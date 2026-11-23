import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import {join,dirname} from 'node:path';

import { assertOnlyManagedGalleryChanged, parseGalleryState } from "./gallery-html.mjs";
import { assertPreviewUnchanged } from "./preview-state.mjs";

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
    branch: session.branch || "main",
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

export function isExpectedGalleryAssetResponse(response) {
  const contentType = response?.headers?.get?.("content-type") || "";
  return Boolean(response?.ok) && /^image\/webp(?:;|$)/i.test(contentType);
}

export function matchesExpectedGallery(html, expected) {
  try {
    const actual = parseGalleryState(html);
    return actual.maxPhotoNumber === expected.maxPhotoNumber
      && actual.latestAssetNumber === expected.latestAssetNumber
      && actual.count === expected.count
      && actual.items.every((item, index) => item.markup === expected.items[index].markup);
  } catch { return false; }
}

async function verifyDeployment({ session, domains, onUpdate, expectedGallery }) {
  const lastNumber = String(session.batchEnd).padStart(2, "0");
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
        const galleryMatches = htmlResponse.ok && matchesExpectedGallery(html, expectedGallery);
        if (session.type === "delete") {
          return galleryMatches;
        }
        const assetResponse = await fetch(`${origin}${expectedAsset}?gallery-publisher=${nonce}`, {
          method: "HEAD",
          cache: "no-store",
          signal: AbortSignal.timeout(15_000),
        });
        return galleryMatches && isExpectedGalleryAssetResponse(assetResponse);
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

const REQUIRED_CHECKS=['Deployable site on Node 24','Affected tools and browser checks on Node 24'];

export function galleryChecksState(pr, candidate) {
  if(pr.headRefOid!==candidate)throw Error('相册PR的提交已经改变，已停止发布');
  if(pr.state==='MERGED')return 'merged';
  if(pr.state!=='OPEN')throw Error('相册PR已关闭，已停止发布');
  const checks=pr.statusCheckRollup??[];
  const failed=checks.find(check=>['FAILURE','CANCELLED','TIMED_OUT','ACTION_REQUIRED','STARTUP_FAILURE'].includes(check.conclusion?.toUpperCase())||['FAILURE','ERROR'].includes(check.state));
  if(failed)throw Error(`相册PR检查失败：${failed.name??failed.context}；请查看PR中的原始日志，修复后重试`);
  return REQUIRED_CHECKS.every(name=>checks.some(check=>check.name===name&&check.status==='COMPLETED'&&check.conclusion==='SUCCESS'))?'ready':'pending';
}

async function readGalleryPr(root, session, githubRun){
  return JSON.parse((await githubRun('gh',['pr','view',session.prUrl,'--json','state,headRefOid,mergeCommit,statusCheckRollup'],{cwd:root})).stdout);
}

async function waitForGalleryChecks(root,session,githubRun){
  const deadline=Date.now()+35*60*1000;
  while(Date.now()<deadline){
    const pr=await readGalleryPr(root,session,githubRun);
    const state=galleryChecksState(pr,session.commitSha);
    if(state!=='pending')return state;
    await new Promise(resolve=>setTimeout(resolve,10000));
  }
  throw Error(`相册PR检查仍未完成，已保留批次，可稍后重试：${session.prUrl}`);
}

export async function publishGallerySession({ root, session, onUpdate, onCommitted, onMerged, githubRun=run, verifyDeploymentImpl=verifyDeployment }) {
  if (!session?.verified) throw new Error("必须先生成并通过本地预览");
  if (session.baselineDirty?.length) throw new Error("生成预览前已有未提交改动，正式发布保持锁定");
  assertGalleryOnlyPaths(session.changedFiles || []);
  const [beforeHtml, currentHtml] = await Promise.all([
    readFile(session.backupPath, "utf8"),
    readFile(`${root}/index.html`, "utf8"),
  ]);
  assertOnlyManagedGalleryChanged(beforeHtml, currentHtml);
  const expectedGallery = parseGalleryState(currentHtml);
  if (!session.commitSha) await assertPreviewUnchanged(session.previewState, await gitOutput(root, ["rev-parse", "HEAD"]));

  const branch = await gitOutput(root, ["branch", "--show-current"]);
  if(!session.isolated || !/^gallery-publisher\/[a-f0-9-]{36}$/.test(branch) || session.branch!==branch)throw Error('旧预览不能直接推送main；请清空未提交的旧批次，在独立相册工作区重新生成预览');
  onUpdate?.("重新运行完整验证");
  await run("npm", ["run", "verify"], { cwd: root });
  onUpdate?.("同步 origin/main");
  await run("git", ["fetch", "--prune", "origin"], { cwd: root });
  let head = await gitOutput(root, ["rev-parse", "HEAD"]);
  let remoteHead = await gitOutput(root, ["rev-parse", "origin/main"]);
  const summary = session.release || buildReleaseSummary(session);
  const alreadyMerged=session.prUrl && galleryChecksState(await readGalleryPr(root,session,githubRun),session.commitSha)==='merged';

  if (session.commitSha) {
    const changedPaths = await listGitChanges(root);
    if (changedPaths.length) throw new Error("发布提交已生成，但工作区又出现改动，已停止重试");
    if (head !== session.commitSha) throw new Error("发布提交已生成，但本地 main 已移动，已停止重试");
    const parent = await gitOutput(root, ["rev-parse", `${session.commitSha}^`]);
    if (!alreadyMerged && remoteHead !== parent) {
      throw new Error("origin/main 已被其他提交更新，已停止重试");
    }
  } else {
    await assertPreviewUnchanged(session.previewState, head);
    const changedPaths = await listGitChanges(root);
    assertGalleryOnlyPaths(changedPaths);
    if (!samePathSet(changedPaths, session.changedFiles)) {
      throw new Error("预览后出现了批次之外的文件变化，已停止发布");
    }
    if (head !== remoteHead) throw new Error("正式基线已更新，请清空未提交的本批预览后重新生成；开发工作区不受影响");

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

  if(!alreadyMerged){
    onUpdate?.('推送本批相册分支与回滚标签');
    await run('git',['push','origin',summary.tag],{cwd:root});
    await run('git',['push','-u','origin',branch],{cwd:root});
    if(!session.prUrl){
      const existing=JSON.parse((await githubRun('gh',['pr','list','--head',branch,'--base','main','--state','all','--json','url'],{cwd:root})).stdout);
      if(existing.length)session.prUrl=existing[0].url;
      else{
        const bodyPath=join(root,'tools/gallery-publisher/.runtime/pr-body.md');
        await mkdir(dirname(bodyPath),{recursive:true});
        await writeFile(bodyPath,`${summary.commitMessage}\n\n只修改本批团建相册条目与对应图片；本地预览和验证通过。回滚标签：${summary.tag}。等待现有必需检查后普通合并，再复查两个正式域名。\n`);
        session.prUrl=(await githubRun('gh',['pr','create','--base','main','--head',branch,'--title',summary.commitMessage,'--body-file',bodyPath],{cwd:root})).stdout;
      }
      summary.prUrl=session.prUrl;
      await onCommitted?.({commitSha:session.commitSha,release:summary});
    }
    onUpdate?.(`等待相册PR现有必需检查：${session.prUrl}`);
    const state=await waitForGalleryChecks(root,session,githubRun);
    if(state!=='merged')await githubRun('gh',['pr','merge',session.prUrl,'--merge','--match-head-commit',session.commitSha],{cwd:root});
  }
  const merged=await readGalleryPr(root,session,githubRun);
  if(galleryChecksState(merged,session.commitSha)!=='merged')throw Error('相册PR尚未完成合并，已保留批次');
  summary.prUrl=session.prUrl;summary.mergeSha=merged.mergeCommit?.oid;
  await onMerged?.({ commitSha: session.commitSha, release: summary });
  onUpdate?.("等待 EdgeOne 并复查两个正式域名");
  await verifyDeploymentImpl({ session, domains: summary.domains, onUpdate, expectedGallery });
  return { ...summary, commitSha: session.commitSha };
}
