// Live repetition counter for the camera preview. It mirrors the server's segmentation (see
// backend/app/services/local_analyzer.segment_reps): a repetition starts at the rest angle, crosses
// the "enter" angle and returns to rest. The authoritative count and every form check still come
// from the analysis service after the set; this is only the on-screen preview.
import { jointsOf } from './framing.js';

const angleAt = (a, b, c) => {
  const bax = a.x - b.x, bay = a.y - b.y, bcx = c.x - b.x, bcy = c.y - b.y;
  const norm = Math.hypot(bax, bay) * Math.hypot(bcx, bcy);
  if (norm === 0) return null;
  return (Math.acos(Math.max(-1, Math.min(1, (bax * bcx + bay * bcy) / norm))) * 180) / Math.PI;
};

const TRIPLES = {
  knee_angle: ['hip', 'knee', 'ankle'],
  hip_angle: ['shoulder', 'hip', 'knee'],
  elbow_angle: ['shoulder', 'elbow', 'wrist'],
  body_line: ['shoulder', 'hip', 'ankle'],
};

// Angle (degrees) of the exercise's counting signal on the given body side, or null.
export function signalAngle(lms, side, signal) {
  const names = TRIPLES[signal];
  if (!lms || !side || !names) return null;
  const [a, b, c] = jointsOf(lms, side, names);
  if (!a || !b || !c || [a, b, c].some((p) => (p.visibility ?? 0) < 0.4)) return null;
  return angleAt(a, b, c);
}

export class RepCounter {
  // spec: { mode: 'dip' | 'peak' | 'hold', rest, enter }
  constructor(spec) {
    this.spec = spec;
    this.reps = 0;
    this.armed = false;
    this.inRep = false;
    this.window = [];
  }

  push(angle) {
    const { mode, rest, enter } = this.spec;
    if (angle == null || mode === 'hold') return this.reps;
    this.window.push(angle);
    if (this.window.length > 5) this.window.shift();
    const v = this.window.reduce((s, x) => s + x, 0) / this.window.length;
    const atRest = mode === 'dip' ? v >= rest : v <= rest;
    const entered = mode === 'dip' ? v <= enter : v >= enter;
    if (!this.armed) {
      if (atRest) this.armed = true;
    } else if (!this.inRep) {
      if (entered) this.inRep = true;
    } else if (atRest) {
      this.reps += 1;
      this.inRep = false;
    }
    return this.reps;
  }
}
