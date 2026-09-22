import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { fetchDigest, generateLinkedInPost, StorySchema } from "./claude.js";
import type { PostTone } from "./claude.js";

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

/** Yesterday in UTC, as YYYY-MM-DD. */
function yesterdayISO(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Returns the AI news digest for a date, fetching it from Claude on a cache
 * miss. Results are cached in Firestore so repeat views cost nothing.
 */
export const getDigest = onCall(runtime, async (request) => {
  const requested = request.data?.date;
  if (requested !== undefined && !DATE_RE.test(String(requested))) {
    throw new HttpsError("invalid-argument", "date must be YYYY-MM-DD.");
  }
  const date = requested ? String(requested) : yesterdayISO();
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
    stories = await fetchDigest(date);
  } catch (err) {
    console.error("digest fetch failed", { date, err });
    throw new HttpsError("internal", "Could not fetch the news digest.");
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
    throw new HttpsError("internal", "Could not generate the post.");
  }

  const doc = await db.collection("posts").add({
    content,
    tone,
    story: parsedStory.data,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { id: doc.id, content, tone };
});
