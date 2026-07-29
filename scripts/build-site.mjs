import { cp, copyFile, mkdir, rm } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "dist");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const file of ["index.html", "member-brawl.html", "site.webmanifest", "robots.txt", "sitemap.xml"]) {
  await copyFile(resolve(root, file), resolve(output, file));
}

const activeHeroAssets = new Set([
  "fleet-hero-01-1080p-v4.mp4",
  "fleet-hero-01-mobile-720p-v1.mp4",
  "fleet-hero-01-poster-v2.webp",
  "fleet-hero-02-1080p-v4.mp4",
  "fleet-hero-02-mobile-720p-v1.mp4",
  "fleet-hero-02-1440p-v4.mp4",
  "fleet-hero-02-poster-1440p-v3.webp",
  "fleet-hero-03-1080p-v1.mp4",
  "fleet-hero-03-mobile-720p-v1.mp4",
  "fleet-hero-03-poster-v1.webp",
]);

const activeOperationAssets = new Set([
  "combat-1920-v2.mp4",
  "combat-2560-v2.mp4",
  "combat-mobile-1280-v1.mp4",
  "industry-1920-v2.mp4",
  "industry-2560-v2.mp4",
  "industry-mobile-1280-v1.mp4",
  "logistics-1920-v2.mp4",
  "logistics-2560-v2.mp4",
  "logistics-mobile-1280-v1.mp4",
  "exploration-1920-v2.mp4",
  "exploration-2560-v2.mp4",
  "exploration-mobile-1280-v1.mp4",
]);

const excludedProductionAssets = new Set([
  "assets/archive-planet-feed.mp4",
  "assets/operations-planet-video.mp4",
  "assets/hero-random/fleet-hero-01.mp4",
  "assets/hero-random/fleet-hero-02.mp4",
  "assets/fleet-command.js",
  "assets/js/deferred-media.js",
  "assets/js/fleet-data.js",
]);

const excludedProductionDirectories = [
  "assets/gallery/thumbs",
  "assets/gallery/originals",
];

function isExcludedProductionAsset(source) {
  const relativeSource = source.slice(root.length + 1).replaceAll("\\", "/");
  return excludedProductionAssets.has(relativeSource)
    || excludedProductionDirectories.some(
      (directory) => relativeSource === directory || relativeSource.startsWith(`${directory}/`),
    );
}

await cp(resolve(root, "assets"), resolve(output, "assets"), {
  recursive: true,
  filter(source) {
    if (isExcludedProductionAsset(source)) return false;
    const inVersionedHeroDirectory = dirname(source).endsWith("assets/hero-random/v2");
    if (inVersionedHeroDirectory && !activeHeroAssets.has(basename(source))) return false;
    if (source.includes("assets/operations-motion/v1")) return false;
    const inActiveOperationDirectory = dirname(source).endsWith("assets/operations-motion/v2");
    return !inActiveOperationDirectory || activeOperationAssets.has(basename(source));
  },
});

const vendorOutput = resolve(output, "assets/vendor");
await mkdir(vendorOutput, { recursive: true });
await copyFile(
  resolve(root, "node_modules/gsap/dist/gsap.min.js"),
  resolve(output, "assets/vendor/gsap.min.js"),
);
await copyFile(
  resolve(root, "node_modules/gsap/dist/ScrollTrigger.min.js"),
  resolve(output, "assets/vendor/ScrollTrigger.min.js"),
);
