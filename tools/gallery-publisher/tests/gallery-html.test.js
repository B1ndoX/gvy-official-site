import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  appendGalleryBatch,
  createBatchNumbers,
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

test("publisher reads the current gallery count and the one precise latest-batch start", () => {
  const state = parseGalleryState(homepage);
  assert.ok(state.count >= 2);
  assert.ok(state.latestStart >= 1);
  assert.ok(state.latestStart <= state.count);
  assert.equal(state.latestEnd, state.count);
  assert.ok(state.maxPhotoNumber >= state.items.at(-1).number);
  assert.equal(state.latestAssetNumber, state.items.find((item) => item.latestStart).number);
  assert.equal(state.items.filter((item) => item.latestStart).length, 1);
});

test("a six-photo batch continues stable numbering and moves latest to the first new photo", () => {
  const current = parseGalleryState(homepage);
  const nextHtml = appendGalleryBatch(homepage, makeBatch(current.maxPhotoNumber + 1, 6));
  const next = parseGalleryState(nextHtml);
  const grid = nextHtml.match(/<div class="archive-grid" data-archive-grid[^>]*>([\s\S]*?)<\/div>/)?.[1] || "";

  assert.equal(next.count, current.count + 6);
  assert.equal(next.latestStart, current.count + 1);
  assert.equal(next.latestEnd, current.count + 6);
  assert.equal(next.items.at(-1).number, current.maxPhotoNumber + 6);
  assert.equal((grid.match(/data-archive-latest-start/g) || []).length, 1);
  assert.doesNotMatch(grid, /\bNEW\b/i);
  assert.match(nextHtml, new RegExp(`aria-label="${current.count + 6} 张舰队团建照片`));
  assert.match(nextHtml, new RegExp(`<input(?=[^>]*data-archive-carousel-scrubber)(?=[^>]*max="${current.count + 5}")`));
});

test("a twenty-photo batch still marks its exact first photo, not an arbitrary last-ten window", () => {
  const current = parseGalleryState(homepage);
  const next = parseGalleryState(appendGalleryBatch(homepage, makeBatch(current.maxPhotoNumber + 1, 20)));

  assert.equal(next.latestStart, current.count + 1);
  assert.equal(next.latestEnd, current.count + 20);
  assert.equal(next.items.at(-1).number, current.maxPhotoNumber + 20);
});

test("batch numbers are sequential and reject invalid batch sizes", () => {
  assert.deepEqual(createBatchNumbers(47, 6), [48, 49, 50, 51, 52, 53]);
  assert.throws(() => createBatchNumbers(47, 0), RangeError);
  assert.throws(() => createBatchNumbers(47, 101), RangeError);
});

test("deleting visible 004 and 005 closes the visible-number gap without renaming stable assets", () => {
  const current = parseGalleryState(homepage);
  const removed = [current.items[3].number, current.items[4].number];
  const oldSixthAsset = current.items[5].number;
  const nextHtml = removeGalleryItems(homepage, removed);
  const next = parseGalleryState(nextHtml);

  assert.equal(next.count, current.count - 2);
  assert.equal(next.maxPhotoNumber, current.maxPhotoNumber);
  assert.ok(next.items.every((item, index) => item.openIndex === index));
  assert.ok(next.items.every((item, index) => item.displayNumber === index + 1));
  assert.ok(next.items.every((item) => !removed.includes(item.number)));
  assert.equal(next.items[3].number, oldSixthAsset);
  assert.equal(next.items[3].displayNumber, 4);
  assert.match(next.items[3].markup, new RegExp(`assets/gallery/team-${String(oldSixthAsset).padStart(2, "0")}\\.`));
  assert.match(next.items[3].markup, /alt="GVY 远航档案 04"/);
  assert.match(next.items[3].markup, /<span>004<\/span>/);
  assert.match(nextHtml, new RegExp(`aria-label="${current.count - 2} 张舰队团建照片`));
  assert.match(nextHtml, new RegExp(`<input(?=[^>]*data-archive-carousel-scrubber)(?=[^>]*max="${current.count - 3}")`));
});

test("the latest marker moves safely when its photo is deleted", () => {
  const current = parseGalleryState(homepage);
  const next = parseGalleryState(removeGalleryItems(homepage, [current.latestAssetNumber]));
  const expectedAsset = current.items.find((item) => item.number > current.latestAssetNumber)?.number
    ?? current.items.at(-2).number;

  assert.equal(next.latestAssetNumber, expectedAsset);
  assert.equal(next.latestStart, next.items.find((item) => item.number === expectedAsset).displayNumber);
  assert.equal(next.items.filter((item) => item.latestStart).length, 1);
});

test("new photos never reuse a deleted stable number", () => {
  const current = parseGalleryState(homepage);
  const deletedMiddle = removeGalleryItems(homepage, [current.items[10].number]);
  const afterDelete = parseGalleryState(deletedMiddle);
  const nextNumber = afterDelete.maxPhotoNumber + 1;
  const afterAdd = parseGalleryState(appendGalleryBatch(deletedMiddle, makeBatch(nextNumber, 1)));

  assert.equal(afterAdd.items.at(-1).number, current.maxPhotoNumber + 1);
  assert.equal(afterAdd.items.at(-1).displayNumber, current.count);
  assert.equal(afterAdd.count, current.count);
  assert.equal(afterAdd.maxPhotoNumber, current.maxPhotoNumber + 1);
});

test("four photos plus three uploads become seven, then deleting visible four and five leaves visible one through five", () => {
  const current = parseGalleryState(homepage);
  const fourPhotoHtml = removeGalleryItems(
    homepage,
    current.items.slice(4).map((item) => item.number),
  );
  const fourPhotos = parseGalleryState(fourPhotoHtml);
  const sevenPhotoHtml = appendGalleryBatch(
    fourPhotoHtml,
    makeBatch(fourPhotos.maxPhotoNumber + 1, 3),
  );
  const sevenPhotos = parseGalleryState(sevenPhotoHtml);
  const deletedAssetNumbers = [sevenPhotos.items[3].number, sevenPhotos.items[4].number];
  const fivePhotos = parseGalleryState(removeGalleryItems(sevenPhotoHtml, deletedAssetNumbers));

  assert.deepEqual(fourPhotos.items.map((item) => item.displayNumber), [1, 2, 3, 4]);
  assert.deepEqual(sevenPhotos.items.map((item) => item.displayNumber), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(fivePhotos.items.map((item) => item.displayNumber), [1, 2, 3, 4, 5]);
});
