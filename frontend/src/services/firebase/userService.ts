import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  type DocumentData,
} from "firebase/firestore";
import type { AuthUser } from "../auth.types";
import type { RegisteredUser, UserService } from "../user.types";
import { firestore } from "./client";

const USERS_COLLECTION = "users";

function timestampToDate(value: unknown): Date {
  return value instanceof Timestamp ? value.toDate() : new Date();
}

function toRegisteredUser(id: string, data: DocumentData): RegisteredUser {
  return {
    uid: id, // document ID is the email — used as the stable cross-project identifier
    email: data.email ?? id,
    displayName: data.displayName ?? null,
    photoURL: data.photoURL ?? null,
    updatedAt: timestampToDate(data.updatedAt),
  };
}

export const firebaseUserService: UserService = {
  async upsertOnSignIn(user: AuthUser) {
    if (!user.email) {
      throw new Error("cannot register user without an email");
    }
    // Document ID is the email so the identity is stable across Firebase projects.
    // firebaseUid is stored for reference but is NOT used as an identifier anywhere.
    await setDoc(doc(firestore, USERS_COLLECTION, user.email), {
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      firebaseUid: user.uid,
      updatedAt: serverTimestamp(),
    });
  },

  async listAll() {
    const snap = await getDocs(collection(firestore, USERS_COLLECTION));
    return snap.docs.map((d) => toRegisteredUser(d.id, d.data()));
  },
};
