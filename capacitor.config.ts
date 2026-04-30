$env: CLAUDE_CODE_GIT_BASH_PATH = "C:\Program Files\Git\bin\bash.exe"dsimport type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.7c76bc68beae49c3ab66cb1230e7a668',
  appName: 'Papirun',
  webDir: 'dist',
  server: {
    url: 'https://7c76bc68-beae-49c3-ab66-cb1230e7a668.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#F4F9F6',
      overlaysWebView: false,
    },
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#F4F9F6',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#F4F9F6',
  },
  android: {
    backgroundColor: '#F4F9F6',
  },
};

export default config;
