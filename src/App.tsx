import { useState, useCallback } from "react";
import { getDigest, type Story } from "./lib/firebase";
import { describeError } from "./lib/errors";
import { StoryCard } from "./components/StoryCard";
import { PostComposer } from "./components/PostComposer";

/** Today in the visitor's own timezone, as YYYY-MM-DD (not UTC). */
function localTodayISO(): string {
  const d = new Date();
  const offsetMs = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 10);
}

type Status = "idle" | "loading" | "loaded" | "error";

export default function App() {
  const [status, setStatus] = useState<Status>("idle");
  const [stories, setStories] = useState<Story[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [selected, setSelected] = useState<Story | null>(null);

  // Nothing fetches on page load -- searching costs money (Claude web search
  // + tokens), so it only runs when the user explicitly asks for it. A cache
  // hit for today's date is still free to re-check.
  const search = useCallback(async (refresh = false) => {
    setStatus("loading");
    setError(null);
    setSelected(null);
    try {
      const result = await getDigest({ date: localTodayISO(), refresh });
      setStories(result.data.stories);
      setCached(result.data.cached);
      setStatus("loaded");
    } catch (err) {
      setError(describeError(err, "Could not load the digest."));
      setStories([]);
      setStatus("error");
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">radai</h1>
            <p className="text-sm text-slate-500">The most relevant AI news, on demand</p>
          </div>

          {status === "loaded" && (
            <button
              type="button"
              onClick={() => void search(true)}
              className="ml-auto shrink-0 rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
            >
              Search again
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6">
        {selected && (
          <PostComposer story={selected} onClose={() => setSelected(null)} />
        )}

        {status === "idle" && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <p className="max-w-sm text-slate-500">
              Search the web for the most significant AI news from the last
              couple of days. Each search uses your Anthropic API credit.
            </p>
            <button
              type="button"
              onClick={() => void search(false)}
              className="rounded bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
            >
              Search for AI news
            </button>
          </div>
        )}

        {status === "loading" && (
          <p className="py-12 text-center text-slate-500">
            Searching the web for recent AI news. This takes a minute.
          </p>
        )}

        {status === "error" && error && (
          <div className="space-y-3">
            <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => void search(false)}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Try again
            </button>
          </div>
        )}

        {status === "loaded" && stories.length === 0 && (
          <div className="space-y-3 py-12 text-center text-slate-500">
            <p>No significant AI news found in the last couple of days.</p>
            <button
              type="button"
              onClick={() => void search(true)}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Search again
            </button>
          </div>
        )}

        {status === "loaded" && stories.length > 0 && (
          <>
            <p className="text-xs text-slate-400">
              {stories.length} stories{cached ? " · already searched today" : ""}
            </p>
            {stories.map((story) => (
              <StoryCard
                key={story.url}
                story={story}
                selected={selected?.url === story.url}
                onSelect={() => setSelected(story)}
              />
            ))}
          </>
        )}
      </main>
    </div>
  );
}
