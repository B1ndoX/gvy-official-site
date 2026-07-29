const GRID_PATTERN = /<div class="archive-grid" data-archive-grid(?:\sdata-archive-high-watermark="\d+")?>/;
const BUTTON_PATTERN = /<button type="button" data-archive-open="(\d+)"([^>]*)><picture>[\s\S]*?<img src="\.\/assets\/gallery\/team-(\d+)\.(jpe?g|png)"[^>]*>[\s\S]*?<span>(\d+)<\/span><\/button>/gi;

export function padPhotoNumber(number, width = 2) {
  return String(number).padStart(width, "0");
}

export function findGalleryGridBounds(html) {
  const match = GRID_PATTERN.exec(html);
  if (!match) throw new Error("找不到官网团建相册容器");
  const tagStart = match.index;
  const contentStart = tagStart + match[0].length;
  const contentEnd = html.indexOf("</div>", contentStart);
  if (contentEnd < 0) throw new Error("官网团建相册容器没有正确闭合");
  return { tagStart, tag: match[0], contentStart, contentEnd };
}

function maskManagedGalleryRegions(html) {
  const bounds = findGalleryGridBounds(html);
  const afterGrid = bounds.contentEnd + "</div>".length;
  return `${html.slice(0, bounds.tagStart)}__GVY_MANAGED_GALLERY_GRID__${html.slice(afterGrid)}`
    .replace(/aria-label="\d+ 张舰队团建照片匀速滚动相册/, 'aria-label="__GVY_GALLERY_COUNT__ 张舰队团建照片匀速滚动相册')
    .replace(
      /<input(?=[^>]*data-archive-carousel-scrubber)[^>]*>/,
      (tag) => tag.replace(/\bmax="\d+"/, 'max="__GVY_GALLERY_MAX__"'),
    );
}

export function assertOnlyManagedGalleryChanged(beforeHtml, afterHtml) {
  if (maskManagedGalleryRegions(beforeHtml) !== maskManagedGalleryRegions(afterHtml)) {
    throw new Error("发布器检测到团建相册区域之外的官网代码变化，已停止操作");
  }
}

export function parseGalleryState(html) {
  const { tag, contentStart, contentEnd } = findGalleryGridBounds(html);
  const grid = html.slice(contentStart, contentEnd);
  const items = [];
  let match;
  BUTTON_PATTERN.lastIndex = 0;

  while ((match = BUTTON_PATTERN.exec(grid))) {
    const openIndex = Number(match[1]);
    const number = Number(match[3]);
    items.push({
      openIndex,
      number,
      assetNumber: number,
      extension: match[4].toLowerCase(),
      fallbackName: `team-${padPhotoNumber(number, 2)}.${match[4].toLowerCase()}`,
      displayNumber: Number(match[5]),
      latestStart: /\bdata-archive-latest-start\b/.test(match[2]),
      markup: match[0],
    });
  }

  if (items.length < 1) throw new Error("官网团建相册中没有可识别的照片");
  items.forEach((item, index) => {
    if (item.openIndex !== index) throw new Error(`团建相册打开索引在第 ${index + 1} 张处不连续`);
    if (item.displayNumber !== index + 1) throw new Error(`团建相册第 ${index + 1} 张的显示编号不连续`);
    if (index > 0 && item.number <= items[index - 1].number) throw new Error("团建相册稳定编号必须递增且唯一");
  });

  const latestItems = items.filter((item) => item.latestStart);
  if (latestItems.length !== 1) throw new Error("团建相册必须且只能有一个最新批次起点");
  const recordedHighWatermark = Number(tag.match(/data-archive-high-watermark="(\d+)"/)?.[1] || 0);
  const maxPhotoNumber = Math.max(items.at(-1).number, recordedHighWatermark);

  return {
    count: items.length,
    items,
    latestStart: latestItems[0].displayNumber,
    latestEnd: items.length,
    latestAssetNumber: latestItems[0].number,
    maxPhotoNumber,
  };
}

export function renderGalleryButton(item, openIndex, { latestStart = false } = {}) {
  const twoDigit = padPhotoNumber(item.number, 2);
  const displayNumber = openIndex + 1;
  const twoDigitDisplay = padPhotoNumber(displayNumber, 2);
  const threeDigitDisplay = padPhotoNumber(displayNumber, 3);
  const srcset = [`./assets/gallery/optimized/team-${twoDigit}-1280.webp 1280w`];
  if (item.has1920) srcset.push(`./assets/gallery/optimized/team-${twoDigit}-1920.webp 1920w`);
  const latestAttribute = latestStart ? " data-archive-latest-start" : "";

  return `            <button type="button" data-archive-open="${openIndex}"${latestAttribute}><picture><source type="image/webp" srcset="${srcset.join(", ")}" sizes="(max-width: 760px) 33vw, 17vw" /><img src="./assets/gallery/${item.fallbackName}" alt="GVY 远航档案 ${twoDigitDisplay}" loading="lazy" width="${item.width}" height="${item.height}" /></picture><span>${threeDigitDisplay}</span></button>`;
}

export function appendGalleryBatch(html, batchItems) {
  if (!Array.isArray(batchItems) || batchItems.length < 1) {
    throw new Error("至少需要一张照片才能生成相册预览");
  }

  const state = parseGalleryState(html);
  batchItems.forEach((item, index) => {
    if (item.number !== state.maxPhotoNumber + index + 1) {
      throw new Error("新增照片编号与官网当前相册不连续");
    }
  });

  const bounds = findGalleryGridBounds(html);
  const grid = html
    .slice(bounds.contentStart, bounds.contentEnd)
    .replace(/\sdata-archive-latest-start\b/g, "");
  const newButtons = batchItems.map((item, index) => renderGalleryButton(
    item,
    state.count + index,
    { latestStart: index === 0 },
  ));
  const nextGrid = `${grid.trimEnd()}\n${newButtons.join("\n")}\n              `;
  const nextCount = state.count + batchItems.length;
  let withGrid = `${html.slice(0, bounds.contentStart)}${nextGrid}${html.slice(bounds.contentEnd)}`;
  const nextHighWatermark = batchItems.at(-1).number;
  if (/data-archive-high-watermark="\d+"/.test(bounds.tag)) {
    withGrid = withGrid.replace(/data-archive-high-watermark="\d+"/, `data-archive-high-watermark="${nextHighWatermark}"`);
  } else {
    withGrid = withGrid.replace(/<div class="archive-grid" data-archive-grid/, `<div class="archive-grid" data-archive-grid data-archive-high-watermark="${nextHighWatermark}"`);
  }
  return updateGalleryCountControls(withGrid, nextCount);
}

function updateGalleryCountControls(html, count) {
  const countPattern = /aria-label="\d+ 张舰队团建照片匀速滚动相册/;
  if (!countPattern.test(html)) throw new Error("找不到团建相册数量标签");
  let next = html.replace(
    countPattern,
    `aria-label="${count} 张舰队团建照片匀速滚动相册`,
  );
  const scrubberPattern = /<input(?=[^>]*data-archive-carousel-scrubber)[^>]*>/;
  if (scrubberPattern.test(next)) {
    next = next.replace(scrubberPattern, (tag) => tag.replace(/\bmax="\d+"/, `max="${count - 1}"`));
  }
  return next;
}

function withOpenIndex(markup, openIndex) {
  return markup.replace(/data-archive-open="\d+"/, `data-archive-open="${openIndex}"`);
}

function withLatestMarker(markup, latestStart) {
  const clean = markup.replace(/\sdata-archive-latest-start\b/g, "");
  return latestStart
    ? clean.replace(/(data-archive-open="\d+")/, "$1 data-archive-latest-start")
    : clean;
}

function withVisibleNumber(markup, openIndex) {
  const displayNumber = openIndex + 1;
  return markup
    .replace(/alt="GVY 远航档案 \d+"/, `alt="GVY 远航档案 ${padPhotoNumber(displayNumber, 2)}"`)
    .replace(/<span>\d+<\/span>/, `<span>${padPhotoNumber(displayNumber, 3)}</span>`);
}

export function removeGalleryItems(html, numbers) {
  if (!Array.isArray(numbers) || numbers.length < 1) throw new Error("请选择至少一张要删除的照片");
  const selected = [...new Set(numbers.map(Number))];
  if (selected.some((number) => !Number.isInteger(number) || number < 1)) throw new Error("删除照片编号无效");

  const state = parseGalleryState(html);
  const existing = new Set(state.items.map((item) => item.number));
  const missing = selected.filter((number) => !existing.has(number));
  if (missing.length) throw new Error(`官网相册中找不到编号 ${missing.map((number) => padPhotoNumber(number, 3)).join("、")}`);

  const selectedSet = new Set(selected);
  const remaining = state.items.filter((item) => !selectedSet.has(item.number));
  if (remaining.length < 2) throw new Error("团建相册至少必须保留 2 张照片");

  let nextLatestAssetNumber = state.latestAssetNumber;
  if (selectedSet.has(nextLatestAssetNumber)) {
    nextLatestAssetNumber = remaining.find((item) => item.number > state.latestAssetNumber)?.number
      ?? remaining.at(-1).number;
  }

  const bounds = findGalleryGridBounds(html);
  const nextButtons = remaining.map((item, index) => withLatestMarker(
    withVisibleNumber(withOpenIndex(item.markup, index), index),
    item.number === nextLatestAssetNumber,
  ));
  const nextGrid = `\n${nextButtons.join("\n")}\n              `;
  const withGrid = `${html.slice(0, bounds.contentStart)}${nextGrid}${html.slice(bounds.contentEnd)}`;
  return updateGalleryCountControls(withGrid, remaining.length);
}

export function createBatchNumbers(currentCount, batchSize) {
  if (!Number.isInteger(currentCount) || currentCount < 0) throw new RangeError("当前照片数量无效");
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) {
    throw new RangeError("单批照片数量必须在 1 到 100 之间");
  }
  return Array.from({ length: batchSize }, (_, index) => currentCount + index + 1);
}
