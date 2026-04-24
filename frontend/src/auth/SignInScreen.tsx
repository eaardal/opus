import { useState } from "react";
import { authService } from "../services/container";
import "./SignInScreen.css";

export function SignInScreen() {
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = async () => {
    setSigningIn(true);
    setError(null);
    try {
      await authService.signIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setSigningIn(false);
    }
  };

  return (
    <div className="signin-screen">
      <div className="signin-card">
        <h1 className="signin-title">Domino</h1>
        <p className="signin-subtitle">Sign in to continue</p>
        <button
          type="button"
          className="signin-button"
          onClick={handleSignIn}
          disabled={signingIn}
        >
          {signingIn ? "Signing in…" : "Sign in with Google"}
        </button>
        {error && <p className="signin-error">{error}</p>}
      </div>
    </div>
  );
}
