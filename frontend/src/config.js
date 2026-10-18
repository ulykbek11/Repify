// Backend base URL (the analysis service). Set EXPO_PUBLIC_API_URL in frontend/.env, see .env.example.
// On a physical phone use your computer's LAN address, e.g. http://192.168.1.5:8000
// Without it the app has no analysis service and says so: nothing is simulated.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');
