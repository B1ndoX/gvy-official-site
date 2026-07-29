import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  appendGalleryBatch,
  assertOnlyManagedGalleryChanged,
  createBatchAssetIds,
  findGalleryGridBounds,
  parseGalleryState,
  removeGalleryItems,
} from "../lib/gallery-html.mjs";

const homepageUrl = new URL("../../../index.html", import.meta.url);
const homepage = await readFile(homepageUrl, "utf8");

function makeBatch(start, count) {
  return Array.from({ length: count }, (_, index) => {
    const number = start + index;
    const padded = String(number).padStart(2, "0");
    return {
      number,
      fallbackName: `team-${padded}.jpg`,
      width: 1600,
      height: 900,
      has1920: false,
    };
  });
}

function reorderFirstTwo(html) {
  const state = parseGalleryState(html);
  const reordered = [state.items[1], state.items[0], ...state.items.slice(2)];
  const markup = reordered
    .map((item, index) => item.markup.replace(/data-archive-open="\d+"/, `data-archive-open="${index}"`))
    .join("\n");
  const bounds = findGalleryGridBounds(html);
  return `${html.slice(0, bounds.contentStart)}\n${markup}\n              ${html.slice(bounds.contentEnd)}`;
}

test("publisher reads DOM order and one internal latest-batch marker without exposing photo numbers", () => {
  const state = parseGalleryState(homepage);
  const grid = homepage.match(/<div class="archive-grid" data-archive-grid[^>]*>([\s\S]*?)<\/div>/)?.[1] || "";

  assert.ok(state.count >= 2);
  assert.ok(state.maxPhotoNumber >= Math.max(...state.items.map((item) => item.number)));
  assert.equal(state.latestAssetNumber, state.items.find((item) => item.latestStart).number);
  assert.equal(state.items.filter((item) => item.latestStart).length, 1);
  assert.doesNotMatch(grid, /<span>\d+<\/span>|远航档案\s*\d+/);
});

test("a six-photo batch appends in order and moves latest to the first new photo", () => {
  const current = parseGalleryState(homepage);
  const nextHtml = appendGalleryBatch(homepage, makeBatch(current.maxPhotoNumber + 1, 6));
  const next = parseGalleryState(nextHtml);
  const appended = next.items.slice(current.count);
  const grid = nextHtml.match(/<div class="archive-grid" data-archive-grid[^>]*>([\s\S]*?)<\/div>/)?.[1] || "";

  assert.equal(next.count, current.count + 6);
  assert.deepEqual(appended.map((item) => item.number), createBatchAssetIds(current.maxPhotoNumber, 6));
  assert.equal(next.latestAssetNumber, appended[0].number);
  assert.equal((grid.match(/data-archive-latest-start/g) || []).length, 1);
  assert.doesNotMatch(grid, /<span>\d+<\/span>|远航档案\s*\d+/);
  assert.equal((grid.match(/alt="GVY 团建回忆"/g) || []).length, next.count);
});

test("publisher changes are byte-identical outside the managed gallery grid", () => {
  const current = parseGalleryState(homepage);
  const nextHtml = appendGalleryBatch(homepage, makeBatch(current.maxPhotoNumber + 1, 1));

  assert.doesNotThrow(() => assertOnlyManagedGalleryChanged(homepage, nextHtml));
  assert.throws(
    () => assertOnlyManagedGalleryChanged(homepage, nextHtml.replace("GVY", "BROKEN")),
    /团建相册区域之外/,
  );
});

test("a twenty-photo batch still marks its exact first appended photo", () => {
  const current = parseGalleryState(homepage);
  const next = parseGalleryState(appendGalleryBatch(homepage, makeBatch(current.maxPhotoNumber + 1, 20)));

  assert.equal(next.count, current.count + 20);
  assert.equal(next.latestAssetNumber, current.maxPhotoNumber + 1);
  assert.deepEqual(
    next.items.slice(current.count).map((item) => item.number),
    createBatchAssetIds(current.maxPhotoNumber, 20),
  );
});

