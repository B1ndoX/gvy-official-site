import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { syncMembers, parseFirstPage, fetchMembers, hash, decodeRoster, ROSTER_PATH, validateRosterAssets } from "../scripts/lib/rsi-members.mjs";
import { assertReadyToPromote, verifiedStatusReports, assertSyncHealth, assertPublished, REQUIRED_CHECKS } from "../scripts/lib/rsi-sync-release.mjs";

const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082", "hex");
const record = (handle, name = handle) => ({ handle, name, rank: "星舰船员", avatar: `/media/${handle}/avatar/example.png` });
const escape = (value) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const cards = (items) => items.map((item) => `<li class="member-item js-member-item org-main org-visibility-V" data-org-sid="GVY">
  <a class="membercard" href="/citizens/${item.handle}"><span class="thumb"><img src="${item.avatar}"></span><span class="right">
  <span class="roles"><ul><li>CEO</li><li>HR</li></ul></span><span class="frontinfo"><span class="name-wrap"><span class="trans-03s name data4">${escape(item.name)}</span>
  <span class="nick">${item.handle}</span></span><span class="rank">${item.rank}</span></span></span></a><div></div></li>`).join("");
const page = (items, total = items.length) => `<title>Members - 星远 [GVY] - Organizations</title><input name="symbol" value="GVY"><span class="totalrows js-totalrows">${total} members</span><ul id="members-data">${cards(items)}</ul>`;
const html = (value) => new Response(value, { headers: { "content-type": "text/html" } });
const initial = [record("Alpha"), record("Bravo"), record("Charlie")];
async function temporary(fn) {
  const root = await mkdtemp(resolve(tmpdir(), "gvy-member-test-"));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
function source(items, { image = png, failAvatar = false, conditional = false, calls = [] } = {}) {
  return async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith("/members")) return html(page(items));
    if (failAvatar) return new Response("not an image", { headers: { "content-type": "text/html" } });
    if (conditional && options.headers["If-None-Match"] === '"unchanged"') return new Response(null, { status: 304 });
    return new Response(image, { headers: { "content-type": "image/png", etag: '"unchanged"' } });
  };
}
async function snapshot(root) {
  const files = {};
  async function walk(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const next = resolve(path, entry.name);
      if (entry.isDirectory()) await walk(next); else files[next.slice(root.length)] = hash(await readFile(next));
    }
  }
  await walk(root); return files;
}

test("public member parser balances nested roles and preserves escaped display names/handles", () => {
  const parsed = parseFirstPage(page([record("Handle_123", '<Alice & "Bob">')]));
  assert.equal(parsed.total, 1); assert.equal(parsed.members[0].name, '<Alice & "Bob">');
  assert.equal(parsed.members[0].handle, "Handle_123"); assert.equal(parsed.members[0].rank, "星舰船员");
  assert.throws(() => parseFirstPage(page(initial).replace('value="GVY"', 'value="OTHER"')), /organization/);
  assert.throws(() => parseFirstPage(page(initial).replace(/<\/ul>$/, "")), /truncated/);
  assert.throws(() => parseFirstPage(page(initial).replace('/media/Alpha/avatar/example.png', 'https://example.com/avatar.png')), /host/);
  assert.throws(() => parseFirstPage(page(initial, 0)), /total/);
});

test("membership beyond 32 follows official pagination once per required page and rejects partial/duplicate data", async () => {
  const records = Array.from({ length: 33 }, (_, i) => record(`member${i}`));
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/members")) return html(page(records.slice(0, 32), 33));
    assert.deepEqual(JSON.parse(options.body), { symbol: "GVY", page: 2, pagesize: 32 });
    return Response.json({ success: 1, code: "OK", data: { totalrows: 33, html: cards(records.slice(32)) } });
  };
  assert.equal((await fetchMembers(fetchImpl)).members.length, 33); assert.equal(calls.length, 2);
  await assert.rejects(fetchMembers(async (url) => url.endsWith("/members") ? html(page(records.slice(0, 32), 33)) :
    Response.json({ success: 1, code: "OK", data: { totalrows: 33, html: "" } })), /pagination/);
  await assert.rejects(fetchMembers(async () => html(page([record("Same"), record("same")]))), /duplicate/);
});

test("snapshot applies joins, leaves, rename, rank, and same-URL avatar content changes; A to B to A remains correct", () => temporary(async (root) => {
  await syncMembers({ root, fetchImpl: source(initial) });
  const a = decodeRoster(await readFile(resolve(root, ROSTER_PATH), "utf8"));
  const edited = [record("Alpha", "New Name"), { ...record("Bravo"), rank: "深航舰长" }, record("Delta")];
  const image = Buffer.concat([png, Buffer.from("changed image bytes")]);
  assert.equal((await syncMembers({ root, fetchImpl: source(edited, { image }) })).changed, true);
  const b = await validateRosterAssets(root);
  assert.deepEqual(b.members.map((v) => v.handle), ["Alpha", "Bravo", "Delta"]);
  assert.equal(b.members[0].name, "New Name"); assert.equal(b.members[1].rank, "深航舰长");
  assert.notEqual(b.members[0].avatar, a.members[0].avatar);
  assert.equal((await syncMembers({ root, fetchImpl: source(initial) })).changed, true);
  const restored = await validateRosterAssets(root);
  assert.deepEqual(restored.members, a.members);
}));

test("unchanged data and conditional avatar 304 make no writes, deduplicate shared avatars, and do not add timestamps", () => temporary(async (root) => {
  const shared = initial.map((v) => ({ ...v, avatar: "/media/shared/avatar/default.png" }));
  const calls = [];
  await syncMembers({ root, fetchImpl: source(shared, { calls }) });
  assert.equal(calls.length, 2);
  const before = await snapshot(root);
  calls.length = 0;
  const result = await syncMembers({ root, fetchImpl: source(shared, { calls, conditional: true }), now: new Date("2030-01-01Z") });
  assert.equal(result.changed, false); assert.equal(calls.length, 2);
  assert.deepEqual(await snapshot(root), before);
}));

