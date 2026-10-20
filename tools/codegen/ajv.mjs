// The JSON Schema validator the generators share: Ajv for draft 2020-12 (strict, every error) with
// ajv-formats, both resolved from the packages/contracts devDependencies so every generator uses
// the one pinned copy. Used by gen-kernel.mjs (the shared-kernel registry schemas) and
// tokens/contracts.mjs (the component contract schema).
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** `require` that resolves from packages/contracts (ajv, ajv-formats, the contract files). */
export const requireFromContracts = createRequire(
  path.join(ROOT, 'packages/contracts/package.json'),
);

/** A strict draft 2020-12 Ajv that reports every error, with the standard formats. */
export async function createAjv() {
  const load = (id) => import(pathToFileURL(requireFromContracts.resolve(id)).href);
  const [{ Ajv2020 }, { default: addFormats }] = await Promise.all([
    load('ajv/dist/2020.js'),
    load('ajv-formats'),
  ]);
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  return ajv;
}
