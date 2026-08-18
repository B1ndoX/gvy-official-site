import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

import { assertOnlyManagedGalleryChanged } from "./gallery-html.mjs";

export const DEPLOYMENT_VERIFY_TIMEOUT_MINUTES = 12;

function run(command, args, { cwd, maxOutput = 6_000_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { if (stdout.length < maxOutput) stdout += chunk; });
    child.stderr.on("data", (chunk) => { if (stderr.length < maxOutput) stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      else reject(new Error(`${command} ${args.join(" ")} 失败：${stderr.trim() || stdout.trim() || `退出码 ${code}`}`));
    });
  });
}

export async function gitOutput(root, args) {
  return (await run("git", args, { cwd: root })).stdout;
}

export async function listGitChanges(root) {
  const output = await gitOutput(root, ["status", "--porcelain"]);
  if (!output) return [];
  return output.split("\n")
    .map((line) => line.replace(/^[ MADRCU?!]{1,2}\s+/, "").trim())
    .filter(Boolean);
}

function createBackupTag(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value || "00";
  return `backup-production-before-gallery-${value("year")}${value("month")}${value("day")}-${value("hour")}${value("minute")}${value("second")}-CST`;
}

export function buildReleaseSummary(session, date = new Date()) {
  const isDelete = session.type === "delete";
  const itemCount = session.itemCount
    ?? session.items?.length
    ?? Math.max(1, session.batchEnd - session.batchStart + 1);
  const photoWord = itemCount === 1 ? "photo" : "photos";
  return {
    tag: createBackupTag(date),
    commitMessage: isDelete
      ? `fix: remove ${itemCount} gallery ${photoWord}`
      : `feat: publish ${itemCount} gallery ${photoWord}`,
    branch: "main",
    remoteBranch: "origin/main",
    project: "gvy-official-site",
    domains: ["https://www.gvyvoyagers.vip", "https://gvyvoyagers.vip"],
  };
}

