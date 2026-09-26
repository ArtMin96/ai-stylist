// Durable effect-once guard over `platform_idempotency_keys` (doc 04 §9.2 "consumers also guard with
// a processed-events check where side effects are non-transactional"; P02-T08 lead decision D2).
// pg-boss dedupes an enqueue only while it retains the job (~7 days), so a handler that must never
// repeat its side effect claims the key here, durably, for as long as the caller's retention says.
//
// Semantics (one transaction per call):
// 1. Claim: INSERT the key; ON CONFLICT it only re-claims a row whose `expires_at` has passed.
//    A live row committed by an earlier call ⇒ the effect already ran ⇒ `{ ran: false }`.
// 2. Run the effect while the claim is still uncommitted. A concurrent call with the same key waits
//    for it (bounded by `claimWaitMs`, then IdempotencyKeyBusyError: retry later).
// 3. Effect resolves ⇒ COMMIT: the key is recorded, every later call is a no-op.
//    Effect throws ⇒ ROLLBACK: no row is left behind, so a retry with the same key runs the effect
//    again. A crash or lost connection mid-effect rolls back the same way.
// Guarantee: the key is recorded only together with a completed effect. The one gap is an effect
// that completed while the COMMIT itself failed (connection lost at that instant): the retry runs it
// again, so provider calls still pass their own idempotency key where the provider supports one.
//
// Translation only: which key, scope and retention a consumer uses is decided by the caller.
// Logs: none here; errors carry no key, scope or payload.
import type { Sql } from 'postgres';

/** One guarded effect. */
export type IdempotentEffectRequest = {
  /** Unique key of the effect, e.g. the outbox event id (`evt_…`). */
  readonly key: string;
  /** What the key is unique for, e.g. `job:<queue>`; the same key under another scope conflicts. */
  readonly scope: string;
  /** Seconds the completed key blocks a repeat (integer >= 1). Chosen by the caller, not here. */
  readonly retentionSeconds: number;
  /** Fingerprint of the effect input; a repeat with another value conflicts. Default: scope + key. */
  readonly requestHash?: string;
};

export type IdempotentEffectResult<T> =
  { readonly ran: true; readonly value: T } | { readonly ran: false };

export type PgIdempotencyGuardOptions = {
  /** How long a concurrent call waits for an in-flight claim on the same key, ms. Default 5 000. */
  readonly claimWaitMs?: number;
  /**
   * Upper bound on how long the claim transaction may sit idle while the effect runs, ms: Postgres
   * ends the session (rolling the claim back) after it. Default 900 000, pg-boss's default job
   * `expireInSeconds` (900 s), so a hung handler never holds a key longer than its job may run.
   */
  readonly maxEffectMs?: number;
};

/** The key already completed under another scope or request hash (HTTP analogue: 409). */
export class IdempotencyKeyConflictError extends Error {
  constructor() {
    super('idempotency key already used for a different scope or request');
    this.name = 'IdempotencyKeyConflictError';
  }
}

/** Another call holds the same key and did not finish within `claimWaitMs`. Retry later. */
export class IdempotencyKeyBusyError extends Error {
  constructor() {
    super('idempotency key is claimed by an effect still in flight');
    this.name = 'IdempotencyKeyBusyError';
  }
}

/** SQLSTATE lock_not_available: raised when `lock_timeout` expires. */
const LOCK_NOT_AVAILABLE = '55P03';

export class PgIdempotencyGuard {
  private readonly sql: Sql;
  private readonly claimWaitMs: number;
  private readonly maxEffectMs: number;

  /**
   * `sql` is the pool the composition root opened. The claim holds one connection for the whole
   * effect, so an effect that queries through the same pool needs `max >= 2`.
   */
  constructor(sql: Sql, options: PgIdempotencyGuardOptions = {}) {
    this.sql = sql;
    this.claimWaitMs = positiveInteger(options.claimWaitMs ?? 5_000, 'claimWaitMs');
    this.maxEffectMs = positiveInteger(options.maxEffectMs ?? 900_000, 'maxEffectMs');
  }

  /** Run `effect` at most once per `request.key` (see the file header for the exact semantics). */
  async runOnce<T>(
    request: IdempotentEffectRequest,
    effect: () => Promise<T>,
  ): Promise<IdempotentEffectResult<T>> {
    const { key, scope } = request;
    if (key.length === 0 || scope.length === 0) {
      throw new TypeError('PgIdempotencyGuard: key and scope must be non-empty');
    }
    const retentionSeconds = positiveInteger(request.retentionSeconds, 'retentionSeconds');
    const requestHash = request.requestHash ?? `${scope}\n${key}`;
    const lockTimeout = `${this.claimWaitMs}ms`;
    const idleTimeout = `${this.maxEffectMs}ms`;

    return this.sql.begin(async (tx): Promise<IdempotentEffectResult<T>> => {
      await tx`select set_config('lock_timeout', ${lockTimeout}, true),
        set_config('idle_in_transaction_session_timeout', ${idleTimeout}, true)`;
      let claimed: readonly unknown[];
      try {
        claimed = await tx`
          insert into platform_idempotency_keys (key, scope, request_hash, expires_at)
          values (${key}, ${scope}, ${requestHash},
                  now() + make_interval(secs => ${retentionSeconds}))
          on conflict (key) do update
            set scope = excluded.scope,
                request_hash = excluded.request_hash,
                response_hash = null,
                created_at = now(),
                expires_at = excluded.expires_at
            where platform_idempotency_keys.expires_at <= now()
          returning key`;
      } catch (error) {
        if (isLockTimeout(error)) {
          throw new IdempotencyKeyBusyError();
        }
        throw error;
      }
      if (claimed.length === 0) {
        const [existing] = await tx<{ scope: string; request_hash: string }[]>`
          select scope, request_hash from platform_idempotency_keys where key = ${key}`;
        if (existing?.scope !== scope || existing.request_hash !== requestHash) {
          throw new IdempotencyKeyConflictError();
        }
        return { ran: false };
      }
      return { ran: true, value: await effect() };
    });
  }
}

function isLockTimeout(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === LOCK_NOT_AVAILABLE
  );
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`PgIdempotencyGuard: ${name} must be an integer >= 1, got ${value}`);
  }
  return value;
}
