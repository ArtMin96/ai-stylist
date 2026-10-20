// SVG path data (a `d` attribute, SVG 2 "Paths" grammar) -> the four absolute commands the icon
// glyph table holds: `move`, `line`, `cubic` and `close` (C02 icons, Linear AI-201). Every command
// is read, absolute and relative: M L H V C S Q T A Z. Quadratics (Q, T) become their exact cubics;
// arcs (A) become one cubic per quarter turn or less (SVG 2 appendix B.2.4, endpoint to centre
// parameterisation). Points are rounded to ROUND_DIGITS decimals in viewBox units, so both
// languages spell the same numbers (`num` in naming.mjs). Pure: no I/O.
// tools/codegen/tokens/README.md, "Icon sets".

/** The emitted commands, in the order the generated `<Name>Command` enum lists them. */
export const PATH_COMMANDS = ['move', 'line', 'cubic', 'close'];

/** Decimals kept in every emitted coordinate (0.001 of a 24-unit viewBox). */
export const ROUND_DIGITS = 3;

/** Arguments per command letter; A takes its two flags as arguments 3 and 4. */
const ARITY = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
const ARC_FLAGS = [3, 4];
const NUMBER = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
const WHITESPACE = /[ \t\r\n\f]/;
const QUARTER_TURN = Math.PI / 2;
/** Turns a hair over a multiple of a quarter (float noise) do not add a near-empty cubic. */
const TURN_EPSILON = 1e-9;

const FACTOR = 10 ** ROUND_DIGITS;
const round = (n) => {
  const r = Math.round(n * FACTOR) / FACTOR;
  return Object.is(r, -0) ? 0 : r;
};

/**
 * Path data -> `{ segments }`, each `{ command, points }` with `points` the flat x, y pairs of the
 * end point (`move`, `line`), the two controls and the end point (`cubic`) or none (`close`); or
 * `{ error }` naming the first character the grammar rejects.
 */
export function compilePath(d) {
  let commands;
  try {
    commands = readCommands(d);
  } catch (err) {
    if (err instanceof PathSyntaxError) return { error: err.message };
    throw err;
  }
  if (commands.length === 0) return { error: 'holds no command' };
  if (commands[0].letter.toUpperCase() !== 'M') {
    return { error: `starts with "${commands[0].letter}", not a moveto (M or m)` };
  }
  return { segments: toSegments(commands) };
}

class PathSyntaxError extends Error {}

/** The command letters and their argument groups; an implicit repeat after M/m is L/l. */
function readCommands(d) {
  const reader = { d, at: 0 };
  const commands = [];
  skipWhitespace(reader);
  while (reader.at < d.length) {
    const letter = d[reader.at];
    const arity = ARITY[letter.toUpperCase()];
    if (arity === undefined) fail(reader, `unexpected "${letter}"`);
    reader.at += 1;
    skipWhitespace(reader);
    if (arity === 0) {
      commands.push({ letter, args: [] });
      continue;
    }
    let repeat = letter;
    do {
      commands.push({ letter: repeat, args: readGroup(reader, letter.toUpperCase(), arity) });
      if (repeat === 'M') repeat = 'L';
      if (repeat === 'm') repeat = 'l';
    } while (separator(reader) && startsNumber(d[reader.at]));
  }
  return commands;
}

function readGroup(reader, upper, arity) {
  const args = [];
  for (let i = 0; i < arity; i += 1) {
    if (i > 0) separator(reader);
    const flag = upper === 'A' && ARC_FLAGS.includes(i);
    args.push(flag ? readFlag(reader) : readNumber(reader));
  }
  return args;
}

function readNumber(reader) {
  NUMBER.lastIndex = reader.at;
  const match = NUMBER.exec(reader.d);
  if (!match) fail(reader, 'expected a number');
  const value = Number(match[0]);
  if (!Number.isFinite(value)) fail(reader, `"${match[0]}" is not a finite number`);
  reader.at += match[0].length;
  return value;
}

