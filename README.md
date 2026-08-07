# CISSPP — Gamified CISSP Study Quest

A single-user, mobile-first, offline-capable PWA that turns an 8-week CISSP study plan into a gamified daily experience. Built for personal use during exam prep.

## Features

- **8-week campaign** with 56 seeded quests mapped to the standard CISSP study plan
- **245+ CISSP-style questions** with CISO-mindset detection (technician trap + speed-reader nudges) and per-question confidence ratings
- **179 high-yield flashcards** across all 8 domains with SM-2 spaced repetition, swipe gestures, and search/domain/tag filtering
- **Memorization vault** — 12 drag-to-order sequences (BCP, NIST IR, OSI, RMF, forensics, IAAA, data lifecycle, change management, DR test rigor, SDLC, Kerberos, evidence lifecycle) and 12 reference tables
- **Vault Quick Test** — 5 timed recall questions generated from any sequence's canonical order
- **Full-length exam simulation** (150 Q, 3 hr, hard no-back rule, CAT-style)
- **Study analytics** — 30/90-day timeline, per-domain learning curves with 7-day movement, stalled-domain detection, 90-day heatmap, score trends, CISO Thinking Score
- **Next Up recommendations** — ranks what to study next from your actual behaviour, plus signals for cramming, low-score runs, dormancy, and SRS backlog
- **Gamification** — XP, 10 level titles, daily streak with freeze, 29 achievements across 8 categories with Common/Rare/Epic/Legendary difficulty tiers (all 29 reachable)
- **Pace Board** — your standing against six reference study paces, scaled to your campaign week
- **Study report** — printable summary (campaign, mastery, quiz history, achievements); save as PDF from the browser print dialog
- **Share card** — PNG export with weekly deltas and a progress headline
- **Pomodoro FAB** that logs focus minutes automatically
- **Mobile-first** — bottom nav, 48px tap targets, swipe gestures, safe-area support, haptic feedback
- **PWA** — installs to home screen, works 100% offline after first load
- **Accessible** — WCAG 2.1 AA: zero axe-core violations across all 12 routes; skip links, ARIA landmarks, keyboard-only operation, reduced-motion support
- **Safe by default** — automatic snapshots before anything destructive, a confirmation step on import, and a validated backup format
- **Truly offline** — fonts are bundled, not fetched; the app makes no third-party request at any point

## Local development

```bash
npm install --legacy-peer-deps
npm run dev        # http://localhost:5173
npm run build      # production build to dist/
npm run preview    # preview production build
```

## Deploying to GitHub Pages

A workflow in `.github/workflows/deploy.yml` auto-deploys on push to `main`:

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
progress, quiz history and streak survive upgrades.

Backups are versioned. Version 1 files still restore; version 2 adds vault-game
wins and your reminder settings. The app also keeps the three most recent
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
npx vite preview --port 4173 --strictPort &

npm run qa            # Chromium: routes + accessibility
npm run qa:firefox    # same, in Firefox
```

- `scripts/qa-routes.mjs` — every route at 375 / 768 / 1440 px, failing on
  horizontal overflow, a blank render, or a console error
- `scripts/qa-a11y.mjs` — axe-core WCAG 2.1 A/AA scan on every route

Both accept `--browser=chromium|firefox`. Point them elsewhere with
`QA_BASE_URL`. Avoid ports on the [WHATWG bad-port list](https://fetch.spec.whatwg.org/#port-blocking)
— 4190 and similar are refused by browsers outright and look like an app hang.

**Verified in Chromium 141 and Firefox 153**: 36 route/viewport combinations
clean, zero axe violations. WebKit is skipped with a message — its host
libraries are not installable in this environment.

### Tests

215 tests over the pure logic: export/import and every rejection path, analytics
and study signals, recommendations, campaign/date helpers, quick-test
generation, SM-2, XP levels, ISO week keys, guarded storage, seed idempotency
and the achievement engine. No jsdom, no component tests — Dexie runs on
`fake-indexeddb`.

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
