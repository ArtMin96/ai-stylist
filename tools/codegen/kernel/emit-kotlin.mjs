// shared-kernel registries -> Kotlin (package app.aistylist.contracts.kernel, written next to the
// analytics taxonomy under packages/contracts/gen/kotlin-client/kernel). Enums carry their wire
// `value` and a `fromValue` lookup; plain constants are `const val` in an object.
import {
  assertUniqueIds,
  captureHintKinds,
  docText,
  int,
  isIntKey,
  isNumberBlock,
  ktStr,
  num,
  pascal,
  src,
  stripCapHint,
  stripRc,
  upperSnake,
} from './naming.mjs';

const banner = (name) =>
  [
    '// GENERATED — run `just generate` (tools/codegen/gen-kernel.mjs). DO NOT EDIT BY HAND.',
    `// Source: ${src(name)}`,
    'package app.aistylist.contracts.kernel',
    '',
  ].join('\n');

const ktEnum = ({ doc, name, cases, props = [] }) => {
  assertUniqueIds(name, cases);
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
  const errorCodes = reg['error-codes'];
  const measurements = reg['measurement-definitions'];
  const shapes = reg['starting-shapes'];
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
        {
          name: 'levels',
          type: 'List<String>',
          value: (c) => `listOf(${(c.def.levels ?? []).map(ktStr).join(', ')})`,
        },
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

  out['ErrorCodes.kt'] = [
    banner('error-codes'),
    ktEnum({
      doc: 'Error code (planning/06 §2): the stable `code` of an RFC 9457 problem the API answers, with its HTTP `status`, its RFC 9457 `title` and its `description` (registry text, not UI copy). A newer server can send a code this build lacks, so a null `fromValue` is a case to handle.',
      name: 'ErrorCode',
      // A code is already SCREAMING_SNAKE (schema pattern), so it is the entry name as written.
      cases: Object.entries(errorCodes.codes).map(([code, def]) => ({
        id: code,
        raw: code,
        doc: def.description,
        def,
      })),
      props: [
        { name: 'status', type: 'Int', value: (c) => int(c.def.status) },
        { name: 'title', type: 'String', value: (c) => ktStr(c.def.title) },
        describe,
      ],
    }),
    '',
  ].join('\n');

  out['MeasurementDefinitions.kt'] = [
    banner('measurement-definitions'),
    ktEnum({
      doc: 'Body measurement (planning/07 §3.3) with its `dimension`, the raw value of its stored `unit` (the canonical unit of the dimension) and its hard bounds `minimum` and `maximum` in that unit (registry `min` and `max`; the names match Swift, where `min` would shadow `min(_:_:)`). Both bounds are inclusive: a value equal to one is accepted. Outside them the API answers `MEASUREMENT_IMPLAUSIBLE` and never stores or clamps the value.',
      name: 'MeasurementId',
      cases: Object.entries(measurements.measurements).map(([id, def]) => ({
        id: upperSnake(id),
        raw: id,
        def,
      })),
      props: [
        {
          name: 'dimension',
          type: 'MeasurementDimension',
          value: (c) => `MeasurementDimension.${upperSnake(c.def.dimension)}`,
        },
        { name: 'unit', type: 'String', value: (c) => ktStr(c.def.unit) },
        { name: 'minimum', type: 'Double', value: (c) => num(c.def.min) },
        { name: 'maximum', type: 'Double', value: (c) => num(c.def.max) },
      ],
    }),
    '',
  ].join('\n');

  out['StartingShapes.kt'] = [
    banner('starting-shapes'),
    ktEnum({
      doc: 'Avatar starting shape offered at onboarding (planning/07 §3.1), in display order. The entry docs are registry text, not UI copy.',
      name: 'StartingShape',
      cases: Object.entries(shapes.shapes).map(([id, def]) => ({
        id: upperSnake(id),
        raw: id,
        doc: def.description,
      })),
    }),
    '',
    '/** Starting-shape constants (planning/07 §3.1). */',
    'object StartingShapes {',
    '    /** The shape preselected when the person makes no choice. */',
    `    val DEFAULT_SHAPE: StartingShape = StartingShape.${upperSnake(shapes.default)}`,
    '',
    '    /** Base mesh id every starting shape starts from. */',
    `    const val BASE_MESH: String = ${ktStr(shapes.baseMesh)}`,
    '}',
    '',
  ].join('\n');

  out['CaptureRules.kt'] = emitCaptureRules(reg['capture-rules']);
  return out;
}

