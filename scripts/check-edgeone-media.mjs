import assert from "node:assert/strict";

const origin = (process.env.GVY_CDN_ORIGIN || "https://www.gvyvoyagers.vip").replace(/\/$/, "");
const mediaPaths = [
  "/assets/hero-random/v2/fleet-hero-01-1080p-v4.mp4?v=20260720-edgeone-v1",
  "/assets/hero-random/v2/fleet-hero-01-mobile-720p-v1.mp4?v=20260720-edgeone-v1",
  "/assets/hero-random/v2/fleet-hero-02-1080p-v4.mp4?v=20260720-edgeone-v1",
  "/assets/hero-random/v2/fleet-hero-02-mobile-720p-v1.mp4?v=20260720-edgeone-v1",
  "/assets/hero-random/v2/fleet-hero-02-1440p-v4.mp4?v=20260720-edgeone-v1",
  "/assets/operations-motion/v1/combat-1280-v1.mp4",
  "/assets/operations-motion/v1/combat-1920-v1.mp4",
  "/assets/operations-motion/v1/industry-1280-v1.mp4",
  "/assets/operations-motion/v1/industry-1920-v1.mp4",
  "/assets/operations-motion/v1/logistics-1280-v1.mp4",
  "/assets/operations-motion/v1/logistics-1920-v1.mp4",
  "/assets/operations-motion/v1/exploration-1280-v1.mp4",
  "/assets/operations-motion/v1/exploration-1920-v1.mp4",
];

async function fetchRange(url) {
  const response = await fetch(url, {
    headers: { Range: "bytes=0-1023" },
  });
  await response.arrayBuffer();
  return response;
}

for (const path of mediaPaths) {
  const url = `${origin}${path}`;
  const head = await fetch(url, { method: "HEAD" });
  assert.equal(head.status, 200, `${path} must be deployed before CDN verification`);
  assert.match(head.headers.get("server") || "", /edgeone/i, `${path} must be served by EdgeOne`);
  assert.match(
    head.headers.get("cache-control") || "",
    /max-age=31536000/i,
    `${path} must use the immutable one-year browser cache rule`,
  );

  const firstRange = await fetchRange(url);
  assert.equal(firstRange.status, 206, `${path} must support HTTP Range requests`);
  assert.match(firstRange.headers.get("content-range") || "", /^bytes 0-1023\//i);

  const secondRange = await fetchRange(url);
  assert.equal(secondRange.status, 206, `${path} must keep serving byte ranges after warming`);
  assert.match(
    secondRange.headers.get("eo-cache-status") || "",
    /^(?:cache )?(?:hit|refreshhit)$/i,
    `${path} second range request must hit EdgeOne cache`,
  );

  console.log(`EdgeOne media OK: ${path}`);
}
