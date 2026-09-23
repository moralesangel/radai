import type { Story } from "../lib/firebase";

const CATEGORY_LABELS: Record<Story["category"], string> = {
  "model-release": "Model release",
  research: "Research",
  funding: "Funding",
  product: "Product",
  policy: "Policy",
  other: "Other",
};

type Props = {
  story: Story;
  selected: boolean;
  onSelect: () => void;
};

export function StoryCard({ story, selected, onSelect }: Props) {
  return (
    <article
      className={`rounded-lg border p-4 transition-colors ${
        selected
          ? "border-sky-500 bg-sky-50"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <div className="mb-2 flex items-center gap-2 text-xs">
        <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
          {CATEGORY_LABELS[story.category]}
        </span>
        <span className="text-slate-400">{story.source}</span>
        <span className="ml-auto font-mono text-slate-400">
          {story.significance}/10
        </span>
      </div>

      <h3 className="mb-1 font-semibold text-slate-900">{story.title}</h3>
      <p className="mb-3 text-sm leading-relaxed text-slate-600">
        {story.summary}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSelect}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          Draft LinkedIn post
        </button>
        <a
          href={story.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-sky-600 hover:underline"
        >
          Read source
        </a>
      </div>
    </article>
  );
}
