import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

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
