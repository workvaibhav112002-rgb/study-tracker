import type { CapacitorConfig } from '@capacitor/cli'

// Android/iOS app shell around the web build (dist/). The app loads its files
// from https://localhost, so that origin must be in the API's CORS_ORIGINS.
const config: CapacitorConfig = {
  appId: 'app.granule.focus',
  appName: 'Granule',
  webDir: 'dist',
  server: { androidScheme: 'https' },
  android: { backgroundColor: '#07080c' },
  plugins: {
    LocalNotifications: { smallIcon: 'ic_stat_granule', iconColor: '#10b981' },
  },
}

export default config
