import 'dotenv/config';

export default {
  expo: {
    name: "TabiGo",
    slug: "japanplanner",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "myapp",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    jsEngine: "hermes",

    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.yourname.appname",
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "แอปพลิเคชันต้องการเข้าถึงตำแหน่งของคุณเพื่อระบุพิกัดในการใช้งาน (ใส่เหตุผลที่ฟังขึ้นเพื่อให้ Apple อนุมัติ)",
      },
      config: {
        googleMapsApiKey: process.env.IOS_GOOGLE_MAPS_API_KEY,
      },
    },

    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/icon.png",
        backgroundColor: "#ffffff",
      },
      package: "com.anonymous.japanplanner",
      usesCleartextTraffic: true,
      permissions: ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION"],
      config: {
        googleMaps: {
          apiKey: process.env.ANDROID_GOOGLE_MAPS_API_KEY,
        },
      },
    },

    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png",
    },

    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
        },
      ],
      "expo-font",
      [
        "expo-build-properties",
        {
          android: {
            compileSdkVersion: 35,
            targetSdkVersion: 34,
            minSdkVersion: 24,
            kotlinVersion: "1.9.25",
          },
        },
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission:
            "Allow TabiGo to use your location.",
          isIosBackgroundLocationEnabled: true,
          isAndroidBackgroundLocationEnabled: true,
          isAndroidForegroundServiceEnabled: true,
        },
      ],
      [
        "expo-sqlite",
        {
          "enableFTS": true,
          "useSQLCipher": true,
          "android": {
            // Override the shared configuration for Android
            "enableFTS": false,
            "useSQLCipher": false
          },
          "ios": {
            // You can also override the shared configurations for iOS
            "customBuildFlags": ["-DSQLITE_ENABLE_DBSTAT_VTAB=1 -DSQLITE_ENABLE_SNAPSHOT=1"]
          }
        }
      ],
    ],

    experiments: {
      typedRoutes: true,
    },

    extra: {
      router: {
        origin: false,
      },
      eas: {
        projectId: "65e04b9e-ba11-4cea-9d08-b12a7ab624c5",
      },
      googleApiKey: process.env.GOOGLE_API_KEY,
    },
    owner: "natthapong_12",
  },
};
