// .impeccable/components/<id>.yaml -> checked component contracts and their API models
// (ADR-0011 follow-up 7, DEC-87; field rules: .impeccable/components/README.md). CC-01 parses the
// YAML and checks it against component-contract.schema.json with the generators' shared Ajv
// (../ajv.mjs: draft 2020-12 + ajv-formats from the packages/contracts devDependencies, as
// gen-kernel.mjs uses it). A contract without `kind` is a control (the button): CC-02 to CC-08
// check its fields against each other and against the in-memory token model, and
// contract-model.mjs then merges the looks. `kind: icon-set` (C02) runs CC-02 and CC-09 to CC-11
// (icon-set.mjs) instead. Rules: tools/codegen/tokens/README.md, "Component contracts" and
// "Icon sets".
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { parseDocument } from 'yaml';

import { createAjv } from '../ajv.mjs';
import {
  BASE_STATE,
  ICON_SLOT,
  allowedCombinations,
  buildApi,
  comboKey,
  finding,
  identifierFindings,
  isToken,
  resolveReference,
  slotEntryOf,
  tableContexts,
} from './contract-model.mjs';
import { contextsOf, typedValue } from './declarations.mjs';
import { ICON_SET_STAGES, buildIconSet, isIconSet } from './icon-set.mjs';
import { testIdName } from './naming.mjs';
import { resolveComponents } from './normalise.mjs';
import { CONTEXTS, isColourProperty } from './syntax.mjs';

const SCHEMA_FILE = path.join(import.meta.dirname, 'component-contract.schema.json');
const ajv = await createAjv();
const validateSchema = ajv.compile(JSON.parse(readFileSync(SCHEMA_FILE, 'utf8')));

const isContractFile = (name) => name.endsWith('.yaml');

/**
 * Every `*.yaml` contract in `dir`, in file-name order, checked against the token `model`:
 * `{ findings, apis, pending }`. `apis` holds one API model per approved contract; `pending` names
 * the files still `approved: pending`, which are checked but get no API (README step 4: the owner
 * approves a contract before the generator emits it and both lanes build against it).
 */
export function loadContracts(dir, model) {
  let files;
  try {
    files = readdirSync(dir).filter(isContractFile).sort();
  } catch (err) {
    const where = path.basename(dir);
    return { findings: [finding('CC-01', where, `cannot read: ${err.message}`)], apis: [] };
  }
  const result = { findings: [], apis: [], pending: [] };
  for (const file of files) {
    const text = readFileSync(path.join(dir, file), 'utf8');
    const { findings, api, pending } = checkContract(text, file, model);
    result.findings.push(...findings);
    if (pending) result.pending.push(file);
    else if (api) result.apis.push(api);
  }
  return result;
}

/**
 * One contract's text -> `{ findings }`, or `{ findings: [], api, pending }`. The rules run in
 * stages and stop at the first stage with a finding, so a later rule never reports what an earlier
 * one already explains (each fixture fails on its own rule only).
 */
export function checkContract(text, file, model) {
  const parsed = parseContract(text, file);
  if (parsed.findings.length > 0) return { findings: parsed.findings };
  const { contract } = parsed;
  const iconSet = isIconSet(contract);
  const stages = (iconSet ? iconSetStages : controlStages)(contract, file, model);
  for (const stage of stages) {
    const findings = stage();
    if (findings.length > 0) return { findings };
  }
  const { findings, api } = (iconSet ? buildIconSet : buildApi)(contract, file, model);
  if (findings.length > 0) return { findings };
  return { findings: [], api, pending: contract.approved === 'pending' };
}

/** A control contract (no `kind`: the button): CC-02 to CC-08, in their stages. */
const controlStages = (contract, file, model) => [
  () => [...checkId(contract, file), ...checkAxes(contract, file)],
  () => [...checkTokenShape(contract, file), ...checkUsage(contract, file)],
  () => checkReferences(contract, file, model),
  () => checkRoles(contract, file, model),
  () => checkIconSlot(contract, file, model),
];

/** An icon set (`kind: icon-set`): CC-02 with CC-09, then CC-10, then CC-11 (icon-set.mjs). */
function iconSetStages(contract, file, model) {
  const [glyphIds, ...rest] = ICON_SET_STAGES;
  return [
    () => [...checkId(contract, file), ...glyphIds(contract, file, model)],
    ...rest.map((stage) => () => stage(contract, file, model)),
  ];
}

/**
 * CC-01: the YAML parses (no duplicate keys) and matches component-contract.schema.json. The
 * schema picks the control or the icon-set branch with `if`; that keyword's own "must match" error
 * is left out, since the branch's errors say what is wrong.
 */
