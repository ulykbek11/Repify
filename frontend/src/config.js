// Backend base URL. Set EXPO_PUBLIC_API_URL in frontend/.env (see .env.example).
// On a physical phone use your computer's LAN address, e.g. http://192.168.1.5:8000
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

// Optional. Without these the app runs in local demo mode (no server-side accounts).
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
