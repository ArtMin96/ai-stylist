// DESIGN.md text -> findings, or the in-memory DTCG model (DEC-87 stages 1 and 2: validate, then
// normalise in memory). The pinned design.md lint (TK-12) runs beside it in the CLI because it
// needs a file on disk. The emitters (emit-swift.mjs, emit-kotlin.mjs) consume `model`.
import { normalise } from './normalise.mjs';
import { parseDesignMd } from './parse.mjs';
import { validate } from './validate.mjs';

/** `{ findings, model }`: `model` is present only when there are no findings. */
export function loadTokens(text) {
  const parsed = parseDesignMd(text);
  if (parsed.findings.length > 0) return { findings: parsed.findings };
  const findings = validate(parsed);
  if (findings.length > 0) return { findings };
  return { findings: [], model: normalise(parsed.frontmatter) };
}

/** One finding as the CLI prints it. */
export const formatFinding = ({ rule, at, message }) => `${rule} ${at}: ${message}`;
