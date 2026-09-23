import { FirebaseError } from "firebase/app";

/**
 * Turns a callable-function error into a message worth showing the user.
 *
 * Firebase Functions errors carry a `code` (e.g. "functions/internal",
 * "functions/invalid-argument") and a `message` -- the message is whatever
 * string the Cloud Function passed to `HttpsError`, which in this app is
 * already a specific, human-readable explanation (see
 * functions/src/index.ts -> describeClaudeError). Prefix with the code only
 * when it adds information the message doesn't already carry.
 */
export function describeError(err: unknown, fallback: string): string {
  if (err instanceof FirebaseError) {
    const code = err.code.replace(/^functions\//, "");
    if (code === "internal" || code === "unknown") {
      // The message already came from our own HttpsError with real detail.
      return err.message || fallback;
    }
    return `${err.message} (${code})`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
}
