// Native builds record with the system camera (expo-image-picker) and upload to the backend, so there
// is no in-app live preview. The browser build overrides this module in LiveCamera.web.js.
export const liveCameraSupported = false;
export default function LiveCamera() {
  return null;
}
