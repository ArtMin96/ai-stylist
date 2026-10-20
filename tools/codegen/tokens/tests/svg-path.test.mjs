// Tests for the SVG path compiler (svg-path.mjs; C02 icons, Linear AI-201): every command,
// absolute and relative, compiles to absolute move / line / cubic / close; quadratics and arcs
// become cubics; numbers are rounded the same way every time; rejected path data names the first
// character it cannot read. Run by scripts/test/design-tokens.test.sh.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PATH_COMMANDS, compilePath } from '../svg-path.mjs';

/** `d` compiled to `[command, ...points]` rows, which must compile without an error. */
function rows(d) {
  const { error, segments } = compilePath(d);
  assert.equal(error, undefined, `${d}: ${error}`);
  return segments.map(({ command, points }) => [command, ...points]);
}

const errorOf = (d) => compilePath(d).error;

test('absolute commands: M, L, H, V, C and Z keep their points', () => {
  assert.deepEqual(rows('M1 2L3 4H5V6C7 8 9 10 11 12Z'), [
    ['move', 1, 2],
    ['line', 3, 4],
    ['line', 5, 4],
    ['line', 5, 6],
    ['cubic', 7, 8, 9, 10, 11, 12],
    ['close'],
  ]);
});

test('relative commands compile to the same segments as their absolute twins', () => {
  const twins = [
    ['m1 2l2 2h2v2c2 2 4 4 6 6z', 'M1 2L3 4H5V6C7 8 9 10 11 12Z'],
    ['M2 2c1 1 2 1 3 0s2-1 3 0', 'M2 2C3 3 4 3 5 2S7 1 8 2'],
    ['M0 0q3 6 6 0t6 0', 'M0 0Q3 6 6 0T12 0'],
    ['M2 12a10 10 0 0 0 20 0', 'M2 12A10 10 0 0 0 22 12'],
  ];
  for (const [relative, absolute] of twins) assert.deepEqual(rows(relative), rows(absolute));
});

test('an implicit repeat after a moveto is a lineto, relative after m', () => {
  assert.deepEqual(rows('M1 2 3 4'), [
    ['move', 1, 2],
    ['line', 3, 4],
  ]);
  assert.deepEqual(rows('m1 2 3 4 5 6'), [
    ['move', 1, 2],
    ['line', 4, 6],
    ['line', 9, 12],
  ]);
  assert.deepEqual(rows('M0 0L1 1 2 0'), rows('M0 0L1 1L2 0'));
});

test('S mirrors the last cubic control; with no cubic before, its first control is the pen', () => {
  assert.deepEqual(rows('M0 0C0 3 3 6 6 6S12 3 12 0').at(-1), ['cubic', 9, 6, 12, 3, 12, 0]);
  assert.deepEqual(rows('M0 0S3 3 6 0').at(-1), ['cubic', 0, 0, 3, 3, 6, 0]);
  assert.deepEqual(rows('M0 0L1 1S3 3 6 0').at(-1), ['cubic', 1, 1, 3, 3, 6, 0]);
});

test('quadratics become their exact cubics; T mirrors the last quadratic control', () => {
  assert.deepEqual(rows('M0 0Q3 6 6 0T12 0').slice(1), [
    ['cubic', 2, 4, 4, 4, 6, 0],
    ['cubic', 8, -4, 10, -4, 12, 0],
  ]);
  assert.deepEqual(rows('M0 0T6 0').at(-1), ['cubic', 0, 0, 2, 0, 6, 0]);
});

test('arcs: one cubic per quarter turn, handles 0.5523 of the radius, ending on the end point', () => {
  // A half circle of radius 10 from (2, 12) to (22, 12): sweep 0 passes below, sweep 1 above.
  assert.deepEqual(rows('M2 12A10 10 0 0 0 22 12').slice(1), [
    ['cubic', 2, 17.523, 6.477, 22, 12, 22],
    ['cubic', 17.523, 22, 22, 17.523, 22, 12],
  ]);
  assert.deepEqual(rows('M2 12A10 10 0 0 1 22 12').slice(1), [
    ['cubic', 2, 6.477, 6.477, 2, 12, 2],
    ['cubic', 17.523, 2, 22, 6.477, 22, 12],
  ]);
  // A quarter turn with the flags written without separators (`011`).
  assert.deepEqual(rows('M0 0a1 1 0 011 1').slice(1), [['cubic', 0.552, 0, 1, 0.448, 1, 1]]);
  // A full circle as two half arcs is four cubics, back on its start.
  const circle = rows('M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0z');
  assert.equal(circle.filter(([command]) => command === 'cubic').length, 4);
  assert.deepEqual(circle.at(-2).slice(-2), [3, 12]);
});

