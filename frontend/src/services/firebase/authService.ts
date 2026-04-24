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
  signIn() {
    return isDesktop ? signInDesktop() : signInWeb();
  },
  async signOut() {
    await firebaseSignOut(firebaseAuth);
  },
};
