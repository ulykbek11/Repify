import { Platform } from 'react-native';
import { API_URL } from '../config';
import { canExtractInBrowser, extractPosesInBrowser } from './poseExtractor';

export class ApiError extends Error {
  constructor(message, kind = 'http', status) {
    super(message);
    this.kind = kind; // 'network' | 'http'
    this.status = status;
  }
}

async function request(path, options = {}, timeoutMs = 120000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_URL}${path}`, { ...options, signal: controller.signal });
    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const body = await response.json();
        if (body?.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
      } catch (_) {}
      throw new ApiError(detail, 'http', response.status);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(error.message, 'network');
  } finally {
    clearTimeout(timer);
  }
}

export const apiConfigured = Boolean(API_URL);

function requireService() {
  if (!API_URL) throw new ApiError('The analysis service is not configured', 'config');
}

export function getHealth() {
  if (!API_URL) return Promise.reject(new ApiError('The analysis service is not configured', 'config'));
  return request('/health', {}, 20000);
}

// Exercise registry from the backend: counting signal, thresholds and required joints.
export function getExercises() {
  requireService();
  return request('/api/exercises', {}, 20000);
}

// Web: poses are extracted in the browser (MediaPipe Tasks Vision) and only the landmarks are sent,
// so the video never leaves the device and the 4.5 MB request limit of Vercel Functions does not
// apply. Native: the video is uploaded to the backend, which runs MediaPipe on the server.
// asset: result of expo-image-picker ({ uri, file? })
export async function extractPoses(asset, onProgress) {
  requireService();
  if (Platform.OS === 'web') {
    if (!canExtractInBrowser) throw new ApiError('This browser cannot run pose detection (WebAssembly is required)', 'http', 501);
    const file = asset.file || (await (await fetch(asset.uri)).blob());
    let poses;
    try {
      poses = await extractPosesInBrowser(file, onProgress);
    } catch (error) {
      throw new ApiError(`Pose detection failed in the browser: ${error.message}`, 'http', 500);
    }
    if (!poses.length) throw new ApiError('No person detected in the video', 'http', 422);
    return poses;
  }
  const form = new FormData();
  form.append('video', { uri: asset.uri, name: 'video.mp4', type: 'video/mp4' });
  const data = await request('/api/extract-poses', { method: 'POST', body: form }, 600000);
  return data.pose_sequence;
}

export const analyze = ({ poseSequence, exercise, language, heightCm }) => {
  requireService();
  return request(
    '/api/analyze',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exercise,
        pose_sequence: poseSequence,
        language,
        user_height_cm: heightCm || null,
        camera_angle: 'side_profile',
      }),
    },
    600000
  );
};
