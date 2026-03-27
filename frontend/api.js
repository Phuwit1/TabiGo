import Constants from 'expo-constants';

const getBackendUrl = () => {
  const debuggerHost = Constants.expoConfig?.hostUri;
  const localhost = debuggerHost?.split(":")[0];

  if (!localhost) {
     return 'https://unvulgar-uneffectively-junior.ngrok-free.dev'; // ← ใส่ IP คอมตัวเองตรงนี้
  }

  console.log(`Using backend URL: http://${localhost}:8000`);
  return `http://${localhost}:8000`;
}


const getWebSocketUrl = () => {
  const debuggerHost = Constants.expoConfig?.hostUri;
  const localhost = debuggerHost?.split(":")[0];

  if (!localhost) {
     return 'https://unvulgar-uneffectively-junior.ngrok-free.dev';
  }

  console.log(`Using backend URL: http://${localhost}:8000`);
  return `http://${localhost}:8000`;
}

export const API_URL = getBackendUrl();
export const GOOGLE_API_KEY = Constants.expoConfig?.extra?.googleApiKey ?? '';
export const WEBSOCKET_URL = getWebSocketUrl();
