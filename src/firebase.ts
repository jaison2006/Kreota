import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from "firebase/app-check";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectDatabaseEmulator, getDatabase } from "firebase/database";

// Firebase web config is public by design; access is controlled by Firebase security rules.
const firebaseConfig = {
  apiKey: "AIzaSyBM7UX8EiYVdzGVm47f8j0t_SN5Ct90aAY",
  authDomain: "kreota-83c24.firebaseapp.com",
  databaseURL: "https://kreota-83c24-default-rtdb.firebaseio.com",
  projectId: "kreota-83c24",
  storageBucket: "kreota-83c24.firebasestorage.app",
  messagingSenderId: "476926079982",
  appId: "1:476926079982:web:b6830d84f8be524a0dd4ff",
  measurementId: "G-RY4BV4SJ0K",
};

export const app = initializeApp(firebaseConfig);

/*
 * App Check proves requests come from this app; Firebase AI Logic (Gemini) rejects requests without it once enforced.
 *
 * Provider: reCAPTCHA Enterprise. The key is created on Google Cloud's Fraud Defense page (score-based, no checkbox
 * challenge) and registered for this web app under Firebase console → App Check, which stores the secret server-side.
 * The browser only ever needs the public site key:
 *   VITE_RECAPTCHA_ENTERPRISE_SITE_KEY=6L...   (build-time; see .env.example)
 *
 * On your own computer (localhost) a debug token is used instead, so the production key can stay locked to the live
 * domain. Register that token under App Check → Apps → ⋮ → Manage debug tokens.
 */
const enterpriseSiteKey = (import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY as string | undefined)?.trim() || undefined;
const isLocalhost = typeof location !== "undefined" && ["localhost", "127.0.0.1"].includes(location.hostname);

function localDebugToken(): string | null {
  if (!isLocalhost || import.meta.env.VITE_FIREBASE_EMULATORS) return null;
  try {
    let token = localStorage.getItem("kreota-appcheck-debug-token");
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem("kreota-appcheck-debug-token", token);
    }
    return token;
  } catch {
    return null;
  }
}

/** Debug token this browser uses for App Check on localhost (null elsewhere). */
export const appCheckDebugToken = localDebugToken();
if (appCheckDebugToken) (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = appCheckDebugToken;

/** How this build attests itself: a localhost debug token, the reCAPTCHA Enterprise key, or not at all. */
export type AppCheckMode = "debug" | "enterprise" | "off";
export const appCheckMode: AppCheckMode = appCheckDebugToken ? "debug" : enterpriseSiteKey ? "enterprise" : "off";

// In debug mode the SDK uses the debug token and never calls the provider, so the placeholder key is unused.
export const appCheck: AppCheck | null = appCheckMode === "off"
  ? null
  : initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(enterpriseSiteKey ?? "debug-token-only"), isTokenAutoRefreshEnabled: true });

// getAuth persists the session in IndexedDB, so users stay signed in on this device until they sign out.
export const auth = getAuth(app);
export const db = getDatabase(app);

// Local testing against the Firebase emulators: VITE_FIREBASE_EMULATORS=1 pnpm dev
if (import.meta.env.VITE_FIREBASE_EMULATORS) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectDatabaseEmulator(db, "127.0.0.1", 9000);
}

// Analytics throws in browsers without IndexedDB/cookies (some private windows), so only start it where supported.
// Emulator runs are test traffic, so they never report to the real Analytics property.
export const analytics: Promise<Analytics | null> = import.meta.env.VITE_FIREBASE_EMULATORS ? Promise.resolve(null) : isSupported()
  .then((ok) => (ok ? getAnalytics(app) : null))
  .catch(() => null);
