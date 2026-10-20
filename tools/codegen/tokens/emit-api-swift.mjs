// Component API declarations (api-declarations.mjs) -> ComponentAPI.swift beside the Swift token
// tiers in the Foundation-free `DesignTokens` target (ADR-0011 DEC-87 amendment: the generated
// component API surface), plus `<Name>Glyphs.swift` per icon set (its glyph table). Spelled by the
// token dialect (emit-swift.mjs), so the layout, the `nonisolated public` types and the value
// spellings are the token files' own.
import { swift } from './emit-swift.mjs';
import { renderApiFiles } from './render.mjs';

export const API_FILE_SWIFT = 'ComponentAPI.swift';

/** `{ ComponentAPI.swift: text, <Name>Glyphs.swift: text, … }`. */
export const emitApiSwift = (decls, source) => renderApiFiles(swift, decls, source, API_FILE_SWIFT);
