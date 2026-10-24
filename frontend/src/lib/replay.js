// Pure helpers for the result replay: the analysed video plays with the extracted landmarks drawn
// on top. Frames are matched to the video by the timestamps recorded during extraction.
import { jointsOf, visibleSide } from './framing.js';

// Index of the pose whose timestamp (ms) is closest to timeMs. poses must be sorted by timestamp.
export function nearestPose(poses, timeMs) {
  if (!poses || !poses.length) return -1;
  let lo = 0, hi = poses.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (poses[mid].timestamp < timeMs) lo = mid + 1; else hi = mid;
  }
  if (lo > 0 && Math.abs(poses[lo - 1].timestamp - timeMs) <= Math.abs(poses[lo].timestamp - timeMs)) return lo - 1;
  return lo;
}

export function angleAt(a, b, c) {
  const bax = a.x - b.x, bay = a.y - b.y, bcx = c.x - b.x, bcy = c.y - b.y;
  const norm = Math.hypot(bax, bay) * Math.hypot(bcx, bcy);
  if (norm === 0) return null;
  return (Math.acos(Math.max(-1, Math.min(1, (bax * bcx + bay * bcy) / norm))) * 180) / Math.PI;
}

// Joint angles shown on the replay for each counting signal: [label key, [a, vertex, c]].
const ANGLES = {
  knee_angle: [['knee', ['hip', 'knee', 'ankle']], ['hip', ['shoulder', 'hip', 'knee']]],
  hip_angle: [['knee', ['hip', 'knee', 'ankle']], ['hip', ['shoulder', 'hip', 'knee']]],
  elbow_angle: [['elbow', ['shoulder', 'elbow', 'wrist']]],
  body_line: [['hip', ['shoulder', 'hip', 'ankle']]],
};

// Angles to draw for one frame: [{ key, deg, a, b, c }] in normalised coordinates.
export function frameAngles(lms, signal = 'knee_angle', side = visibleSide(lms)) {
  const out = [];
  for (const [key, names] of ANGLES[signal] || ANGLES.knee_angle) {
    const [a, b, c] = jointsOf(lms, side, names);
    if (!a || !b || !c || [a, b, c].some((p) => (p.visibility ?? 0) < 0.4)) continue;
    const deg = angleAt(a, b, c);
    if (deg != null) out.push({ key, deg, a, b, c });
  }
  return out;
}

// One body side is used for the whole clip so the arcs do not jump between legs.
export function dominantSide(poses) {
  let left = 0;
  for (const p of poses || []) if (visibleSide(p.landmarks) === 'left') left += 1;
  return left * 2 >= (poses || []).length ? 'left' : 'right';
}