test("empty, greatly reduced, broken avatar or incomplete inputs leave every old byte intact", () => temporary(async (root) => {
  await syncMembers({ root, fetchImpl: source(initial) }); const before = await snapshot(root);
  await assert.rejects(syncMembers({ root, fetchImpl: source([]) }));
  await assert.rejects(syncMembers({ root, fetchImpl: source(initial.slice(0, 1)) }), /50%/);
  await assert.rejects(syncMembers({ root, fetchImpl: source(initial, { failAvatar: true }) }), /raster/);
  await assert.rejects(syncMembers({ root, fetchImpl: async () => html(page(initial).replace(/<\/ul>$/, "")) }), /truncated/);
  assert.deepEqual(await snapshot(root), before);
}));

test("asset validation rejects corrupted local avatar bytes", () => temporary(async (root) => {
  await syncMembers({ root, fetchImpl: source(initial) });
  const roster = await validateRosterAssets(root);
  await writeFile(resolve(root, roster.members[0].avatar), "broken");
  await assert.rejects(validateRosterAssets(root));
}));

const candidate = "a".repeat(40), base = "b".repeat(40);
const gate = () => ({ base, currentMain: base, candidate,
  run: { id: 123, check_suite_id: 42, head_sha: candidate, event: "workflow_dispatch", path: ".github/workflows/verify.yml", conclusion: "success" },
  checks: REQUIRED_CHECKS.map((name, index) => ({ name, head_sha: candidate, app: { id: 15368 }, status: "completed", conclusion: "success",
    check_suite: { id: 42 }, html_url: `https://github.com/B1ndoX/gvy-official-site/actions/runs/123/job/${index + 1}` })),
  paths: [ROSTER_PATH, "config/rsi-member-source.json"] });
test("automated promotion refuses changed main, failed/missing/foreign checks and every non-roster source mutation", () => {
  assertReadyToPromote(gate());
  assert.throws(() => assertReadyToPromote({ ...gate(), currentMain: candidate }), /main changed/);
  assert.throws(() => assertReadyToPromote({ ...gate(), checks: [] }), /required check/);
  const wrong = gate(); wrong.checks[0].conclusion = "failure"; assert.throws(() => assertReadyToPromote(wrong));
  const fake = gate(); fake.checks[0].app.id = 1; assert.throws(() => assertReadyToPromote(fake));
  for (const path of ["index.html", "assets/fleet-command-brawl.js", "../outside", ".github/workflows/verify.yml"]) {
    assert.throws(() => assertReadyToPromote({ ...gate(), paths: [path] }), /unexpected/);
  }
});

test("protected-branch result reports reference the actual exact-SHA successful CI jobs and refuse unverified results", () => {
  const reports = verifiedStatusReports(gate());
  assert.deepEqual(reports.map((report) => report.context), REQUIRED_CHECKS);
  assert.ok(reports.every((report) => report.state === "success" && report.target_url.includes("/actions/runs/123/job/")));
  for (const change of [
    { currentMain: candidate }, { checks: [] }, { run: { ...gate().run, conclusion: "failure" } },
    { paths: ["index.html"] },
  ]) assert.throws(() => verifiedStatusReports({ ...gate(), ...change }));
  const wrong = gate(); wrong.checks[0].head_sha = base; assert.throws(() => verifiedStatusReports(wrong));
  const forgedLink = gate(); forgedLink.checks[0].html_url = "https://example.com/fake"; assert.throws(() => verifiedStatusReports(forgedLink));
  const otherRun = gate(); otherRun.checks[0].check_suite.id = 999; assert.throws(() => verifiedStatusReports(otherRun));
});

test("weekly health flags failed, missing, future and stale records", () => {
  const now = Date.parse("2026-10-20T12:00:00Z");
  const status = { schemaVersion: 1, success: true, checkedAt: new Date(now).toISOString(), publishedCommit: base, memberCount: 32 };
  assertSyncHealth(status, now);
  assert.throws(() => assertSyncHealth({ ...status, success: false }, now));
  assert.throws(() => assertSyncHealth({ ...status, checkedAt: "" }, now));
  assert.throws(() => assertSyncHealth({ ...status, checkedAt: new Date(now - 11 * 86400000).toISOString() }, now));
  assert.throws(() => assertSyncHealth({ ...status, checkedAt: new Date(now + 86400000).toISOString() }, now));
});

test("public deployment verification checks exact bytes on both ordinary roots and content-addressed avatars", () => temporary(async (root) => {
  await mkdir(resolve(root, "dist/assets/js"), { recursive: true });
  await mkdir(resolve(root, "dist/assets/member-avatars"), { recursive: true });
  const avatar = `./assets/member-avatars/${hash(png)}.png`;
  const files = { "index.html": Buffer.from("home"), "member-brawl.html": Buffer.from("arena"),
    [ROSTER_PATH]: Buffer.from("snapshot"), [avatar.slice(2)]: png };
  for (const [path, bytes] of Object.entries(files)) await writeFile(resolve(root, "dist", path), bytes);
  const urls = [];
  const fetchImpl = async (url) => { urls.push(url); const p = new URL(url).pathname.slice(1); return new Response(files[p || "index.html"]); };
  const roster = { members: [{ avatar }] };
  await assertPublished({ root, roster, fetchImpl }); assert.equal(urls.length, 8);
  await assert.rejects(assertPublished({ root, roster, fetchImpl: async () => new Response("old snapshot") }), /bytes differ/);
}));
