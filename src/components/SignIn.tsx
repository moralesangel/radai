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
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center">
      <h1 className="text-lg font-semibold text-slate-900">radai</h1>
      <p className="max-w-xs text-sm text-slate-500">
        This app is restricted to its owner's Google account.
      </p>
      <button
        type="button"
        onClick={() => void handleSignIn()}
        disabled={loading}
        className="rounded bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {loading ? "Signing in..." : "Sign in with Google"}
      </button>
      {error && <p className="max-w-xs text-sm text-red-700">{error}</p>}
    </div>
  );
}
