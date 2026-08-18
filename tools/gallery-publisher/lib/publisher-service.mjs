import { spawn } from "node:child_process";
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";

import {
  appendGalleryBatch,
  assertOnlyManagedGalleryChanged,
  createBatchAssetIds,
  parseGalleryState,
  removeGalleryItems,
} from "./gallery-html.mjs";
import { createVisualFingerprint, isVisualDuplicate, processGalleryPhoto } from "./process.mjs";
import { buildReleaseSummary, gitOutput, listGitChanges, publishGallerySession } from "./git-release.mjs";

const STEP_LABELS = [
  "保留原图",
  "生成 1280 WebP",
  "按原图宽度生成 1920 WebP",
  "生成 640×360 缩略图",
  "更新相册与最新批次标记",
  "运行完整测试与生产构建",
];

const OFFICIAL_ORIGINS = ["https://www.gvyvoyagers.vip", "https://gvyvoyagers.vip"];

function galleryDeploymentIdentity(gallery) {
  return JSON.stringify({
    count: gallery.count,
    maxPhotoNumber: gallery.maxPhotoNumber,
    items: gallery.items.map((item) => ({
      number: item.number,
      fallbackName: item.fallbackName,
      latestStart: item.latestStart,
    })),
  });
}

export function assertSameDeployedGallery(localGallery, officialGallery) {
  if (galleryDeploymentIdentity(localGallery) !== galleryDeploymentIdentity(officialGallery)) {
    throw new Error("本地相册与正式官网当前相册不一致，已停止操作；请等待正式部署完成后重试");
  }
}

export class DuplicateReviewRequiredError extends Error {
  constructor(duplicates) {
    super(`检测到 ${duplicates.length} 张重复或疑似相同照片，请确认是否继续上传`);
    this.name = "DuplicateReviewRequiredError";
    this.code = "DUPLICATE_REVIEW_REQUIRED";
    this.duplicates = duplicates;
  }
}

function run(command, args, { cwd, maxOutput = 8_000_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { if (stdout.length < maxOutput) stdout += chunk; });
    child.stderr.on("data", (chunk) => { if (stderr.length < maxOutput) stderr += chunk; });
    child.on("error", reject);
    child.on("close", async (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else {
        const output = stderr.trim() || stdout.trim();
        const lines = output.split("\n").map((line) => line.trim()).filter(Boolean);
        const failureTitle = lines.find((line) => /^✖\s+.+\([\d.]+m?s\)$/.test(line));
        const usefulLine = lines.find((line) => /^error:\s*['"]?.+/i.test(line))
          || [...lines].reverse().find((line) => /AssertionError|SyntaxError|ReferenceError|TypeError|npm error/i.test(line));
        const detail = [failureTitle, usefulLine]
          .filter(Boolean)
          .join(" — ")
          .slice(0, 900) || lines.at(-1) || `退出码 ${code}`;
        if (cwd) {
          const failureLogPath = join(cwd, "tools/gallery-publisher/.runtime/last-verify-failure.log");
          await mkdir(dirname(failureLogPath), { recursive: true }).catch(() => {});
          await writeFile(failureLogPath, `${output}\n`, "utf8").catch(() => {});
        }
        reject(new Error(`${command} ${args.join(" ")} 失败：${detail}`));
      }
    });
  });
}

function relativePaths(root, paths) {
  return paths.map((path) => relative(root, path)).sort();
}

function assertExactChangedFiles(actual, expected, action) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const unexpected = actual.filter((path) => !expectedSet.has(path));
  const missing = expected.filter((path) => !actualSet.has(path));
  if (unexpected.length || missing.length) {
    const detail = [
      unexpected.length ? `额外：${unexpected.join("、")}` : "",
      missing.length ? `缺少：${missing.join("、")}` : "",
    ].filter(Boolean).join("；");
    throw new Error(`${action}产生了团建相册批次之外的文件变化，已停止操作${detail ? `（${detail}）` : ""}`);
  }
}

