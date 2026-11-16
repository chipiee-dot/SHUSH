// Run with: node --test client/src/lib/facultyId.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { isCompleteFacultyId, toFacultyId } from './facultyId.js';

const CASES = [
  ['', ''],
  ['2', 'FAC-2'],
  ['2026', 'FAC-2026-'],
  ['20262', 'FAC-2026-2'],
  ['20262005', 'FAC-2026-2005'],
  ['202620059999', 'FAC-2026-2005'], // extra digits dropped
  ['FAC-2026-2005', 'FAC-2026-2005'], // paste
  ['fac 2026 2005', 'FAC-2026-2005'],
  ['2026-2005', 'FAC-2026-2005'],
  ['abc', ''],
];

for (const [input, expected] of CASES) {
  test(`toFacultyId(${JSON.stringify(input)}) -> ${JSON.stringify(expected)}`, () => {
    assert.equal(toFacultyId(input), expected);
  });
}

test('isCompleteFacultyId accepts a full ID', () => {
  assert.equal(isCompleteFacultyId('FAC-2026-2005'), true);
});

test('isCompleteFacultyId rejects a partial ID', () => {
  assert.equal(isCompleteFacultyId('FAC-2026-'), false);
});