function parseContract(text, file) {
  const doc = parseDocument(text, { uniqueKeys: true, prettyErrors: false });
  if (doc.errors.length > 0) {
    return {
      findings: doc.errors.map((e) => finding('CC-01', file, `YAML: ${e.message.split('\n')[0]}`)),
    };
  }
  const contract = doc.toJS();
  if (validateSchema(contract)) return { findings: [], contract };
  const where = (pointer) => (pointer ? `${file} ${pointer.slice(1).replace(/\//g, '.')}` : file);
  return {
    findings: (validateSchema.errors ?? [])
      .filter((e) => e.keyword !== 'if')
      .map((e) =>
        finding('CC-01', where(e.instancePath), `${e.message} ${JSON.stringify(e.params)}`),
      ),
  };
}

/** CC-02: `id` is the file name without `.yaml`. */
function checkId(contract, file) {
  const expected = path.basename(file, '.yaml');
  if (contract.id === expected) return [];
  return [finding('CC-02', `${file} id`, `"${contract.id}" is not the file name "${expected}"`)];
}

/**
 * CC-03: the axes agree. `combinations` names exactly the variants; each allows only listed sizes
 * and states; every listed size and state is allowed somewhere; ids and test-ID constants become
 * distinct identifiers that are no Swift or Kotlin keyword.
 */
function checkAxes(contract, file) {
  const at = (where) => `${file} ${where}`;
  const out = sameKeys(contract.combinations, contract.variants, at('combinations'), 'CC-03');
  const axes = [
    ['sizes', 'size'],
    ['states', 'state'],
  ];
  for (const [variant, allowed] of Object.entries(contract.combinations)) {
    for (const [list, noun] of axes) {
      for (const id of allowed[list].filter((x) => !contract[list].includes(x))) {
        const message = `${noun} "${id}" is not in \`${list}\``;
        out.push(finding('CC-03', at(`combinations.${variant}.${list}`), message));
      }
    }
  }
  for (const [list, noun] of axes) {
    const used = new Set(Object.values(contract.combinations).flatMap((c) => c[list]));
    for (const id of contract[list].filter((x) => !used.has(x))) {
      out.push(finding('CC-03', at(list), `${noun} "${id}" is allowed by no variant`));
    }
  }
  for (const list of ['variants', 'sizes', 'states']) {
    out.push(...identifierFindings(contract[list], at(list), 'id', 'CC-03'));
  }
  const constants = allowedCombinations(contract).map(testIdName);
  out.push(...identifierFindings(constants, at('combinations'), 'test-ID constant', 'CC-03'));
  return out;
}

/** A finding for every expected key `object` lacks and every key it has that is not expected. */
function sameKeys(object, expected, at, rule) {
  const keys = Object.keys(object);
  return [
    ...expected
      .filter((id) => !keys.includes(id))
      .map((id) => finding(rule, at, `has no entry for "${id}"`)),
    ...keys
      .filter((id) => !expected.includes(id))
      .map((id) => finding(rule, at, `names "${id}", which is not listed`)),
  ];
}

/**
 * CC-04: `tokens` has one entry per variant; its `sizes` name exactly the variant's allowed sizes,
 * and its `states` only allowed states other than the base state (the base entry is that look).
 */
function checkTokenShape(contract, file) {
  const out = sameKeys(contract.tokens, contract.variants, `${file} tokens`, 'CC-04');
  for (const [variant, tokens] of Object.entries(contract.tokens)) {
    const allowed = contract.combinations[variant];
    if (!allowed) continue;
    const at = (list) => `${file} tokens.${variant}.${list}`;
    out.push(...sameKeys(tokens.sizes, allowed.sizes, at('sizes'), 'CC-04'));
    for (const state of Object.keys(tokens.states)) {
      if (state === BASE_STATE) {
        const message = `"${BASE_STATE}" is the base entry's look; it takes no state entry`;
        out.push(finding('CC-04', at('states'), message));
      } else if (!allowed.states.includes(state)) {
        out.push(finding('CC-04', at('states'), `"${state}" is not allowed for ${variant}`));
      }
    }
  }
  return out;
}

/** CC-07: `accessibility.busy` is a state; an explicit gallery names only allowed combinations. */
function checkUsage(contract, file) {
  const out = [];
  const { busy } = contract.accessibility;
  if (!contract.states.includes(busy)) {
    const message = `"${busy}" is not in \`states\``;
    out.push(finding('CC-07', `${file} accessibility.busy`, message));
  }
  const { include } = contract.gallery;
  if (include === 'all') return out;
  const allowed = new Set(allowedCombinations(contract).map(comboKey));
  include.forEach((item, i) => {
    if (allowed.has(comboKey(item))) return;
    const message = `${comboKey(item)} is not an allowed combination`;
    out.push(finding('CC-07', `${file} gallery.include.${i}`, message));
  });
  return out;
}

