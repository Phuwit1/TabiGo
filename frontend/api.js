import Constants from 'expo-constants';

const getBackendUrl = () => {
  const debuggerHost = Constants.expoConfig?.hostUri;
  const localhost = debuggerHost?.split(":")[0];

  if (!localhost) {
     return 'http://localhost:3000'; 
  }

  console.log(`Using backend URL: http://${localhost}:8000`);
  return `http://${localhost}:8000`;
}


const getWebSocketUrl = () => {
  const debuggerHost = Constants.expoConfig?.hostUri;
  const localhost = debuggerHost?.split(":")[0];

  if (!localhost) {
     return 'http://localhost:3000'; 
  }

  console.log(`Using backend URL: http://${localhost}:8010`);
  return `http://${localhost}:8010`;
}

export const API_URL = getBackendUrl();
export const GOOGLE_API_KEY = "AIzaSyA73tpAfskui7aqX9GXabfGLU0OZ5HLC-U";
export const WEBSOCKET_URL = getWebSocketUrl();
