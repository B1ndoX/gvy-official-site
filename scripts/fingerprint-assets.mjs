import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";

export const assetDigest = (source) => createHash("sha256").update(source).digest("hex").slice(0, 16);

// Hash dependency-first, so a changed module invalidates its parent entry too.
// Only external script/style URLs and the local arena document are rewritten;
// inline bootstrap bytes (CSP), images and video selection stay untouched.
export function codeReferences(source, file) {
  if (extname(file) === ".html") {
    return [...source.matchAll(/\b(?:src|href)=["'](\.\/[^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g)]
      .map((match) => ({ url: match[1], index: match.index + match[0].indexOf(match[1]) }));
  }
  if (extname(file) === ".js") {
    return [...source.matchAll(/["'](\.\/[^"']+\.(?:js|css|html)(?:\?[^"']*)?)["']/g)]
      .map((match) => ({ url: match[1], index: match.index + 1 }));
  }
  return [];
}

export function codeReferenceTarget(output, file, url) {
  const path = url.split("?")[0];
  // The iframe URL is document-relative, unlike ES module imports.
  const target = resolve(path.endsWith(".html") ? output : dirname(file), path);
  if (!target.startsWith(`${resolve(output)}${sep}`)) throw new Error(`Asset reference escapes output: ${url}`);
  return target;
}

export async function fingerprintAssets(output) {
  const done = new Map();
  const visiting = new Set();
  async function visit(file) {
    if (done.has(file)) return done.get(file);
    if (visiting.has(file)) throw new Error(`Circular asset dependency: ${file}`);
    visiting.add(file);
    let source = await readFile(file, "utf8");
    for (const { url, index } of codeReferences(source, file).reverse()) {
      const digest = await visit(codeReferenceTarget(output, file, url));
      source = source.slice(0, index) + `${url.split("?")[0]}?v=${digest}` + source.slice(index + url.length);
    }
    await writeFile(file, source);
    const digest = assetDigest(source);
    done.set(file, digest);
    visiting.delete(file);
    return digest;
  }
  for (const file of ["index.html", "404.html", "member-brawl.html"]) await visit(resolve(output, file));
}
