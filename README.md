# CISSPP — Gamified CISSP Study Quest

A single-user, mobile-first, offline-capable PWA that turns an 8-week CISSP study plan into a gamified daily experience. Built for personal use during exam prep.

## Features

- **8-week campaign** with 56 seeded quests mapped to the standard CISSP study plan
- **246 CISSP-style questions** with CISO-mindset detection (technician trap + speed-reader nudges) and per-question confidence ratings
- **Not gameable** — an audit found the bank beatable with no CISSP knowledge:
  always picking B scored 79.7% and always picking the longest option scored
  95%, both past the pass mark. Options are now shuffled per attempt and every
  distractor has been rewritten; both cheats score at chance (26% and 29%), and
  `src/data/content.test.ts` fails the build if either tell returns
- **179 high-yield flashcards** across all 8 domains with SM-2 spaced repetition, swipe gestures, and search/domain/tag filtering
- **Memorization vault** — 12 drag-to-order sequences (BCP, NIST IR, OSI, RMF, forensics, IAAA, data lifecycle, change management, DR test rigor, SDLC, Kerberos, evidence lifecycle) and 12 reference tables
- **Vault Quick Test** — 5 timed recall questions generated from any sequence's canonical order
- **Full-length exam simulation** (150 Q, 3 hr, hard no-back rule, CAT-style)
- **Retry your misses** — questions you get wrong come back on their own SM-2
  schedule, hardest first; answer one correctly twice and it stops chasing you
- **Study analytics** — 30/90-day timeline, per-domain learning curves with 7-day movement, stalled-domain detection, 90-day heatmap, score trends, CISO Thinking Score
- **Confidence calibration** — whether you're right as often as you think, from
  the 1-5 rating you give each answer; refuses to draw a curve until there's
  enough data to mean something
- **Pacing** — median seconds a question against the real 72s exam budget, split
  by right and wrong, so fast-and-wrong shows up as the distinct problem it is
- **Next Up recommendations** — ranks what to study next from your actual behaviour, plus signals for cramming, low-score runs, dormancy, and SRS backlog; miss patterns route to the right drill (mindset → vault, knowledge → domain, misread → pacing)
- **Gamification** — XP, 10 level titles, daily streak with freeze, 29 achievements across 8 categories with Common/Rare/Epic/Legendary difficulty tiers (all 29 reachable)
- **Exam readiness** — mastery weighted by each domain's real exam weight, with
  its own uncertainty attached: untested and thinly-covered domains are named,
  and a trend line is only drawn when there's enough history to justify one
- **Pace Board** — your standing against six reference study paces, scaled to your campaign week
- **Study report** — printable summary (readiness with its caveats, calibration, pacing, campaign, mastery, quiz history, achievements); save as PDF from the browser print dialog
- **Your Gaps** — every question you've missed, what keeps catching you out, and
  when each one comes back; prompts only, never the answers
- **Share card** — PNG export with weekly deltas and a progress headline
- **Pomodoro FAB** that logs focus minutes automatically
- **Daily reminder** — an in-app nudge at your preferred time on every platform,
  plus a best-effort system notification where the browser can wake the app.
  No web app can schedule a notification for a chosen time without a server, and
  the UI says so rather than implying otherwise
- **Mobile-first** — bottom nav, 48px tap targets, swipe gestures, safe-area support, haptic feedback
- **PWA** — installs to home screen, works 100% offline after first load
- **Fast to start** — 290KB entry chunk; the question bank, flashcard deck and
  vault tables load on demand, not before the first paint
- **Accessible** — WCAG 2.1 AA: zero axe-core violations across all 13 routes; skip links, ARIA landmarks, keyboard-only operation, reduced-motion support
- **Safe by default** — automatic snapshots before anything destructive, a confirmation step on import, a validated backup format, and a failed write that says so instead of celebrating
- **Truly offline** — fonts are bundled, not fetched; the app makes no third-party request at any point

## Local development

```bash
npm install --legacy-peer-deps
npm run dev        # http://localhost:5173
npm run build      # production build to dist/
npm run preview    # preview production build
```

## Deploying to GitHub Pages

A workflow in `.github/workflows/deploy.yml` auto-deploys on push, once CI passes:

1. Go to **Settings → Pages → Build and deployment**
2. Set **Source** to **GitHub Actions**
3. Push to `main` — the workflow builds and deploys to `https://<user>.github.io/<repo>/`

The app uses relative paths (`base: "./"` in Vite) and **HashRouter**, so it works at any sub-path and doesn't need the 404.html SPA-redirect hack.

### Deploying elsewhere

Works as-is on Vercel, Netlify, Cloudflare Pages, or any static host — just point at the `dist/` folder after `npm run build`.

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS
- Zustand (state)
- Dexie (IndexedDB persistence)
- React Router (HashRouter)
- Recharts (stats visualizations)
- Framer Motion (swipe + drag gestures)
- vite-plugin-pwa (service worker + manifest)

## Data

Everything lives in IndexedDB in your browser. No backend. No auth. Export to JSON from **Settings → Backup & Restore** before clearing browser storage or switching devices.

Because there's no backend, two things that look like social features aren't:

- **Achievement tiers** (Common → Legendary) rate how hard a badge is to earn. They are not percentages of other users.
- **The Pace Board** ranks you against named reference paces with defined weekly rates, not against real people.

