import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readdir, readFile, stat } from "node:fs/promises";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { assetDigest, codeReferences, codeReferenceTarget } from "./fingerprint-assets.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "dist");
const requiredFiles = [
  "index.html",
  "404.html",
  "member-brawl.html",
  "robots.txt",
  "sitemap.xml",
  "site.webmanifest",
];
const forbiddenPrefixes = [".github/", "config/", "docs/", "script/", "scripts/", "tests/", "tools/"];

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

function cleanReference(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed || trimmed.startsWith("#") || /^(?:https?:|data:|mailto:|tel:)/i.test(trimmed)) return null;
  assert.doesNotMatch(trimmed, /^javascript:/i, `active URL scheme is forbidden: ${trimmed}`);
  return decodeURIComponent(trimmed.split(/[?#]/, 1)[0]);
}

function resolveReference(source, value, { documentRelative = false } = {}) {
  const cleaned = cleanReference(value);
  if (!cleaned) return null;
  if (cleaned === "/" || cleaned === "." || cleaned === "./") return resolve(output, "index.html");
  const base = cleaned.startsWith("/") || documentRelative ? output : dirname(source);
  const relativePath = cleaned.replace(/^\.\//, "").replace(/^\/+/, "");
  const target = resolve(base, relativePath.endsWith("/") ? `${relativePath}index.html` : relativePath);
  assert.ok(target === output || target.startsWith(`${output}${sep}`), `reference escapes dist: ${value}`);
  return target;
}

function collectMarkupReferences(source) {
  const references = [];
  for (const match of source.matchAll(/\b(?:src|href|poster|data-src(?:-mobile|-compact|-wide)?)=["']([^"']+)["']/gi)) {
    references.push(match[1]);
  }
  for (const match of source.matchAll(/\bsrcset=["']([^"']+)["']/gi)) {
    references.push(...match[1].split(",").map((candidate) => candidate.trim().split(/\s+/, 1)[0]));
  }
  return references;
}

const files = await walk(output);
const builtHome = await readFile(resolve(output, "index.html"), "utf8");
const edgeConfig = JSON.parse(await readFile(resolve(root, "edgeone.json"), "utf8"));
const csp = edgeConfig.headers.find((rule) => rule.source === "/*").headers
  .find((header) => header.key === "Content-Security-Policy").value;
for (const match of builtHome.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
  const hash = createHash("sha256").update(match[1]).digest("base64");
  assert.ok(csp.includes(`'sha256-${hash}'`), "production bootstrap is not authorized by CSP");
}
const relativeFiles = files.map((file) => relative(output, file).replaceAll("\\", "/"));
for (const file of requiredFiles) await access(resolve(output, file));
for (const file of relativeFiles) {
  assert.ok(!forbiddenPrefixes.some((prefix) => file.startsWith(prefix)), `non-production directory leaked into dist: ${file}`);
  assert.notEqual(extname(file), ".map", `source map must not be public: ${file}`);
  assert.notEqual(extname(file), ".md", `documentation must not be public: ${file}`);
}

const references = [];
for (const file of files) {
  const extension = extname(file).toLowerCase();
  if (![".html", ".css", ".js", ".json", ".webmanifest"].includes(extension)) continue;
  const source = await readFile(file, "utf8");
  for (const { url } of codeReferences(source, file)) {
    const target = codeReferenceTarget(output, file, url);
    const digest = assetDigest(await readFile(target, "utf8"));
    assert.equal(url.split("?")[1], `v=${digest}`, `stale production asset URL: ${url}`);
  }
  if (extension === ".html") {
    references.push(...collectMarkupReferences(source).map((value) => ({ file, value })));
  } else if (extension === ".css") {
    for (const match of source.matchAll(/url\(["']?([^"')]+)["']?\)/gi)) references.push({ file, value: match[1] });
  } else if (extension === ".js") {
    for (const match of source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g)) references.push({ file, value: match[1] });
    for (const match of source.matchAll(/["'](\.\/?assets\/[^"']+)["']/g)) {
      references.push({ file, value: match[1], documentRelative: true });
    }
  } else if (extension === ".webmanifest") {
    const manifest = JSON.parse(source);
    for (const icon of manifest.icons || []) references.push({ file, value: icon.src });
  }
}

const missing = [];
for (const reference of references) {
  const target = resolveReference(reference.file, reference.value, reference);
  if (!target) continue;
  try {
    const details = await stat(target);
    if (!details.isFile()) missing.push(`${relative(output, reference.file)} -> ${reference.value}`);
  } catch {
    missing.push(`${relative(output, reference.file)} -> ${reference.value}`);
  }
}
assert.deepEqual(missing, [], `missing production references:\n${missing.join("\n")}`);

const totalBytes = (await Promise.all(files.map(async (file) => (await stat(file)).size)))
  .reduce((total, size) => total + size, 0);
process.stdout.write(`Production output audit passed: ${files.length} files, ${references.length} local references, ${totalBytes} bytes.\n`);
