// Run with: node --test client/src/lib/*.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { cellFromPoint, clampPlacement, diffPlacements, isFree, overlaps, resizeOutcome, seatsAfterResize } from './layoutRules.js';

const p = (col, row, width = 2, height = 2) => ({ col, row, width, height });

test('overlaps: shared cells overlap, touching edges do not', () => {
  assert.equal(overlaps(p(0, 0), p(1, 1)), true);
  assert.equal(overlaps(p(0, 0), p(2, 0)), false);
  assert.equal(overlaps(p(0, 0), p(0, 2)), false);
  assert.equal(overlaps(p(0, 0, 4, 4), p(1, 1, 1, 1)), true);
});

test('clampPlacement keeps a table inside the grid', () => {
  assert.deepEqual(clampPlacement(p(-3, -1)), p(0, 0));
  assert.deepEqual(clampPlacement(p(11, 5)), p(10, 5));
  assert.deepEqual(clampPlacement(p(0, 99), { rows: 100 }), p(0, 98));
  assert.deepEqual(clampPlacement(p(0, 0, 20, 2), { maxWidth: 10 }), p(0, 0, 10, 2));
});

test('isFree: inside the grid and clear of the others', () => {
  const others = [p(0, 0), p(4, 0)];
  assert.equal(isFree(p(2, 0), others), true);
  assert.equal(isFree(p(1, 0), others), false);
  assert.equal(isFree(p(11, 0), others), false); // runs off the right edge
  assert.equal(isFree(p(0, -1), others), false);
  assert.equal(isFree(p(0, 5), others, { rows: 6 }), false); // runs past the last row
});

test('cellFromPoint turns pixels into a cell', () => {
  const metrics = { stepX: 100, stepY: 50 };
  assert.deepEqual(cellFromPoint(0, 0, metrics), { col: 0, row: 0 });
  assert.deepEqual(cellFromPoint(250, 120, metrics), { col: 2, row: 2 });
  assert.deepEqual(cellFromPoint(-10, -1, metrics), { col: -1, row: -1 });
  assert.deepEqual(cellFromPoint(10, 10, { stepX: 0, stepY: 0 }), { col: 0, row: 0 });
});

test('diffPlacements returns only the tables that changed', () => {
  const server = { 1: p(0, 0), 2: p(2, 0), 3: p(4, 0) };
  const draft = { 1: p(0, 0), 2: p(2, 4), 3: p(4, 0, 3, 2) };
  assert.deepEqual(diffPlacements(server, draft), [
    { tableNo: 2, col: 2, row: 4, width: 2, height: 2 },
    { tableNo: 3, col: 4, row: 0, width: 3, height: 2 },
  ]);
  assert.deepEqual(diffPlacements(server, server), []);
  // a table that is not in the saved layout is ignored
  assert.deepEqual(diffPlacements({ 1: p(0, 0) }, { 1: p(0, 0), 9: p(5, 5) }), []);
});

test('seatsAfterResize: the long side decides (examples from the plan)', () => {
  const r = (oldW, oldH, newW, newH, seats, occupied = 0) => seatsAfterResize({ oldW, oldH, newW, newH, seats, occupied });
  assert.equal(r(2, 2, 3, 2, 4), 6); // 2x2 -> 3x2
  assert.equal(r(2, 2, 2, 3, 4), 6); // long side is now vertical
  assert.equal(r(3, 2, 3, 1, 6), 6); // short side only
  assert.equal(r(2, 2, 3, 2, 6), 8); // Table 3: keeps its 6 seats until resized
  assert.equal(r(2, 2, 1, 1, 4, 3), null); // would be 2 seats with 3 seated
  assert.equal(r(2, 2, 1, 2, 4, 3), 4); // 1x2: the long side is still 2, nothing changes
});

test('seatsAfterResize: refuses below 1 seat and above 20', () => {
  assert.equal(seatsAfterResize({ oldW: 2, oldH: 2, newW: 1, newH: 1, seats: 3, occupied: 0 }), 1);
  assert.equal(seatsAfterResize({ oldW: 2, oldH: 2, newW: 1, newH: 1, seats: 2, occupied: 0 }), null);
  assert.equal(seatsAfterResize({ oldW: 2, oldH: 2, newW: 3, newH: 2, seats: 19, occupied: 0 }), null);
  assert.equal(seatsAfterResize({ oldW: 2, oldH: 2, newW: 3, newH: 2, seats: 18, occupied: 0 }), 20);
});

test('resizeOutcome: limits, neighbours and seat rules', () => {
  const origin = { col: 0, row: 0, width: 2, height: 2, seats: 4 };
  const near = [p(3, 0)];
  assert.deepEqual(resizeOutcome({ origin, width: 3, height: 2, others: near }), { valid: true, seats: 6 });
  assert.equal(resizeOutcome({ origin, width: 4, height: 2, others: near }).valid, false); // hits the neighbour
  assert.equal(resizeOutcome({ origin, width: 2, height: 5, others: [] }).valid, false); // taller than 4
  assert.equal(resizeOutcome({ origin, width: 11, height: 2, others: [] }).valid, false); // wider than 10
  assert.equal(resizeOutcome({ origin: { ...origin, col: 10 }, width: 3, height: 2, others: [] }).valid, false); // off the grid
  assert.equal(resizeOutcome({ origin, width: 1, height: 1, others: [], occupied: 3 }).valid, false); // seated students
});

test('diffPlacements sends seats only when the seat count changed', () => {
  const server = { 1: { ...p(0, 0), seats: 4 }, 2: { ...p(2, 0), seats: 4 } };
  const draft = { 1: { ...p(0, 3), seats: 4 }, 2: { ...p(2, 0, 3, 2), seats: 6 } };
  assert.deepEqual(diffPlacements(server, draft), [
    { tableNo: 1, col: 0, row: 3, width: 2, height: 2 },
    { tableNo: 2, col: 2, row: 0, width: 3, height: 2, seats: 6 },
  ]);
});
