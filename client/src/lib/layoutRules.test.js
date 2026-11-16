// Run with: node --test client/src/lib/*.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { cellFromPoint, clampPlacement, diffPlacements, isFree, overlaps } from './layoutRules.js';

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
