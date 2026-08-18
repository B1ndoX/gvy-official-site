import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const productionMedia = JSON.parse(
  await readFile(resolve(root, "config/production-media.json"), "utf8"),
);
const origin = (process.env.GVY_CDN_ORIGIN || "https://www.gvyvoyagers.vip").replace(/\/$/, "");
const maxAttempts = Number(process.env.GVY_EDGEONE_ATTEMPTS || 4);
const mediaPaths = [
  ...productionMedia.heroAssets
    .filter((file) => file.endsWith(".mp4"))
    .map((file) => `/assets/hero-random/v2/${file}?v=${productionMedia.edgeCacheVersion}`),
  ...productionMedia.operationAssets
    .map((file) => `/assets/operations-motion/v2/${file}`),
];

function wait(milliseconds) {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

async function fetchChecked(url, init, validate, label) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      if (init?.method !== "HEAD") await response.arrayBuffer();
      validate(response);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) await wait(500 * attempt);
    }
  }
  throw new Error(`${label} after ${maxAttempts} attempts: ${lastError?.message || lastError}`);
}

async function verifyMedia(path) {
  const url = `${origin}${path}`;
  await fetchChecked(url, { method: "HEAD" }, (response) => {
    assert.equal(response.status, 200, `${path} must be deployed`);
    assert.match(response.headers.get("server") || "", /edgeone/i, `${path} must use EdgeOne`);
    assert.match(
      response.headers.get("cache-control") || "",
      /max-age=31536000/i,
      `${path} must keep its immutable one-year browser cache`,
    );
  }, `${path} HEAD check failed`);

  await fetchChecked(url, { headers: { Range: "bytes=0-1023" } }, (response) => {
    assert.equal(response.status, 206, `${path} must support byte ranges`);
    assert.match(response.headers.get("content-range") || "", /^bytes 0-1023\//i);
  }, `${path} range check failed`);

  await fetchChecked(url, { headers: { Range: "bytes=0-1023" } }, (response) => {
    assert.equal(response.status, 206, `${path} must keep serving byte ranges`);
    assert.match(response.headers.get("content-range") || "", /^bytes 0-1023\//i);
    assert.match(
      response.headers.get("eo-cache-status") || "",
      /^(?:cache )?(?:hit|refreshhit)$/i,
      `${path} must eventually hit EdgeOne cache`,
    );
  }, `${path} cache warm-up failed`);
}

const failures = [];
for (const path of mediaPaths) {
  try {
    await verifyMedia(path);
    console.log(`EdgeOne media OK: ${path}`);
  } catch (error) {
    failures.push(error.message);
    console.error(`EdgeOne media FAILED: ${error.message}`);
  }
}

assert.equal(
  failures.length,
  0,
  `EdgeOne media verification failed for ${failures.length}/${mediaPaths.length} assets:\n${failures.join("\n")}`,
);
console.log(`EdgeOne media verification passed: ${mediaPaths.length} assets.`);
