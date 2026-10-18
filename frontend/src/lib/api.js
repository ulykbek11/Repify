import { Platform } from 'react-native';
import { API_URL } from '../config';

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

export const getHealth = () => request('/health', {}, 5000);

export const sampleAnalysis = (exercise, language) =>
  request(`/api/sample-analysis?exercise=${exercise}&language=${language}`);

// asset: result of expo-image-picker ({ uri, file? })
export async function extractPoses(asset) {
  const form = new FormData();
  if (Platform.OS === 'web') {
    const file = asset.file || (await (await fetch(asset.uri)).blob());
    form.append('video', file, asset.fileName || 'video.mp4');
  } else {
    form.append('video', { uri: asset.uri, name: 'video.mp4', type: 'video/mp4' });
  }
  const data = await request('/api/extract-poses', { method: 'POST', body: form }, 600000);
  return data.pose_sequence;
}

export const analyze = ({ poseSequence, exercise, language, heightCm }) =>
  request(
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