test("internal asset IDs are unique high-watermark values and reject invalid batch sizes", () => {
  assert.deepEqual(createBatchAssetIds(47, 6), [48, 49, 50, 51, 52, 53]);
  assert.throws(() => createBatchAssetIds(47, 0), RangeError);
  assert.throws(() => createBatchAssetIds(47, 101), RangeError);
});

test("deleting photos preserves the remaining upload order without renaming stable assets", () => {
  const current = parseGalleryState(homepage);
  const removed = [current.items[3].number, current.items[4].number];
  const expectedOrder = current.items.filter((item) => !removed.includes(item.number)).map((item) => item.number);
  const nextHtml = removeGalleryItems(homepage, removed);
  const next = parseGalleryState(nextHtml);

  assert.equal(next.count, current.count - 2);
  assert.equal(next.maxPhotoNumber, current.maxPhotoNumber);
  assert.deepEqual(next.items.map((item) => item.number), expectedOrder);
  assert.ok(next.items.every((item, index) => item.openIndex === index));
  assert.ok(next.items.every((item) => !removed.includes(item.number)));
  assert.match(next.items[3].markup, /alt="GVY 团建回忆"/);
  assert.doesNotMatch(nextHtml, /<span>\d+<\/span>|远航档案\s*\d+/);
});

test("the latest marker moves to the next remaining DOM item when its photo is deleted", () => {
  const current = parseGalleryState(homepage);
  const latestIndex = current.items.findIndex((item) => item.number === current.latestAssetNumber);
  const expectedAsset = current.items[latestIndex + 1]?.number
    ?? current.items.filter((item) => item.number !== current.latestAssetNumber).at(-1).number;
  const next = parseGalleryState(removeGalleryItems(homepage, [current.latestAssetNumber]));

  assert.equal(next.latestAssetNumber, expectedAsset);
  assert.equal(next.items.filter((item) => item.latestStart).length, 1);
});

test("new photos never reuse an internal asset ID that was previously deleted", () => {
  const current = parseGalleryState(homepage);
  const deletedMiddle = removeGalleryItems(homepage, [current.items[10].number]);
  const afterDelete = parseGalleryState(deletedMiddle);
  const afterAdd = parseGalleryState(appendGalleryBatch(
    deletedMiddle,
    makeBatch(afterDelete.maxPhotoNumber + 1, 1),
  ));

  assert.equal(afterAdd.items.at(-1).number, current.maxPhotoNumber + 1);
  assert.equal(afterAdd.count, current.count);
  assert.equal(afterAdd.maxPhotoNumber, current.maxPhotoNumber + 1);
});

test("four existing photos plus three uploads become seven, then deleting two leaves five in relative order", () => {
  const current = parseGalleryState(homepage);
  const fourPhotoHtml = removeGalleryItems(homepage, current.items.slice(4).map((item) => item.number));
  const fourPhotos = parseGalleryState(fourPhotoHtml);
  const sevenPhotoHtml = appendGalleryBatch(fourPhotoHtml, makeBatch(fourPhotos.maxPhotoNumber + 1, 3));
  const sevenPhotos = parseGalleryState(sevenPhotoHtml);
  const deletedAssetIds = [sevenPhotos.items[3].number, sevenPhotos.items[4].number];
  const fivePhotos = parseGalleryState(removeGalleryItems(sevenPhotoHtml, deletedAssetIds));

  assert.equal(fourPhotos.count, 4);
  assert.equal(sevenPhotos.count, 7);
  assert.equal(fivePhotos.count, 5);
  assert.deepEqual(
    fivePhotos.items.map((item) => item.number),
    sevenPhotos.items.filter((item) => !deletedAssetIds.includes(item.number)).map((item) => item.number),
  );
});

test("publisher treats DOM position as canonical and never sorts by internal asset ID", () => {
  const reorderedHtml = reorderFirstTwo(homepage);
  const reordered = parseGalleryState(reorderedHtml);
  const removed = reordered.items[2].number;
  const afterDelete = parseGalleryState(removeGalleryItems(reorderedHtml, [removed]));

  assert.deepEqual(reordered.items.slice(0, 2).map((item) => item.number), [2, 1]);
  assert.deepEqual(
    afterDelete.items.map((item) => item.number),
    reordered.items.filter((item) => item.number !== removed).map((item) => item.number),
  );
});
