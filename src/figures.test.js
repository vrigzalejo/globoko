import assert from 'node:assert/strict';
import test from 'node:test';
import { Constellation } from 'astronomy-engine';
import { FIGURES, GALAXIES, galacticToEquatorial, milkyWayBands } from './figures.js';
import { fixedSky } from './sky.js';

function separation(raA, decA, raB, decB) {
  const dec1 = decA * (Math.PI / 180);
  const dec2 = decB * (Math.PI / 180);
  const dRa = (raA - raB) * (Math.PI / 12);
  const cos = Math.sin(dec1) * Math.sin(dec2)
    + Math.cos(dec1) * Math.cos(dec2) * Math.cos(dRa);
  return Math.acos(Math.min(1, Math.max(-1, cos))) * (180 / Math.PI);
}

test('each stick-figure star sits in that constellation, and strokes stay short', () => {
  assert.ok(FIGURES.length >= 40);
  const mismatches = [];
  for (const figure of FIGURES) {
    figure.stars.forEach((star, index) => {
      assert.ok(star[0] >= 0 && star[0] < 24, `${figure.name} ra`);
      assert.ok(star[1] >= -90 && star[1] <= 90, `${figure.name} dec`);
      if (star[3] === true) return;
      const found = Constellation(star[0], star[1]);
      if (found.name !== figure.name) mismatches.push(`${figure.name} star ${index} is in ${found.name}`);
    });
  }
  assert.deepEqual(mismatches, []);
  for (const figure of FIGURES) {
    for (const stroke of figure.strokes) {
      for (let index = 1; index < stroke.length; index += 1) {
        const from = figure.stars[stroke[index - 1]];
        const to = figure.stars[stroke[index]];
        const angle = separation(from[0], from[1], to[0], to[1]);
        assert.ok(angle < 50, `${figure.name} stroke ${index} spans ${angle.toFixed(1)}°`);
      }
    }
  }
});

test('the Milky Way follows the galactic equator', () => {
  const center = galacticToEquatorial(0, 0);
  const pole = galacticToEquatorial(0, 90);
  assert.ok(separation(center.ra, center.dec, 17.761122, -28.936175) < 0.05);
  assert.ok(separation(pole.ra, pole.dec, 12.856667, 27.12825) < 0.05);
  const bands = milkyWayBands();
  assert.equal(bands[0].samples.length, 121);
  assert.equal(bands[0].samples[0].ra, bands[0].samples.at(-1).ra);
  for (const galaxy of GALAXIES) {
    assert.equal(typeof galaxy.name, 'string');
    assert.ok(galaxy.ra >= 0 && galaxy.ra < 24);
  }
  const andromeda = GALAXIES.find((galaxy) => galaxy.name.startsWith('Andromeda'));
  assert.equal(Constellation(andromeda.ra, andromeda.dec).name, 'Andromeda');
});

test('a star turns with the Earth and keeps its distance', () => {
  const start = new Date('2026-10-23T12:00:00Z');
  const later = new Date(start.getTime() + 6 * 60 * 60 * 1000);
  const radius = 6e12;
  const here = fixedSky(6.752, -16.72, start, radius);
  const there = fixedSky(6.752, -16.72, later, radius);
  assert.ok(Math.abs(Math.hypot(here.x, here.y, here.z) - radius) / radius < 1e-9);
  const dot = (here.x * there.x + here.y * there.y + here.z * there.z) / (radius * radius);
  assert.ok(dot < 0.3);
  const same = fixedSky(6.752, -16.72, start, radius);
  const again = (here.x * same.x + here.y * same.y + here.z * same.z) / (radius * radius);
  assert.ok(again > 0.999999);
});
