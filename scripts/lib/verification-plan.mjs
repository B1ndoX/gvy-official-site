import assert from "node:assert/strict";

export const REQUIRED_CHECKS = ["Deployable site on Node 24", "Affected tools and browser checks on Node 24"];
export const BROWSER_SUITES = {
  ship: ["fleet-game-hub.spec.js", "ship-release-entry.spec.js"],
  arena: ["arena-events.spec.js", "arena-feedback.spec.js", "arena-interface-scale.spec.js", "arena-map.spec.js", "arena-upgrade.spec.js", "arena-weapons.spec.js", "arena-window.spec.js"],
  gallery: ["archive-interaction.spec.js"],
  media: ["production-smoke.spec.js", "video-playback.spec.js"],
};
const knownSuites = new Set(Object.values(BROWSER_SUITES).flat());
const documentation = (path) => /^(?:README|ARCHITECTURE|OPERATIONS|上下文)\.md$/.test(path) || /^games\/ship-battle\/(?:README\.md|docs\/.*\.md)$/.test(path);

export function validatePlan(plan) {
  assert.equal(plan.version, 1);
  assert.ok(["full", "affected", "docs", "verified-merge"].includes(plan.mode));
  for (const key of ["ship", "publisher", "media", "browser", "tools"]) assert.equal(typeof plan[key], "boolean", `invalid plan field: ${key}`);
  assert.ok(Array.isArray(plan.suites));
  assert.ok(plan.suites.every((suite) => suite === "all" || knownSuites.has(suite)), "unrecognized browser suite");
  assert.equal(plan.browser, plan.suites.length > 0);
  assert.equal(plan.tools, plan.ship || plan.publisher || plan.media || plan.browser);
  if (plan.mode === "full") {
    assert.ok(plan.ship && plan.publisher && plan.media && plan.tools);
    assert.deepEqual(plan.suites, ["all"]);
  } else assert.ok(!plan.suites.includes("all"));
  if (["docs", "verified-merge"].includes(plan.mode)) assert.equal(plan.tools, false);
  assert.equal(typeof plan.reason, "string");
  return plan;
}

export function verificationPlan(paths, { full = false, verifiedMerge = false } = {}) {
  assert.ok(Array.isArray(paths) && paths.every((path) => typeof path === "string" && path && !path.startsWith("/") && !path.split("/").includes("..")), "invalid changed paths");
  const selected = new Set();
  const plan = { version: 1, mode: "affected", ship: false, publisher: false, media: false, browser: false, tools: false, suites: [], reason: "Tests selected from changed paths" };
  const all = (reason) => Object.assign(plan, { mode: "full", ship: true, publisher: true, media: true, suites: ["all"], reason });
  const suite = (name) => BROWSER_SUITES[name].forEach((file) => selected.add(file));
  if (full) all("Full verification requested, or no safe comparison is available");
  else if (verifiedMerge) Object.assign(plan, { mode: "verified-merge", reason: "The exact source tree already passed both required checks; rebuild and audit deployment output" });
  else if (!paths.length) all("Empty comparison is not evidence that verification can be skipped");
  else for (const path of paths) {
    if (documentation(path)) continue;
    if (path.startsWith("games/ship-battle/")) { plan.ship = true; suite("ship"); }
    else if (/^(?:assets\/js\/fleet-members\.js|config\/rsi-member-source\.json|assets\/member-avatars\/[^/]+)$/.test(path)) { suite("ship"); selected.add("production-smoke.spec.js"); }
    else if (/^(?:assets\/fleet-command-brawl\.js|member-brawl\.html|assets\/member-brawl\.css|assets\/arena\/|assets\/js\/member-arena-)/.test(path)) { suite("arena"); suite("ship"); selected.add("production-smoke.spec.js"); }
    else if (path.startsWith("tools/gallery-publisher/")) { plan.publisher = true; suite("gallery"); }
    else if (/^(?:assets\/gallery\/|assets\/js\/archive-(?:carousel|lightbox)\.js$)/.test(path)) suite("gallery");
    else if (/^(?:assets\/(?:hero-random|operations-motion|game-previews)\/|assets\/js\/(?:hero-video-controller|operation-motion|game-card-previews)\.js$)/.test(path)) { plan.media = true; suite("media"); suite("ship"); }
    else if (path.startsWith("tests/e2e/") && knownSuites.has(path.slice("tests/e2e/".length))) {
      const name = path.slice("tests/e2e/".length); selected.add(name);
      if (BROWSER_SUITES.ship.includes(name)) plan.ship = true;
      if (BROWSER_SUITES.media.includes(name)) plan.media = true;
    } else all(`Shared, workflow, dependency or unclassified change: ${path}`);
  }
  if (plan.mode !== "full") plan.suites = [...selected].sort();
  if (plan.mode === "affected" && paths.every(documentation)) { plan.mode = "docs"; plan.reason = "Only known documentation changed; deployable site checks still run"; }
  plan.browser = plan.suites.length > 0;
  plan.tools = plan.ship || plan.publisher || plan.media || plan.browser;
  return validatePlan(plan);
}

export function hasPassedVerification({ candidate, sourceTree, targetTree, run, checks }) {
  return /^[a-f0-9]{40}$/.test(candidate || "") && sourceTree === targetTree && /^[a-f0-9]{40}$/.test(sourceTree || "") &&
    run?.head_sha === candidate && run.path === ".github/workflows/verify.yml" && run.conclusion === "success" &&
    ["pull_request", "workflow_dispatch", "push"].includes(run.event) && Number.isSafeInteger(run.check_suite_id) &&
    REQUIRED_CHECKS.every((name) => checks?.some((check) => check.name === name && check.head_sha === candidate &&
      check.app?.id === 15368 && check.check_suite?.id === run.check_suite_id && check.status === "completed" && check.conclusion === "success"));
}

export function validateGateResults(plan, results) {
  validatePlan(plan);
  assert.equal(results.plan, "success", "Scope calculation did not succeed");
  for (const [job, required] of [["game", plan.ship], ["tools", plan.tools]]) {
    assert.ok(["success", "skipped"].includes(results[job]), `${job} failed, was cancelled, or has no result`);
    if (required) assert.equal(results[job], "success", `Required ${job} checks were not executed successfully`);
  }
}
