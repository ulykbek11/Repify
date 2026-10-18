// Framing checks for the live camera: is the body fully visible, far enough away and turned the
// way the exercise needs? Pure functions over the 33 MediaPipe landmarks ({ x, y, visibility }).

// Landmark indices per body side (MediaPipe Pose order).
const SIDE = {
  left: { shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27, heel: 29 },
  right: { shoulder: 12, elbow: 14, wrist: 16, hip: 24, knee: 26, ankle: 28, heel: 30 },
};
const DEFAULT_REQUIRED = ['shoulder', 'hip', 'knee', 'ankle'];
const MIN_VISIBILITY = 0.5;
const EDGE = 0.02;

export const BLOCKING_CUES = ['noBody', 'cutoff', 'hidden', 'tooFar'];

const vis = (p) => (p ? p.visibility ?? 0 : 0);

// The body side the camera sees best (same rule as the server: mean visibility of the joints).
export function visibleSide(lms) {
  const mean = (side) => {
    const ids = Object.values(SIDE[side]);
    return ids.reduce((sum, i) => sum + vis(lms[i]), 0) / ids.length;
  };
  return mean('left') >= mean('right') ? 'left' : 'right';
}

export function jointsOf(lms, side, names) {
  return names.map((n) => lms[SIDE[side][n]]);
}

// Returns { cues: string[], blocking: boolean, side }.
export function checkFraming(lms, required = DEFAULT_REQUIRED) {
  if (!lms || lms.length < 33) return { cues: ['noBody'], blocking: true, side: null };
  const side = visibleSide(lms);
  const names = required.filter((n) => SIDE[side][n] !== undefined);
  const pts = jointsOf(lms, side, names);
  const cues = [];

  const outside = (p) => p.x < EDGE || p.x > 1 - EDGE || p.y < EDGE || p.y > 1 - EDGE;
  const weak = pts.filter((p) => vis(p) < MIN_VISIBILITY);
  if (weak.length === pts.length) return { cues: ['noBody'], blocking: true, side };
  if (pts.some((p) => outside(p))) cues.push('cutoff');
  else if (weak.length) cues.push('hidden');

  if (!cues.length) {
    // The head counts too, so a deep squat (shoulders close to the knees) is not mistaken for "too far".
    const box = vis(lms[0]) > MIN_VISIBILITY ? [...pts, lms[0]] : pts;
    const xs = box.map((p) => p.x);
    const ys = box.map((p) => p.y);
    const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const needsFeet = names.includes('ankle');
    if (extent < (needsFeet ? 0.4 : 0.2)) cues.push('tooFar');
  }

  // Side view: both shoulders nearly on top of each other. A wide shoulder line means the camera
  // sees the chest, which makes the 2D angles unreliable.
  const [ls, rs, lh, rh] = [lms[11], lms[12], lms[23], lms[24]];
  if ([ls, rs, lh, rh].every((p) => vis(p) > MIN_VISIBILITY)) {
    const torso = Math.hypot((ls.x + rs.x) / 2 - (lh.x + rh.x) / 2, (ls.y + rs.y) / 2 - (lh.y + rh.y) / 2);
    if (torso > 0.05 && Math.abs(ls.x - rs.x) > 0.5 * torso && Math.abs(ls.y - rs.y) < 0.5 * torso) cues.push('turn');
  }
  return { cues, blocking: cues.some((c) => BLOCKING_CUES.includes(c)), side };
}

// Mean luma (0-255) of an ImageData; used to warn about a dark room.
export function meanLuma(data) {
  let sum = 0;
  const n = data.length / 4;
  for (let i = 0; i < data.length; i += 4) sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  return n ? sum / n : 0;
}
export const DARK_LUMA = 45;
