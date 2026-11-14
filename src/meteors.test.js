import assert from 'node:assert/strict';
import test from 'node:test';
import { activeShowers, peakLabel } from './meteors.js';

test('Perseids are active around mid-August', () => {
  const showers = activeShowers(new Date(Date.UTC(2026, 7, 12)));
  const perseids = showers.find((shower) => shower.id === 'perseids');
  assert.ok(perseids);
  assert.equal(perseids.nearPeak, true);
  assert.equal(peakLabel(perseids), 'Aug 12');
});

test('Leonids are active in mid-November', () => {
  const showers = activeShowers(new Date(Date.UTC(2026, 10, 14)));
  assert.ok(showers.some((shower) => shower.id === 'leonids'));
});

test('a quiet March day has no major shower window', () => {
  const showers = activeShowers(new Date(Date.UTC(2026, 2, 10)));
  assert.equal(showers.length, 0);
});
