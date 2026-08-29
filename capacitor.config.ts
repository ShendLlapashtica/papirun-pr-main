import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'net.papirun.app',
  appName: 'Papirun',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  server: {
    // Serve the bundled app; external links are handled via openExternal().
    androidScheme: 'https',
  },
};

export default config;
