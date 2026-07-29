import { access, copyFile, mkdir, rm, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { extname, join, relative } from "node:path";

const SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".heic", ".heif"]);
const MIME_BY_EXTENSION = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".heic", "image/heic"],
  [".heif", "image/heif"],
]);

function run(command, args, { cwd } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} 执行失败：${stderr.trim() || `退出码 ${code}`}`));
    });
  });
}

function runBuffer(command, args, { cwd, maxOutput = 2 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    const chunks = [];
    let size = 0;
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      size += chunk.length;
      if (size <= maxOutput) chunks.push(chunk);
      else child.kill("SIGTERM");
    });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0 && size <= maxOutput) resolve(Buffer.concat(chunks));
      else reject(new Error(`图片内容指纹生成失败：${stderr.trim() || `退出码 ${code}`}`));
    });
  });
}

async function firstExecutable(candidates) {
  for (const candidate of candidates.filter(Boolean)) {
    if (!candidate.includes("/")) return candidate;
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }
  return "ffmpeg";
}

export async function createVisualFingerprint(path) {
  const ffmpeg = await firstExecutable([
    process.env.GVY_FFMPEG,
    "/Users/bindox/.local/bin/ffmpeg",
    "/opt/homebrew/bin/ffmpeg",
    "ffmpeg",
  ]);
  const pixels = await runBuffer(ffmpeg, [
    "-hide_banner", "-loglevel", "error", "-i", path,
    "-vf", "scale=32:32:flags=lanczos,format=rgb24",
    "-frames:v", "1", "-f", "rawvideo", "-",
  ]);
  if (pixels.length !== 32 * 32 * 3) throw new Error("图片内容指纹尺寸异常");
  return pixels;
}

export function visualFingerprintDistance(left, right) {
  if (!Buffer.isBuffer(left) || !Buffer.isBuffer(right) || left.length !== right.length || !left.length) {
    return Number.POSITIVE_INFINITY;
  }
  let total = 0;
  for (let index = 0; index < left.length; index += 1) total += Math.abs(left[index] - right[index]);
  return total / left.length;
}

function luminanceSamples(fingerprint) {
  if (!Buffer.isBuffer(fingerprint) || fingerprint.length !== 32 * 32 * 3) return null;
  const samples = new Float64Array(32 * 32);
  for (let source = 0, target = 0; source < fingerprint.length; source += 3, target += 1) {
    samples[target] = (0.2126 * fingerprint[source])
      + (0.7152 * fingerprint[source + 1])
      + (0.0722 * fingerprint[source + 2]);
  }
  return samples;
}

export function visualFingerprintMetrics(left, right) {
  const pixelDistance = visualFingerprintDistance(left, right);
  const leftLuminance = luminanceSamples(left);
  const rightLuminance = luminanceSamples(right);
  if (!leftLuminance || !rightLuminance) {
    return {
      pixelDistance,
      normalizedLuminanceDistance: Number.POSITIVE_INFINITY,
      gradientDistance: Number.POSITIVE_INFINITY,
    };
  }

  const sampleCount = leftLuminance.length;
  const leftMean = leftLuminance.reduce((total, value) => total + value, 0) / sampleCount;
  const rightMean = rightLuminance.reduce((total, value) => total + value, 0) / sampleCount;
  const leftDeviation = Math.sqrt(
    leftLuminance.reduce((total, value) => total + ((value - leftMean) ** 2), 0) / sampleCount,
  );
  const rightDeviation = Math.sqrt(
    rightLuminance.reduce((total, value) => total + ((value - rightMean) ** 2), 0) / sampleCount,
  );
  const safeLeftDeviation = leftDeviation || 1;
  const safeRightDeviation = rightDeviation || 1;
  let normalizedDifference = 0;
  let gradientDifference = 0;
  let gradientCount = 0;

  for (let index = 0; index < sampleCount; index += 1) {
    const leftNormalized = (leftLuminance[index] - leftMean) / safeLeftDeviation;
    const rightNormalized = (rightLuminance[index] - rightMean) / safeRightDeviation;
    normalizedDifference += Math.abs(leftNormalized - rightNormalized);
  }
  for (let row = 0; row < 32; row += 1) {
    for (let column = 0; column < 31; column += 1) {
      const index = (row * 32) + column;
      const leftRises = leftLuminance[index + 1] > leftLuminance[index];
      const rightRises = rightLuminance[index + 1] > rightLuminance[index];
      if (leftRises !== rightRises) gradientDifference += 1;
      gradientCount += 1;
    }
  }
  for (let row = 0; row < 31; row += 1) {
    for (let column = 0; column < 32; column += 1) {
      const index = (row * 32) + column;
      const leftRises = leftLuminance[index + 32] > leftLuminance[index];
      const rightRises = rightLuminance[index + 32] > rightLuminance[index];
      if (leftRises !== rightRises) gradientDifference += 1;
      gradientCount += 1;
    }
  }

  return {
    pixelDistance,
    normalizedLuminanceDistance: normalizedDifference / sampleCount,
    gradientDistance: gradientDifference / gradientCount,
    minimumDeviation: Math.min(leftDeviation, rightDeviation),
  };
}

export function isVisualDuplicate(left, right) {
  const metrics = visualFingerprintMetrics(left, right);
  const sameRenderedPixels = metrics.pixelDistance <= 8;
  const samePictureStructure = metrics.minimumDeviation >= 4
    && metrics.normalizedLuminanceDistance <= 0.12
    && metrics.gradientDistance <= 0.16;
  return sameRenderedPixels || samePictureStructure;
}

export function normalizeUploadExtension(filename, mimeType = "") {
  const extension = extname(filename || "").toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(extension)) throw new Error(`不支持的照片格式：${extension || mimeType || "未知"}`);
  const expectedMime = MIME_BY_EXTENSION.get(extension);
  if (mimeType && !mimeType.startsWith("image/") && mimeType !== "application/octet-stream") {
    throw new Error(`文件不是可识别的图片：${filename}`);
  }
  return { extension, expectedMime };
}

export async function inspectImage(path) {
  const { stdout } = await run("/usr/bin/sips", ["-g", "pixelWidth", "-g", "pixelHeight", path]);
  const width = Number(stdout.match(/pixelWidth:\s*(\d+)/)?.[1]);
  const height = Number(stdout.match(/pixelHeight:\s*(\d+)/)?.[1]);
  if (!width || !height) throw new Error(`无法读取图片尺寸：${path}`);
  return { width, height };
}

export async function processGalleryPhoto({ upload, number, root }) {
  const { extension } = normalizeUploadExtension(upload.originalName, upload.mimeType);
  const twoDigit = String(number).padStart(2, "0");
  const galleryDir = join(root, "assets/gallery");
  const optimizedDir = join(galleryDir, "optimized");
  const thumbsDir = join(galleryDir, "thumbs");
  const originalsDir = join(galleryDir, "originals");
  await Promise.all([mkdir(optimizedDir, { recursive: true }), mkdir(thumbsDir, { recursive: true })]);

  const isHeif = extension === ".heic" || extension === ".heif";
  const fallbackExtension = isHeif ? ".jpg" : extension;
  const fallbackName = `team-${twoDigit}${fallbackExtension}`;
  const fallbackPath = join(galleryDir, fallbackName);
  const optimized1280 = join(optimizedDir, `team-${twoDigit}-1280.webp`);
  const optimized1920 = join(optimizedDir, `team-${twoDigit}-1920.webp`);
  const thumbPath = join(thumbsDir, `team-${twoDigit}.jpg`);
  const originalPath = isHeif ? join(originalsDir, `team-${twoDigit}${extension}`) : fallbackPath;
  const collisionPaths = [fallbackPath, optimized1280, optimized1920, thumbPath, originalPath];
  for (const path of new Set(collisionPaths)) {
    try {
      await stat(path);
      throw new Error(`目标文件已存在，已停止以避免覆盖：${relative(root, path)}`);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  const dimensions = await inspectImage(upload.path);
  const createdPaths = [];
  try {
    if (isHeif) {
      await mkdir(originalsDir, { recursive: true });
      await copyFile(upload.path, originalPath);
      createdPaths.push(originalPath);
      await run("/usr/bin/sips", ["-s", "format", "jpeg", upload.path, "--out", fallbackPath]);
    } else {
      await copyFile(upload.path, fallbackPath);
    }
    createdPaths.push(fallbackPath);

    const ffmpeg = await firstExecutable([
      process.env.GVY_FFMPEG,
      "/Users/bindox/.local/bin/ffmpeg",
      "/opt/homebrew/bin/ffmpeg",
      "ffmpeg",
    ]);
    const webpArgs = (width, output) => [
      "-hide_banner", "-loglevel", "error", "-y", "-i", fallbackPath,
      "-vf", `scale=min(${width}\\,iw):-2`, "-frames:v", "1", "-an",
      "-c:v", "libwebp", "-quality", "82", "-compression_level", "6", "-preset", "picture", output,
    ];
    await run(ffmpeg, webpArgs(1280, optimized1280));
    createdPaths.push(optimized1280);

    const has1920 = dimensions.width >= 1920;
    if (has1920) {
      await run(ffmpeg, webpArgs(1920, optimized1920));
      createdPaths.push(optimized1920);
    }

    await run(ffmpeg, [
      "-hide_banner", "-loglevel", "error", "-y", "-i", fallbackPath,
      "-vf", "scale=640:360:force_original_aspect_ratio=increase,crop=640:360,setsar=1",
      "-frames:v", "1", "-an", "-q:v", "3", thumbPath,
    ]);
    createdPaths.push(thumbPath);

    return {
      number,
      fallbackName,
      width: dimensions.width,
      height: dimensions.height,
      has1920,
      createdPaths,
      publicUrl: `/preview/assets/gallery/${fallbackName}`,
    };
  } catch (error) {
    await Promise.all([...new Set(collisionPaths)].map((path) => rm(path, { force: true })));
    throw error;
  }
}
