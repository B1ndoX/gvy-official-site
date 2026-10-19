import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(await readFile(resolve(siteRoot, "edgeone.json"), "utf8"));
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".mp4": "video/mp4", ".webm": "video/webm", ".webp": "image/webp", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

// Development/test server only. Reuse the deployed cache rules, while keeping
// CDN cache hits distinct from the browser disk cache measured by Playwright.
export function createPreviewServer({ root = resolve(siteRoot, "dist") } = {}) {
  const etags = new Map();
  return createServer(async (request, response) => {
    try {
      if (!["GET", "HEAD"].includes(request.method)) {
        response.writeHead(405, { Allow: "GET, HEAD" }).end(); return;
      }
      const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
      const file = resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
      if (!file.startsWith(resolve(root) + sep)) { response.writeHead(403).end(); return; }
      const info = await stat(file).catch(() => null);
      if (!info?.isFile()) {
        response.writeHead(404, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        response.end(request.method === "HEAD" ? undefined : await readFile(resolve(root, "404.html")));
        return;
      }
      const identity = `${info.mtimeMs}:${info.size}`;
      if (etags.get(file)?.identity !== identity) {
        const hash = createHash("sha256");
        for await (const chunk of createReadStream(file)) hash.update(chunk);
        etags.set(file, { identity, value: `"${hash.digest("hex")}"` });
      }
      const etag = etags.get(file).value;
      const modified = info.mtime.toUTCString();
      const headers = { "Content-Type": types[extname(file)] || "application/octet-stream",
        "Cache-Control": "public, max-age=0, must-revalidate", "Accept-Ranges": "bytes",
        ETag: etag, "Last-Modified": modified, "X-Content-Type-Options": "nosniff" };
      for (const rule of config.headers) {
        const matches = rule.source.endsWith("*")
          ? pathname.startsWith(rule.source.slice(0, -1)) : pathname === rule.source;
        if (matches) for (const header of rule.headers) headers[header.key] = header.value;
      }
      const noneMatch = request.headers["if-none-match"];
      const notModified = noneMatch
        ? noneMatch.split(",").some((value) => value.trim() === "*" || value.trim().replace(/^W\//, "") === etag)
        : request.headers["if-modified-since"] && Date.parse(request.headers["if-modified-since"]) >= Date.parse(modified);
      if (notModified) { response.writeHead(304, headers).end(); return; }
      let start = 0;
      let end = info.size - 1;
      let status = 200;
      const ifRange = request.headers["if-range"];
      if (request.headers.range && (!ifRange || ifRange === etag || Date.parse(ifRange) >= Date.parse(modified))) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
        if (match && (match[1] || match[2])) {
          start = match[1] ? Number(match[1]) : Math.max(0, info.size - Number(match[2]));
          end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end;
        } else start = info.size;
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= info.size) {
          response.writeHead(416, { ...headers, "Content-Range": `bytes */${info.size}` }).end(); return;
        }
        status = 206;
        headers["Content-Range"] = `bytes ${start}-${end}/${info.size}`;
      }
      headers["Content-Length"] = Math.max(0, end - start + 1);
      response.writeHead(status, headers);
      if (request.method === "HEAD" || !info.size) { response.end(); return; }
      const stream = createReadStream(file, { start, end });
      stream.on("error", () => response.destroy());
      response.on("close", () => stream.destroy());
      stream.pipe(response);
    } catch {
      if (!response.headersSent) response.writeHead(400);
      response.end();
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const portIndex = process.argv.indexOf("--port");
  const port = portIndex < 0 ? 8001 : Number(process.argv[portIndex + 1]);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("Invalid preview port");
  const server = createPreviewServer();
  server.listen(port, "127.0.0.1", () => console.log(`GVY local preview: http://127.0.0.1:${server.address().port}/`));
}
