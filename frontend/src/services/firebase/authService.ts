import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { SignInWithGoogle } from "../../../wailsjs/go/main/App";
import { isDesktop } from "../platform";
import type { AuthService, AuthUser } from "../types";
import { firebaseAuth } from "./client";

const ALLOWED_EMAIL_DOMAINS = ["tv2.no", "apparat.no"];
const ALLOWED_EMAILS = ["eirikaardal@gmail.com"];

function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  if (ALLOWED_EMAILS.includes(lower)) return true;
  const at = lower.lastIndexOf("@");
  if (at < 0) return false;
  return ALLOWED_EMAIL_DOMAINS.includes(lower.slice(at + 1));
}

function toAuthUser(u: User | null): AuthUser | null {
  if (!u) return null;
  return {
    uid: u.uid,
    email: u.email,
    displayName: u.displayName,
    photoURL: u.photoURL,
  };
}

async function signInWeb(): Promise<void> {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(firebaseAuth, provider);
}

async function signInDesktop(): Promise<void> {
  console.info("[auth] calling SignInWithGoogle() via Wails");
  let idToken: string;
  try {
    idToken = await SignInWithGoogle();
  } catch (err) {
    console.error("[auth] Go SignInWithGoogle failed:", err);
    throw new Error(`Desktop OAuth: ${typeof err === "string" ? err : String(err)}`);
  }
  console.info("[auth] got Google ID token; exchanging with Firebase");
  try {
    const credential = GoogleAuthProvider.credential(idToken);
    await signInWithCredential(firebaseAuth, credential);
  } catch (err) {
    console.error("[auth] Firebase signInWithCredential failed:", err);
    throw err;
  }
}

export const firebaseAuthService: AuthService = {
  currentUser() {
    return toAuthUser(firebaseAuth.currentUser);
  },
  onAuthChange(callback) {
    return onAuthStateChanged(firebaseAuth, (user) => callback(toAuthUser(user)));
  },
  async signIn() {
    if (isDesktop) await signInDesktop();
    else await signInWeb();
    const email = firebaseAuth.currentUser?.email;
    if (!isEmailAllowed(email)) {
      await firebaseSignOut(firebaseAuth);
      throw new Error("This email address is not allowed to access this app.");
    }
  },
  async signOut() {
    await firebaseSignOut(firebaseAuth);
  },
};
