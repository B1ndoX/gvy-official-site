import { cp, copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "dist");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const file of ["index.html", "site.webmanifest", "robots.txt", "sitemap.xml"]) {
  await copyFile(resolve(root, file), resolve(output, file));
}

await cp(resolve(root, "assets"), resolve(output, "assets"), { recursive: true });

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
