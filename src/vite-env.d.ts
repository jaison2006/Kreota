/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public reCAPTCHA Enterprise site key registered for this web app in Firebase App Check. */
  readonly VITE_RECAPTCHA_ENTERPRISE_SITE_KEY?: string;
  /** Set to 1 to use the local Firebase emulators. */
  readonly VITE_FIREBASE_EMULATORS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
