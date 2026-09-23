import { useState, useCallback, useEffect } from "react";
import {
  getDigest,
  getLatestDigest,
  onAuthChange,
  signOut,
  type Story,
} from "./lib/firebase";
import { describeError } from "./lib/errors";
import { StoryCard } from "./components/StoryCard";
import { PostComposer } from "./components/PostComposer";
import { SignIn } from "./components/SignIn";
import type { User } from "firebase/auth";

/** Today in the visitor's own timezone, as YYYY-MM-DD (not UTC). */
function localTodayISO(): string {
  const d = new Date();
  const offsetMs = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 10);
}

/** "22 Sep, 14:03" in the visitor's own locale and timezone. */
function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Status = "idle" | "restoring" | "loading" | "loaded" | "error";

export default function App() {
  // undefined = auth state not yet known (initial load); null = signed out.
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [status, setStatus] = useState<Status>("restoring");
  const [stories, setStories] = useState<Story[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [selected, setSelected] = useState<Story | null>(null);

  useEffect(() => onAuthChange(setUser), []);

  // Restoring the last search is free (it only reads Firestore, never calls
  // Claude), so this runs automatically once signed in -- closing and
  // reopening the app shows what you last found, not a blank slate.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getLatestDigest({})
      .then((result) => {
        if (cancelled) return;
        if (result.data.stories.length > 0) {
          setStories(result.data.stories);
          setFetchedAt(result.data.fetchedAt);
          setStatus("loaded");
        } else {
          setStatus("idle");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        // Restoring silently falling back to "idle" hid real failures (auth
        // token races, a missing function, etc.) behind what looked like an
        // empty history. Surface it instead of guessing.
        console.error("getLatestDigest failed", err);
        setError(describeError(err, "Could not load your last search."));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // A *new* search costs money (Claude web search + tokens), so it only runs
  // on an explicit press -- never automatically.
  const search = useCallback(async (refresh = false) => {
    setStatus("loading");
    setError(null);
    setSelected(null);
    try {
      const result = await getDigest({ date: localTodayISO(), refresh });
      setStories(result.data.stories);
      setFetchedAt(result.data.fetchedAt);
      setStatus("loaded");
    } catch (err) {
      setError(describeError(err, "Could not load the digest."));
      setStories([]);
      setStatus("error");
    }
  }, []);

  if (user === undefined) {
    return <div style={{ background: "var(--bg)" }} className="min-h-screen" />;
  }

  if (user === null) {
    return <SignIn />;
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <header
        className="border-b"
        style={{ borderColor: "var(--rule-strong)", background: "var(--surface)" }}
      >
        <div className="mx-auto flex max-w-2xl flex-wrap items-baseline gap-x-4 gap-y-2 px-5 py-6 sm:px-8">
          <h1
            className="font-display text-3xl font-medium tracking-tight"
            style={{ color: "var(--ink)" }}
          >
            radai
          </h1>
          <p
            className="text-[13px] uppercase tracking-[0.14em]"
            style={{ color: "var(--ink-faint)" }}
          >
            The most significant AI news, on demand
          </p>

          <div className="ml-auto flex items-center gap-4 text-sm">
            {status === "loaded" && (
              <button
                type="button"
                onClick={() => void search(true)}
                className="font-medium underline decoration-1 underline-offset-4 transition-opacity hover:opacity-70"
                style={{ color: "var(--accent)" }}
              >
                Search again
              </button>
            )}
            <button
              type="button"
              onClick={() => void signOut()}
              className="transition-opacity hover:opacity-70"
              style={{ color: "var(--ink-faint)" }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-8 sm:px-8">
        {selected && (
          <div className="mb-8">
            <PostComposer story={selected} onClose={() => setSelected(null)} />
          </div>
        )}

        {(status === "restoring" || status === "loading") && (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <div
              className="h-5 w-5 animate-spin rounded-full border-2 border-transparent"
              style={{ borderTopColor: "var(--accent)", borderRightColor: "var(--rule-strong)" }}
            />
            <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
              {status === "restoring"
                ? "Loading your last search…"
                : "Searching the web for recent AI news. This takes a minute."}
            </p>
          </div>
        )}

        {status === "idle" && (
          <div className="flex flex-col items-center gap-5 py-20 text-center">
            <p
              className="max-w-sm font-display text-xl leading-snug"
              style={{ color: "var(--ink)" }}
            >
              Find what actually happened in AI this week.
            </p>
            <p className="max-w-xs text-sm" style={{ color: "var(--ink-dim)" }}>
              Each search uses your Anthropic API credit, so nothing runs until
              you ask for it.
            </p>
            <button
              type="button"
              onClick={() => void search(false)}
              className="mt-2 px-6 py-3 text-sm font-medium tracking-wide text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--accent)" }}
            >
              Search for AI news
            </button>
          </div>
        )}

        {status === "error" && error && (
          <div
            className="space-y-3 border-l-2 py-1 pl-4"
            style={{ borderColor: "var(--danger)" }}
          >
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {error}
            </p>
            <button
              type="button"
              onClick={() => void search(false)}
              className="text-sm font-medium underline decoration-1 underline-offset-4"
              style={{ color: "var(--accent)" }}
            >
              Try again
            </button>
          </div>
        )}

        {status === "loaded" && stories.length === 0 && (
          <div className="space-y-4 py-20 text-center">
            <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
              No significant AI news found in the last week.
            </p>
            <button
              type="button"
              onClick={() => void search(true)}
              className="px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--accent)" }}
            >
              Search again
            </button>
          </div>
        )}

        {status === "loaded" && stories.length > 0 && (
          <>
            <div
              className="mb-6 flex items-baseline justify-between border-b pb-3 text-[13px]"
              style={{ borderColor: "var(--rule)", color: "var(--ink-faint)" }}
            >
              <span>
                {stories.length} {stories.length === 1 ? "story" : "stories"}
              </span>
              {fetchedAt && <span>Searched {formatTimestamp(fetchedAt)}</span>}
            </div>
            <div className="divide-y divide-[var(--rule)]">
              {stories.map((story) => (
                <StoryCard
                  key={story.url}
                  story={story}
                  selected={selected?.url === story.url}
                  onSelect={() => setSelected(story)}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
