# radai

A single-user, mobile-friendly React app that finds the most significant
recent AI news on demand and drafts LinkedIn posts about it, powered by Claude
(web search + structured outputs) and Firebase (Cloud Functions + Firestore
cache).

## How it works

1. **News discovery is user-triggered, not scheduled.** Opening the app
   doesn't run a new search — it restores whatever you found last time (see
   below). Pressing "Search for AI news" calls a Cloud Function that asks
   Claude (with the `web_search` server tool) for the most significant AI
   news from the last 7 days, then makes a second structured-outputs call to
   normalize the results into typed JSON
   (`{ title, summary, source, url, publishedDate, category, significance }`),
   capped at the 8 most significant stories. There's no cron job spending
   your Anthropic credit on days you don't ask for a search.
2. **Caching and restoring** — each search is cached in Firestore keyed by
   the visitor's local calendar date, so pressing "Search again" the same
   day is the only way to spend more credit that day. Separately, a pointer
   to the most recent search ever run (`getLatestDigest`, a read-only,
   Claude-free call) is what the app loads automatically on open — so
   closing the app and coming back later shows the same stories you last
   saw, with the timestamp of when that search ran, until you search again.
3. **LinkedIn drafting** — selecting a story calls a second Cloud Function
   that asks Claude to draft a post in one of three tones. The result is
   editable and copies to the clipboard — nothing is posted to LinkedIn
   automatically (no LinkedIn OAuth is set up).

Only one Google account can use a given deployment — see
[Access control](#access-control). All Firestore access goes through Cloud
Functions (Admin SDK); direct client reads/writes are denied by
`firestore.rules`.

## Access control

The app requires Google Sign-In, but signing in isn't what grants access —
anyone with a Google account can sign in. What actually gates access is a
server-side check: both Cloud Functions (`requireOwner` in
`functions/src/index.ts`) reject every request whose Firebase-verified email
doesn't match the `ALLOWED_EMAIL` value set at deploy time
(`functions/.env`, one email per deployment). Sign in as anyone else and
Firebase Auth succeeds but the functions still return `permission-denied` —
so a stray link, a public repo, or the Hosting URL leaking doesn't let anyone
else spend your Anthropic credit.

## Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS, custom editorial
  theme (Fraunces + Source Sans, warm-paper palette) defined as CSS custom
  properties in `src/index.css` with light/dark variants
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
   is expected to stay within it. It just requires a card on file. (A
   Firebase project is a Google Cloud project underneath, so this is the
   only "GCP project" step — there's nothing separate to create in the GCP
   console itself.)
2. **An Anthropic API key with billing set up** at
   [console.anthropic.com](https://console.anthropic.com/settings/billing) —
   this is separate from any claude.ai (Pro/Max) subscription, which does
   *not* cover API usage. See [Cost](#cost) below for what to expect.
3. **The Google account you'll sign in with.** No account to create — just
   decide which existing Google account (personal Gmail, etc.) should be the
   one allowed to use your deployment. Its email is what you'll enter as
   `ALLOWED_EMAIL` during setup; see [Access control](#access-control).
4. **Node.js 20+** and the Firebase CLI: `npm install -g firebase-tools`,
   then `firebase login`.

Then, from the cloned repo:

```bash
bash scripts/setup.sh
```

This asks for your Firebase project ID, writes your own `.firebaserc` (not
tracked in git — every clone points at its own project), creates a web app
in it if needed, writes your `.env` from that app's config, prompts you to
paste your Anthropic key (stored in Secret Manager — it never enters your
`.env` or the git repo), asks for the Google account email that should be
allowed to use the app (written to `functions/.env`, also gitignored), and
walks you through the one manual step left — enabling the Google sign-in
provider in the Firebase console, which has no CLI equivalent for a brand
new project. It's interactive and safe to re-run.

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

### A shorter Hosting URL

By default your app lives at `https://<your-project-id>.web.app`, which
often carries an auto-generated suffix (Firebase project IDs are globally
unique, so `radai` alone may already be taken — this deployment's project is
`radia-889ee`, for instance). If you'd rather have a clean name like
`https://your-name.web.app`, Firebase Hosting supports multiple named
"sites" per project, independent of the project ID:

```bash
firebase hosting:sites:create your-name --project your-project-id
```

Then deploy to it with a personal config override (kept local, never
committed — everyone else keeps deploying with the plain `firebase deploy`
above, so this is opt-in and doesn't affect them):

```bash
node -e "
const fs = require('fs');
const cfg = JSON.parse(fs.readFileSync('firebase.json', 'utf8'));
cfg.hosting.site = 'your-name';
fs.writeFileSync('firebase.personal.json', JSON.stringify(cfg, null, 2));
"
firebase deploy --only hosting -c firebase.personal.json
```

(Functions and Firestore still deploy the normal way; only Hosting has a
separate site name.) For a fully custom domain instead of `*.web.app`, see
[Firebase's custom domain docs](https://firebase.google.com/docs/hosting/custom-domain).

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
    SignIn.tsx             Google sign-in screen shown when logged out
  lib/firebase.ts         Firebase client init, auth helpers, callable wrappers
  lib/errors.ts           turns callable-function errors into readable text
  App.tsx                 auth gate, search button, story list, post composer

functions/src/
  claude.ts               Claude calls: web search digest, LinkedIn drafting
  index.ts                Cloud Functions: getDigest, getLatestDigest,
                           createLinkedInPost, requireOwner (ALLOWED_EMAIL check)
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
- **Sharing with more than one person:** `ALLOWED_EMAIL` is a single email.
  To allow a small fixed set of people, change the check in `requireOwner`
  (`functions/src/index.ts`) to compare against a list instead.
