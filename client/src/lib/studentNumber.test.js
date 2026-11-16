import test from 'node:test';
import assert from 'node:assert/strict';
import { SECTION_RE, formatSectionInput } from './studentNumber.js';

const CASES = [
  ['', ''],
  ['b', 'B'],
  ['bsit', 'BSIT'],
  ['bsit3', 'BSIT-3'],
  ['BSIT-3', 'BSIT-3'],
  ['bsit3d', 'BSIT-3D'],
  ['BSIT-3D', 'BSIT-3D'],
  ['bsit 3d', 'BSIT-3D'],
  ['BSIT-3DX', 'BSIT-3D'],
  ['BSIT-7', 'BSIT'],
  ['BSIT-0', 'BSIT'],
  ['BSIT-', 'BSIT'],
  ['BSCS1D', 'BSCS-1D'],
  ['BSECE-2A', 'BSECE-2A'],
  ['BSITXXXXX', 'BSITXXX'],
  ['BS3', 'BS'],
];

for (const [input, expected] of CASES) {
  test(`formatSectionInput(${JSON.stringify(input)}) -> ${JSON.stringify(expected)}`, () => {
    assert.equal(formatSectionInput(input), expected);
  });
}

test('formatSectionInput handles null and undefined', () => {
  assert.equal(formatSectionInput(null), '');
  assert.equal(formatSectionInput(undefined), '');
});

test('every complete output passes SECTION_RE', () => {
  for (const [, out] of CASES) {
    if (/^[A-Z]+-[1-6][A-Z]$/.test(out)) assert.match(out, SECTION_RE);
  }
});
