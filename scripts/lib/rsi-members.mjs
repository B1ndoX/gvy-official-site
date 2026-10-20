import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile, rename, unlink } from "node:fs/promises";
import { resolve, dirname } from "node:path";

export const SOURCE = "https://robertsspaceindustries.com/en/orgs/GVY/members";
export const ROSTER_PATH = "assets/js/fleet-members.js";
export const CACHE_PATH = "config/rsi-member-source.json";
const PREFIX = "window.__gvyFleetRoster = ";
const avatarPath = /^assets\/member-avatars\/[a-f0-9]{64}\.(?:png|jpg|gif|webp)$/;
export const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const encodeRoster = (value) => `${PREFIX}${JSON.stringify(value, null, 2)};\n`;
export function decodeRoster(source) {
  assert.ok(source.startsWith(PREFIX) && source.endsWith(";\n"), "invalid roster envelope");
  return JSON.parse(source.slice(PREFIX.length, -2));
}
function text(value) {
  const named = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
  return value.replace(/<[^>]*>/g, "").replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (_, entity) => {
    if (!entity.startsWith("#")) {
      assert.ok(Object.hasOwn(named, entity), `unknown HTML entity: ${entity}`);
      return named[entity];
    }
    const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    assert.ok(code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff));
    return String.fromCodePoint(code);
  }).normalize("NFC").trim();
}
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"))?.[1];
function span(block, name) {
  const found = [...block.matchAll(/<span\b([^>]*)>/gi)]
    .find((match) => (attr(match[1], "class") || "").split(/\s+/).includes(name));
  assert.ok(found, `missing member ${name}`);
  const value = text(block.slice(found.index + found[0].length).split(/<\/span>/i, 1)[0]);
  assert.ok(value.length > 0 && value.length <= 100 && !/[\u0000-\u001f\u007f]/.test(value), `invalid ${name}`);
  return value;
}
export function sourceAvatarUrl(input) {
  const url = new URL(text(input), SOURCE);
  assert.equal(url.protocol, "https:");
  assert.ok(!url.username && !url.password && !url.hash);
  assert.ok((url.hostname === "robertsspaceindustries.com" && url.pathname.startsWith("/media/")) ||
    (url.hostname === "cdn.robertsspaceindustries.com" && url.pathname.startsWith("/static/images/account/")), "unexpected avatar host/path");
  return url.href;
}
export function parseMemberCards(html) {
  const members = [];
  let redacted = 0;
  // Balance li tags because the official role list nests li inside each card.
  const tags = [...html.matchAll(/<\/?li\b[^>]*>/gi)];
  for (let i = 0; i < tags.length; i++) {
    const start = tags[i];
    if (!(attr(start[0], "class") || "").split(/\s+/).includes("js-member-item")) continue;
    let depth = 1;
    let end;
    while (++i < tags.length) {
      depth += /^<\/li/i.test(tags[i][0]) ? -1 : 1;
      if (depth === 0) { end = tags[i]; break; }
    }
    assert.ok(end, "truncated member card");
    const block = html.slice(start.index, end.index + end[0].length);
    const href = block.match(/<a\b[^>]*\bhref=["'](\/citizens\/[^"']+)["']/i)?.[1];
    if (!href && /\borg-visibility-[RH]\b/.test(start[0])) { redacted++; continue; }
    assert.ok(href, "member has no public handle");
    const handle = decodeURIComponent(href.slice("/citizens/".length));
    assert.match(handle, /^[A-Za-z0-9_-]{1,64}$/);
    const image = block.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1];
    assert.ok(image, "member avatar missing");
    members.push({ handle, name: span(block, "name"), rank: span(block, "rank"),
      membership: /\borg-main\b/.test(start[0]) ? "main" : "affiliate", sourceAvatar: sourceAvatarUrl(image) });
  }
  return { members, redacted, cardCount: members.length + redacted };
}
export function parseFirstPage(html) {
  assert.ok(/<title>[\s\S]*?Members[\s\S]*?GVY[\s\S]*?<\/title>/i.test(html), "unexpected organization page");
  assert.ok(/<input\b[^>]*name=["']symbol["'][^>]*value=["']GVY["']/i.test(html), "wrong organization");
  const totalText = html.match(/<span\b[^>]*class=["'][^"']*\bjs-totalrows\b[^"']*["'][^>]*>([^<]+)<\/span>/i)?.[1];
  const total = Number(totalText?.match(/^\s*([\d,]+)\s+members?\s*$/i)?.[1].replaceAll(",", ""));
  assert.ok(Number.isInteger(total) && total > 0 && total <= 1000, "missing/invalid member total");
  const start = html.search(/<ul\b[^>]*id=["']members-data["']/i);
  assert.ok(start >= 0, "member list missing");
  let depth = 0;
  let end;
  for (const match of html.slice(start).matchAll(/<\/?ul\b[^>]*>/gi)) {
    depth += /^<\/ul/i.test(match[0]) ? -1 : 1;
    if (depth === 0) { end = start + match.index + match[0].length; break; }
  }
  assert.ok(end, "truncated member list");
  return { total, ...parseMemberCards(html.slice(start, end)) };
}
async function bodyBounded(response, max) {
  assert.ok(!response.headers.get("content-length") || Number(response.headers.get("content-length")) <= max, "response too large");
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > max) { await response.body?.cancel().catch(() => {}); throw new Error("response too large"); }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
export async function request(url, init = {}, fetchImpl = fetch) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetchImpl(url, { ...init, redirect: "error", signal: AbortSignal.timeout(20000),
        headers: { "User-Agent": "GVY-Member-Sync/1.0 (+https://www.gvyvoyagers.vip/)", ...init.headers } });
      assert.ok(response.status === 200 || response.status === 304, `source HTTP ${response.status}`);
      return response;
    } catch (error) { last = error; if (attempt < 2) await new Promise((done) => setTimeout(done, (attempt + 1) * 500)); }
  }
  throw last;
}
export async function fetchMembers(fetchImpl = fetch) {
  const response = await request(SOURCE, {}, fetchImpl);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /text\/html/i);
  const first = parseFirstPage((await bodyBounded(response, 2_000_000)).toString("utf8"));
  const members = [...first.members];
  let count = first.cardCount;
  let redacted = first.redacted;
  assert.ok(count > 0 && count <= 32 && count <= first.total, "unexpected first-page size");
  for (let page = 2; count < first.total && page <= 32; page++) {
    const result = await request("https://robertsspaceindustries.com/api/orgs/getOrgMembers", {
      method: "POST", headers: { "Content-Type": "application/json", Referer: SOURCE },
      body: JSON.stringify({ symbol: "GVY", page, pagesize: 32 }),
    }, fetchImpl);
    const json = JSON.parse((await bodyBounded(result, 2_000_000)).toString("utf8"));
    assert.ok(json.success && json.code === "OK" && json.data?.totalrows === first.total, "inconsistent pagination total");
    const next = parseMemberCards(json.data.html);
    assert.ok(next.cardCount > 0 && next.cardCount <= 32, "empty/incomplete pagination");
    count += next.cardCount; redacted += next.redacted; members.push(...next.members);
  }
  assert.equal(count, first.total, "member list incomplete");
  assert.ok(members.length > 0, "no public members; retaining prior roster");
  assert.equal(new Set(members.map(({ handle }) => handle.toLowerCase())).size, members.length, "duplicate member handles");
  return { total: first.total, redacted, members: members.sort((a, b) => a.handle.toLowerCase().localeCompare(b.handle.toLowerCase(), "en")) };
}
export function imageType(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpg";
  if (/^GIF8[79]a/.test(bytes.subarray(0, 6).toString())) return "gif";
  if (bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP") return "webp";
  throw new Error("avatar is not a supported raster image");
}
async function optionalJson(file) {
  try { return JSON.parse(await readFile(file, "utf8")); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
}
export async function syncMembers({ root, fetchImpl = fetch, now = new Date() }) {
  const rosterFile = resolve(root, ROSTER_PATH);
  let previous = null;
  try { previous = decodeRoster(await readFile(rosterFile, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const cache = await optionalJson(resolve(root, CACHE_PATH)) || { avatars: {}, retained: {} };
  const source = await fetchMembers(fetchImpl);
  const previousCount = previous?.members.length || 0;
  assert.ok(!previousCount || source.members.length >= previousCount * 0.5, "public roster fell by over 50%; keeping last good snapshot for review");
  const downloaded = new Map();
  const avatars = {};
  for (const member of source.members) {
    const url = member.sourceAvatar;
    if (!avatars[url]) {
      const old = cache.avatars[url];
      let cached;
      if (old && avatarPath.test(old.path)) {
        cached = await readFile(resolve(root, old.path)).catch(() => null);
        if (cached && hash(cached) !== old.sha256) cached = null;
      }
      const response = await request(url, { headers: cached ? {
        ...(old.etag ? { "If-None-Match": old.etag } : {}),
        ...(!old.etag && old.lastModified ? { "If-Modified-Since": old.lastModified } : {}),
      } : {} }, fetchImpl);
      assert.ok(response.status !== 304 || cached, "304 without a valid local avatar");
      const bytes = response.status === 304 ? cached : await bodyBounded(response, 2_000_000);
      const ext = imageType(bytes);
      const sha256 = hash(bytes);
      const path = `assets/member-avatars/${sha256}.${ext}`;
      avatars[url] = { path, sha256, etag: response.status === 304 ? old?.etag || null : response.headers.get("etag"),
        lastModified: response.status === 304 ? old?.lastModified || null : response.headers.get("last-modified") };
      downloaded.set(path, bytes);
    }
    member.avatar = `./${avatars[url].path}`;
    member.avatarSha256 = avatars[url].sha256;
  }
  const content = { schemaVersion: 1, organization: "GVY", source: SOURCE,
    total: source.total, redacted: source.redacted, members: source.members };
  const { updatedAt: ignored, ...priorContent } = previous || {};
  if (JSON.stringify(content) === JSON.stringify(priorContent)) return { changed: false, count: content.members.length, total: content.total };
  const stamp = now.toISOString();
  const retained = { ...cache.retained };
  for (const member of previous?.members || []) retained[member.avatar.replace(/^\.\//, "")] = stamp;
  for (const path of downloaded.keys()) retained[path] ||= stamp;
  const active = new Set(downloaded.keys());
  const remove = Object.entries(retained).filter(([path, at]) => avatarPath.test(path) && !active.has(path)
    && now - new Date(at) > 90 * 86400000).map(([path]) => path);
  for (const path of remove) delete retained[path];
  const writes = new Map([...downloaded, [CACHE_PATH, Buffer.from(JSON.stringify({ schemaVersion: 1, avatars, retained }, null, 2) + "\n")],
    [ROSTER_PATH, Buffer.from(encodeRoster({ ...content, updatedAt: stamp }))]]);
  // Network/parsing/image validation is complete before any managed file changes.
  for (const [path, bytes] of writes) {
    const file = resolve(root, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(`${file}.sync-tmp`, bytes); await rename(`${file}.sync-tmp`, file);
  }
  for (const path of remove) await unlink(resolve(root, path)).catch((error) => { if (error.code !== "ENOENT") throw error; });
  return { changed: true, count: content.members.length, total: content.total, redacted: content.redacted,
    files: [...writes.keys(), ...remove] };
}
export async function validateRosterAssets(root) {
  const roster = decodeRoster(await readFile(resolve(root, ROSTER_PATH), "utf8"));
  assert.equal(roster.organization, "GVY"); assert.equal(roster.schemaVersion, 1); assert.equal(roster.source, SOURCE);
  assert.equal(roster.members.length + roster.redacted, roster.total);
  assert.ok(roster.members.length > 0 && roster.members.length <= 1000);
  assert.equal(new Set(roster.members.map((member) => member.handle.toLowerCase())).size, roster.members.length);
  for (const member of roster.members) {
    assert.match(member.handle, /^[A-Za-z0-9_-]{1,64}$/);
    assert.ok(member.name && member.rank);
    const path = member.avatar.replace(/^\.\//, ""); assert.match(path, avatarPath);
    const bytes = await readFile(resolve(root, path));
    assert.equal(hash(bytes), member.avatarSha256); assert.ok(path.includes(hash(bytes))); imageType(bytes);
  }
  return roster;
}
