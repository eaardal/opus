import { useEffect, useState } from "react";
import { authService } from "../services/container";
import type { AuthUser } from "../services/types";

type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; user: AuthUser };

export function useAuthUser(): AuthState {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    return authService.onAuthChange((user) => {
      setState(user ? { status: "signedIn", user } : { status: "signedOut" });
    });
  }, []);

  return state;
}
