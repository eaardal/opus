import type { AuthService } from "./types";
import { firebaseAuthService } from "./firebase/authService";

export const authService: AuthService = firebaseAuthService;
