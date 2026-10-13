import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.htpdevs.merchtable',
  appName: 'Merch Table',
  webDir: 'dist',
  backgroundColor: '#08090b',
  ios: {
    contentInset: 'always',
    backgroundColor: '#08090b',
  },
  android: {
    backgroundColor: '#08090b',
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#08090b',
      androidScaleType: 'CENTER_INSIDE',
    },
  },
};

export default config;
