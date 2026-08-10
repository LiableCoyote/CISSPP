import http from "node:http";
import { existsSync } from "node:fs";
import { chromium, firefox, webkit } from "playwright";

export const BASE = process.env.QA_BASE_URL || "http://127.0.0.1:4173";

export const ROUTES = [
  "/",
  "/plan",
  "/flashcards",
  "/quiz",
  "/domains",
  "/vault",
  "/stats",
  "/achievements",
  "/pace",
  "/report",
  "/resources",
  "/settings",
];

export const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

/**
 * Launch config per engine.
 *
 * The dev container ships a Chromium whose build number doesn't match what
 * Playwright expects, so the default executable path misses and it has to be
 * pointed at the installed one. CI installs browsers normally, where that path
 * doesn't exist — so use it only when it does, and otherwise let Playwright
 * resolve its own.
 */
const LOCAL_CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const ENGINES = {
  chromium: {
    type: chromium,
    options: existsSync(LOCAL_CHROMIUM) ? { executablePath: LOCAL_CHROMIUM } : {},
  },
  firefox: { type: firefox, options: {} },
  webkit: { type: webkit, options: {} },
};

export function parseBrowserArg(argv = process.argv) {
  const arg = argv.find((a) => a.startsWith("--browser="));
  return arg ? arg.split("=")[1] : "chromium";
}

export async function launch(name) {
  const engine = ENGINES[name];
  if (!engine) throw new Error(`Unknown browser "${name}". Use chromium, firefox or webkit.`);
  try {
    return await engine.type.launch(engine.options);
  } catch (err) {
    // WebKit's host libraries can't be installed in the dev container. Skipping
    // is right there, but never in CI — that is the one place it can run, and a
    // silent skip would defeat the point of adding it.
    if (name === "webkit" && !process.env.CI) {
      console.log("SKIP  webkit — host libraries are not available in this environment.");
      return null;
    }
    throw err;
  }
}

/**
 * Opens a page with onboarding already dismissed and the database seeded.
 * Without the flag the onboarding modal covers every route and the results
 * describe the modal rather than the page.
 */
export async function newSeededPage(browser, viewport) {
  // Service workers are blocked so runs are deterministic — a worker activating
  // mid-sweep would race the first navigation, which Firefox reports as
  // "interrupted by another navigation".
  const ctx = await browser.newContext({ viewport, serviceWorkers: "block" });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem("cisspp-onboarded-default", "1"));

  try {
    await page.goto(BASE, { waitUntil: "commit" });
  } catch (err) {
    // HashRouter rewrites the URL on mount, which can still land as an
    // interrupted navigation. The document loads regardless, so wait it out
    // below rather than failing the run.
    if (!/interrupted by another navigation/.test(String(err))) throw err;
  }

  // Wait for the shell to actually render rather than for a lifecycle event.
  // `document.body` can still be null when the predicate first runs with
  // waitUntil "commit", so guard it.
  await page.waitForFunction(() => !!document.body && document.body.innerText.trim().length > 40, null, {
    timeout: 20_000,
  });
  await page.waitForTimeout(1200);
  return { ctx, page };
}

/**
 * Switches route the way the app itself does, by assigning location.hash.
 * page.goto() to a hash-only difference is not a navigation, and engines
 * disagree about what it does.
 */
export async function gotoRoute(page, route, settleMs = 700) {
  await page.evaluate((r) => {
    window.location.hash = r;
  }, route);
  await page.waitForTimeout(settleMs);
}

/**
 * Uses node:http rather than fetch — undici honours the sandbox proxy
 * configuration and rejects a plain loopback URL with "bad port".
 */
export async function assertServerUp() {
  const reachable = await new Promise((resolve) => {
    const req = http.get(BASE, (res) => {
      res.resume();
      resolve(res.statusCode !== undefined && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(4000, () => {
      req.destroy();
      resolve(false);
    });
  });

  if (!reachable) {
    console.error(
      `Cannot reach ${BASE}.\n` +
        `Start it first:  npm run build && npx vite preview --port 4173 --strictPort &\n` +
        `Or point the scripts elsewhere with QA_BASE_URL.`,
    );
    process.exit(2);
  }
}
