// Component API declarations (api-declarations.mjs) -> ComponentApi.kt beside the Kotlin token
// tiers in the pure-JVM `:core:designsystem` module (ADR-0011 DEC-87 amendment: the generated
// component API surface). Spelled by the token dialect (emit-kotlin.mjs), so the package, the
// ktlint_official layout and the value spellings are the token files' own.
import { kotlin } from './emit-kotlin.mjs';
import { renderFile } from './render.mjs';

export const API_FILE_KOTLIN = 'ComponentApi.kt';
const TITLE = 'Component API surface: enums, test IDs, merged looks, gallery';

/** `{ ComponentApi.kt: text }`. */
export const emitApiKotlin = (decls, source) => ({
  [API_FILE_KOTLIN]: renderFile(kotlin, decls, source, TITLE),
});
