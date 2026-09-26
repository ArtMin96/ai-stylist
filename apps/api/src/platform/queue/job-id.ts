// Deterministic pg-boss job id from an idempotency key (doc 04 §9.2).
//
// pg-boss v12 job ids are `uuid` and the job table's primary key is (name, id); every insert is
// `ON CONFLICT DO NOTHING`. A job id derived from the key therefore makes a second `send()` with
// the same key on the same queue a no-op for as long as pg-boss retains the job (created, retry,
// active, and completed/failed until `deleteAfterSeconds`). `singletonKey` cannot do this on a
// `standard` queue: v12 only enforces it for the short/singleton/stately/exclusive/key_strict_fifo
// policies or together with `singletonSeconds` (throttling), so it is left free to carry the user
// id for per-user cancellation (doc 06 §8 step 4).
import { createHash } from 'node:crypto';

/** Fixed namespace for name-based (v5, RFC 9562 §5.5) job ids. Never change: ids would drift. */
const JOB_ID_NAMESPACE = Buffer.from('3f0d8f5e6a1b4c7d9e2f0a1b2c3d4e5f', 'hex');

/** UUIDv5 of `key` under JOB_ID_NAMESPACE: the same key always yields the same job id. */
export function jobIdForKey(key: string): string {
  if (key.length === 0) throw new TypeError('idempotency key must be a non-empty string');
  const hash = createHash('sha1').update(JOB_ID_NAMESPACE).update(key, 'utf8').digest();
  const bytes = hash.subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50; // version 5
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // RFC 9562 variant
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
