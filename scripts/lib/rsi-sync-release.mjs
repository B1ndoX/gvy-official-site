import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { hash, ROSTER_PATH } from "./rsi-members.mjs";

export const REQUIRED_CHECKS = ["Site on EdgeOne Node 22.11", "Full runtime and publisher on Node 24 LTS"];
export function assertReadyToPromote({ base, currentMain, candidate, run, checks, paths }) {
  assert.equal(currentMain, base, "main changed during refresh; do not overwrite it");
  assert.match(candidate, /^[a-f0-9]{40}$/);
  assert.equal(run.head_sha, candidate); assert.equal(run.event, "workflow_dispatch");
  assert.ok(Number.isSafeInteger(run.id) && Number.isSafeInteger(run.check_suite_id));
  assert.equal(run.conclusion, "success"); assert.equal(run.path, ".github/workflows/verify.yml");
  for (const name of REQUIRED_CHECKS) assert.ok(checks.some((check) => check.name === name &&
    check.app?.id === 15368 && check.head_sha === candidate && check.check_suite?.id === run.check_suite_id &&
    check.status === "completed" && check.conclusion === "success"), `required check missing: ${name}`);
  assert.ok(paths.length > 0);
  for (const path of paths) assert.ok(path === ROSTER_PATH || path === "config/rsi-member-source.json" ||
    /^assets\/member-avatars\/[a-f0-9]{64}\.(png|jpg|gif|webp)$/.test(path), `unexpected automated change: ${path}`);
}
export function verifiedStatusReports(gate) {
  assertReadyToPromote(gate);
  // GitHub excludes workflow_dispatch job checks from protected-branch evaluation.
  // Report only the already completed, exact-SHA real CI results as commit statuses.
  // Their source remains the designated GitHub Actions App; no dummy test is run.
  return REQUIRED_CHECKS.map((context) => {
    const check = gate.checks.find((item) => item.name === context && item.app?.id === 15368 &&
      item.head_sha === gate.candidate && item.check_suite?.id === gate.run.check_suite_id &&
      item.status === "completed" && item.conclusion === "success");
    assert.match(check.html_url, /^https:\/\/github\.com\/B1ndoX\/gvy-official-site\/actions\/runs\/\d+\/job\/\d+$/);
    assert.ok(check.html_url.includes(`/actions/runs/${gate.run.id}/job/`), "job link does not belong to verified run");
    return { context, state: "success", target_url: check.html_url,
      description: "Full original CI passed on this exact commit; open the original job for evidence." };
  });
}
export async function assertPublished({ root, roster, fetchImpl = fetch }) {
  const paths = ["index.html", "member-brawl.html", ROSTER_PATH,
    ...new Set(roster.members.map(({ avatar }) => avatar.replace(/^\.\//, "")))];
  for (const origin of ["https://www.gvyvoyagers.vip", "https://gvyvoyagers.vip"]) {
    for (const path of paths) {
      const bytes = await readFile(resolve(root, "dist", path));
      const suffix = path === ROSTER_PATH ? `?v=${hash(bytes).slice(0, 16)}` : "";
      const url = path === "index.html" ? `${origin}/` : `${origin}/${path}${suffix}`;
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(15000) });
      assert.equal(response.status, 200, `deployment incomplete: ${url}`);
      const body = Buffer.from(await response.arrayBuffer());
      assert.equal(hash(body), hash(bytes), `production bytes differ: ${url}`);
    }
  }
}
export function assertSyncHealth(status, now = Date.now()) {
  assert.equal(status.schemaVersion, 1); assert.equal(status.success, true, "last RSI member sync failed; inspect its run");
  const age = now - Date.parse(status.checkedAt);
  assert.ok(Number.isFinite(age) && age >= -300000 && age < 10 * 86400000, "weekly RSI sync is stale (>10 days)");
  assert.match(status.publishedCommit, /^[a-f0-9]{40}$/);
  assert.ok(Number.isInteger(status.memberCount) && status.memberCount > 0);
}
