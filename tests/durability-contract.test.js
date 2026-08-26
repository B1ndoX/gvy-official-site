import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import notFoundHandler from "../edge-functions/[[default]].js";
import { middleware } from "../middleware.js";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const packageJson = JSON.parse(await read("package.json"));
const edgeone = JSON.parse(await read("edgeone.json"));
const media = JSON.parse(await read("config/production-media.json"));
const homepage = await read("index.html");
const heroController = await read("assets/js/hero-video-controller.js");
const checkJavaScript = await read("scripts/check-js.mjs");
const checkEdgeOne = await read("scripts/check-edgeone-media.mjs");
const monitorScript = await read("scripts/monitor-production.mjs");
const verifyWorkflow = await read(".github/workflows/verify.yml");
const monitorWorkflow = await read(".github/workflows/production-monitor.yml");
const notFoundPage = await read("404.html");
const buildScript = await read("scripts/build-site.mjs");
const outputAudit = await read("scripts/check-production-output.mjs");
const publisherRunner = await read("tools/gallery-publisher/run-server-macos.zsh");
const publisherProcess = await read("tools/gallery-publisher/lib/process.mjs");

test("development and EdgeOne runtimes are explicit and independently verified", async () => {
  assert.equal((await read(".node-version")).trim(), "24.19.0");
  assert.equal(edgeone.nodeVersion, "22.11.0");
  assert.equal(edgeone.installCommand, "npm ci --ignore-scripts --omit=dev");
  assert.equal(edgeone.buildCommand, "npm run verify:edgeone");
  assert.equal(packageJson.scripts["test:site"], "node --test tests/*.test.js");
  assert.match(packageJson.scripts["verify:edgeone"], /GVY_SKIP_MEDIA_METADATA=1/);
  assert.match(packageJson.scripts["verify:edgeone"], /npm run test:site && npm run check:js && npm run build && npm run check:dist/);
  assert.match(packageJson.scripts["verify:site"], /npm run test:site && npm run check:js && npm run build && npm run check:dist/);
  assert.match(packageJson.scripts.verify, /gallery:publisher:test/);
  assert.match(verifyWorkflow, /node-version:\s*22\.11\.0/);
  assert.match(verifyWorkflow, /node-version-file:\s*\.node-version/);
  assert.match(verifyWorkflow, /Node 24 LTS/);
  assert.match(verifyWorkflow, /ffmpeg@7/);
  assert.match(verifyWorkflow, /libwebp/);
});

test("production output is self-audited and includes a crawl-safe 404 document", () => {
  assert.equal(packageJson.scripts["check:dist"], "node scripts/check-production-output.mjs");
  assert.deepEqual(edgeone.rewrites, []);
  assert.match(buildScript, /"404\.html"/);
  assert.match(outputAudit, /missing production references/);
  assert.match(outputAudit, /non-production directory leaked into dist/);
  assert.match(notFoundPage, /name="robots" content="noindex, nofollow"/);
  assert.match(notFoundPage, /返回舰队主页/);
});

test("publisher bootstrap is reproducible and contains no maintainer-specific runtime path", () => {
  assert.match(publisherRunner, /npm ci --ignore-scripts --no-audit --no-fund/);
  assert.doesNotMatch(publisherRunner, /npm install/);
  assert.doesNotMatch(publisherProcess, /\/Users\/bindox/);
  assert.match(publisherProcess, /GVY_FFMPEG/);
  assert.match(publisherProcess, /\/usr\/local\/bin\/ffmpeg/);
});

test("deployed brawl runtime is included in JavaScript syntax checks", () => {
  assert.match(checkJavaScript, /assets\/fleet-command-brawl\.js/);
  assert.match(checkJavaScript, /edge-functions/);
  assert.match(checkJavaScript, /middleware\.js/);
  assert.match(checkJavaScript, /ignoredDirectories/);
});

