import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { onValue, ref, runTransaction, serverTimestamp, update } from "firebase/database";
import { auth, db } from "./firebase";

export type Role = "client" | "creator";
export type FormValues = Record<string, string | boolean>;

/** Stored at users/{uid} in the Realtime Database. */
export interface Profile {
  uid: string;
  name: string;
  email: string;
  photoURL: string | null;
  provider: string;
  role?: Role;
  onboarded?: Partial<Record<Role, boolean>>;
  client?: FormValues;
  creator?: FormValues;
  createdAt: number;
  lastLoginAt: number;
}

export type Session =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; user: User; profile: Profile | null; error: string | null };

const userRef = (uid: string) => ref(db, `users/${uid}`);

// Name typed on the sign-up form, used if the auth listener creates the profile first.
let pendingSignupName: string | null = null;

/** Creates the profile on first sign-in and records the login time on later ones. */
export async function ensureProfile(user: User, name?: string) {
  const r = userRef(user.uid);
  const displayName = name || pendingSignupName || user.displayName || user.email?.split("@")[0] || "Kreota member";
  // A transaction so two callers racing on a brand-new account can't overwrite each other.
  const result = await runTransaction(r, (current) => current ?? {
    uid: user.uid,
    name: displayName,
    email: user.email ?? "",
    photoURL: user.photoURL ?? null,
    provider: user.providerData[0]?.providerId ?? "password",
    createdAt: Date.now(),
    lastLoginAt: Date.now(),
  }, { applyLocally: false });
  const existing = result.snapshot.val() as Profile;
  await update(r, {
    lastLoginAt: serverTimestamp(),
    photoURL: user.photoURL ?? existing.photoURL ?? null,
    ...(name && existing.name !== name ? { name } : {}),
  });
}

export function useSession(): Session {
  const [session, setSession] = useState<Session>({ status: "loading" });

  useEffect(() => {
    let stopProfile: (() => void) | null = null;
    const stopAuth = onAuthStateChanged(auth, (user) => {
      stopProfile?.();
      stopProfile = null;
      if (!user) { setSession({ status: "signedOut" }); return; }
      setSession({ status: "loading" });
      let creating = false;
      const fail = (e: unknown) => setSession({ status: "signedIn", user, profile: null, error: describeError(e) });
      stopProfile = onValue(
        userRef(user.uid),
        (snap) => {
          if (snap.exists()) { setSession({ status: "signedIn", user, profile: snap.val() as Profile, error: null }); return; }
          // First sign-in on a new account: create the record, and this listener fires again with it.
          if (!creating) { creating = true; ensureProfile(user).catch(fail); }
        },
        fail,
      );
    });
    return () => { stopProfile?.(); stopAuth(); };
  }, []);

  return session;
}

/* ---------- auth actions ---------- */

export async function signUpWithEmail(name: string, email: string, password: string) {
  pendingSignupName = name;
  let user: User;
  try {
    ({ user } = await createUserWithEmailAndPassword(auth, email, password));
  } catch (e) {
    pendingSignupName = null;
    throw e;
  }
  // The account exists now. The rest is best-effort: the auth listener also creates the
  // profile (using pendingSignupName), so a hiccup here shouldn't surface as a failed sign-up.
  try {
    await updateProfile(user, { displayName: name });
    await ensureProfile(user, name);
    pendingSignupName = null;
  } catch { /* the listener finishes the profile */ }
  sendEmailVerification(user).catch(() => {});
}

export async function signInWithEmail(email: string, password: string) {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  await ensureProfile(user);
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    const { user } = await signInWithPopup(auth, provider);
    await ensureProfile(user);
  } catch (e) {
    // Popup blockers (common on mobile) fall back to a full-page redirect.
    if ((e as { code?: string }).code === "auth/popup-blocked") await signInWithRedirect(auth, provider);
    else throw e;
  }
}

export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email);
export const resendVerification = () => (auth.currentUser ? sendEmailVerification(auth.currentUser) : Promise.resolve());
export const signOutUser = () => signOut(auth);

/* ---------- profile writes ---------- */

export const setRole = (uid: string, role: Role) => update(userRef(uid), { role });

/** Saves one onboarding step so progress survives a reload. */
export const saveOnboardingStep = (uid: string, role: Role, values: FormValues) =>
  update(userRef(uid), Object.fromEntries(Object.entries(values).map(([k, v]) => [`${role}/${k}`, v])));

/** Saves edits made on the profile page. */
export const saveProfileFields = (uid: string, role: Role, values: FormValues) =>
  update(userRef(uid), Object.fromEntries(Object.entries(values).map(([k, v]) => [`${role}/${k}`, v])));

export async function updateDisplayName(user: User, name: string) {
  await updateProfile(user, { displayName: name });
  await update(userRef(user.uid), { name });
}

export const completeOnboarding =(uid: string, role: Role, values: FormValues) =>
  update(userRef(uid), { ...Object.fromEntries(Object.entries(values).map(([k, v]) => [`${role}/${k}`, v])), [`onboarded/${role}`]: true, role });

/* ---------- errors ---------- */

export function describeError(e: unknown): string {
  const code = (e as { code?: string }).code ?? "";
  const msg = (e as { message?: string }).message ?? "";
  if (code === "PERMISSION_DENIED" || /permission[_ ]denied/i.test(msg))
    return "Your account is signed in, but the database rules are blocking access to your profile. Update the Realtime Database rules in the Firebase console.";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-login-credentials":
      return "That email and password don't match. Check them, or reset your password.";
    case "auth/email-already-in-use": return "An account with this email already exists. Sign in instead.";
    case "auth/invalid-email": return "Enter a valid email address.";
    case "auth/weak-password": return "Choose a stronger password — at least 8 characters.";
    case "auth/too-many-requests": return "Too many attempts. Wait a moment and try again.";
    case "auth/network-request-failed": return "No connection. Check your internet and try again.";
    case "auth/operation-not-allowed": return "This sign-in method isn't enabled yet. Turn it on in Firebase Console → Authentication → Sign-in method.";
    case "auth/unauthorized-domain": return "This website's domain isn't authorised for sign-in. Add it in Firebase Console → Authentication → Settings → Authorised domains.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request": return "";
    case "auth/missing-email": return "Enter your email first.";
    default: return msg ? `Something went wrong: ${msg.replace(/^Firebase: /, "")}` : "Something went wrong. Please try again.";
  }
}
