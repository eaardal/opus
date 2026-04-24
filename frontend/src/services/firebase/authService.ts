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
  const idToken = await SignInWithGoogle();
  const credential = GoogleAuthProvider.credential(idToken);
  await signInWithCredential(firebaseAuth, credential);
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
