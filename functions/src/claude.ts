import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

// Haiku 4.5 keeps this app's cost near-zero for a once-a-day digest fetch.
// Two tradeoffs versus Opus/Sonnet, both handled below:
// - Haiku uses `thinking: { type: "enabled", budget_tokens }`, not adaptive.
// - Haiku doesn't support the newer web_search_20260209 tool variant, so we
//   use the basic web_search_20250305 tool instead.
const MODEL = "claude-haiku-4-5";

/** Lazily constructed so a missing key fails at call time, not at module load. */
let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

export const StorySchema = z.object({
  title: z.string(),
  summary: z.string(),
  source: z.string(),
  url: z.string(),
  category: z.enum([
    "model-release",
    "research",
    "funding",
    "product",
    "policy",
    "other",
  ]),
  significance: z.number(),
});

const DigestSchema = z.object({
  stories: z.array(StorySchema),
});

export type Story = z.infer<typeof StorySchema>;

/**
 * Runs a request that uses the web_search server tool.
 *
 * Server-tool turns can stop with `stop_reason: "pause_turn"` when the search
 * runs long. That is not an error and not a final answer -- the turn has to be
 * resumed by pushing the paused assistant content back as-is. Without this the
 * response is silently truncated.
 */
async function runWithWebSearch(
  prompt: string,
  maxSearches: number,
): Promise<string> {
  const anthropic = getClient();
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: prompt },
  ];

  // Bounded so a pathological pause loop cannot run forever.
  for (let i = 0; i < 10; i++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "enabled", budget_tokens: 4000 },
      tools: [
        { type: "web_search_20250305", name: "web_search", max_uses: maxSearches },
      ],
      messages,
    });

    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }

    if (response.stop_reason === "refusal") {
      throw new Error("Claude declined this request.");
    }

    return response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  }

  throw new Error("Web search did not converge after 10 turns.");
}

/**
 * Finds the most significant AI news from the `windowDays` days up to and
 * including `throughDateISO` (YYYY-MM-DD, the caller's "today"), and returns
 * up to `maxStories` as structured stories, most significant first.
 *
 * Two passes on purpose: structured outputs and server tools don't combine
 * cleanly, so pass 1 searches freely and pass 2 normalizes that prose into
 * schema-valid JSON.
 */
export async function fetchDigest(
  throughDateISO: string,
  windowDays = 2,
  maxStories = 8,
): Promise<Story[]> {
  const research = await runWithWebSearch(
    `Find the most significant artificial intelligence news from the last
${windowDays} days, up to and including ${throughDateISO}.

Search the web for AI news from that window. Cover model releases, research
papers, funding rounds, product launches, and AI policy -- but use your searches
economically: 2-4 well-chosen queries is normally enough to cover these
categories, so don't spend a search confirming something you're already
confident about.

For each story report: headline, 2-3 sentence summary, publication name, the URL,
the publication date, and why it matters. Only include stories actually
published within that window. Favor genuinely significant developments over
routine updates -- report at most the ${maxStories} most significant stories
you find, and fewer if that's all there is.`,
    5,
  );

  const parsed = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 16000,
    messages: [
      {
        role: "user",
        content: `Convert this AI news research into structured JSON.

Rules:
- Include at most ${maxStories} stories -- the most significant ones.
- "significance" is 1-10, where 10 is a landmark event for the field.
- "url" must be the real article URL from the research. Never invent one.
- "source" is the publication name, e.g. "TechCrunch".
- Order by significance, highest first.

Research:
${research}`,
      },
    ],
    output_config: { format: zodOutputFormat(DigestSchema) },
  });

  return parsed.parsed_output?.stories ?? [];
}

export type PostTone = "professional" | "conversational" | "analytical";

/** Drafts a LinkedIn post about one story. */
export async function generateLinkedInPost(
  story: Story,
  tone: PostTone,
): Promise<string> {
  const toneGuide: Record<PostTone, string> = {
    professional: "Polished and industry-focused. Suited to a senior audience.",
    conversational: "Warm and direct, first person, plain language.",
    analytical: "Lead with implications and second-order effects.",
  };

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4000,
    thinking: { type: "enabled", budget_tokens: 2000 },
    system: `You write LinkedIn posts about AI news for a technical professional.

Constraints:
- 120-200 words.
- Open with a hook that is not a question.
- Give a genuine point of view, not just a summary.
- End with one question that invites discussion.
- At most 3 hashtags, on the final line.
- No em dashes. No "game-changer", "revolutionary", or "dive into".
- Return only the post text, with no preamble or surrounding quotes.`,
    messages: [
      {
        role: "user",
        content: `Tone: ${toneGuide[tone]}

Story: ${story.title}
Source: ${story.source}
Summary: ${story.summary}
URL: ${story.url}`,
      },
    ],
  });

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
