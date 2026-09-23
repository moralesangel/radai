import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import Anthropic from "@anthropic-ai/sdk";
import { fetchDigest, generateLinkedInPost, StorySchema } from "./claude.js";
import type { PostTone } from "./claude.js";

/**
 * Turns a Claude API failure into a message that's actually useful on the
 * frontend, instead of a bare "internal" 500. Logs the raw error either way.
 */
function describeClaudeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return "The Anthropic API key is missing or invalid. Update the ANTHROPIC_API_KEY secret and redeploy the functions.";
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return "The Anthropic API key does not have permission for this request (check plan/org access).";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "Anthropic rate limit reached. Wait a moment and try again.";
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return "Could not reach the Anthropic API (network issue from the function). Try again shortly.";
  }
  if (err instanceof Anthropic.InternalServerError) {
    return "Anthropic's API is temporarily overloaded or having an outage. Try again shortly.";
  }
  if (err instanceof Anthropic.BadRequestError) {
    return `The request to Claude was rejected: ${err.message}`;
  }
  if (err instanceof Anthropic.APIError) {
    return `Claude API error (${err.status ?? "unknown status"}): ${err.message}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "An unexpected error occurred.";
}

initializeApp();
const db = getFirestore();

// Read from Secret Manager at runtime; the SDK picks it up via the environment.
const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

const runtime = {
  secrets: [anthropicApiKey],
  timeoutSeconds: 540,
  memory: "1GiB" as const,
  region: "us-central1",
};

/** Today in UTC, as YYYY-MM-DD. Used only if the client sends no date. */
function todayUTCISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const WINDOW_DAYS = 7;
const MAX_STORIES = 8;

/**
 * Returns the most significant AI news from the last few days, fetching from
 * Claude on a cache miss. Results are cached in Firestore keyed by the
 * caller's local "today" date, so opening the app more than once on the same
 * day (their time) doesn't re-run the search -- only an explicit refresh does.
 *
 * `date` is the caller's local today (YYYY-MM-DD), not a date to search a
 * single day for -- the search itself always looks back WINDOW_DAYS days from
 * it. The frontend computes this in the visitor's own timezone; falling back
 * to server UTC only covers callers that omit it (e.g. direct API calls).
 */
export const getDigest = onCall(runtime, async (request) => {
  const requested = request.data?.date;
  if (requested !== undefined && !DATE_RE.test(String(requested))) {
    throw new HttpsError("invalid-argument", "date must be YYYY-MM-DD.");
  }
  const date = requested ? String(requested) : todayUTCISO();
  const refresh = request.data?.refresh === true;

  const docRef = db.collection("digests").doc(date);

  if (!refresh) {
    const cached = await docRef.get();
    if (cached.exists) {
      return { date, cached: true, stories: cached.data()?.stories ?? [] };
    }
  }

  let stories;
  try {
    stories = await fetchDigest(date, WINDOW_DAYS, MAX_STORIES);
  } catch (err) {
    console.error("digest fetch failed", { date, err });
    throw new HttpsError("internal", describeClaudeError(err));
  }

  await docRef.set({
    date,
    stories,
    fetchedAt: FieldValue.serverTimestamp(),
  });

  return { date, cached: false, stories };
});

const TONES: PostTone[] = ["professional", "conversational", "analytical"];

/** Drafts a LinkedIn post for one story and saves it to history. */
export const createLinkedInPost = onCall(runtime, async (request) => {
  const parsedStory = StorySchema.safeParse(request.data?.story);
  if (!parsedStory.success) {
    throw new HttpsError("invalid-argument", "A valid story is required.");
  }

  const tone = request.data?.tone ?? "professional";
  if (!TONES.includes(tone)) {
    throw new HttpsError("invalid-argument", `tone must be one of ${TONES.join(", ")}.`);
  }

  let content: string;
  try {
    content = await generateLinkedInPost(parsedStory.data, tone);
  } catch (err) {
    console.error("post generation failed", err);
    throw new HttpsError("internal", describeClaudeError(err));
  }

  const doc = await db.collection("posts").add({
    content,
    tone,
    story: parsedStory.data,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { id: doc.id, content, tone };
});
