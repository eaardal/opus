import type { AuthUser } from "./auth.types";

export interface RegisteredUser {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  updatedAt: Date;
}

export interface UserService {
  /** Upsert the signed-in user's profile. Called after each successful sign-in. */
  upsertOnSignIn(user: AuthUser): Promise<void>;

  /** Returns every user that has signed in to the app at least once. */
  listAll(): Promise<RegisteredUser[]>;
}
