import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.echotune.app',
  appName: 'EchoTune',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Allow JioSaavn API calls from inside the app
    allowNavigation: [
      'saavn.dev',
      '*.saavn.dev',
      'aac.saavncdn.com',
      '*.saavncdn.com',
      'c.saavncdn.com',
    ]
  },
  android: {
    allowMixedContent: true,  // allows http audio streams inside https app
    captureInput: true,
    webContentsDebuggingEnabled: false  // set true during development
  },
  plugins: {
    CapacitorHttp: {
      enabled: true  // use native HTTP instead of browser fetch — bypasses CORS
    },
    BackgroundRunner: {
      label: 'com.echotune.background',
      src: 'background.js',
      event: 'keepAlive',
      repeat: true,
      interval: 30,
      autoStart: true
    }
  }
};

export default config;
