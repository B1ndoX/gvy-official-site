import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(new URL("..", import.meta.url).pathname);
const targets = [resolve(root, "assets/js"), resolve(root, "scripts")];
const files = [];

async function collectJavaScript(directory) {
  let entries = [];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }

  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await collectJavaScript(path);
    else if (/\.(?:js|mjs)$/.test(entry.name)) files.push(path);
  }
}

for (const target of targets) await collectJavaScript(target);

for (const file of files.sort()) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status === 0) continue;
  process.stderr.write(result.stderr || result.stdout);
  process.exitCode = result.status || 1;
  break;
}

if (!process.exitCode) {
  process.stdout.write(`Checked ${files.length} JavaScript files.\n`);
}
