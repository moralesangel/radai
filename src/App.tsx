import { useState, useEffect, useCallback } from "react";
import { getDigest, type Story } from "./lib/firebase";
import { StoryCard } from "./components/StoryCard";
import { PostComposer } from "./components/PostComposer";

function yesterdayISO(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export default function App() {
  const [date, setDate] = useState(yesterdayISO());
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [selected, setSelected] = useState<Story | null>(null);

  const load = useCallback(async (targetDate: string, refresh = false) => {
    setLoading(true);
    setError(null);
    setSelected(null);
    try {
      const result = await getDigest({ date: targetDate, refresh });
      setStories(result.data.stories);
      setCached(result.data.cached);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the digest.");
      setStories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(date);
    // Intentionally runs once: later loads are driven by the date picker and
    // refresh button, not by every keystroke in the input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-6 py-4">
          <h1 className="text-lg font-semibold text-slate-900">radai</h1>
          <p className="text-sm text-slate-500">Yesterday in AI</p>

          <div className="ml-auto flex items-center gap-2">
            <input
              type="date"
              value={date}
              max={yesterdayISO()}
              onChange={(e) => {
                setDate(e.target.value);
                void load(e.target.value);
              }}
              className="rounded border border-slate-200 px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={() => void load(date, true)}
              disabled={loading}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-6 py-6">
        {selected && (
          <PostComposer story={selected} onClose={() => setSelected(null)} />
        )}

        {loading && (
          <p className="py-12 text-center text-slate-500">
            Searching the web for AI news from {date}. This takes a minute.
          </p>
        )}

        {error && (
          <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}

        {!loading && !error && stories.length === 0 && (
          <p className="py-12 text-center text-slate-500">
            No stories for {date}. Try Refresh or pick another date.
          </p>
        )}

        {!loading && stories.length > 0 && (
          <>
            <p className="text-xs text-slate-400">
              {stories.length} stories
              {cached ? " (cached)" : ""}
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
