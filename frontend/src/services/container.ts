import type { AuthService } from "./auth.types";
import type { UserService } from "./user.types";
import type { WorkspaceService } from "./workspace.types";
import { firebaseAuthService } from "./firebase/authService";
import { firebaseUserService } from "./firebase/userService";
import { firebaseWorkspaceService } from "./firebase/workspaceService";

export const authService: AuthService = firebaseAuthService;
export const userService: UserService = firebaseUserService;
export const workspaceService: WorkspaceService = firebaseWorkspaceService;
