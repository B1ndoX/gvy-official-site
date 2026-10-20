import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { syncMembers, validateRosterAssets, ROSTER_PATH, hash } from "./lib/rsi-members.mjs";
import { assertReadyToPromote, assertPublished } from "./lib/rsi-sync-release.mjs";

// Only the trusted scheduled/manual main workflow may publish generated data.
assert.equal(process.env.GITHUB_ACTIONS, "true");
assert.equal(process.env.GITHUB_REF, "refs/heads/main");
assert.equal(process.env.GITHUB_REPOSITORY, "B1ndoX/gvy-official-site");
const exec = promisify(execFile);
const command = async (program, args, options = {}) => (await exec(program, args, {
  maxBuffer: 8 * 1024 * 1024, ...options,
})).stdout.trim();
const git = (args, options) => command("git", args, options);
const api = async (path) => JSON.parse(await command("gh", ["api", `repos/B1ndoX/gvy-official-site/${path}`]));
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const root = process.cwd();
const base = await git(["rev-parse", "HEAD"]);
assert.equal(await git(["status", "--porcelain"]), "", "refresh requires a clean checkout");
const suffix = `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`;
assert.match(suffix, /^\d+-\d+$/);
const branch = `automation/rsi-members-${suffix}`;
const statusBranch = "automation/rsi-members-state";
const runUrl = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
let candidate;
let branchPushed = false;
let error;
const initialRoster = await validateRosterAssets(root);
const status = { schemaVersion: 1, checkedAt: new Date().toISOString(), success: false,
  runUrl, publishedCommit: base, memberCount: initialRoster.members.length };
try {
  const result = await syncMembers({ root });
  const roster = await validateRosterAssets(root);
  status.memberCount = roster.members.length;
  status.rosterSha256 = hash(await readFile(resolve(root, ROSTER_PATH)));
  status.changed = result.changed;
  console.log(`RSI complete public roster: ${roster.members.length}/${roster.total}; changed=${result.changed}`);
  if (result.changed) {
    await git(["switch", "-c", branch]);
    await git(["add", "--", ROSTER_PATH, "config/rsi-member-source.json", "assets/member-avatars"]);
    const paths = (await git(["diff", "--cached", "--name-only"])).split("\n").filter(Boolean);
    for (const path of paths) assert.ok(path === ROSTER_PATH || path === "config/rsi-member-source.json" ||
      /^assets\/member-avatars\/[a-f0-9]{64}\.(png|jpg|gif|webp)$/.test(path), `unexpected change: ${path}`);
    assert.ok(paths.length > 0);
    await git(["commit", "-m", "chore: synchronize public RSI fleet members"]);
    candidate = await git(["rev-parse", "HEAD"]);
    await git(["push", "origin", `HEAD:refs/heads/${branch}`]); branchPushed = true;
    await command("gh", ["workflow", "run", "verify.yml", "--ref", branch]);
    const deadline = Date.now() + 25 * 60000;
    let run;
    while (Date.now() < deadline) {
      const data = await api(`actions/workflows/verify.yml/runs?head_sha=${candidate}&event=workflow_dispatch&per_page=20`);
      run = data.workflow_runs.find((item) => item.head_sha === candidate && item.head_branch === branch);
      if (run?.status === "completed") break;
      console.log(`Waiting for original Verify on ${candidate.slice(0, 12)} (${run?.status || "queued"})`);
      await sleep(30000);
    }
    assert.ok(run?.status === "completed", "original Verify timed out; production retained");
    const checks = (await api(`commits/${candidate}/check-runs?per_page=100`)).check_runs;
    const currentMain = (await git(["ls-remote", "origin", "refs/heads/main"])).split(/\s/)[0];
    assertReadyToPromote({ base, currentMain, candidate, run, checks, paths });
    // Normal fast-forward push. GitHub's existing required checks stay enforced.
    // A concurrent main update makes this fail rather than overwrite anyone.
    await git(["push", "origin", `${candidate}:refs/heads/main`]);
    status.publishedCommit = candidate;
    status.verifyRun = run.html_url;
    await command(process.execPath, ["scripts/build-site.mjs"]);
    const publishDeadline = Date.now() + 6 * 60000;
    let published = false;
    let last;
    while (Date.now() < publishDeadline) {
      try { await assertPublished({ root, roster }); published = true; break; }
      catch (failure) { last = failure; console.log(`Waiting for EdgeOne: ${failure.message}`); await sleep(10000); }
    }
    assert.ok(published, `EdgeOne publish verification failed: ${last?.message}`);
    console.log(`Protected-main update and exact public roster/avatar verification passed: ${candidate}`);
  } else {
    assert.equal((await git(["ls-remote", "origin", "refs/heads/main"])).split(/\s/)[0], base,
      "main changed while checking; next refresh must read its current snapshot");
    console.log("No roster/avatar change; no production commit or deployment.");
    await command(process.execPath, ["scripts/build-site.mjs"]);
    await assertPublished({ root, roster });
  }
  status.success = true;
} catch (failure) {
  error = failure;
  status.error = failure.message.slice(0, 1000);
  console.error(`RSI sync failed: ${status.error}`);
} finally {
  // A real status commit on an internal branch keeps public-repo scheduled runs
  // active after 60 days without main changes. It never publishes production.
  const temp = await mkdtemp(resolve(tmpdir(), "gvy-rsi-sync-state-"));
  try {
    const prior = await git(["ls-remote", "origin", `refs/heads/${statusBranch}`]);
    let parent = base;
    if (prior) { await git(["fetch", "--depth=1", "origin", `refs/heads/${statusBranch}`]); parent = await git(["rev-parse", "FETCH_HEAD"]); }
    const env = { ...process.env, GIT_INDEX_FILE: resolve(temp, "index") };
    // Keep the state branch's source tree fixed: only its status file changes.
    // Copying future main workflows here would unnecessarily require workflow-write access.
    await git(["read-tree", parent], { env });
    await writeFile(resolve(temp, "status.json"), JSON.stringify(status, null, 2) + "\n");
    const object = await git(["hash-object", "-w", resolve(temp, "status.json")]);
    await git(["update-index", "--add", "--cacheinfo", `100644,${object},config/rsi-members-status.json`], { env });
    const tree = await git(["write-tree"], { env });
    const commit = await git(["commit-tree", tree, "-p", parent, "-m", "chore: record weekly RSI member sync health"]);
    await git(["push", "origin", `${commit}:refs/heads/${statusBranch}`]);
    console.log(`Weekly sync health recorded: success=${status.success}; ${runUrl}`);
  } catch (failure) { error ||= failure; console.error(`Sync status write failed: ${failure.message}`); }
  finally { await rm(temp, { recursive: true, force: true }); }
  if (branchPushed) {
    try {
      const tip = (await git(["ls-remote", "origin", `refs/heads/${branch}`])).split(/\s/)[0];
      if (tip === candidate) await git(["push", "origin", `:refs/heads/${branch}`]);
    } catch (failure) { console.warn(`Temporary candidate cleanup failed: ${failure.message}`); }
  }
}
if (error) throw error;
