import { useState } from "react";
import { signInWithGoogle } from "../lib/firebase";
import { describeError } from "../lib/errors";

/** Shown when nobody is signed in. Access itself is enforced server-side. */
export function SignIn() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(describeError(err, "Could not sign in."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center"
      style={{ background: "var(--bg)" }}
    >
      <h1
        className="font-display text-4xl font-medium tracking-tight"
        style={{ color: "var(--ink)" }}
      >
        radai
      </h1>
      <p className="max-w-xs text-sm" style={{ color: "var(--ink-dim)" }}>
        This app is restricted to its owner's Google account.
      </p>
      <button
        type="button"
        onClick={() => void handleSignIn()}
        disabled={loading}
        className="px-6 py-3 text-sm font-medium tracking-wide text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: "var(--accent)" }}
      >
        {loading ? "Signing in…" : "Sign in with Google"}
      </button>
      {error && (
        <p className="max-w-xs text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
