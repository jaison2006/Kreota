import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
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
