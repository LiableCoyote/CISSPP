/**
 * Runs axe-core against every route and fails on any WCAG 2.1 A/AA violation.
 *
 * Usage: node scripts/qa-a11y.mjs [--browser=chromium|firefox]
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { ROUTES, launch, newSeededPage, gotoRoute, parseBrowserArg, assertServerUp } from "./qa-lib.mjs";

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const browserName = parseBrowserArg();
await assertServerUp();

const browser = await launch(browserName);
if (!browser) process.exit(0);

console.log(`\nAccessibility check — ${browserName} ${browser.version()}\n`);

const { ctx, page } = await newSeededPage(browser, { width: 390, height: 844 });
const totals = new Map();

for (const route of ROUTES) {
  await gotoRoute(page, route);
  await page.evaluate(AXE);

  const { violations } = await page.evaluate(async () =>
    window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    }),
  );

  console.log(`  ${violations.length === 0 ? "ok  " : "FAIL"} ${route.padEnd(14)} ${violations.length} violation(s)`);
  for (const v of violations) {
    console.log(`       [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`);
    console.log(`         ${v.nodes[0].html.slice(0, 100)}`);
    totals.set(v.id, (totals.get(v.id) || 0) + v.nodes.length);
  }
}

await ctx.close();
await browser.close();

if (totals.size === 0) {
  console.log("\nNo violations.\n");
  process.exit(0);
}
console.log("\nTotals by rule:");
for (const [rule, n] of [...totals].sort((a, b) => b[1] - a[1])) console.log(`  ${rule}: ${n}`);
process.exit(1);
