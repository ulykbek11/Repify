// Browser pose extraction with MediaPipe Tasks Vision (WASM). The video never leaves the device:
// only the 33 landmarks per sampled frame (a few hundred KB) are sent to the API for analysis. This
// avoids the 4.5 MB request body limit of Vercel Functions and keeps hosting cheap.
const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task';

const TARGET_FPS = 15;
const MAX_FRAMES = 450;
const MODEL_SIZE_ESTIMATE = 9.4 * 1024 * 1024;
const MAX_SIDE = 640; // detection runs on a downscaled frame, like the server (640x480)

export const canExtractInBrowser = typeof document !== 'undefined' && typeof WebAssembly !== 'undefined';

// The model file is downloaded once (with progress) and shared by every landmarker instance.
let modelPromise = null;
const progressListeners = new Set();

function fetchModel(onProgress) {
  if (onProgress) progressListeners.add(onProgress);
  if (!modelPromise) {
    modelPromise = (async () => {
      const response = await fetch(MODEL_URL);
      if (!response.ok) throw new Error(`model download failed (HTTP ${response.status})`);
      const total = Number(response.headers.get('content-length')) || MODEL_SIZE_ESTIMATE;
      const chunks = [];
      let received = 0;
      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        const fraction = Math.min(0.99, received / total);
        progressListeners.forEach((fn) => fn(fraction));
      }
      const bytes = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      progressListeners.forEach((fn) => fn(1));
      return bytes;
    })().catch((error) => { modelPromise = null; throw error; });
  }
  return modelPromise.finally(() => { if (onProgress) progressListeners.delete(onProgress); });
}

let fileLandmarker = null;
let fileTsBase = 0;

// Creates a pose landmarker: GPU delegate first, CPU when the GPU is not available.
// Resolves to { landmarker, delegate }.
export async function createLandmarker(onProgress) {
  const [{ FilesetResolver, PoseLandmarker }, bytes] = await Promise.all([
    import('@mediapipe/tasks-vision'),
    fetchModel(onProgress),
  ]);
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
  const make = (delegate) =>
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetBuffer: bytes.slice(), delegate },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  try {
    return { landmarker: await make('GPU'), delegate: 'GPU' };
  } catch (_) {
    return { landmarker: await make('CPU'), delegate: 'CPU' };
  }
}

function getFileLandmarker(onProgress) {
  if (!fileLandmarker) {
    fileLandmarker = createLandmarker(onProgress).then((r) => r.landmarker).catch((e) => { fileLandmarker = null; throw e; });
  }
  return fileLandmarker;
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

// file: File/Blob. onProgress(fraction, 'model' | 'frames'). Returns [{ landmarks: [{x, y, z, visibility} x33], timestamp }]
export async function extractPosesInBrowser(file, onProgress) {
  const { video, url } = await loadVideo(file);
  try {
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('Could not read the video duration');
    if (onProgress) onProgress(0, 'model');
    const landmarker = await getFileLandmarker((f) => onProgress && onProgress(f, 'model'));

    const frameCount = Math.max(1, Math.min(MAX_FRAMES, Math.floor(duration * TARGET_FPS)));
    const step = duration / frameCount;
    const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext('2d');

    const poses = [];
    let lastTs = fileTsBase; // detectForVideo needs timestamps that keep increasing across files
    for (let i = 0; i < frameCount; i++) {
      const time = Math.min(duration - 0.001, i * step);
      await seek(video, time);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const ts = Math.max(lastTs + 1, fileTsBase + Math.round(time * 1000)); // VIDEO mode needs increasing timestamps
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
      if (onProgress) onProgress((i + 1) / frameCount, 'frames');
    }
    fileTsBase = lastTs + 1000;
    return poses;
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}
