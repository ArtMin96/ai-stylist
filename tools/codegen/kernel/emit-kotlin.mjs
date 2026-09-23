// shared-kernel registries -> Kotlin (package app.aistylist.contracts.kernel, written next to the
// analytics taxonomy under packages/contracts/gen/kotlin-client/kernel). Enums carry their wire
// `value` and a `fromValue` lookup; plain constants are `const val` in an object.
import { docText, ktStr, num, pascal, src, stripRc, upperSnake } from './naming.mjs';

const banner = (name) =>
  [
    '// GENERATED — run `just generate` (tools/codegen/gen-kernel.mjs). DO NOT EDIT BY HAND.',
    `// Source: ${src(name)}`,
    'package app.aistylist.contracts.kernel',
    '',
  ].join('\n');

const ktEnum = ({ doc, name, cases, props = [] }) => {
  const params = ['val value: String', ...props.map((p) => `val ${p.name}: ${p.type}`)];
  const lines = [`/** ${docText(doc)} */`, `enum class ${name}(${params.join(', ')}) {`];
  cases.forEach((c, i) => {
    if (c.doc) lines.push(`    /** ${docText(c.doc)} */`);
    const args = [ktStr(c.raw), ...props.map((p) => p.value(c))].join(', ');
    lines.push(`    ${c.id}(${args})${i === cases.length - 1 ? ';' : ','}`);
  });
  if (cases.length === 0) lines.push('    ;');
  lines.push(
    '',
    '    companion object {',
    '        /** The entry whose wire value is [value], or null. */',
    `        fun fromValue(value: String): ${name}? = entries.firstOrNull { it.value == value }`,
    '    }',
    '}',
  );
  return lines.join('\n');
};
const simpleCases = (values) => values.map((v) => ({ id: upperSnake(v), raw: v }));
const describe = { name: 'description', type: 'String', value: (c) => ktStr(c.def.description) };

export function emitKotlin(reg) {
  const rc = reg['reason-codes'];
  const ent = reg.entitlements;
  const units = reg.units;
  const out = {};

  out['ReasonCodes.kt'] = [
    banner('reason-codes'),
    ktEnum({
      doc: 'Reason-code namespace (planning/09 §7).',
      name: 'ReasonCodeNamespace',
      cases: rc.namespaces.map((n) => ({
        id: upperSnake(stripRc(n.name)),
        raw: n.name,
        doc: n.note,
      })),
    }),
    '',
    ktEnum({
      doc: 'Pipeline stage (planning/09 §2) that may emit a reason code.',
      name: 'ReasonCodeStage',
      cases: simpleCases(rc.stages),
    }),
    '',
    ktEnum({
      doc: 'Recommendation reason code (planning/09 §7): a stable identifier emitted while deciding; explanations are templated from it.',
      name: 'ReasonCode',
      cases: Object.entries(rc.codes).map(([code, def]) => ({
        id: upperSnake(stripRc(code)),
        raw: code,
        doc: def.description,
        def,
      })),
      props: [
        {
          name: 'namespace',
          type: 'ReasonCodeNamespace',
          value: (c) => `ReasonCodeNamespace.${upperSnake(stripRc(c.def.namespace))}`,
        },
        {
          name: 'stage',
          type: 'ReasonCodeStage',
          value: (c) => `ReasonCodeStage.${upperSnake(c.def.stage)}`,
        },
        {
          name: 'params',
          type: 'List<String>',
          value: (c) => `listOf(${c.def.params.map(ktStr).join(', ')})`,
        },
        describe,
      ],
    }),
    '',
  ].join('\n');

  out['Entitlements.kt'] = [
    banner('entitlements'),
    ktEnum({
      doc: 'Value kind of an entitlement (planning/12 §3.1).',
      name: 'EntitlementValueKind',
      cases: simpleCases(ent.kinds),
    }),
    '',
    ktEnum({
      doc: 'Entitlement name (planning/12 §3.1): the only entitlement identifiers.',
      name: 'EntitlementName',
      cases: Object.entries(ent.entitlements).map(([name, def]) => ({
        id: upperSnake(name),
        raw: name,
        doc: def.description,
        def,
      })),
      props: [
        {
          name: 'kind',
          type: 'EntitlementValueKind',
          value: (c) => `EntitlementValueKind.${upperSnake(c.def.kind)}`,
        },
        describe,
      ],
    }),
    '',
    ktEnum({
      doc: 'Weighted generative task metered against `credits.monthly` (planning/12 §3.3).',
      name: 'CreditMeter',
      cases: simpleCases(ent.creditMeters),
    }),
    '',
  ].join('\n');

  const dims = Object.entries(units.dimensions);
  out['Units.kt'] = [
    banner('units'),
    ...dims.flatMap(([d, def]) => [
      ktEnum({
        doc: `Canonical ${d} unit(s) (planning/06 §2): the API stores and returns SI.`,
        name: `${pascal(d)}Unit`,
        cases: simpleCases(def.units),
      }),
      '',
    ]),
    ktEnum({
      doc: 'Measurement dimension (TS `Dimension`).',
      name: 'MeasurementDimension',
      cases: dims.map(([d, def]) => ({ id: upperSnake(d), raw: d, def })),
      props: [{ name: 'canonicalUnit', type: 'String', value: (c) => ktStr(c.def.canonical) }],
    }),
    '',
    '/** Canonical (stored) unit per dimension. */',
    'object CanonicalUnits {',
    ...dims.map(
      ([d, def]) =>
        `    val ${upperSnake(d)}: ${pascal(d)}Unit = ${pascal(d)}Unit.${upperSnake(def.canonical)}`,
    ),
    '}',
    '',
    ktEnum({
      doc: 'Display unit system selectable in the profile (planning/06 §3.1 `locale.unitSystem`).',
      name: 'UnitSystem',
      cases: simpleCases(units.unitSystems),
    }),
    '',
    ktEnum({
      doc: 'Who produced a measurement value (planning/06 §3.1): estimated/derived values must carry confidence.',
      name: 'MeasurementSource',
      cases: simpleCases(units.measurementSources),
    }),
    '',
    '/** Exact display-conversion factors (planning/06 §3.1); storage stays SI. */',
    'object ConversionFactors {',
    ...Object.entries(units.conversionFactors).map(
      ([k, v]) => `    const val ${upperSnake(k)}: Double = ${num(v)}`,
    ),
    '}',
    '',
  ].join('\n');
  return out;
}
