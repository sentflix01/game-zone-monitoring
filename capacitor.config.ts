import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gamezone.app',
  appName: 'Game Zone',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 500,
      launchAutoHide: true,
      backgroundColor: '#0f172a',
      showSpinner: false,
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '562421960778-vm9t5j2de8d0idliqpnloc65ajcrlor1.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
