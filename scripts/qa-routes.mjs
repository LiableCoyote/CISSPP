/**
 * Loads every route at three viewports and fails on horizontal overflow, a
 * blank render, or a console/page error.
 *
 * Overflow is the one worth explaining: a container that cannot shrink pushes
 * the document wider than the viewport, which on a phone means the whole page
 * scrolls sideways. Two such bugs shipped before this check existed, both from
 * a flex or grid child defaulting to min-width:auto.
 *
 * Usage: node scripts/qa-routes.mjs [--browser=chromium|firefox]
 */
import { ROUTES, VIEWPORTS, launch, newSeededPage, gotoRoute, parseBrowserArg, assertServerUp } from "./qa-lib.mjs";

const browserName = parseBrowserArg();
await assertServerUp();

const browser = await launch(browserName);
if (!browser) process.exit(0); // engine unavailable, reported by launch()

console.log(`\nRoute check — ${browserName} ${browser.version()}\n`);
let failures = 0;

for (const vp of VIEWPORTS) {
  const { ctx, page } = await newSeededPage(browser, { width: vp.width, height: vp.height });
  const errors = [];
  page.on("pageerror", (e) => errors.push(`PAGEERROR ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/ERR_CONNECTION_RESET|favicon/.test(m.text())) {
      errors.push(`CONSOLE ${m.text()}`);
    }
  });

  console.log(`${vp.name} (${vp.width}x${vp.height})`);
  for (const route of ROUTES) {
    errors.length = 0;
    await gotoRoute(page, route);

    const m = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      heading: document.querySelector("h1,h2")?.textContent?.trim().slice(0, 38) ?? null,
      textLen: document.body.innerText.length,
    }));

    const overflow = m.scrollW > m.clientW + 1;
    const blank = m.textLen < 40;
    const bad = overflow || blank || errors.length > 0;
    if (bad) failures++;

    console.log(
      `  ${bad ? "FAIL" : "ok  "} ${route.padEnd(14)} ${m.scrollW}/${m.clientW}` +
        `${overflow ? "  OVERFLOW" : ""}${blank ? "  BLANK" : ""}` +
        `  ${m.heading ?? "(no heading)"}` +
        (errors.length ? `\n       ${errors.slice(0, 3).join("\n       ")}` : ""),
    );
  }
  await ctx.close();
}

await browser.close();
console.log(failures === 0 ? "\nAll routes clean.\n" : `\n${failures} failure(s).\n`);
process.exit(failures === 0 ? 0 : 1);