export class PublisherService {
  constructor({ root, officialGalleryLoader = null, fetchImpl = globalThis.fetch } = {}) {
    this.root = resolve(root);
    this.runtimeDir = join(this.root, "tools/gallery-publisher/.runtime");
    this.statePath = join(this.runtimeDir, "active-session.json");
    this.indexPath = join(this.root, "index.html");
    this.session = null;
    this.operation = { type: "idle", status: "idle", message: "等待添加照片", steps: STEP_LABELS.map(() => "pending") };
    this.activity = [];
    this.hashCache = new Map();
    this.visualFingerprintCache = new Map();
    this.officialGalleryLoader = officialGalleryLoader;
    this.fetchImpl = fetchImpl;
  }

  async initialize() {
    await mkdir(this.runtimeDir, { recursive: true });
    try {
      this.session = JSON.parse(await readFile(this.statePath, "utf8"));
      this.session.type ||= "add";
      this.log("检测到上次保留的本地预览，可继续发布或清空回滚");
    } catch (error) {
      if (error?.code !== "ENOENT") this.log(`无法恢复上次预览：${error.message}`);
    }
  }

  log(message) {
    this.activity.unshift({ at: new Date().toISOString(), message });
    this.activity = this.activity.slice(0, 60);
  }

  setOperation(patch) {
    this.operation = { ...this.operation, ...patch };
    if (patch.message) this.log(patch.message);
  }

  async getRepositoryInfo() {
    const [branch, remote, changes] = await Promise.all([
      gitOutput(this.root, ["branch", "--show-current"]).catch(() => "未知"),
      gitOutput(this.root, ["remote", "get-url", "origin"]).catch(() => ""),
      listGitChanges(this.root).catch(() => []),
    ]);
    return { branch, remote, connected: Boolean(remote), changes };
  }

