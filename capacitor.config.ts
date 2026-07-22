import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.htpdevs.merchtable',
  appName: 'Merch Table',
  webDir: 'dist',
  backgroundColor: '#0f1115',
  ios: {
    contentInset: 'always',
    backgroundColor: '#0f1115',
  },
  android: {
    backgroundColor: '#0f1115',
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#0f1115',
      androidScaleType: 'CENTER_CROP',
    },
  },
};

export default config;
