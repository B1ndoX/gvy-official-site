import { cp, copyFile, mkdir, readFile, rm } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fingerprintAssets } from "./fingerprint-assets.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "dist");
const productionMedia = JSON.parse(
  await readFile(resolve(root, "config/production-media.json"), "utf8"),
);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const file of ["index.html", "404.html", "member-brawl.html", "site.webmanifest", "robots.txt", "sitemap.xml"]) {
  await copyFile(resolve(root, file), resolve(output, file));
}

const activeHeroAssets = new Set(productionMedia.heroAssets);
const activeOperationAssets = new Set(productionMedia.operationAssets);

const excludedProductionDirectories = [
  "assets/gallery/thumbs",
  "assets/gallery/originals",
];

function isExcludedProductionAsset(source) {
  const relativeSource = source.slice(root.length + 1).replaceAll("\\", "/");
  return excludedProductionDirectories.some(
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

await fingerprintAssets(output);
