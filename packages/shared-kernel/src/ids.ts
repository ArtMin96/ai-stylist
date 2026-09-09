// Prefixed ULID identifiers (planning/06 §2: "ULIDs, prefixed — sortable, greppable,
// unambiguous in logs"). Every persisted entity ID is `<prefix>_<26-char ULID>`.
//
// Adding a kind = adding a row here (single-writer registry; consumers import, never copy).
import { ulid as generateUlid } from 'ulid';

export const ID_PREFIXES = {
  /** identity: account principal (`usr_`, doc 06 §4 actor). */
  user: 'usr',
  /** profile: measurements, preferences (`prf_`, doc 06 §3.1). */
  profile: 'prf',
  /** avatar: parametric avatar configuration (`avt_`; no doc-06 example — chosen in P02). */
  avatar: 'avt',
  /** closet: a garment / closet item (`itm_`, doc 06 §2, §3.2). */
  closetItem: 'itm',
  /** outfit: saved or worn outfit (`out_`, doc 06 §2). */
  outfit: 'out',
  /** media: uploaded or derived media asset (`ast_`, doc 06 §2, §3.2). */
  mediaAsset: 'ast',
  /** recommendation: one engine result (`rec_`, doc 06 §2). */
  recommendation: 'rec',
  /** context: snapshot of context facts a recommendation was computed against (`ctx_`, doc 06 §3.4). */
  contextSnapshot: 'ctx',
  /** billing: an entitlement grant (`ent_`, doc 06 §2). */
  entitlement: 'ent',
  /** domain event envelope id / outbox row id (`evt_`, doc 06 §4, §6). */
  event: 'evt',
} as const;

export type IdKind = keyof typeof ID_PREFIXES;
export type IdPrefix = (typeof ID_PREFIXES)[IdKind];

declare const idBrand: unique symbol;

/** A prefixed ULID string branded with the entity kind it identifies. */
export type Id<K extends IdKind> = `${(typeof ID_PREFIXES)[K]}_${string}` & {
  readonly [idBrand]: K;
};

/** Crockford base32 alphabet, 26 chars, first char ≤ 7 (48-bit timestamp fits). */
const ULID_PATTERN = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
const ID_PATTERN = /^([a-z]+)_([0-9A-HJKMNP-TV-Z]{26})$/;

const PREFIX_TO_KIND: ReadonlyMap<string, IdKind> = new Map(
  (Object.keys(ID_PREFIXES) as IdKind[]).map((kind) => [ID_PREFIXES[kind], kind]),
);

export type ParsedId<K extends IdKind = IdKind> = { readonly kind: K; readonly ulid: string };

export type IdParseError =
  | { readonly reason: 'malformed'; readonly value: string }
  | { readonly reason: 'unknown_prefix'; readonly value: string; readonly prefix: string }
  | { readonly reason: 'invalid_ulid'; readonly value: string }
  | {
      readonly reason: 'kind_mismatch';
      readonly value: string;
      readonly expected: IdKind;
      readonly actual: IdKind;
    };

export type IdParseResult<K extends IdKind = IdKind> =
  | { readonly ok: true; readonly id: ParsedId<K> }
  | { readonly ok: false; readonly error: IdParseError };

/** Mint a fresh, time-sortable id for `kind`. */
export function newId<K extends IdKind>(kind: K, seedTime?: number): Id<K> {
  const value = seedTime === undefined ? generateUlid() : generateUlid(seedTime);
  return `${ID_PREFIXES[kind]}_${value}` as Id<K>;
}

/** Build the id string for a known kind + ULID without minting (e.g. from storage). */
export function formatId<K extends IdKind>(kind: K, ulid: string): Id<K> {
  return `${ID_PREFIXES[kind]}_${ulid}` as Id<K>;
}

/**
 * Parse `<prefix>_<ULID>` into its kind and ULID. Never throws: malformed input,
 * unknown prefixes, and (when `expected` is given) the wrong kind come back as a typed error.
 */
export function parseId(value: string): IdParseResult;
export function parseId<K extends IdKind>(value: string, expected: K): IdParseResult<K>;
export function parseId(value: string, expected?: IdKind): IdParseResult {
  const match = ID_PATTERN.exec(value);
  if (match === null) {
    return { ok: false, error: { reason: 'malformed', value } };
  }
  const prefix = match[1] as string;
  const ulid = match[2] as string;
  const kind = PREFIX_TO_KIND.get(prefix);
  if (kind === undefined) {
    return { ok: false, error: { reason: 'unknown_prefix', value, prefix } };
  }
  if (!ULID_PATTERN.test(ulid)) {
    return { ok: false, error: { reason: 'invalid_ulid', value } };
  }
  if (expected !== undefined && kind !== expected) {
    return { ok: false, error: { reason: 'kind_mismatch', value, expected, actual: kind } };
  }
  return { ok: true, id: { kind, ulid } };
}

/** Type guard: `value` is a well-formed id of `kind`. */
export function isId<K extends IdKind>(value: string, kind: K): value is Id<K> {
  return parseId(value, kind).ok;
}
