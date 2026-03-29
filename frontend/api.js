import Constants from 'expo-constants';
import axios from 'axios';

const NGROK_URL = 'https://unvulgar-uneffectively-junior.ngrok-free.dev';
const NGROK_WS_URL = 'wss://unvulgar-uneffectively-junior.ngrok-free.dev';

const getBackendUrl = () => {
  const debuggerHost = Constants.expoConfig?.hostUri;
  const localhost = debuggerHost?.split(":")[0];

  if (!localhost) {
     return NGROK_URL;
  }

  console.log(`Using backend URL: http://${localhost}:8000`);
  return `http://${localhost}:8000`;
}


const getWebSocketUrl = () => {
  const debuggerHost = Constants.expoConfig?.hostUri;
  const localhost = debuggerHost?.split(":")[0];

  if (!localhost) {
     return NGROK_WS_URL;
  }

  console.log(`Using WebSocket URL: ws://${localhost}:8000`);
  return `ws://${localhost}:8000`;
}

export const API_URL = getBackendUrl();
export const GOOGLE_API_KEY = Constants.expoConfig?.extra?.googleApiKey ?? '';
export const WEBSOCKET_URL = getWebSocketUrl();

// Axios instance with ngrok header (prevents 403 on ngrok free tier)
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'ngrok-skip-browser-warning': 'true',
  },
});
