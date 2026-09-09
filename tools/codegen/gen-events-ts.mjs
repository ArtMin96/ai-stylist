#!/usr/bin/env node
// JSON Schema (packages/contracts/events/**/*.json with a `$schema` key) -> gen/events-ts/index.ts
// via json-schema-to-typescript. Deterministic: schemas are compiled in sorted path order.
// Invoked by tools/codegen/gen-ts.sh with cwd = packages/contracts.
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
// Resolve the generator from the contracts package (its devDependency), not from tools/.
const requireFromContracts = createRequire(path.join(root, 'package.json'));
const { compile } = await import(
  pathToFileURL(requireFromContracts.resolve('json-schema-to-typescript')).href
);

const BANNER = [
  '// GENERATED — do not edit. Run `just generate`.',
  '// Source: packages/contracts/events/**/*.json (JSON Schema 2020-12)',
  '',
].join('\n');

const eventsDir = path.join(root, 'events');
const outDir = path.join(root, 'gen', 'events-ts');

async function* walk(dir) {
  const entries = (await readdir(dir, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name, 'en'),
  );
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && entry.name.endsWith('.json')) yield full;
  }
}

const schemaFiles = [];
for await (const file of walk(eventsDir)) {
  const doc = JSON.parse(await readFile(file, 'utf8'));
  if (typeof doc.$schema === 'string') schemaFiles.push({ file, doc });
}
schemaFiles.sort((a, b) => a.file.localeCompare(b.file, 'en'));

const chunks = [BANNER];
for (const { file, doc } of schemaFiles) {
  const rel = path.relative(root, file).split(path.sep).join('/');
  const name = doc.title ?? path.basename(file, '.json');
  // `examples` are data, not types; drop them so they cannot influence the output.
  const { examples: _examples, ...schema } = doc;
  const ts = await compile(schema, name, {
    cwd: path.dirname(file),
    bannerComment: `// ---- ${rel} ----`,
    additionalProperties: false,
    declareExternallyReferenced: true,
    strictIndexSignatures: true,
    style: { singleQuote: true, printWidth: 100, trailingComma: 'all', semi: true },
  });
  chunks.push(ts.trimEnd(), '');
}

await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, 'index.ts'), chunks.join('\n'));
