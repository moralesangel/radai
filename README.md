# radai

A single-user, mobile-friendly React app that finds the most significant
recent AI news on demand and drafts LinkedIn posts about it, powered by Claude
(web search + structured outputs) and Firebase (Cloud Functions + Firestore
cache).

## How it works

1. **News discovery is user-triggered, not scheduled.** Opening the app does
   nothing by itself — the visitor presses "Search for AI news", which calls a
   Cloud Function that asks Claude (with the `web_search` server tool) for the
   most significant AI news from the last 7 days, then makes a second
   structured-outputs call to normalize the results into typed JSON
   (`{ title, summary, source, url, category, significance }`), capped at the
   8 most significant stories. There's no cron job spending your Anthropic
   credit on days you don't open the app.
2. **Caching** — results are cached in Firestore keyed by the visitor's local
   calendar date, so pressing the button again the same day is free. A
   "Search again" button forces a real re-fetch.
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
each LinkedIn post is 1 short call. Web search itself is billed per search
performed (up to 6 per fetch, though the prompt asks Claude to use 3-5
normally to cover a week) on top of token cost. With `claude-haiku-4-5` and
one digest fetch per day, expect roughly **$2.50–$5/month** — most of that is
the search tool, not model tokens, so it doesn't drop much further by
changing `MODEL`. Since
fetching is user-triggered rather than scheduled, days you don't open the app
cost nothing. Switching `MODEL` to `claude-sonnet-5` or `claude-opus-5` raises
research/writing quality but adds meaningfully to the token portion of the
cost — check current pricing before switching.

## Deploy your own copy

Anyone can clone this repo and run their own instance — each copy is fully
independent (own Firebase project, own Anthropic billing, own URL). Nothing
is shared with the original deployment.

You'll need, before starting:

1. **A Firebase project on the Blaze plan.** Create one free at
   [console.firebase.google.com](https://console.firebase.google.com) (any
   name), then upgrade it to **Blaze** under Project settings → Usage and
   billing. Blaze is pay-as-you-go but includes the same free tier as the
   Spark plan — a personal instance of this app (a handful of calls a day)
   is expected to stay within it. It just requires a card on file.
2. **An Anthropic API key with billing set up** at
   [console.anthropic.com](https://console.anthropic.com/settings/billing) —
   this is separate from any claude.ai (Pro/Max) subscription, which does
   *not* cover API usage. See [Cost](#cost) below for what to expect.
3. **Node.js 20+** and the Firebase CLI: `npm install -g firebase-tools`,
   then `firebase login`.

Then, from the cloned repo:

```bash
bash scripts/setup.sh
```

This asks for your Firebase project ID, writes your own `.firebaserc` (not
tracked in git — every clone points at its own project), creates a web app
in it if needed, writes your `.env` from that app's config, and prompts you
to paste your Anthropic key (stored in Secret Manager — it never
enters your `.env` or the git repo). It's interactive and safe to re-run.

Once it finishes:

```bash
npm install && (cd functions && npm install)
firebase deploy
```

`firebase deploy` builds and deploys the frontend, functions, and Firestore
rules together (each has its build step wired into `firebase.json`'s
`predeploy`). It prints your Hosting URL when done — that's your app.

### Running it locally instead of deploying

```bash
# Terminal 1: emulate functions + firestore
cd functions && npm run build && firebase emulators:start --only functions,firestore

# Terminal 2: run the frontend against the emulator
echo "VITE_USE_EMULATOR=true" >> .env
npm run dev
```

### Updating an existing deploy

Made code changes and want them live? Just `firebase deploy` again — no need
to re-run `setup.sh`, which is only for the first-time project link and
secret.

## Project structure

```
src/                     React app
  components/
    StoryCard.tsx         one news story + "draft post" action
    PostComposer.tsx       tone picker + generated post + copy button
  lib/firebase.ts         Firebase client init + typed callable wrappers
  lib/errors.ts           turns callable-function errors into readable text
  App.tsx                 search button, story list, post composer

functions/src/
  claude.ts               Claude calls: web search digest, LinkedIn drafting
  index.ts                Cloud Functions: getDigest, createLinkedInPost
```

## Notes / things you may want to change

- **News source:** Claude's `web_search` tool is doing the discovery — there's
  no dedicated news API. Quality depends on what's indexed and how Claude
  ranks it. If you want a more deterministic source, swap in NewsAPI/GNews/RSS
  and have Claude summarize+rank those results instead of searching cold.
- **Deliberately not scheduled:** an earlier version of this app considered a
  daily cron (`onSchedule`) to have a digest waiting every morning, but that
  spends Anthropic credit every day whether or not you actually look at the
  app. Fetching stays user-triggered by design. If you change your mind,
  `fetchDigest(dateISO, windowDays, maxStories)` in `functions/src/claude.ts`
  is ready to be called from a scheduled function instead.
- **Who can access it — no auth:** there's no login. Anyone who has (or
  guesses) your Hosting URL — e.g. `https://your-project.web.app` — can open
  the app and trigger searches on your Anthropic bill, even though the repo
  itself being public reveals nothing about your specific deployment or its
  URL. Fine for a personal instance you don't share; add Firebase Auth (and
  update `firestore.rules`, though Firestore is already locked to Cloud
  Functions only) if you plan to share the link with anyone else.