const hintEntry = (key) => upperSnake(stripCapHint(key));
const optional = (value, render) => (value === undefined ? 'null' : render(value));
const captureConstant = (k, v) =>
  `const val ${upperSnake(k)}: ${isIntKey(k) ? `Int = ${v}` : `Double = ${num(v)}`}`;

function emitCaptureRules(cr) {
  return [
    banner('capture-rules'),
    ktEnum({
      doc: 'How the item is photographed (capture brief §2).',
      name: 'CaptureMode',
      cases: simpleCases(cr.captureModes),
    }),
    '',
    ktEnum({
      doc: 'Blocking check that keeps the shutter locked, highest priority first (capture brief §4).',
      name: 'CaptureLockReason',
      cases: simpleCases(cr.lockReasons),
    }),
    '',
    ktEnum({
      doc: 'Body keypoint read by the worn-mode body check (capture brief §3).',
      name: 'CaptureBodyPart',
      cases: simpleCases(cr.bodyParts),
    }),
    '',
    ktEnum({
      doc: 'Hint class: blocking (shutter locked), advisory (never locks) or status.',
      name: 'CaptureHintKind',
      cases: simpleCases(captureHintKinds(cr)),
    }),
    '',
    ktEnum({
      doc: 'Hint key, also the hint label test ID, in priority order (capture brief §6).',
      name: 'CaptureHint',
      cases: Object.entries(cr.hints).map(([key, def]) => ({ id: hintEntry(key), raw: key, def })),
      props: [
        {
          name: 'kind',
          type: 'CaptureHintKind',
          value: (c) => `CaptureHintKind.${upperSnake(c.def.kind)}`,
        },
        {
          name: 'lockReason',
          type: 'CaptureLockReason?',
          value: (c) => optional(c.def.lockReason, (r) => `CaptureLockReason.${upperSnake(r)}`),
        },
      ],
    }),
    '',
    ktEnum({
      doc: 'Shape family picked before capture (capture brief §2); not a closet taxonomy id.',
      name: 'CaptureShapeFamily',
      cases: Object.entries(cr.families).map(([id, def]) => ({ id: upperSnake(id), raw: id, def })),
      props: [
        { name: 'minAreaShare', type: 'Double', value: (c) => num(c.def.minAreaShare) },
        {
          name: 'modes',
          type: 'List<CaptureMode>',
          value: (c) =>
            `listOf(${c.def.modes.map((m) => `CaptureMode.${upperSnake(m)}`).join(', ')})`,
        },
        {
          name: 'wornRequiredParts',
          type: 'List<CaptureBodyPart>',
          value: (c) =>
            `listOf(${c.def.wornRequiredParts.map((p) => `CaptureBodyPart.${upperSnake(p)}`).join(', ')})`,
        },
        {
          name: 'wornHint',
          type: 'CaptureHint?',
          value: (c) => optional(c.def.wornHint, (h) => `CaptureHint.${hintEntry(h)}`),
        },
      ],
    }),
    '',
    '/** Live-check thresholds, counts and timings (capture brief §3-§5). MS = milliseconds. */',
    'object CaptureRules {',
    ...Object.entries(cr)
      .filter(([, v]) => typeof v === 'number')
      .map(([k, v]) => `    ${captureConstant(k, v)}`),
    ...Object.entries(cr)
      .filter(([, v]) => isNumberBlock(v))
      .flatMap(([block, values]) => [
        '',
        `    object ${pascal(block)} {`,
        ...Object.entries(values).map(([k, v]) => `        ${captureConstant(k, v)}`),
        '    }',
      ]),
    '}',
    '',
  ].join('\n');
}
