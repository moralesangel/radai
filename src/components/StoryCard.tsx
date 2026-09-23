import type { Story } from "../lib/firebase";

const CATEGORY_LABELS: Record<Story["category"], string> = {
  "model-release": "Model release",
  research: "Research",
  funding: "Funding",
  product: "Product",
  policy: "Policy",
  other: "Other",
};

/** "22 Sep" from a YYYY-MM-DD string, in the visitor's own locale. */
function formatStoryDate(dateISO: string): string {
  if (!dateISO) return "Date unclear";
  const [y, m, d] = dateISO.split("-").map(Number);
  if (!y || !m || !d) return "Date unclear";
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

/** A short horizontal bar out of 10, standing in for the significance score. */
function SignificanceMeter({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(10, value));
  return (
    <span
      className="inline-flex items-center gap-[3px]"
      title={`Significance ${clamped}/10`}
      aria-label={`Significance ${clamped} out of 10`}
    >
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          className="h-2.5 w-[3px] rounded-full"
          style={{
            background: i < clamped ? "var(--accent)" : "var(--rule)",
          }}
        />
      ))}
    </span>
  );
}

type Props = {
  story: Story;
  selected: boolean;
  onSelect: () => void;
};

export function StoryCard({ story, selected, onSelect }: Props) {
  return (
    <article className="py-6 first:pt-0">
      <div
        className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]"
        style={{ color: "var(--ink-faint)" }}
      >
        <span
          className="font-medium uppercase tracking-[0.1em]"
          style={{ color: "var(--accent)" }}
        >
          {CATEGORY_LABELS[story.category]}
        </span>
        <span aria-hidden style={{ color: "var(--rule-strong)" }}>
          ·
        </span>
        <time dateTime={story.publishedDate || undefined}>
          {formatStoryDate(story.publishedDate)}
        </time>
        <span aria-hidden style={{ color: "var(--rule-strong)" }}>
          ·
        </span>
        <span>{story.source}</span>
        <SignificanceMeter value={story.significance} />
      </div>

      <h3
        className="font-display mb-2 text-xl leading-snug"
        style={{ color: "var(--ink)" }}
      >
        {story.title}
      </h3>
      <p
        className="mb-4 max-w-prose text-[15px] leading-relaxed"
        style={{ color: "var(--ink-dim)" }}
      >
        {story.summary}
      </p>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <button
          type="button"
          onClick={onSelect}
          className="font-medium underline decoration-1 underline-offset-4 transition-opacity hover:opacity-70"
          style={{ color: selected ? "var(--ink-faint)" : "var(--accent)" }}
        >
          {selected ? "Drafting…" : "Draft LinkedIn post"}
        </button>
        <a
          href={story.url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-1 underline-offset-4 transition-opacity hover:opacity-70"
          style={{ color: "var(--ink-faint)" }}
        >
          Read source ↗
        </a>
      </div>
    </article>
  );
}