test('arcs: large-arc picks the long way round; radii too small to reach are scaled up', () => {
  const cubics = (d) => rows(d).filter(([command]) => command === 'cubic');
  assert.equal(cubics('M12 3A9 9 0 0 1 21 12').length, 1, 'the short quarter');
  assert.equal(cubics('M12 3A9 9 0 1 0 21 12').length, 3, 'the long three quarters');
  const scaled = cubics('M0 0A1 1 0 0 1 10 0');
  assert.equal(scaled.length, 2, 'a half circle of radius 5');
  assert.deepEqual(scaled[0].slice(-2), [5, -5]);
});

test('arcs: a rotation is applied; a zero radius is a line; an arc to the pen draws nothing', () => {
  assert.deepEqual(rows('M0 0A4 2 90 0 1 4 0'), rows('M0 0A2 4 0 0 1 4 0'));
  assert.deepEqual(rows('M1 1A0 5 0 0 1 4 4'), [
    ['move', 1, 1],
    ['line', 4, 4],
  ]);
  assert.deepEqual(rows('M1 1A5 5 0 0 1 1 1'), [['move', 1, 1]]);
});

test('after Z the pen is at the subpath start, and a drawing command first moves there', () => {
  assert.deepEqual(rows('M10 10h2z l1 1'), [
    ['move', 10, 10],
    ['line', 12, 10],
    ['close'],
    ['move', 10, 10],
    ['line', 11, 11],
  ]);
  assert.deepEqual(rows('M1 1h1zM5 5h1'), [
    ['move', 1, 1],
    ['line', 2, 1],
    ['close'],
    ['move', 5, 5],
    ['line', 6, 5],
  ]);
  assert.deepEqual(rows('M1 1h1zz'), rows('M1 1h1z'));
});

test('numbers: a sign or a second dot starts the next one; exponents; comma separators', () => {
  assert.deepEqual(rows('M-1.5-2.5.5.5'), [
    ['move', -1.5, -2.5],
    ['line', 0.5, 0.5],
  ]);
  assert.deepEqual(rows('M1e1,2E-1 L+3 .5'), [
    ['move', 10, 0.2],
    ['line', 3, 0.5],
  ]);
  assert.deepEqual(rows(' M 1 , 2\n\tL 3 4 '), rows('M1 2L3 4'));
});

test('points are rounded to three decimals, never -0, the same on every run', () => {
  const [[, x, y], line] = rows('M0.12345 -0.0004L1.0006 2');
  assert.equal(x, 0.123);
  assert.ok(Object.is(y, 0), 'no negative zero');
  assert.deepEqual(line, ['line', 1.001, 2]);
  const d = 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0zM12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6';
  assert.deepEqual(compilePath(d), compilePath(d));
  for (const [command] of rows(d)) assert.ok(PATH_COMMANDS.includes(command), command);
});

test('path data the grammar rejects is an error naming where it stopped', () => {
  const cases = [
    ['', 'holds no command'],
    ['   ', 'holds no command'],
    ['L1 1', 'starts with "L", not a moveto (M or m)'],
    ['M1', 'expected a number at 2'],
    ['M1 1L', 'expected a number at 5'],
    ['M0 0X1 1', 'unexpected "X" at 4'],
    ['M1 1e', 'unexpected "e" at 4'],
    ['M0 0Z1', 'unexpected "1" at 5'],
    ['M1,,2', 'expected a number after "," at 3'],
    ['M1 1,', 'expected a number after "," at 5'],
    ['M0 0a1 1 0 2 1 1 1', 'expected an arc flag (0 or 1) at 11'],
    ['M1e999 0', '"1e999" is not a finite number at 1'],
  ];
  for (const [d, error] of cases) assert.equal(errorOf(d), error, JSON.stringify(d));
});
