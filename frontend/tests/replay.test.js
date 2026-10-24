// Unit tests for the result replay helpers. Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { angleAt, dominantSide, frameAngles, nearestPose } from '../src/lib/replay.js';

function body(kneeX = 0.5) {
  const lms = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.05 }));
  const set = (i, x, y) => { lms[i] = { x, y, z: 0, visibility: 0.95 }; };
  set(11, 0.5, 0.25); set(13, 0.5, 0.4); set(15, 0.5, 0.5);
  set(23, 0.5, 0.5); set(25, kneeX, 0.7); set(27, 0.5, 0.9);
  return lms;
}

test('nearestPose picks the closest timestamp', () => {
  const poses = [0, 66, 133, 200].map((timestamp) => ({ timestamp }));
  assert.equal(nearestPose(poses, 0), 0);
  assert.equal(nearestPose(poses, 90), 1);
  assert.equal(nearestPose(poses, 120), 2);
  assert.equal(nearestPose(poses, 5000), 3);
  assert.equal(nearestPose([], 10), -1);
});

test('angleAt measures the angle at the vertex', () => {
  assert.equal(Math.round(angleAt({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })), 90);
  assert.equal(angleAt({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 }), null);
});

test('frameAngles returns knee and hip for a squat, straight leg is about 180', () => {
  const angles = frameAngles(body(), 'knee_angle', 'left');
  assert.deepEqual(angles.map((a) => a.key), ['knee', 'hip']);
  assert.equal(Math.round(angles[0].deg), 180);
  assert.ok(frameAngles(body(0.7), 'knee_angle', 'left')[0].deg < 150);
});

test('frameAngles returns the elbow for arm exercises and skips hidden joints', () => {
  assert.deepEqual(frameAngles(body(), 'elbow_angle', 'left').map((a) => a.key), ['elbow']);
  assert.deepEqual(frameAngles(body(), 'knee_angle', 'right'), []);
});

test('dominantSide follows the better visible side', () => {
  assert.equal(dominantSide([{ landmarks: body() }, { landmarks: body() }]), 'left');
});
