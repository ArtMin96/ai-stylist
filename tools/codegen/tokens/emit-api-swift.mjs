// Component API declarations (api-declarations.mjs) -> ComponentAPI.swift beside the Swift token
// tiers in the Foundation-free `DesignTokens` target (ADR-0011 DEC-87 amendment: the generated
// component API surface). Spelled by the token dialect (emit-swift.mjs), so the layout, the
// `nonisolated public` types and the value spellings are the token files' own.
import { swift } from './emit-swift.mjs';
import { renderFile } from './render.mjs';

export const API_FILE_SWIFT = 'ComponentAPI.swift';
const TITLE = 'Component API surface: enums, test IDs, merged looks, gallery';

/** `{ ComponentAPI.swift: text }`. */
export const emitApiSwift = (decls, source) => ({
  [API_FILE_SWIFT]: renderFile(swift, decls, source, TITLE),
});
