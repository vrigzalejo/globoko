import assert from 'node:assert/strict';
import test from 'node:test';
import { asteroidHelioEqj, asteroidMagnitude } from './asteroids.js';
import { computeSky } from './sky.js';

test('Ceres and Vesta stay near the main belt', () => {
  const date = new Date('2026-06-09T12:00:00Z');
  const ceres = asteroidHelioEqj('Ceres', date);
  const vesta = asteroidHelioEqj('Vesta', date);
  const ceresR = Math.hypot(ceres.x, ceres.y, ceres.z);
  const vestaR = Math.hypot(vesta.x, vesta.y, vesta.z);
  assert.ok(ceresR > 2.4 && ceresR < 3.1);
  assert.ok(vestaR > 2.0 && vestaR < 2.8);
});

test('asteroid magnitude brightens when closer', () => {
  const far = asteroidMagnitude('Ceres', 2.8, 2.0, 20);
  const near = asteroidMagnitude('Ceres', 2.5, 1.5, 20);
  assert.ok(near < far);
});

test('the sky list includes Ceres and Vesta with overhead points', () => {
  const sky = computeSky(new Date('2026-11-14T18:00:00Z'), null);
  const ceres = sky.bodies.find((body) => body.id === 'Ceres');
  const vesta = sky.bodies.find((body) => body.id === 'Vesta');
  assert.ok(ceres);
  assert.ok(vesta);
  assert.ok(Number.isFinite(ceres.x) && Number.isFinite(ceres.y) && Number.isFinite(ceres.z));
  assert.ok(ceres.distanceAu > 1);
  assert.ok(ceres.constellation);
  assert.ok(sky.showers.some((shower) => shower.id === 'leonids'));
});
