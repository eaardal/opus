import type { ReactNode } from "react";
import { SignInScreen } from "./SignInScreen";
import { useAuthUser } from "./useAuthUser";

interface AuthGateProps {
  children: ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const auth = useAuthUser();

  if (auth.status === "loading") {
    // Firebase persists auth state in IndexedDB; the first render tick
    // resolves quickly on an already-signed-in user. A blank screen is
    // fine here — flashing a loader for ~50ms is worse.
    return null;
  }
  if (auth.status === "signedOut") {
    return <SignInScreen />;
  }
  return <>{children}</>;
}
