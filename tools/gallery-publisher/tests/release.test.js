import assert from "node:assert/strict";
import test from "node:test";

import { buildReleaseSummary } from "../lib/git-release.mjs";

test("release summary is stable, scoped to main, and includes a pre-release rollback tag", () => {
  const summary = buildReleaseSummary(
    { batchStart: 48, batchEnd: 53 },
    new Date("2026-07-29T04:05:06.000Z"),
  );

  assert.deepEqual(summary, {
    tag: "backup-production-before-gallery-20260729-120506-CST",
    commitMessage: "feat: publish gallery photos 048-053",
    branch: "main",
    remoteBranch: "origin/main",
    project: "gvy-official-site",
    domains: ["https://www.gvyvoyagers.vip", "https://gvyvoyagers.vip"],
  });
});

test("deletion releases identify the exact stable gallery numbers", () => {
  const summary = buildReleaseSummary(
    { type: "delete", batchStart: 38, batchEnd: 47, deletedNumbers: [38, 39, 47] },
    new Date("2026-07-29T04:05:06.000Z"),
  );

  assert.equal(summary.commitMessage, "fix: remove gallery entries 038,039,047");
});
