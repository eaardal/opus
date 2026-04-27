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
    uid: data.uid ?? id,
    email: data.email ?? "",
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
    await setDoc(doc(firestore, USERS_COLLECTION, user.uid), {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      updatedAt: serverTimestamp(),
    });
  },

  async listAll() {
    const snap = await getDocs(collection(firestore, USERS_COLLECTION));
    return snap.docs.map((d) => toRegisteredUser(d.id, d.data()));
  },
};
