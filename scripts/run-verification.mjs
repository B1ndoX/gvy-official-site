import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { validatePlan, validateGateResults } from "./lib/verification-plan.mjs";

const plan = validatePlan(JSON.parse(process.env.GVY_VERIFICATION_PLAN || "null"));
console.log(`Verification scope: ${plan.mode}; ${plan.reason}`);
const run = (program, args, env = {}) => execFileSync(program, args, { stdio: "inherit", env: { ...process.env, ...env } });
const phase = process.argv[2];
assert.ok(["validate", "site", "game", "tools", "gate"].includes(phase), "unknown verification phase");
if (phase === "site") run("npm", ["run", "verify:edgeone"]);
if (phase === "game") {
  assert.equal(plan.ship, true, "No game checks selected");
  run("npm", ["--prefix", "games/ship-battle", "test", "--", "--maxWorkers=1"]);
}
if (phase === "gate") validateGateResults(plan, {
  plan: process.env.GVY_PLAN_RESULT, game: process.env.GVY_GAME_RESULT, tools: process.env.GVY_TOOLS_RESULT,
});
if (phase === "tools") {
  if (plan.ship) run(process.execPath, ["scripts/build-ship-battle.mjs", "--check"]);
  if (plan.publisher) { run("npm", ["run", "gallery:publisher:test"]); run("npm", ["run", "gallery:publisher:build"]); }
  if (plan.media) run(process.execPath, ["--test", "tests/media-contract.test.js"], { GVY_SKIP_MEDIA_METADATA: "0" });
  if (plan.browser) {
    run("npm", ["run", "build"]);
    const suites = plan.suites.includes("all") ? [] : plan.suites.map((suite) => `tests/e2e/${suite}`);
    const args = ["node_modules/@playwright/test/cli.js", "test", ...suites];
    if (process.env.RUNNER_TEMP) args.push("--output", resolve(process.env.RUNNER_TEMP, "gvy-browser-results"));
    run(process.execPath, args);
  }
  if (!plan.tools) console.log("No affected tools or browser suites; the independent site job still verifies the deployable output.");
}
