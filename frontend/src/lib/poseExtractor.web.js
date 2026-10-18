// Browser pose extraction with MediaPipe Tasks Vision (WASM). The video never leaves the device:
// only the 33 landmarks per sampled frame (a few hundred KB) are sent to the API for analysis. This
// avoids the 4.5 MB request body limit of Vercel Functions and keeps hosting cheap.
const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task';

const TARGET_FPS = 15;
const MAX_FRAMES = 450;
const MAX_SIDE = 640; // detection runs on a downscaled frame, like the server (640x480)

export const canExtractInBrowser = typeof document !== 'undefined' && typeof WebAssembly !== 'undefined';

let landmarkerPromise = null;

async function createLandmarker() {
  const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
  const make = (delegate) =>
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  try {
    return await make('GPU');
  } catch (_) {
    return await make('CPU');
  }
}

function getLandmarker() {
  if (!landmarkerPromise) landmarkerPromise = createLandmarker().catch((e) => { landmarkerPromise = null; throw e; });
  return landmarkerPromise;
}

function seek(video, time) {
  return new Promise((resolve, reject) => {
    const done = () => { video.removeEventListener('seeked', done); video.removeEventListener('error', fail); resolve(); };
    const fail = () => { video.removeEventListener('seeked', done); video.removeEventListener('error', fail); reject(new Error('Could not read the video')); };
    video.addEventListener('seeked', done);
    video.addEventListener('error', fail);
    video.currentTime = time;
  });
}

function loadVideo(file) {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';
  return new Promise((resolve, reject) => {
    video.onloadeddata = () => resolve({ video, url });
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not open the video file')); };
    video.src = url;
  });
}

const round = (n) => Math.round(n * 10000) / 10000;

// file: File/Blob. Returns [{ landmarks: [{x, y, z, visibility} x33], timestamp }]
export async function extractPosesInBrowser(file, onProgress) {
  const { video, url } = await loadVideo(file);
  try {
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('Could not read the video duration');
    const landmarker = await getLandmarker();

    const frameCount = Math.max(1, Math.min(MAX_FRAMES, Math.floor(duration * TARGET_FPS)));
    const step = duration / frameCount;
    const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext('2d');

    const poses = [];
    let lastTs = -1;
    for (let i = 0; i < frameCount; i++) {
      const time = Math.min(duration - 0.001, i * step);
      await seek(video, time);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const ts = Math.max(lastTs + 1, Math.round(time * 1000)); // VIDEO mode needs increasing timestamps
      lastTs = ts;
      const result = landmarker.detectForVideo(canvas, ts);
      const lms = result?.landmarks?.[0];
      if (lms && lms.length >= 33) {
        poses.push({
          landmarks: lms.slice(0, 33).map((p) => ({
            x: round(p.x), y: round(p.y), z: round(p.z), visibility: round(p.visibility ?? 0),
          })),
          timestamp: Math.round(time * 1000),
        });
      }
      if (onProgress) onProgress((i + 1) / frameCount);
    }
    return poses;
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}