function samePathSet(actual, expected) {
  const left = [...new Set(actual)].sort();
  const right = [...new Set(expected)].sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function assertGalleryOnlyPaths(paths) {
  const allowedAsset = /^assets\/gallery\/(?:optimized\/|thumbs\/|originals\/)?team-\d+[^/]*\.(?:jpe?g|png|webp|heic|heif)$/i;
  const unexpected = paths.filter((path) => path !== "index.html" && !allowedAsset.test(path));
  if (unexpected.length) {
    throw new Error(`检测到团建相册白名单之外的文件：${unexpected.join("、")}；已停止发布`);
  }
}

async function verifyDeployment({ session, domains, onUpdate }) {
  const lastNumber = String(session.batchEnd).padStart(2, "0");
  const firstNumber = String(session.batchStart).padStart(2, "0");
  const expectedAsset = `/assets/gallery/optimized/team-${lastNumber}-1280.webp`;
  const deadline = Date.now() + DEPLOYMENT_VERIFY_TIMEOUT_MINUTES * 60 * 1000;
  let lastError = "等待 EdgeOne 部署";

  while (Date.now() < deadline) {
    try {
      const results = await Promise.all(domains.map(async (origin) => {
        const nonce = Date.now();
        const htmlResponse = await fetch(`${origin}/?gallery-publisher=${nonce}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(15_000),
        });
        const html = await htmlResponse.text();
        if (session.type === "delete") {
          return htmlResponse.ok
            && session.items.every((item) => !html.includes(`./assets/gallery/${item.fallbackName}`))
            && html.includes(`aria-label="${session.resultCount} 张舰队团建照片`);
        }
        const assetResponse = await fetch(`${origin}${expectedAsset}?gallery-publisher=${nonce}`, {
          method: "HEAD",
          cache: "no-store",
          signal: AbortSignal.timeout(15_000),
        });
        return htmlResponse.ok
          && assetResponse.ok
          && html.includes(`team-${lastNumber}-1280.webp`)
          && html.includes(`team-${firstNumber}-1280.webp`);
      }));
      if (results.every(Boolean)) return;
      lastError = "域名尚未全部显示新相册资源";
    } catch (error) {
      lastError = error.message;
    }
    onUpdate?.(`EdgeOne 尚在部署，继续复查：${lastError}`);
    await new Promise((resolve) => setTimeout(resolve, 8_000));
  }
  throw new Error(`推送成功，但 ${DEPLOYMENT_VERIFY_TIMEOUT_MINUTES} 分钟内未完成线上复查：${lastError}`);
}

export async function publishGallerySession({ root, session, onUpdate, onCommitted, onPushed }) {
  if (!session?.verified) throw new Error("必须先生成并通过本地预览");
  if (session.baselineDirty?.length) throw new Error("生成预览前已有未提交改动，正式发布保持锁定");
  assertGalleryOnlyPaths(session.changedFiles || []);
  const [beforeHtml, currentHtml] = await Promise.all([
    readFile(session.backupPath, "utf8"),
    readFile(`${root}/index.html`, "utf8"),
  ]);
  assertOnlyManagedGalleryChanged(beforeHtml, currentHtml);

  const branch = await gitOutput(root, ["branch", "--show-current"]);
  if (branch !== "main") throw new Error(`当前分支是 ${branch || "未知"}，只允许从 main 发布`);
  onUpdate?.("重新运行完整验证");
  await run("npm", ["run", "verify"], { cwd: root });
  onUpdate?.("同步 origin/main");
  await run("git", ["fetch", "--prune", "origin"], { cwd: root });
  let head = await gitOutput(root, ["rev-parse", "HEAD"]);
  let remoteHead = await gitOutput(root, ["rev-parse", "origin/main"]);
  const summary = session.release || buildReleaseSummary(session);

  if (session.commitSha) {
    const changedPaths = await listGitChanges(root);
    if (changedPaths.length) throw new Error("发布提交已生成，但工作区又出现改动，已停止重试");
    if (head !== session.commitSha) throw new Error("发布提交已生成，但本地 main 已移动，已停止重试");
    const parent = await gitOutput(root, ["rev-parse", `${session.commitSha}^`]);
    if (remoteHead !== parent && remoteHead !== session.commitSha) {
      throw new Error("origin/main 已被其他提交更新，已停止重试");
    }
  } else {
    const changedPaths = await listGitChanges(root);
    assertGalleryOnlyPaths(changedPaths);
    if (!samePathSet(changedPaths, session.changedFiles)) {
      throw new Error("预览后出现了批次之外的文件变化，已停止发布");
    }
    if (head !== remoteHead) throw new Error("本地 main 与 origin/main 不一致，请先处理同步后再发布");

    onUpdate?.(`建立回滚标签 ${summary.tag}`);
    await run("git", ["tag", summary.tag, "HEAD"], { cwd: root });
    await run("git", ["add", "--", ...session.changedFiles], { cwd: root });
    const stagedPaths = (await gitOutput(root, ["diff", "--cached", "--name-only"])).split("\n").filter(Boolean);
    assertGalleryOnlyPaths(stagedPaths);
    if (!samePathSet(stagedPaths, session.changedFiles)) {
      throw new Error("暂存内容与本批团建相册文件不一致，已停止发布");
    }
    await run("git", ["commit", "-m", summary.commitMessage], { cwd: root });
    head = await gitOutput(root, ["rev-parse", "HEAD"]);
    session.commitSha = head;
    session.release = summary;
    await onCommitted?.({ commitSha: head, release: summary });
  }

  remoteHead = await gitOutput(root, ["rev-parse", "origin/main"]);
  onUpdate?.("推送回滚标签与 main");
  await run("git", ["push", "origin", summary.tag], { cwd: root });
  if (remoteHead !== session.commitSha) await run("git", ["push", "origin", "main"], { cwd: root });
  await onPushed?.({ commitSha: session.commitSha, release: summary });
  onUpdate?.("等待 EdgeOne 并复查两个正式域名");
  await verifyDeployment({ session, domains: summary.domains, onUpdate });
  return { ...summary, commitSha: session.commitSha };
}
