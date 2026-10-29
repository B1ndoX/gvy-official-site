import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, appendFile, writeFile } from "node:fs/promises";
import { verificationPlan, hasPassedVerification } from "./lib/verification-plan.mjs";

const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const sha = (value) => /^[a-f0-9]{40}$/.test(value || "") && !/^0+$/.test(value);
const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
const head = git("rev-parse", "HEAD");
const eventName = process.env.GITHUB_EVENT_NAME;
let base = event.pull_request?.base?.sha || (eventName === "push" ? event.before : event.inputs?.base_sha);
let full = eventName === "schedule" || event.inputs?.coverage === "full";
let verifiedMerge = false;
const repository = process.env.GITHUB_REPOSITORY;
assert.match(repository || "", /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
const api = async (path) => {
  const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, { headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200, `GitHub verification lookup failed (${response.status})`);
  return response.json();
};
const passedTree = async (candidate) => {
  if (!sha(candidate)) return false;
  git("fetch", "--no-tags", "--depth=1", "origin", candidate);
  const sourceTree = git("rev-parse", `${candidate}^{tree}`), targetTree = git("rev-parse", `${head}^{tree}`);
  if (sourceTree !== targetTree) return false;
  const [runs, checks] = await Promise.all([api(`actions/workflows/verify.yml/runs?head_sha=${candidate}&status=success&per_page=20`), api(`commits/${candidate}/check-runs?per_page=100`)]);
  return runs.workflow_runs.some((run) => hasPassedVerification({ candidate, sourceTree, targetTree, run, checks: checks.check_runs }));
};
if (eventName === "push" && process.env.GITHUB_REF === "refs/heads/main") {
  try {
    verifiedMerge = await passedTree(head);
    if (!verifiedMerge) {
      const prs = await api(`commits/${head}/pulls?per_page=30`);
      for (const pr of prs) if (pr.merged_at && pr.merge_commit_sha === head && pr.base.ref === "main" && await passedTree(pr.head.sha)) { verifiedMerge = true; break; }
    }
  } catch (error) { console.log(`Previous verification could not be proved; running full checks: ${error.message}`); }
  full ||= !verifiedMerge;
}
let paths = [];
if (sha(base)) {
  git("fetch", "--no-tags", "--depth=1", "origin", base);
  paths = execFileSync("git", ["diff", "--no-renames", "--name-only", "-z", base, head], { encoding: "utf8" }).split("\0").filter(Boolean);
} else full = true;
const plan = verificationPlan(paths, { full, verifiedMerge });
console.log(JSON.stringify({ head, base, paths, plan }, null, 2));
await writeFile("verification-plan.json", JSON.stringify(plan, null, 2) + "\n");
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, Object.entries({ plan: JSON.stringify(plan), tools: plan.tools, ship: plan.ship, publisher: plan.publisher, media: plan.media, browser: plan.browser }).map(([key, value]) => `${key}=${value}\n`).join(""));
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Verification scope: ${plan.mode}\n\n${plan.reason}\n\nGame: ${plan.ship}; publisher: ${plan.publisher}; media metadata: ${plan.media}; browser suites: ${plan.suites.join(", ") || "none"}.\n`);
