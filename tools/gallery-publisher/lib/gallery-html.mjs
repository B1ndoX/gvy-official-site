const GRID_PATTERN = /<div class="archive-grid" data-archive-grid(?:\sdata-archive-high-watermark="\d+")?>/;
const BUTTON_PATTERN = /<button type="button" data-archive-open="(\d+)"([^>]*)><picture>[\s\S]*?<img src="\.\/assets\/gallery\/team-(\d+)\.(jpe?g|png)"[^>]*>[\s\S]*?<\/picture><\/button>/gi;

export function formatAssetId(assetId, width = 2) {
  return String(assetId).padStart(width, "0");
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
  return `${html.slice(0, bounds.tagStart)}__GVY_MANAGED_GALLERY_GRID__${html.slice(afterGrid)}`;
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
      fallbackName: `team-${formatAssetId(number, 2)}.${match[4].toLowerCase()}`,
      latestStart: /\bdata-archive-latest-start\b/.test(match[2]),
      markup: match[0],
    });
  }

  if (items.length < 1) throw new Error("官网团建相册中没有可识别的照片");
  items.forEach((item, index) => {
    if (item.openIndex !== index) throw new Error(`团建相册打开索引在第 ${index + 1} 张处不连续`);
  });
  if (new Set(items.map((item) => item.number)).size !== items.length) throw new Error("团建相册资源标识必须唯一");

  const latestItems = items.filter((item) => item.latestStart);
  if (latestItems.length !== 1) throw new Error("团建相册必须且只能有一个最新批次起点");
  const recordedHighWatermark = Number(tag.match(/data-archive-high-watermark="(\d+)"/)?.[1] || 0);
  const maxPhotoNumber = Math.max(...items.map((item) => item.number), recordedHighWatermark);

  return {
    count: items.length,
    items,
    latestAssetNumber: latestItems[0].number,
    maxPhotoNumber,
  };
}

export function renderGalleryButton(item, openIndex, { latestStart = false } = {}) {
  const twoDigit = formatAssetId(item.number, 2);
  const srcset = [`./assets/gallery/optimized/team-${twoDigit}-1280.webp 1280w`];
  if (item.has1920) srcset.push(`./assets/gallery/optimized/team-${twoDigit}-1920.webp 1920w`);
  const latestAttribute = latestStart ? " data-archive-latest-start" : "";

  return `            <button type="button" data-archive-open="${openIndex}"${latestAttribute}><picture><source type="image/webp" srcset="${srcset.join(", ")}" sizes="(max-width: 760px) 33vw, 17vw" /><img src="./assets/gallery/${item.fallbackName}" alt="GVY 团建回忆" loading="lazy" width="${item.width}" height="${item.height}" /></picture></button>`;
}

export function appendGalleryBatch(html, batchItems) {
  if (!Array.isArray(batchItems) || batchItems.length < 1) {
    throw new Error("至少需要一张照片才能生成相册预览");
  }

  const state = parseGalleryState(html);
  batchItems.forEach((item, index) => {
    if (item.number !== state.maxPhotoNumber + index + 1) {
      throw new Error("新增照片资源标识与当前资源高水位不连续");
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
  let withGrid = `${html.slice(0, bounds.contentStart)}${nextGrid}${html.slice(bounds.contentEnd)}`;
  const nextHighWatermark = batchItems.at(-1).number;
  if (/data-archive-high-watermark="\d+"/.test(bounds.tag)) {
    withGrid = withGrid.replace(/data-archive-high-watermark="\d+"/, `data-archive-high-watermark="${nextHighWatermark}"`);
  } else {
    withGrid = withGrid.replace(/<div class="archive-grid" data-archive-grid/, `<div class="archive-grid" data-archive-grid data-archive-high-watermark="${nextHighWatermark}"`);
  }
  return withGrid;
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

export function removeGalleryItems(html, assetIds) {
  if (!Array.isArray(assetIds) || assetIds.length < 1) throw new Error("请选择至少一张要删除的照片");
  const selected = [...new Set(assetIds.map(Number))];
  if (selected.some((assetId) => !Number.isInteger(assetId) || assetId < 1)) throw new Error("删除照片资源标识无效");

  const state = parseGalleryState(html);
  const existing = new Set(state.items.map((item) => item.number));
  const missing = selected.filter((number) => !existing.has(number));
  if (missing.length) throw new Error("官网当前相册中找不到所选照片");

  const selectedSet = new Set(selected);
  const remaining = state.items.filter((item) => !selectedSet.has(item.number));
  if (remaining.length < 2) throw new Error("团建相册至少必须保留 2 张照片");

  let nextLatestAssetNumber = state.latestAssetNumber;
  if (selectedSet.has(nextLatestAssetNumber)) {
    const previousLatestIndex = state.items.findIndex((item) => item.number === state.latestAssetNumber);
    nextLatestAssetNumber = state.items.slice(previousLatestIndex + 1).find((item) => !selectedSet.has(item.number))?.number
      ?? remaining.at(-1).number;
  }

  const bounds = findGalleryGridBounds(html);
  const nextButtons = remaining.map((item, index) => withLatestMarker(
    withOpenIndex(item.markup, index),
    item.number === nextLatestAssetNumber,
  ));
  const nextGrid = `\n${nextButtons.join("\n")}\n              `;
  const withGrid = `${html.slice(0, bounds.contentStart)}${nextGrid}${html.slice(bounds.contentEnd)}`;
  return withGrid;
}

export function createBatchAssetIds(currentHighWatermark, batchSize) {
  if (!Number.isInteger(currentHighWatermark) || currentHighWatermark < 0) throw new RangeError("当前资源高水位无效");
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) {
    throw new RangeError("单批照片数量必须在 1 到 100 之间");
  }
  return Array.from({ length: batchSize }, (_, index) => currentHighWatermark + index + 1);
}
