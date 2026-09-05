import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export const contentHash = (content) => createHash("sha256").update(content).digest("hex");

export async function fileHash(path) {
  try { return contentHash(await readFile(path)); }
  catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

// Validate every managed file before any recovery write, including absent files.
// Never infer ownership from a pathname alone or from the file's mtime.
export async function assertPreviewUnchanged(state, head) {
  if (!state?.head || !state.files) throw new Error("旧预览缺少安全快照，不能自动覆盖；备份已保留，请先核对本地改动");
  if (state.head !== head) throw new Error("预览后 Git 基线已改变，已停止覆盖；预览和备份保持不变");
  for (const [path, expected] of Object.entries(state.files)) {
    if (await fileHash(path) !== expected) {
      throw new Error(`预览后文件被其他操作改变，已停止覆盖：${path}；预览和备份保持不变`);
    }
  }
}