test("one production manifest drives build and EdgeOne media verification", () => {
  assert.equal(media.heroAssets.length, 10);
  assert.equal(media.heroAssets.filter((file) => file.endsWith(".mp4")).length, 7);
  assert.equal(media.operationAssets.length, 12);
  for (const asset of media.heroAssets) {
    assert.ok(homepage.includes(asset));
    assert.ok(heroController.includes(asset));
  }
  for (const asset of media.operationAssets) assert.ok(homepage.includes(asset));
  assert.match(checkEdgeOne, /config\/production-media\.json/);
  assert.match(checkEdgeOne, /GVY_EDGEONE_ATTEMPTS/);
  assert.match(checkEdgeOne, /failures\.push/);
});

test("security headers authorize only the two intentional inline homepage scripts", () => {
  const globalRule = edgeone.headers.find((rule) => rule.source === "/*");
  const headers = new Map(globalRule.headers.map(({ key, value }) => [key, value]));
  assert.equal(headers.get("Strict-Transport-Security"), "max-age=15552000");
  assert.equal(headers.get("Permissions-Policy"), "camera=(), microphone=(), geolocation=()");
  const csp = headers.get("Content-Security-Policy");
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'self'/);
  assert.match(csp, /upgrade-insecure-requests/);

  const inlineScripts = [...homepage.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => `'sha256-${createHash("sha256").update(match[1]).digest("base64")}'`);
  assert.equal(inlineScripts.length, 2);
  inlineScripts.forEach((hash) => assert.ok(csp.includes(hash), `CSP is missing ${hash}`));
});

test("EdgeOne middleware upgrades HTTP without changing HTTPS requests", () => {
  const redirectResult = middleware({
    request: new Request("http://www.gvyvoyagers.vip/gallery?x=1"),
    redirect: (url, status) => ({ url, status }),
    next: () => ({ next: true }),
  });
  assert.deepEqual(redirectResult, {
    url: "https://www.gvyvoyagers.vip/gallery?x=1",
    status: 308,
  });

  const nextResult = middleware({
    request: new Request("https://www.gvyvoyagers.vip/"),
    redirect: () => ({ redirected: true }),
    next: () => ({ next: true }),
  });
  assert.deepEqual(nextResult, { next: true });
});

test("EdgeOne catch-all returns the branded document with a real 404 status", async () => {
  const response = await notFoundHandler({
    request: new Request("https://www.gvyvoyagers.vip/unknown/route"),
    fetch: async (url) => {
      assert.equal(url.toString(), "https://www.gvyvoyagers.vip/404.html");
      return new Response(notFoundPage, { status: 200 });
    },
  });
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow");
  assert.match(await response.text(), /ROUTE NOT FOUND \/ 404/);
});

test("scheduled production monitoring covers live pages, media and expiry alerts", () => {
  assert.match(packageJson.scripts["monitor:production"], /monitor-production\.mjs/);
  assert.match(monitorWorkflow, /cron:\s*"17 \*\/6 \* \* \*"/);
  assert.match(monitorWorkflow, /scripts\/monitor-production\.mjs/);
  assert.match(monitorWorkflow, /scripts\/check-edgeone-media\.mjs/);
  assert.match(monitorWorkflow, /node-version-file:\s*\.node-version/);
  assert.match(monitorWorkflow, /GVY production monitor failure/);
  assert.match(monitorWorkflow, /issues:\s*write/);
  assert.match(monitorScript, /https:\/\/data\.iana\.org\/rdap\/dns\.json/);
  assert.match(monitorScript, /registryBaseUrl/);
  assert.doesNotMatch(monitorScript, /rdap\.verisign\.com/);
  assert.match(monitorScript, /const requiredChecks =/);
  assert.match(monitorScript, /const advisoryChecks =/);
  assert.match(monitorScript, /checkNotFoundResponses/);
  assert.match(monitorScript, /ROUTE NOT FOUND \/ 404/);
  assert.match(monitorScript, /response\.status, 404/);
  assert.match(monitorScript, /data-hero-sequence/);
  assert.match(monitorScript, /www true 404/);
  assert.match(monitorScript, /apex true 404/);
  assert.match(monitorScript, /Independent child service unavailable/);
  assert.match(monitorScript, /GVY_MONITOR_ATTEMPTS \|\| 5/);
  assert.match(monitorScript, /Math\.min\(5_000 \* attempt, 20_000\)/);
});
