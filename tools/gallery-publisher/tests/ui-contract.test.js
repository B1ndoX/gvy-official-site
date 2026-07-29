import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const duplicateReview = await readFile(new URL("../src/components/DuplicateReviewModal.jsx", import.meta.url), "utf8");
const dropZone = await readFile(new URL("../src/components/DropZone.jsx", import.meta.url), "utf8");

test("selected photo previews keep a bounded card and show the complete source ratio", () => {
  const cardRule = styles.match(/\.photo-card\s*\{([^}]+)\}/)?.[1] || "";
  const frameRule = styles.match(/\.photo-frame\s*\{([^}]+)\}/)?.[1] || "";
  const imageRule = styles.match(/\.photo-frame img\s*\{([^}]+)\}/)?.[1] || "";

  assert.match(cardRule, /flex:\s*0 0/);
  assert.doesNotMatch(cardRule, /flex:\s*1/);
  assert.match(frameRule, /height:\s*clamp\(/);
  assert.match(imageRule, /max-width:\s*100%/);
  assert.match(imageRule, /max-height:\s*100%/);
  assert.match(imageRule, /object-fit:\s*contain/);
  assert.doesNotMatch(imageRule, /object-fit:\s*cover/);
});

test("publisher explains local two-layer deduplication and requires a visual comparison decision", () => {
  assert.match(app, /本地文件＋画面去重已启用/);
  assert.match(dropZone, /文件与画面均在本机去重/);
  assert.match(duplicateReview, /检测到疑似相同照片，是否继续上传/);
  assert.match(duplicateReview, /本次上传/);
  assert.match(duplicateReview, /官网已有照片/);
  assert.match(duplicateReview, /我已核对，仍然继续上传/);
  assert.match(styles, /\.duplicate-image-pair img\s*\{[^}]*object-fit:\s*contain/);
});
