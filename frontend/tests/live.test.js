// Unit tests for the pure live-camera logic. Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkFraming, meanLuma, DARK_LUMA } from '../src/lib/framing.js';
import { RepCounter, signalAngle } from '../src/lib/liveCounter.js';

// 33 landmarks; a person seen from the left side, standing, whole body in frame.
function standing(overrides = {}) {
  const lms = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.05 }));
  const set = (i, x, y, v = 0.95) => { lms[i] = { x, y, z: 0, visibility: v }; };
  set(0, 0.52, 0.12);
  set(11, 0.5, 0.25); set(12, 0.51, 0.25, 0.4);
  set(23, 0.5, 0.52); set(24, 0.5, 0.52, 0.4);
  set(25, 0.5, 0.72); set(26, 0.5, 0.72, 0.4);
  set(27, 0.5, 0.92); set(28, 0.5, 0.92, 0.4);
  for (const [i, v] of Object.entries(overrides)) lms[i] = { ...lms[i], ...v };
  return lms;
}

test('a framed side view has no cues', () => {
  const r = checkFraming(standing(), ['hip', 'knee', 'ankle', 'shoulder']);
  assert.deepEqual(r.cues, []);
  assert.equal(r.blocking, false);
  assert.equal(r.side, 'left');
});

test('nobody in frame is reported', () => {
  assert.deepEqual(checkFraming(null).cues, ['noBody']);
  const empty = standing();
  empty.forEach((p) => { p.visibility = 0.05; });
  assert.deepEqual(checkFraming(empty).cues, ['noBody']);
});

test('feet outside the frame are cut off', () => {
  const r = checkFraming(standing({ 27: { y: 1.04, visibility: 0.2 } }), ['hip', 'knee', 'ankle', 'shoulder']);
  assert.deepEqual(r.cues, ['cutoff']);
  assert.equal(r.blocking, true);
});

test('a hidden joint inside the frame is reported as hidden', () => {
  const r = checkFraming(standing({ 25: { visibility: 0.2 } }), ['hip', 'knee', 'ankle', 'shoulder']);
  assert.deepEqual(r.cues, ['hidden']);
});

test('a small body is too far away', () => {
  const small = standing();
  small.forEach((p) => { p.x = 0.5 + (p.x - 0.5) * 0.3; p.y = 0.4 + (p.y - 0.5) * 0.3; });
  assert.deepEqual(checkFraming(small, ['hip', 'knee', 'ankle', 'shoulder']).cues, ['tooFar']);
});

test('a front view asks the user to turn side-on, without blocking', () => {
  const front = standing({ 11: { x: 0.4, y: 0.25, visibility: 0.9 }, 12: { x: 0.62, y: 0.25, visibility: 0.9 }, 23: { x: 0.45, y: 0.52, visibility: 0.9 }, 24: { x: 0.57, y: 0.52, visibility: 0.9 } });
  const r = checkFraming(front, ['hip', 'knee', 'ankle', 'shoulder']);
  assert.ok(r.cues.includes('turn'));
  assert.equal(r.blocking, false);
});

test('mean luma separates dark from lit images', () => {
  assert.ok(meanLuma(new Uint8ClampedArray([10, 10, 10, 255, 20, 20, 20, 255])) < DARK_LUMA);
  assert.ok(meanLuma(new Uint8ClampedArray([200, 200, 200, 255])) > DARK_LUMA);
});

test('the squat signal is the knee angle', () => {
  const straight = standing();
  assert.ok(Math.abs(signalAngle(straight, 'left', 'knee_angle') - 180) < 1);
  const bent = standing({ 25: { x: 0.7, y: 0.62 } });
  assert.ok(signalAngle(bent, 'left', 'knee_angle') < 120);
  assert.equal(signalAngle(standing({ 27: { visibility: 0.1 } }), 'left', 'knee_angle'), null);
});

test('rep counter follows the dip rule of the server (squat: rest 160, enter 130)', () => {
  const c = new RepCounter({ mode: 'dip', rest: 160, enter: 130 });
  const wave = (low) => [170, 170, 160, 140, 110, low, low, low, 110, 140, 160, 170, 170];
  [...wave(95), ...wave(100), ...[170, 165, 155, 145, 145, 145, 155, 165, 170, 170, 170, 170, 170]].forEach((a) => c.push(a));
  assert.equal(c.reps, 2); // the half rep never crosses 130
});

test('rep counter handles peak exercises (overhead press: rest 115, enter 145)', () => {
  const c = new RepCounter({ mode: 'peak', rest: 115, enter: 145 });
  [90, 90, 90, 100, 120, 140, 160, 170, 170, 170, 170, 170, 150, 120, 100, 90, 90, 90, 90, 90, 90, 90].forEach((a) => c.push(a));
  assert.equal(c.reps, 1);
});
