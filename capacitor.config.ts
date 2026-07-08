import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor-Konfiguration für die iOS-App (Fight Calendar).
 *
 * Die iOS-App ist ein nativer Wrapper: Sie lädt die deployte Web-App in
 * einem WKWebView. So funktionieren Server-Rendering, API-Routen,
 * Neon-Datenbank und das Cookie-Login unverändert weiter.
 *
 * → Trage unten die URL deiner Vercel-Deployment ein (Platzhalter ersetzen).
 *
 * Lokale Entwicklung: zeige stattdessen auf deinen Dev-Server, z. B.
 *   CAP_SERVER_URL=http://localhost:3000 npm run cap:sync
 * (Details siehe IOS_SETUP.md.)
 */
const SERVER_URL = process.env.CAP_SERVER_URL ?? 'https://fight-calender.vercel.app';

const config: CapacitorConfig = {
  appId: 'de.everyco.fightcalendar',
  appName: 'Submit',
  webDir: 'capacitor-webdir',
  backgroundColor: '#0a0a0a',
  server: {
    url: SERVER_URL,
    // http:// (z. B. localhost) braucht cleartext; https:// (Vercel) nicht.
    cleartext: SERVER_URL.startsWith('http://'),
  },
  ios: {
    backgroundColor: '#0a0a0a',
    contentInset: 'always',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 600,
      backgroundColor: '#0a0a0a',
      showSpinner: false,
    },
  },
};

export default config;
