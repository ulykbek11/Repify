// Backend base URL. Set EXPO_PUBLIC_API_URL in frontend/.env (see .env.example).
// On a physical phone use your computer's LAN address, e.g. http://192.168.1.5:8000
// Leave it empty to run the app in demo mode: sample analyses come from the bundle and no
// server is needed (video upload needs a backend).
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');
export const DEMO_MODE = !API_URL;

// Optional. Without these the app runs in local demo mode (no server-side accounts).
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
