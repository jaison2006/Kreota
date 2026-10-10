import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";

// Firebase web config is public by design; access is controlled by Firebase security rules.
const firebaseConfig = {
  apiKey: "AIzaSyBM7UX8EiYVdzGVm47f8j0t_SN5Ct90aAY",
  authDomain: "kreota-83c24.firebaseapp.com",
  projectId: "kreota-83c24",
  storageBucket: "kreota-83c24.firebasestorage.app",
  messagingSenderId: "476926079982",
  appId: "1:476926079982:web:b6830d84f8be524a0dd4ff",
  measurementId: "G-RY4BV4SJ0K",
};

export const app = initializeApp(firebaseConfig);

// Analytics throws in browsers without IndexedDB/cookies (some private windows), so only start it where supported.
export const analytics: Promise<Analytics | null> = isSupported()
  .then((ok) => (ok ? getAnalytics(app) : null))
  .catch(() => null);
