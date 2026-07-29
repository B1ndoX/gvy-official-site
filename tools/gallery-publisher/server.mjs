import Busboy from "busboy";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { PublisherService } from "./lib/publisher-service.mjs";

const publisherRoot = dirname(fileURLToPath(import.meta.url));
const root = resolve(publisherRoot, "../..");
const appDist = join(publisherRoot, "dist");
const siteDist = join(root, "dist");
const runtimeDir = join(publisherRoot, ".runtime");
const host = "127.0.0.1";
const port = Number(process.env.GVY_PUBLISHER_PORT || 4179);
const token = randomBytes(24).toString("hex");
const service = new PublisherService({ root });
await service.initialize();

const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml"],
  [".mp4", "video/mp4"],
  [".webmanifest", "application/manifest+json"],
]);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(payload));
}

function safeLocalHost(request) {
  try {
    const requestHost = new URL(`http://${request.headers.host || ""}`).hostname.toLowerCase();
    return requestHost === "127.0.0.1" || requestHost === "localhost" || requestHost === "[::1]";
  } catch {
    return false;
  }
}

function hasValidToken(request) {
  return request.headers["x-gvy-publisher-token"] === token;
}

async function readJson(request, limit = 64 * 1024) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > limit) throw new Error("请求内容过大");
  }
  return body ? JSON.parse(body) : {};
}

async function parseUploads(request) {
  const tempDir = await mkdtemp(join(runtimeDir, "upload-"));
  const uploads = [];
  const writes = [];
  let fileIndex = 0;
  let parseError = null;

  try {
    const busboy = Busboy({
      headers: request.headers,
      limits: { files: 100, fileSize: 50 * 1024 * 1024, fields: 10 },
    });

    busboy.on("file", (fieldName, stream, info) => {
      if (fieldName !== "photos") {
        stream.resume();
        return;
      }
      const index = fileIndex++;
      const path = join(tempDir, `${String(index).padStart(3, "0")}-${randomUUID()}`);
      const output = createWriteStream(path, { flags: "wx" });
      const write = new Promise((resolveWrite) => {
        let settled = false;
        const finish = (value = null) => {
          if (settled) return;
          settled = true;
          resolveWrite(value);
        };
        const fail = (error) => {
          parseError ||= error;
          output.destroy();
          stream.resume();
          finish();
        };
        stream.on("limit", () => fail(new Error(`${info.filename} 超过单张 50MB 限制`)));
        stream.on("error", fail);
        output.on("error", fail);
        output.on("finish", () => finish({
          index,
          path,
          originalName: info.filename,
          mimeType: info.mimeType,
        }));
      });
      stream.pipe(output);
      writes.push(write);
    });
    busboy.on("filesLimit", () => { parseError ||= new Error("单批最多添加 100 张照片"); });

    await new Promise((resolveParse, rejectParse) => {
      busboy.on("error", rejectParse);
      busboy.on("close", resolveParse);
      request.pipe(busboy);
    });
    const completed = await Promise.all(writes);
    if (parseError) throw parseError;
    uploads.push(...completed.filter(Boolean));
    uploads.sort((left, right) => left.index - right.index);
    if (!uploads.length) throw new Error("没有收到照片文件");
    return { tempDir, uploads };
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true });
    throw error;
  }
}

async function serveFile(response, base, requestPath, { spaFallback = false } = {}) {
  const cleanPath = decodeURIComponent(requestPath).replace(/^\/+/, "");
  let path = resolve(base, cleanPath || "index.html");
  if (!(path === base || path.startsWith(`${base}${sep}`))) return false;
  try {
    const details = await stat(path);
    if (details.isDirectory()) path = join(path, "index.html");
  } catch (error) {
    if (!spaFallback || error?.code !== "ENOENT") return false;
    path = join(base, "index.html");
  }
  try {
    const details = await stat(path);
    if (!details.isFile()) return false;
    response.writeHead(200, {
      "Content-Type": MIME_TYPES.get(extname(path).toLowerCase()) || "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "X-Frame-Options": requestPath.startsWith("preview") ? "SAMEORIGIN" : "DENY",
    });
    createReadStream(path).pipe(response);
    return true;
  } catch {
    return false;
  }
}

const server = createServer(async (request, response) => {
  try {
    if (!safeLocalHost(request)) {
      sendJson(response, 403, { error: "发布器只接受本机访问" });
      return;
    }
    const url = new URL(request.url || "/", `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/api/status") {
      sendJson(response, 200, { ...(await service.getStatus()), token });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/health") {
      sendJson(response, 200, { ok: true });
      return;
    }
    if (url.pathname.startsWith("/api/") && request.method !== "GET" && !hasValidToken(request)) {
      sendJson(response, 403, { error: "本机发布会话已失效，请刷新页面" });
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/import") {
      const { tempDir, uploads } = await parseUploads(request);
      try {
        const allowDuplicates = request.headers["x-gvy-allow-duplicates"] === "1";
        sendJson(response, 200, await service.createPreview(uploads, { allowDuplicates }));
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/delete-preview") {
      const payload = await readJson(request);
      sendJson(response, 200, await service.createDeletePreview(payload.numbers));
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/rollback") {
      await readJson(request);
      sendJson(response, 200, await service.rollback());
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/publish") {
      const payload = await readJson(request);
      if (payload.confirmed !== true) throw new Error("必须明确确认正式发布");
      service.publish().catch(() => {});
      sendJson(response, 202, { accepted: true });
      return;
    }
    if (url.pathname.startsWith("/preview/")) {
      const served = await serveFile(response, siteDist, url.pathname.slice("/preview/".length));
      if (!served) sendJson(response, 404, { error: "预览资源不存在" });
      return;
    }
    if (url.pathname.startsWith("/deleted-preview/")) {
      const parts = url.pathname.slice("/deleted-preview/".length).split("/");
      const sessionId = parts.shift();
      if (!/^[a-f0-9-]{36}$/i.test(sessionId || "")) {
        sendJson(response, 404, { error: "删除预览资源不存在" });
        return;
      }
      const served = await serveFile(response, join(runtimeDir, sessionId, "removed-assets"), parts.join("/"));
      if (!served) sendJson(response, 404, { error: "删除预览资源不存在" });
      return;
    }
    if (url.pathname === "/preview") {
      response.writeHead(302, { Location: "/preview/" });
      response.end();
      return;
    }
    if (url.pathname.startsWith("/site-assets/")) {
      const served = await serveFile(response, join(root, "assets"), url.pathname.slice("/site-assets/".length));
      if (!served) sendJson(response, 404, { error: "品牌资源不存在" });
      return;
    }
    if (request.method === "GET") {
      const served = await serveFile(response, appDist, url.pathname, { spaFallback: true });
      if (served) return;
    }
    sendJson(response, 404, { error: "未找到请求" });
  } catch (error) {
    if (error?.code === "DUPLICATE_REVIEW_REQUIRED") {
      sendJson(response, 200, {
        reviewRequired: true,
        message: error.message,
        code: error.code,
        duplicates: error.duplicates,
      });
      return;
    }
    sendJson(response, 400, { error: error.message || "发布器操作失败" });
  }
});

server.listen(port, host, () => {
  const url = `http://${host}:${port}/`;
  console.log(`GVY 相册发布器已启动：${url}`);
  console.log("按 Control+C 可安全关闭发布器。未正式发布的预览可在下次启动后继续处理或清空。");
  if (process.platform === "darwin" && process.env.GVY_PUBLISHER_NO_OPEN !== "1") {
    const opener = spawn("/usr/bin/open", [url], { detached: true, stdio: "ignore" });
    opener.unref();
  }
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
