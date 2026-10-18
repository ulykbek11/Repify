// Native builds (iOS/Android) send the video to the backend, which runs MediaPipe on the server.
// The browser build overrides this module in poseExtractor.web.js and extracts poses on-device.
export const canExtractInBrowser = false;
export async function extractPosesInBrowser() {
  throw new Error('Browser pose extraction is only available on web');
}
