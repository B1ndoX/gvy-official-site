import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { validatePlan } from "./lib/verification-plan.mjs";

const plan = validatePlan(JSON.parse(process.env.GVY_VERIFICATION_PLAN || "null"));
console.log(`Verification scope: ${plan.mode}; ${plan.reason}`);
const run = (program, args, env = {}) => execFileSync(program, args, { stdio: "inherit", env: { ...process.env, ...env } });
const phase = process.argv[2];
assert.ok(["validate", "site", "tools"].includes(phase), "unknown verification phase");
if (phase === "site") run("npm", ["run", "verify:edgeone"]);
if (phase === "tools") {
  if (plan.ship) run("npm", ["run", "game:ship:check"]);
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
