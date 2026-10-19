// DESIGN.md -> { frontmatter, body }, the YAML frontmatter parsed by `yaml` (eemeli/yaml, a root
// devDependency). Parse problems are TK-01 findings, never exceptions.
import { parseDocument } from 'yaml';

import { isPlainObject } from './syntax.mjs';

const FRONTMATTER = /^---\n([\s\S]*?)\n---(?:\n|$)/;

/** Splits and parses one DESIGN.md text; `findings` holds the TK-01 parse errors. */
export function parseDesignMd(text) {
  const normalised = text.replace(/\r\n?/g, '\n');
  const match = FRONTMATTER.exec(normalised);
  if (!match) {
    return {
      frontmatter: null,
      body: normalised,
      findings: [finding('the file does not start with a `---` YAML frontmatter block')],
    };
  }
  const body = normalised.slice(match[0].length);
  const doc = parseDocument(match[1], { uniqueKeys: true, prettyErrors: false });
  if (doc.errors.length > 0) {
    return {
      frontmatter: null,
      body,
      findings: doc.errors.map((e) => finding(`YAML: ${e.message.split('\n')[0]}`)),
    };
  }
  const frontmatter = doc.toJS();
  if (!isPlainObject(frontmatter)) {
    return {
      frontmatter: null,
      body,
      findings: [finding('the frontmatter is not a YAML mapping')],
    };
  }
  return { frontmatter, body, findings: [] };
}

const finding = (message) => ({ rule: 'TK-01', at: 'frontmatter', message });