/** CC-05: every `{components.…}` reference resolves in the token model, `{props.…}` to a prop. */
function checkReferences(contract, file, model) {
  const out = [];
  for (const { at, reference } of referencesOf(contract, file)) {
    if (resolveReference(reference, model)) continue;
    const message = `${reference} is neither a DESIGN.md component nor a state of one`;
    out.push(finding('CC-05', at, message));
  }
  const prop = contract.accessibility.label.slice('{props.'.length, -1);
  if (!contract.props.some(({ name }) => name === prop)) {
    const message = `${contract.accessibility.label} names no prop`;
    out.push(finding('CC-05', `${file} accessibility.label`, message));
  }
  return out;
}

function referencesOf(contract, file) {
  return Object.entries(contract.tokens).flatMap(([variant, tokens]) => {
    const at = (where) => `${file} tokens.${variant}.${where}`;
    const entries = (group, list) =>
      Object.entries(group).map(([key, reference]) => ({ at: at(`${list}.${key}`), reference }));
    return [
      { at: at('base'), reference: tokens.base },
      ...entries(tokens.states, 'states'),
      ...entries(tokens.sizes, 'sizes'),
    ];
  });
}

/**
 * CC-06: each reference plays its part. A base is a whole component. A state names that state of
 * the variant's base, or a whole component drawn over the base look (an overlay: `focus-ring`)
 * with an instance in every context of the table. A size is the base itself or a shared size
 * entry: a whole component with no colour and no state.
 */
function checkRoles(contract, file, model) {
  const out = [];
  const contexts = tableContexts(contract, model);
  for (const [variant, tokens] of Object.entries(contract.tokens)) {
    const at = (where) => `${file} tokens.${variant}.${where}`;
    const base = resolveReference(tokens.base, model);
    if (base.state !== null) {
      out.push(finding('CC-06', at('base'), `${tokens.base} is a state; a base is a component`));
      continue;
    }
    for (const [state, reference] of Object.entries(tokens.states)) {
      const r = resolveReference(reference, model);
      if (r.state === null) {
        const missing = contexts.filter((c) => !contextsOf(r.component).includes(c));
        if (missing.length === 0) continue;
        const message = `${reference} has no instance for ${missing.join(', ')}`;
        out.push(finding('CC-06', at(`states.${state}`), message));
      } else if (r.component !== base.component || r.state !== state) {
        const message = `${reference} is not the ${state} state of {components.${base.component}}`;
        out.push(finding('CC-06', at(`states.${state}`), message));
      }
    }
    for (const [size, reference] of Object.entries(tokens.sizes)) {
      const r = resolveReference(reference, model);
      if (r.state === null && (r.component === base.component || isSizeEntry(r.component, model))) {
        continue;
      }
      const message = `${reference} is neither the base nor a size entry (no colour, no state)`;
      out.push(finding('CC-06', at(`sizes.${size}`), message));
    }
  }
  return out;
}

/** A whole component that holds no colour property in any context and no state. */
function isSizeEntry(component, model) {
  return CONTEXTS.every((context) => {
    const group = resolveComponents(model, context)[component];
    return Object.entries(group).every(([key, node]) => isToken(node) && !isColourProperty(key));
  });
}

/**
 * CC-08: every size an allowed combination uses has its shared size entry `<id>-<size>`, and that
 * entry holds the icon slot (ICON_SLOT: `iconSize`, `iconGap`) as dimensions in every context of
 * the table. The slot depends on the size only, so a missing value is a finding, never a default.
 */
function checkIconSlot(contract, file, model) {
  const out = [];
  const resolved = tableContexts(contract, model).map((c) => resolveComponents(model, c));
  const sizes = new Set(allowedCombinations(contract).map(({ size }) => size));
  for (const size of contract.sizes.filter((s) => sizes.has(s))) {
    const entry = slotEntryOf(contract.id, size);
    const at = `${file} sizes.${size}`;
    if (!Object.hasOwn(model.sets.components, entry)) {
      out.push(finding('CC-08', at, `no {components.${entry}} holds the ${size} icon slot`));
      continue;
    }
    const missing = ICON_SLOT.filter((name) =>
      resolved.some((components) => {
        const node = components[entry]?.[name];
        return !node || !isToken(node) || typedValue(node).type !== 'double';
      }),
    );
    if (missing.length === 0) continue;
    const message = `{components.${entry}} has no ${missing.join(' or ')} dimension`;
    out.push(finding('CC-08', at, message));
  }
  return out;
}
