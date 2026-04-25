import type { AuthService } from "./auth.types";
import type { WorkspaceService } from "./workspace.types";
import { firebaseAuthService } from "./firebase/authService";
import { firebaseWorkspaceService } from "./firebase/workspaceService";

export const authService: AuthService = firebaseAuthService;
export const workspaceService: WorkspaceService = firebaseWorkspaceService;
