// Component API declarations (api-declarations.mjs) -> ComponentApi.kt beside the Kotlin token
// tiers in the pure-JVM `:core:designsystem` module (ADR-0011 DEC-87 amendment: the generated
// component API surface), plus `<Name>Glyphs.kt` per icon set (its glyph table, named after its
// one top-level object). Spelled by the token dialect (emit-kotlin.mjs), so the package, the
// ktlint_official layout and the value spellings are the token files' own.
import { kotlin } from './emit-kotlin.mjs';
import { renderApiFiles } from './render.mjs';

export const API_FILE_KOTLIN = 'ComponentApi.kt';

/** `{ ComponentApi.kt: text, <Name>Glyphs.kt: text, … }`. */
export const emitApiKotlin = (decls, source) =>
  renderApiFiles(kotlin, decls, source, API_FILE_KOTLIN);