function readFlag(reader) {
  const ch = reader.d[reader.at];
  if (ch !== '0' && ch !== '1') fail(reader, 'expected an arc flag (0 or 1)');
  reader.at += 1;
  return ch === '1';
}

/**
 * Comma-whitespace between two arguments or argument groups: whitespace, at most one comma, then
 * whitespace. False when nothing follows; a comma must be followed by a number.
 */
function separator(reader) {
  skipWhitespace(reader);
  if (reader.d[reader.at] === ',') {
    reader.at += 1;
    skipWhitespace(reader);
    if (!startsNumber(reader.d[reader.at])) fail(reader, 'expected a number after ","');
  }
  return reader.at < reader.d.length;
}

function skipWhitespace(reader) {
  while (reader.at < reader.d.length && WHITESPACE.test(reader.d[reader.at])) reader.at += 1;
}

const startsNumber = (ch) => ch !== undefined && /[\d.+-]/.test(ch);

function fail(reader, message) {
  throw new PathSyntaxError(`${message} at ${reader.at}`);
}

/** Commands -> absolute segments (unrounded geometry, rounded points). */
function toSegments(commands) {
  const out = [];
  const pen = { x: 0, y: 0, startX: 0, startY: 0, closed: false, cubic: null, quad: null };
  const emit = (command, ...points) => out.push({ command, points: points.map(round) });
  for (const { letter, args } of commands) {
    const upper = letter.toUpperCase();
    const at = (dx, dy) => (letter === upper ? [dx, dy] : [pen.x + dx, pen.y + dy]);
    // After Z, a drawing command starts a new subpath at the closed one's start: say so.
    if (pen.closed && upper !== 'M' && upper !== 'Z') emit('move', pen.x, pen.y);
    pen.closed = false;
    const cubicControl = pen.cubic;
    const quadControl = pen.quad;
    pen.cubic = null;
    pen.quad = null;
    switch (upper) {
      case 'M': {
        [pen.x, pen.y] = at(args[0], args[1]);
        [pen.startX, pen.startY] = [pen.x, pen.y];
        emit('move', pen.x, pen.y);
        break;
      }
      case 'L':
        lineTo(pen, emit, ...at(args[0], args[1]));
        break;
      case 'H':
        lineTo(pen, emit, letter === 'H' ? args[0] : pen.x + args[0], pen.y);
        break;
      case 'V':
        lineTo(pen, emit, pen.x, letter === 'V' ? args[0] : pen.y + args[0]);
        break;
      case 'C':
        cubicTo(pen, emit, at(args[0], args[1]), at(args[2], args[3]), at(args[4], args[5]));
        break;
      case 'S': {
        const first = cubicControl ? reflect(cubicControl, pen) : [pen.x, pen.y];
        cubicTo(pen, emit, first, at(args[0], args[1]), at(args[2], args[3]));
        break;
      }
      case 'Q':
        quadTo(pen, emit, at(args[0], args[1]), at(args[2], args[3]));
        break;
      case 'T':
        quadTo(pen, emit, quadControl ? reflect(quadControl, pen) : [pen.x, pen.y], at(...args));
        break;
      case 'A':
        arcTo(pen, emit, args, at(args[5], args[6]));
        break;
      case 'Z':
        if (out.at(-1)?.command !== 'close') emit('close');
        [pen.x, pen.y] = [pen.startX, pen.startY];
        pen.closed = true;
    }
  }
  return out;
}

function lineTo(pen, emit, x, y) {
  emit('line', x, y);
  [pen.x, pen.y] = [x, y];
}

function cubicTo(pen, emit, [x1, y1], [x2, y2], [x, y]) {
  emit('cubic', x1, y1, x2, y2, x, y);
  pen.cubic = [x2, y2];
  [pen.x, pen.y] = [x, y];
}

