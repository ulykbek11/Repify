// Export configuration based on environment
const DEV_API_URL = 'http://192.168.1.7:8000';
const PROD_API_URL = 'https://your-backend-url.onrender.com'; // User needs to replace this

export const API_URL = __DEV__ ? DEV_API_URL : PROD_API_URL;
export const WS_URL = API_URL.replace(/^http/, 'ws');