  async loadOfficialGalleryState() {
    if (this.officialGalleryLoader) return this.officialGalleryLoader();
    if (typeof this.fetchImpl !== "function") throw new Error("当前环境无法读取正式官网相册");

    const snapshots = await Promise.all(OFFICIAL_ORIGINS.map(async (origin) => {
      const response = await this.fetchImpl(`${origin}/?gallery-publisher-calibration=${Date.now()}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`${origin} 返回 HTTP ${response.status}`);
      return { origin, gallery: parseGalleryState(await response.text()) };
    }));
    const identity = galleryDeploymentIdentity(snapshots[0].gallery);
    if (snapshots.some((snapshot) => galleryDeploymentIdentity(snapshot.gallery) !== identity)) {
      throw new Error("两个正式域名的团建相册尚未同步，已停止操作；请稍后重试");
    }
    return snapshots[0].gallery;
  }

  async calibrateCleanOfficialBaseline(localGallery) {
    const changes = await listGitChanges(this.root);
    if (changes.length) {
      throw new Error(`发布器要求工作区先保持干净，检测到 ${changes.length} 个本地改动；不会把其他代码带入相册操作`);
    }
    const branch = await gitOutput(this.root, ["branch", "--show-current"]);
    if (branch !== "main") throw new Error(`当前分支是 ${branch || "未知"}，发布器只允许在 main 操作团建相册`);
    this.setOperation({ message: "正在以两个正式域名当前已部署的团建相册为唯一基准进行校准" });
    const officialGallery = await this.loadOfficialGalleryState();
    assertSameDeployedGallery(localGallery, officialGallery);
    return officialGallery;
  }

  async hashGalleryFile(path) {
    const details = await stat(path);
    const cached = this.hashCache.get(path);
    if (cached?.size === details.size && cached?.mtimeMs === details.mtimeMs) return cached.hash;
    const hash = createHash("sha256").update(await readFile(path)).digest("hex");
    this.hashCache.set(path, { size: details.size, mtimeMs: details.mtimeMs, hash });
    return hash;
  }

  async fingerprintGalleryFile(path) {
    const details = await stat(path);
    const cached = this.visualFingerprintCache.get(path);
    if (cached?.size === details.size && cached?.mtimeMs === details.mtimeMs) return cached.fingerprint;
    const fingerprint = await createVisualFingerprint(path);
    this.visualFingerprintCache.set(path, {
      size: details.size,
      mtimeMs: details.mtimeMs,
      fingerprint,
    });
    return fingerprint;
  }

  async getGalleryInventory(parsed) {
    const withHashes = await Promise.all(parsed.items.map(async (item) => {
      const path = join(this.root, "assets/gallery", item.fallbackName);
      const itemRelativePath = relative(this.root, path);
      const backupPath = this.session?.type === "delete" && !this.session.published
        ? join(this.runtimeDir, this.session.id, "removed-assets", itemRelativePath)
        : null;
      const hash = await this.hashGalleryFile(path)
        .catch(() => backupPath ? this.hashGalleryFile(backupPath).catch(() => null) : null);
      return { ...item, hash };
    }));
    const grouped = new Map();
    withHashes.forEach((item) => {
      if (!item.hash) return;
      const group = grouped.get(item.hash) || [];
      group.push(item.number);
      grouped.set(item.hash, group);
    });
    const duplicateGroups = [...grouped.values()]
      .filter((numbers) => numbers.length > 1)
      .sort((left, right) => left[0] - right[0]);
    const originalByDuplicate = new Map();
    duplicateGroups.forEach((numbers) => numbers.slice(1).forEach((number) => originalByDuplicate.set(number, numbers[0])));
    return {
      items: withHashes.map((item) => ({
        number: item.number,
        fallbackName: item.fallbackName,
        publicUrl: this.session?.type === "delete" && !this.session.published && this.session.deletedNumbers?.includes(item.number)
          ? `/deleted-preview/${this.session.id}/assets/gallery/thumbs/team-${String(item.number).padStart(2, "0")}.jpg`
          : `/site-assets/gallery/thumbs/team-${String(item.number).padStart(2, "0")}.jpg`,
        duplicateOf: originalByDuplicate.get(item.number) || null,
      })),
      duplicateGroups,
    };
  }

  async getStatus() {
    const html = await readFile(this.indexPath, "utf8");
    const previewParsed = parseGalleryState(html);
    let officialParsed = previewParsed;
    if (this.session && !this.session.published && this.session.backupPath) {
      officialParsed = parseGalleryState(await readFile(this.session.backupPath, "utf8"));
    }
    const inventory = await this.getGalleryInventory(officialParsed);
    const repository = await this.getRepositoryInfo();
    const baseCount = officialParsed.count;
    const release = this.session ? this.session.release || buildReleaseSummary(this.session) : null;
    return {
      gallery: {
        count: baseCount,
        previewCount: previewParsed.count,
        items: inventory.items,
        duplicateGroups: inventory.duplicateGroups,
      },
      repository,
      operation: this.operation,
      session: this.session ? {
        id: this.session.id,
        type: this.session.type || "add",
        itemCount: this.session.items.length,
        items: this.session.items.map(({ number, fallbackName, publicUrl, width, height, has1920 }) => ({
          number,
          fallbackName,
          publicUrl,
          width,
          height,
          has1920,
        })),
        verified: this.session.verified,
        published: Boolean(this.session.published),
        deploymentVerified: Boolean(this.session.deploymentVerified),
        commitSha: this.session.commitSha || null,
        baselineDirty: this.session.baselineDirty,
        resultCount: previewParsed.count,
        publishAllowed: this.session.verified
          && this.session.baselineDirty.length === 0
          && repository.branch === "main"
          && !this.session.published,
        release,
      } : null,
      activity: this.activity,
    };
  }

  async persistSession() {
    if (!this.session) {
      await rm(this.statePath, { force: true });
      return;
    }
    await writeFile(this.statePath, `${JSON.stringify(this.session, null, 2)}\n`, "utf8");
  }

  async validateUploadDuplicates(gallery, uploads, { allowDuplicates = false } = {}) {
    const existingFiles = [];
    for (const item of gallery.items) {
      const path = join(this.root, "assets/gallery", item.fallbackName);
      existingFiles.push({
        number: item.number,
        fallbackName: item.fallbackName,
        path,
        hash: await this.hashGalleryFile(path),
      });
    }

    const batchFiles = [];
    const duplicatesByUpload = new Map();
    for (let uploadIndex = 0; uploadIndex < uploads.length; uploadIndex += 1) {
      const upload = uploads[uploadIndex];
      const hash = await this.hashGalleryFile(upload.path);
      const exactExistingDuplicate = existingFiles.find((entry) => entry.hash === hash);
      if (exactExistingDuplicate) {
        duplicatesByUpload.set(uploadIndex, {
          uploadIndex,
          uploadName: upload.originalName,
          matchType: "exact",
          matchSource: "gallery",
          matchUrl: `/site-assets/gallery/${exactExistingDuplicate.fallbackName}`,
        });
      }
      const exactBatchDuplicate = batchFiles.find((entry) => entry.hash === hash);
      if (!exactExistingDuplicate && exactBatchDuplicate) {
        duplicatesByUpload.set(uploadIndex, {
          uploadIndex,
          uploadName: upload.originalName,
          matchType: "exact",
          matchSource: "batch",
          matchUploadIndex: exactBatchDuplicate.uploadIndex,
          matchName: exactBatchDuplicate.originalName,
        });
      }
      batchFiles.push({ ...upload, uploadIndex, hash });
    }

    this.setOperation({ message: "文件指纹检查完成，正在本机进行画面检测" });
    for (const entry of existingFiles) {
      entry.fingerprint = await this.fingerprintGalleryFile(entry.path);
    }
    const batchFingerprints = [];
    for (const upload of batchFiles) {
      const fingerprint = await createVisualFingerprint(upload.path);
      if (!duplicatesByUpload.has(upload.uploadIndex)) {
        const visualExistingDuplicate = existingFiles.find(
          (entry) => isVisualDuplicate(entry.fingerprint, fingerprint),
        );
        if (visualExistingDuplicate) {
          duplicatesByUpload.set(upload.uploadIndex, {
            uploadIndex: upload.uploadIndex,
            uploadName: upload.originalName,
            matchType: "visual",
            matchSource: "gallery",
            matchUrl: `/site-assets/gallery/${visualExistingDuplicate.fallbackName}`,
          });
        } else {
          const visualBatchDuplicate = batchFingerprints.find(
            (entry) => isVisualDuplicate(entry.fingerprint, fingerprint),
          );
          if (visualBatchDuplicate) {
            duplicatesByUpload.set(upload.uploadIndex, {
              uploadIndex: upload.uploadIndex,
              uploadName: upload.originalName,
              matchType: "visual",
              matchSource: "batch",
              matchUploadIndex: visualBatchDuplicate.uploadIndex,
              matchName: visualBatchDuplicate.name,
            });
          }
        }
      }
      batchFingerprints.push({
        uploadIndex: upload.uploadIndex,
        name: upload.originalName,
        fingerprint,
      });
    }

    const duplicates = [...duplicatesByUpload.values()].sort((left, right) => left.uploadIndex - right.uploadIndex);
    if (duplicates.length && !allowDuplicates) throw new DuplicateReviewRequiredError(duplicates);
    return duplicates;
  }

  async createPreview(uploads, { allowDuplicates = false } = {}) {
    if (this.operation.status === "running") throw new Error("已有操作正在进行，请稍候");
    if (this.session) throw new Error("已有本地预览，请先发布或清空当前批次");
    if (!Array.isArray(uploads) || uploads.length < 1) throw new Error("请先选择照片");
    if (uploads.length > 100) throw new Error("单批最多添加 100 张照片");

    const originalHtml = await readFile(this.indexPath, "utf8");
    const gallery = parseGalleryState(originalHtml);
    const duplicateSteps = STEP_LABELS.map(() => "pending");
    this.setOperation({ type: "preview", status: "running", message: "正在校准正式官网当前团建相册", steps: duplicateSteps });
    try {
      const officialGallery = await this.calibrateCleanOfficialBaseline(gallery);
      const duplicateReview = await this.validateUploadDuplicates(officialGallery, uploads, { allowDuplicates });
      this.setOperation({
        message: duplicateReview.length
          ? `已按你的确认继续处理 ${duplicateReview.length} 张重复或疑似相同照片`
          : `正式官网当前相册双重去重通过：${uploads.length} 张照片均为新画面`,
      });
    } catch (error) {
      const duplicateReviewNeeded = error?.code === "DUPLICATE_REVIEW_REQUIRED";
      this.setOperation({
        type: "preview",
        status: duplicateReviewNeeded ? "idle" : "error",
        message: error.message,
        steps: duplicateSteps,
      });
      throw error;
    }
    const baselineDirty = [];
    const assetIds = createBatchAssetIds(gallery.maxPhotoNumber, uploads.length);
    const id = randomUUID();
    const sessionDir = join(this.runtimeDir, id);
    const backupPath = join(sessionDir, "index.html.before-preview");
    await mkdir(sessionDir, { recursive: true });
    await writeFile(backupPath, originalHtml, "utf8");
    const createdPaths = [];
    const steps = STEP_LABELS.map(() => "pending");
    this.setOperation({ type: "preview", status: "running", message: `开始处理本批 ${uploads.length} 张照片`, steps });

    try {
      steps[0] = "running";
      steps[1] = "running";
      steps[2] = "running";
      steps[3] = "running";
      this.setOperation({ steps: [...steps], message: "保留原图并生成响应式图片" });
      const items = [];
      for (let index = 0; index < uploads.length; index += 1) {
        const item = await processGalleryPhoto({ upload: uploads[index], number: assetIds[index], root: this.root });
        items.push(item);
        createdPaths.push(...item.createdPaths);
        this.setOperation({ message: `已处理 ${index + 1} / ${uploads.length}` });
      }
      steps.fill("done", 0, 4);
      steps[4] = "running";
      this.setOperation({ steps: [...steps], message: "按本批顺序将照片追加到相册末尾" });
      const nextHtml = appendGalleryBatch(originalHtml, items);
      assertOnlyManagedGalleryChanged(originalHtml, nextHtml);
      await writeFile(this.indexPath, nextHtml, "utf8");
      steps[4] = "done";
      steps[5] = "running";
      this.setOperation({ steps: [...steps], message: "运行完整测试与生产构建" });
      await run("npm", ["run", "verify"], { cwd: this.root });
      steps[5] = "done";

      const changedFiles = ["index.html", ...relativePaths(this.root, createdPaths)].sort();
      const actualChangedFiles = await listGitChanges(this.root);
      assertExactChangedFiles(actualChangedFiles, changedFiles, "预览");
      const sessionDraft = {
        id,
        type: "add",
        createdAt: new Date().toISOString(),
        backupPath,
        baseCount: gallery.count,
        batchStart: assetIds[0],
        batchEnd: assetIds.at(-1),
        items,
        createdPaths,
        changedFiles,
        baselineDirty,
        verified: true,
        published: false,
      };
      sessionDraft.release = buildReleaseSummary(sessionDraft);
      this.session = sessionDraft;
      await this.persistSession();
      this.setOperation({ type: "preview", status: "done", message: `本地预览已通过，本批 ${uploads.length} 张已追加到相册末尾`, steps: [...steps] });
      return this.getStatus();
    } catch (error) {
      await writeFile(this.indexPath, originalHtml, "utf8");
      await Promise.all(createdPaths.map((path) => rm(path, { force: true })));
      await rm(sessionDir, { recursive: true, force: true });
      this.setOperation({ type: "preview", status: "error", message: error.message, steps: steps.map((step) => step === "running" ? "error" : step) });
      throw error;
    }
  }

  async findGalleryAssetPaths(item) {
    const twoDigit = String(item.number).padStart(2, "0");
    const candidates = [
      join(this.root, "assets/gallery", item.fallbackName),
      join(this.root, `assets/gallery/optimized/team-${twoDigit}-1280.webp`),
      join(this.root, `assets/gallery/optimized/team-${twoDigit}-1920.webp`),
      join(this.root, `assets/gallery/thumbs/team-${twoDigit}.jpg`),
      join(this.root, `assets/gallery/originals/team-${twoDigit}.heic`),
      join(this.root, `assets/gallery/originals/team-${twoDigit}.heif`),
    ];
    const existing = [];
    for (const path of candidates) {
      try {
        const details = await stat(path);
        if (details.isFile()) existing.push(path);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
    return [...new Set(existing)];
  }

  async restoreDeletedAssets(assetBackups) {
    for (const entry of assetBackups || []) {
      await mkdir(dirname(entry.path), { recursive: true });
      await copyFile(entry.backupPath, entry.path);
    }
  }

  async createDeletePreview(numbers) {
    if (this.operation.status === "running") throw new Error("已有操作正在进行，请稍候");
    if (this.session) throw new Error("已有本地预览，请先发布或清空当前批次");
    if (!Array.isArray(numbers) || numbers.length < 1) throw new Error("请先选择要删除的照片");

    const originalHtml = await readFile(this.indexPath, "utf8");
    const gallery = parseGalleryState(originalHtml);
    const calibrationSteps = STEP_LABELS.map(() => "pending");
    this.setOperation({ type: "delete-preview", status: "running", message: "正在校准正式官网当前团建相册", steps: calibrationSteps });
    try {
      await this.calibrateCleanOfficialBaseline(gallery);
    } catch (error) {
      this.setOperation({ type: "delete-preview", status: "error", message: error.message, steps: calibrationSteps });
      throw error;
    }
    const selectedSet = new Set(numbers.map(Number));
    const selectedItems = gallery.items.filter((item) => selectedSet.has(item.number));
    const baselineDirty = [];
    const id = randomUUID();
    const sessionDir = join(this.runtimeDir, id);
    const backupPath = join(sessionDir, "index.html.before-preview");
    await mkdir(sessionDir, { recursive: true });
    await writeFile(backupPath, originalHtml, "utf8");
    const assetBackups = [];
    const steps = STEP_LABELS.map(() => "pending");
    this.setOperation({ type: "delete-preview", status: "running", message: `准备删除 ${selectedItems.length} 张官网相册照片`, steps });

    try {
      steps.fill("done", 0, 4);
      steps[4] = "running";
      this.setOperation({ steps: [...steps], message: "移除所选相册条目，其他照片保持原有顺序；原图文件保留可回滚" });
      const nextHtml = removeGalleryItems(originalHtml, numbers);
      assertOnlyManagedGalleryChanged(originalHtml, nextHtml);
      const assetPaths = (await Promise.all(selectedItems.map((item) => this.findGalleryAssetPaths(item)))).flat();
      for (const path of assetPaths) {
        const itemRelativePath = relative(this.root, path);
        const assetBackupPath = join(sessionDir, "removed-assets", itemRelativePath);
        await mkdir(dirname(assetBackupPath), { recursive: true });
        await copyFile(path, assetBackupPath);
        assetBackups.push({ path, backupPath: assetBackupPath });
      }
      await writeFile(this.indexPath, nextHtml, "utf8");
      await Promise.all(assetBackups.map((entry) => rm(entry.path, { force: true })));
      steps[4] = "done";
      steps[5] = "running";
      this.setOperation({ steps: [...steps], message: "运行完整测试与生产构建" });
      await run("npm", ["run", "verify"], { cwd: this.root });
      steps[5] = "done";

      const nextGallery = parseGalleryState(nextHtml);
      const orderedNumbers = selectedItems.map((item) => item.number);
      const items = selectedItems.map((item) => ({
        number: item.number,
        fallbackName: item.fallbackName,
        width: 0,
        height: 0,
        has1920: false,
        publicUrl: `/deleted-preview/${id}/assets/gallery/thumbs/team-${String(item.number).padStart(2, "0")}.jpg`,
      }));
      const changedFiles = ["index.html", ...relativePaths(this.root, assetBackups.map((entry) => entry.path))].sort();
      const actualChangedFiles = await listGitChanges(this.root);
      assertExactChangedFiles(actualChangedFiles, changedFiles, "删除预览");
      const sessionDraft = {
        id,
        type: "delete",
        createdAt: new Date().toISOString(),
        backupPath,
        baseCount: gallery.count,
        batchStart: Math.min(...orderedNumbers),
        batchEnd: Math.max(...orderedNumbers),
        items,
        deletedNumbers: orderedNumbers,
        createdPaths: [],
        removedPaths: assetBackups.map((entry) => entry.path),
        assetBackups,
        changedFiles,
        baselineDirty,
        resultCount: nextGallery.count,
        verified: true,
        published: false,
      };
      sessionDraft.release = buildReleaseSummary(sessionDraft);
      this.session = sessionDraft;
      await this.persistSession();
      this.setOperation({ type: "delete-preview", status: "done", message: `删除预览已通过，官网相册将从 ${gallery.count} 张变为 ${nextGallery.count} 张`, steps: [...steps] });
      return this.getStatus();
    } catch (error) {
      await writeFile(this.indexPath, originalHtml, "utf8");
      await this.restoreDeletedAssets(assetBackups);
      await rm(sessionDir, { recursive: true, force: true });
      this.setOperation({ type: "delete-preview", status: "error", message: error.message, steps: steps.map((step) => step === "running" ? "error" : step) });
      throw error;
    }
  }

  async rollback() {
    if (this.operation.status === "running") throw new Error("已有操作正在进行，请稍候");
    if (!this.session) {
      this.setOperation({ type: "idle", status: "idle", message: "已清空本批", steps: STEP_LABELS.map(() => "pending") });
      return this.getStatus();
    }
    if (this.session.published) {
      await rm(join(this.runtimeDir, this.session.id), { recursive: true, force: true });
      this.session = null;
      await this.persistSession();
      this.setOperation({ type: "idle", status: "idle", message: "已结束上一批，可继续添加照片", steps: STEP_LABELS.map(() => "pending") });
      return this.getStatus();
    }
    if (this.session.commitSha) throw new Error("发布提交已生成，不能清空；请点击发布正式网站重试推送");
    const originalHtml = await readFile(this.session.backupPath, "utf8");
    await writeFile(this.indexPath, originalHtml, "utf8");
    if (this.session.type === "delete") await this.restoreDeletedAssets(this.session.assetBackups);
    else await Promise.all(this.session.createdPaths.map((path) => rm(path, { force: true })));
    await rm(join(this.runtimeDir, this.session.id), { recursive: true, force: true });
    this.session = null;
    await this.persistSession();
    this.setOperation({ type: "idle", status: "idle", message: "已清空本批并恢复生成预览前的文件", steps: STEP_LABELS.map(() => "pending") });
    return this.getStatus();
  }

  async publish() {
    if (!this.session) throw new Error("没有可发布的相册批次");
    if (this.operation.status === "running") throw new Error("已有操作正在进行，请稍候");
    this.setOperation({ type: "publish", status: "running", message: "开始正式发布", steps: STEP_LABELS.map(() => "done") });
    try {
      const release = await publishGallerySession({
        root: this.root,
        session: this.session,
        onUpdate: (message) => this.setOperation({ message }),
        onCommitted: async ({ commitSha, release: preparedRelease }) => {
          this.session.commitSha = commitSha;
          this.session.release = preparedRelease;
          await this.persistSession();
        },
        onPushed: async ({ commitSha, release: pushedRelease }) => {
          this.session.commitSha = commitSha;
          this.session.release = pushedRelease;
          this.session.published = true;
          await this.persistSession();
        },
      });
      this.session.published = true;
      this.session.deploymentVerified = true;
      this.session.release = release;
      await this.persistSession();
      this.setOperation({ type: "publish", status: "done", message: "正式网站发布并复查完成" });
      return release;
    } catch (error) {
      const message = this.session?.published
        ? `代码已推送，但线上复查未完成：${error.message}`
        : error.message;
      this.setOperation({ type: "publish", status: "error", message });
      throw error;
    }
  }
}
