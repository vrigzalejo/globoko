import assert from 'node:assert/strict';
import test from 'node:test';
import { cometHelioEqj, cometMagnitude } from './comets.js';
import { computeSky } from './sky.js';

test('Halley stays near the outer solar system in 2026', () => {
  const date = new Date('2026-11-14T12:00:00Z');
  const helio = cometHelioEqj('Halley', date);
  const r = Math.hypot(helio.x, helio.y, helio.z);
  assert.ok(r > 20 && r < 36);
});

test('Encke stays inside Jupiter’s orbit', () => {
  const date = new Date('2026-11-14T12:00:00Z');
  const helio = cometHelioEqj('Encke', date);
  const r = Math.hypot(helio.x, helio.y, helio.z);
  assert.ok(r > 0.3 && r < 4.2);
});

test('comet magnitude brightens when closer', () => {
  const far = cometMagnitude('Encke', 2.0, 1.5);
  const near = cometMagnitude('Encke', 1.0, 0.8);
  assert.ok(near < far);
});

test('the sky list includes Halley, Encke, and 67P', () => {
  const sky = computeSky(new Date('2026-11-14T18:00:00Z'), null);
  for (const id of ['Halley', 'Encke', '67P']) {
    const body = sky.bodies.find((entry) => entry.id === id);
    assert.ok(body, id);
    assert.equal(body.kind, 'comet');
    assert.ok(Number.isFinite(body.x) && Number.isFinite(body.y) && Number.isFinite(body.z));
    assert.ok(body.distanceAu > 0.2);
    assert.ok(body.constellation);
  }
});
