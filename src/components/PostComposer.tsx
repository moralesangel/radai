import { useState } from "react";
import { createLinkedInPost, type Story, type Tone } from "../lib/firebase";
import { describeError } from "../lib/errors";

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
      setError(describeError(err, "Could not generate the post."));
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
    <div
      className="border-l-2 py-1 pl-5"
      style={{ borderColor: "var(--accent)" }}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p
            className="mb-0.5 text-[13px] font-medium uppercase tracking-[0.1em]"
            style={{ color: "var(--accent)" }}
          >
            LinkedIn draft
          </p>
          <p className="font-display text-lg" style={{ color: "var(--ink)" }}>
            {story.title}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-sm transition-opacity hover:opacity-70"
          style={{ color: "var(--ink-faint)" }}
        >
          Close
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {TONES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTone(t.value)}
            className="px-3 py-1 text-sm transition-colors"
            style={
              tone === t.value
                ? { background: "var(--accent)", color: "white" }
                : { background: "var(--accent-soft)", color: "var(--ink-dim)" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={generate}
        disabled={loading}
        className="mb-4 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: "var(--accent)" }}
      >
        {loading ? "Writing…" : content ? "Regenerate" : "Generate"}
      </button>

      {error && (
        <p
          className="mb-4 text-sm"
          style={{ color: "var(--danger)" }}
        >
          {error}
        </p>
      )}

      {content && (
        <>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
            className="w-full resize-y border p-3 text-[15px] leading-relaxed focus:outline-none"
            style={{
              borderColor: "var(--rule)",
              background: "var(--surface)",
              color: "var(--ink)",
            }}
          />
          <div className="mt-3 flex items-center gap-4">
            <button
              type="button"
              onClick={copy}
              className="px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--ink)" }}
            >
              {copied ? "Copied" : "Copy to clipboard"}
            </button>
            <span className="text-[13px]" style={{ color: "var(--ink-faint)" }}>
              {content.trim().split(/\s+/).length} words
            </span>
          </div>
        </>
      )}
    </div>
  );
}