/** The exact cubic of a quadratic: each control 2/3 of the way from an end to the quadratic's. */
function quadTo(pen, emit, [qx, qy], [x, y]) {
  const third = (from, to) => from + (2 / 3) * (to - from);
  emit('cubic', third(pen.x, qx), third(pen.y, qy), third(x, qx), third(y, qy), x, y);
  pen.quad = [qx, qy];
  [pen.x, pen.y] = [x, y];
}

/** The previous control point mirrored through the pen (S and T). */
const reflect = ([cx, cy], pen) => [2 * pen.x - cx, 2 * pen.y - cy];

/**
 * An elliptical arc as cubics, one per quarter turn or less (SVG 2 appendix B.2.4 and B.2.5): an
 * arc to the pen's own point draws nothing, a zero radius is a line, radii too small to reach the
 * end point are scaled up. The last cubic ends exactly on the end point.
 */
function arcTo(pen, emit, [rxIn, ryIn, degrees, large, sweep], [x, y]) {
  const [x0, y0] = [pen.x, pen.y];
  [pen.x, pen.y] = [x, y];
  if (x0 === x && y0 === y) return;
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (rx === 0 || ry === 0) {
    emit('line', x, y);
    return;
  }
  const phi = ((degrees % 360) * Math.PI) / 180;
  const [cos, sin] = [Math.cos(phi), Math.sin(phi)];
  const [hx, hy] = [(x0 - x) / 2, (y0 - y) / 2];
  const x1 = cos * hx + sin * hy;
  const y1 = -sin * hx + cos * hy;
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const [rx2, ry2] = [rx * rx, ry * ry];
  const spread = rx2 * y1 * y1 + ry2 * x1 * x1;
  const root = Math.sqrt(Math.max(0, (rx2 * ry2 - spread) / spread));
  const sign = large === sweep ? -1 : 1;
  const c1 = (sign * root * rx * y1) / ry;
  const c2 = (-sign * root * ry * x1) / rx;
  const centre = [cos * c1 - sin * c2 + (x0 + x) / 2, sin * c1 + cos * c2 + (y0 + y) / 2];
  const start = angle(1, 0, (x1 - c1) / rx, (y1 - c2) / ry);
  let turn = angle((x1 - c1) / rx, (y1 - c2) / ry, (-x1 - c1) / rx, (-y1 - c2) / ry);
  if (!sweep && turn > 0) turn -= 2 * Math.PI;
  if (sweep && turn < 0) turn += 2 * Math.PI;
  const count = Math.max(1, Math.ceil(Math.abs(turn) / QUARTER_TURN - TURN_EPSILON));
  const step = turn / count;
  const k = (4 / 3) * Math.tan(step / 4);
  const ellipse = { centre, rx, ry, cos, sin };
  for (let i = 0; i < count; i += 1) {
    const [t0, t1] = [start + i * step, start + (i + 1) * step];
    const [p0x, p0y] = pointAt(ellipse, t0);
    const [p3x, p3y] = i === count - 1 ? [x, y] : pointAt(ellipse, t1);
    const [d0x, d0y] = tangentAt(ellipse, t0);
    const [d3x, d3y] = tangentAt(ellipse, t1);
    emit('cubic', p0x + k * d0x, p0y + k * d0y, p3x - k * d3x, p3y - k * d3y, p3x, p3y);
  }
}

/** The signed angle from vector u to vector v. */
const angle = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);

function pointAt({ centre, rx, ry, cos, sin }, t) {
  const [ex, ey] = [rx * Math.cos(t), ry * Math.sin(t)];
  return [centre[0] + cos * ex - sin * ey, centre[1] + sin * ex + cos * ey];
}

function tangentAt({ rx, ry, cos, sin }, t) {
  const [ex, ey] = [-rx * Math.sin(t), ry * Math.cos(t)];
  return [cos * ex - sin * ey, sin * ex + cos * ey];
}
