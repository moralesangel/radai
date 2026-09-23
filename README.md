# radai

A single-user React app that surfaces yesterday's AI news and drafts LinkedIn
posts about it, powered by Claude (web search + structured outputs) and
Firebase (Cloud Functions + Firestore cache).

## How it works

1. **News discovery** — a Cloud Function calls Claude with the `web_search`
   server tool to find AI news published on a given date, then makes a second
   structured-outputs call to normalize the results into typed JSON
   (`{ title, summary, source, url, category, significance }`).
2. **Caching** — results are cached in Firestore per date, so repeat page
   loads don't re-run the search. A "Refresh" button forces a re-fetch.
3. **LinkedIn drafting** — selecting a story calls a second Cloud Function
   that asks Claude to draft a post in one of three tones. The result is
   editable and copies to the clipboard — nothing is posted to LinkedIn
   automatically (no LinkedIn OAuth is set up).

There is no authentication. This is meant to be run by one person, either
locally or deployed to a Firebase project only they know the URL of. All
Firestore access goes through Cloud Functions (Admin SDK); direct client
reads/writes are denied by `firestore.rules`.

## Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS
- **Backend:** Firebase Cloud Functions (2nd gen, Node 22)
- **Data:** Firestore (cache for digests + generated posts)
- **LLM:** Claude (`claude-haiku-4-5`) via `@anthropic-ai/sdk`, using the
  `web_search` server tool and `output_config.format` structured outputs.
  Haiku keeps a once-a-day digest fetch cheap (see Cost below); swap `MODEL`
  in `functions/src/claude.ts` for `claude-sonnet-5` or `claude-opus-5` if you
  want stronger research/writing and don't mind the higher per-token cost.

## Cost

Firebase stays within the free tier for this usage pattern (a handful of
function calls and Firestore reads/writes a day) — the real cost is Claude API
usage, billed separately from any claude.ai subscription (Pro/Max don't cover
API usage; the API needs its own billing at
[console.anthropic.com](https://console.anthropic.com/settings/billing)).

Each digest fetch makes 2 Claude calls (web search + JSON normalization);
each LinkedIn post is 1 short call. With `claude-haiku-4-5` ($1/$5 per MTok)
and one digest fetch per day, expect roughly **$0.50–$1.50/month**. Switching
`MODEL` to `claude-sonnet-5` or `claude-opus-5` raises quality but multiplies
cost several times over — check current pricing before switching.

## Setup

### 1. Firebase project

```bash
npm install -g firebase-tools
firebase login
firebase projects:create   # or use an existing project
```

Put the project ID in `.firebaserc` (replace `YOUR_FIREBASE_PROJECT_ID`).

Cloud Functions gen 2 requires the **Blaze (pay-as-you-go)** plan — it still
has a generous free tier, but the plan itself must be upgraded to deploy.

### 2. Frontend env

```bash
cp .env.example .env
```

Fill in the Firebase web config values from **Project settings → Your apps →
Web app** in the Firebase console (these are public, not secrets).

### 3. Anthropic API key

The key is never exposed to the browser — it's read by Cloud Functions from
Secret Manager:

```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
```

### 4. Install and run locally

```bash
npm install
cd functions && npm install && cd ..

# Terminal 1: emulate functions + firestore
cd functions && npm run build && firebase emulators:start --only functions,firestore

# Terminal 2: run the frontend against the emulator
echo "VITE_USE_EMULATOR=true" >> .env
npm run dev
```

### 5. Deploy

```bash
cd functions && npm run build && cd ..
firebase deploy --only functions,firestore:rules
npm run build
firebase deploy --only hosting
```

## Project structure

```
src/                     React app
  components/
    StoryCard.tsx         one news story + "draft post" action
    PostComposer.tsx       tone picker + generated post + copy button
  lib/firebase.ts         Firebase client init + typed callable wrappers
  App.tsx                 date picker, digest list, post composer

functions/src/
  claude.ts               Claude calls: web search digest, LinkedIn drafting
  index.ts                Cloud Functions: getDigest, createLinkedInPost
```

## Notes / things you may want to change

- **News source:** Claude's `web_search` tool is doing the discovery — there's
  no dedicated news API. Quality depends on what's indexed and how Claude
  ranks it. If you want a more deterministic source, swap in NewsAPI/GNews/RSS
  and have Claude summarize+rank those results instead of searching cold.
- **Scheduling:** fetching is on-demand (triggered by loading the page or
  hitting Refresh). If you want a fresh digest waiting every morning, add a
  scheduled Cloud Function (`onSchedule`) that calls `fetchDigest` for
  "yesterday" once a day and writes to Firestore.
- **No auth:** anyone with the Hosting URL can use the app and spend your
  Anthropic budget. Fine for personal use; add Firebase Auth + rules if you
  ever share the link.