New seed content added in an update — cards, quests, questions and resources —
is backfilled into an existing database by id on next load, so your SRS
progress, quiz history and streak survive upgrades. **Corrections** land too:
question text is refreshed outright (those rows hold no progress), while cards
and quests have only their authored fields refreshed so scheduling and
completion stay yours.

The backfill is gated on `CONTENT_VERSION` in `src/db/seed.ts`, recorded per
profile slot. **Bump it whenever you change seed content** — if you don't, the
new rows never reach anyone who already has a database. If storage is blocked
the gate reads as unset and the backfill simply runs, so the failure mode is a
slower launch, not missing content.

Backups are versioned. Versions 1 and 2 still restore; version 2 added
vault-game wins and your reminder settings, and version 3 adds the retry
schedule for missed questions.

On first launch the app calls `navigator.storage.persist()` to ask the browser
not to clear this data to free space. **That is a request, not a guarantee.**
Chrome decides silently, Firefox prompts, and Safari and iOS effectively ignore
it — on iOS site data can still be cleared after about a week of not opening the
app. Settings shows what your browser actually answered rather than assuming.

The snapshots are not a backup: they live in the same database, so anything that
clears it takes them too. **Only a downloaded export survives.** The app tracks
when you last exported and raises a dashboard reminder once it goes stale. The app also keeps the three most recent
automatic snapshots (daily, and before any import or reset) so an accidental
restore is undoable from **Settings → Backup & Restore**.

## Verification

```bash
npm run lint          # ESLint — expected: 0 problems
npm run typecheck     # types (tsc -b)
npm test              # Vitest unit suite
npm run build         # production build
```

> `npx tsc --noEmit` against the root config is a **no-op** — `tsconfig.json` is
> solution-style (references only, no `include`), so it exits 0 without checking
> anything. Use `npm run typecheck`.

### Browser QA

The sweeps need a server running first:

```bash
npm run build
npx vite preview --port 4173 --strictPort --host 127.0.0.1 &

npm run qa            # Chromium: routes + accessibility
npm run qa:firefox    # same, in Firefox
```

`--host 127.0.0.1` is not optional padding. Without it Vite binds whatever
`localhost` resolves to, and where that is `::1` first — GitHub's runners, for
one — the server starts, prints its banner and is unreachable at the IPv4
address the scripts use. It presents as a hang, not as a bind failure.

- `scripts/qa-routes.mjs` — every route at 375 / 768 / 1440 px, failing on
  horizontal overflow, a blank render, or a console error
- `scripts/qa-a11y.mjs` — axe-core WCAG 2.1 A/AA scan on every route

Both accept `--browser=chromium|firefox`. Point them elsewhere with
`QA_BASE_URL`. Avoid ports on the [WHATWG bad-port list](https://fetch.spec.whatwg.org/#port-blocking)
— 4190 and similar are refused by browsers outright and look like an app hang.

Locally the scripts run against Chromium and Firefox. **WebKit is skipped with
a message** — its host libraries can't be installed in this dev container — but
it *does* run in CI, which is the only place it can.

## CI

`.github/workflows/ci.yml` runs on every pull request, and on every push via
`deploy.yml`, which will not ship unless it passes:

- lint, typecheck and the full unit suite
- route and accessibility sweeps across **Chromium, Firefox and WebKit**

WebKit passed its first real run clean, across all 13 routes at all three
viewports. That was not a foregone conclusion — it had never executed the app
anywhere before CI existed.

Typecheck is its own step rather than riding on `npm run build`. If the build
script were ever simplified to plain `vite build`, typechecking would otherwise
disappear from CI with no other signal.

Node is pinned by `.nvmrc` and the `engines` field so local and CI can't drift.
`--legacy-peer-deps` is required, not cosmetic: `vite-plugin-pwa@1` declares
`vite ^3||^4||^5||^6||^7` while this project is on Vite 8. Retire the flag when
that upstream range catches up.

### Tests

467 tests over the pure logic: export/import and every rejection path, analytics
and study signals, recommendations, miss remediation, campaign/date helpers, quiz scoring and
question selection, question spaced repetition,
confidence calibration, exam pacing, readiness weighting and projection,
reminder scheduling and capability detection,
failure reporting, storage durability and backup age,
and the seeded content itself, XP rewards, profile slots, quick-test generation, SM-2, XP
levels, ISO week keys, guarded storage, seed idempotency snapshots and the
achievement engine. No jsdom, no component tests — Dexie runs on
`fake-indexeddb`.

Logic that decides something lives in `src/lib/`, not in a component, so it can
be tested without a DOM. `scoring.ts` and `rewards.ts` were extracted from
`QuizSessionPage`, `ReviewSession` and `QuickTestMode` for exactly that reason —
`scorePct` feeds domain velocity, boss badges and the remediation banner, and
was previously verified nowhere.

Anything time-dependent takes the clock as a parameter, so the suite does not
change behaviour when it happens to run.

## Keyboard shortcuts

- **Flashcards review**: Space/Enter to reveal, `1`-`4` to grade
- **Quiz**: `1`-`4` to pick an option
- **Vault mini-games**: Alt+↑/↓ to move items, Enter to check
- **Modals** (including Vault Quick Test): Escape to close
- **Global**: `?` for the shortcut list, Cmd/Ctrl+K for search
- Skip-to-content link appears on first Tab

## License

Personal project. Fork it, use it, ignore it.
