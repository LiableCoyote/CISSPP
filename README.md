# CISSPP — Gamified CISSP Study Quest

A single-user, mobile-first, offline-capable PWA that turns an 8-week CISSP study plan into a gamified daily experience. Built for personal use during exam prep.

## Features

- **8-week campaign** with 56 seeded quests mapped to the standard CISSP study plan
- **~120 CISSP-style questions** with CISO-mindset detection (technician trap + speed-reader nudges)
- **~55 high-yield flashcards** with SM-2 spaced repetition and swipe gestures
- **Memorization vault** with drag-to-order mini-games for BCP, NIST IR phases, OSI layers
- **Full-length exam simulation** (150 Q, 3 hr, hard no-back rule, CAT-style)
- **Progress tracking** — 90-day heatmap, score trends, CISO Thinking Score, weakest-domain alerts
- **Gamification** — XP, 10 security-themed level titles, daily streak with freeze, 29 achievements
- **Pomodoro FAB** that logs focus minutes automatically
- **Mobile-first** — bottom nav, 48px tap targets, swipe gestures, safe-area support, haptic feedback
- **PWA** — installs to home screen, works 100% offline after first load
- **Accessible** — WCAG 2.1 AA foundations: skip links, ARIA landmarks, keyboard-only operation, reduced-motion support

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

## Keyboard shortcuts

- **Flashcards review**: Space/Enter to reveal, `1`-`4` to grade
- **Quiz**: `1`-`4` to pick an option
- **Vault mini-games**: Alt+↑/↓ to move items, Enter to check
- **Modals**: Escape to close
- Skip-to-content link appears on first Tab

## License

Personal project. Fork it, use it, ignore it.
