import { useState } from "react";
import { createLinkedInPost, type Story, type Tone } from "../lib/firebase";

const TONES: { value: Tone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "conversational", label: "Conversational" },
  { value: "analytical", label: "Analytical" },
];

export function PostComposer({
  story,
  onClose,
}: {
  story: Story;
  onClose: () => void;
}) {
  const [tone, setTone] = useState<Tone>("professional");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const result = await createLinkedInPost({ story, tone });
      setContent(result.data.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate the post.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-slate-900">LinkedIn post</h2>
          <p className="text-sm text-slate-500">{story.title}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-slate-400 hover:text-slate-600"
        >
          Close
        </button>
      </div>

      <div className="mb-3 flex gap-2">
        {TONES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTone(t.value)}
            className={`rounded px-3 py-1 text-sm ${
              tone === t.value
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={generate}
        disabled={loading}
        className="mb-3 rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
      >
        {loading ? "Writing..." : content ? "Regenerate" : "Generate"}
      </button>

      {error && (
        <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>
      )}

      {content && (
        <>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
            className="w-full resize-y rounded border border-slate-200 p-3 text-sm leading-relaxed focus:border-sky-500 focus:outline-none"
          />
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={copy}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
            >
              {copied ? "Copied" : "Copy to clipboard"}
            </button>
            <span className="text-xs text-slate-400">
              {content.trim().split(/\s+/).length} words
            </span>
          </div>
        </>
      )}
    </div>
  );
}
