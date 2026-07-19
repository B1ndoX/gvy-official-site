export const HERO_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
export const HERO_CACHE_KEY = "gvy-command-hero-video:v4";

// Hero 01 stays archived until a master taller than the official 1920x860 source is available.
const HERO_MEDIA = Object.freeze([
  Object.freeze({
    id: "02",
    video: "./assets/hero-random/v2/fleet-hero-02-1080p-v4.mp4",
    videoLarge: "./assets/hero-random/v2/fleet-hero-02-1440p-v4.mp4",
    poster: "./assets/hero-random/v2/fleet-hero-02-poster-1440p-v3.webp",
  }),
]);

export function getHeroMedia(index) {
  const media = HERO_MEDIA[index];
  if (!media) throw new RangeError(`Unknown hero media index: ${index}`);
  return { ...media };
}

export function resolveHeroVideo(
  media,
  {
    viewportWidth = 0,
    pixelRatio = 1,
    saveData = false,
    effectiveType = "",
  } = {},
) {
  const constrainedNetwork = saveData || /^(slow-2g|2g|3g)$/.test(effectiveType);
  const renderedPixelWidth = viewportWidth * Math.min(Math.max(pixelRatio, 1), 2);
  const useLargeVideo = !constrainedNetwork && renderedPixelWidth >= 2_200;

  return {
    ...media,
    video: useLargeVideo ? media.videoLarge : media.video,
    quality: useLargeVideo ? "1440p" : "1080p",
  };
}

export function readHeroRecord(storage, key = HERO_CACHE_KEY) {
  try {
    const value = storage?.getItem?.(key);
    if (!value) return null;
    const record = JSON.parse(value);
    if (!record || typeof record !== "object") return null;
    return record;
  } catch {
    return null;
  }
}

export function writeHeroRecord(
  storage,
  key,
  index,
  now = Date.now(),
  ttl = HERO_CACHE_TTL_MS,
) {
  try {
    storage?.setItem?.(key, JSON.stringify({ index, expiresAt: now + ttl }));
    return typeof storage?.setItem === "function";
  } catch {
    return false;
  }
}

export function resolveHeroSelection({
  record,
  now = Date.now(),
  optionCount = HERO_MEDIA.length,
  random = Math.random,
}) {
  if (!Number.isInteger(optionCount) || optionCount < 1) {
    throw new RangeError("optionCount must be a positive integer");
  }

  const cachedIndex = record?.index;
  const cacheIsValid =
    Number.isInteger(cachedIndex) &&
    cachedIndex >= 0 &&
    cachedIndex < optionCount &&
    Number.isFinite(record?.expiresAt) &&
    record.expiresAt > now;

  if (cacheIsValid) return { index: cachedIndex, shouldPersist: false };

  const randomValue = Number(random());
  const normalized = Number.isFinite(randomValue)
    ? Math.min(Math.max(randomValue, 0), 0.999999999999)
    : 0;

  return {
    index: Math.floor(normalized * optionCount),
    shouldPersist: true,
  };
}

function getDefaultStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function initHeroVideo({
  root = globalThis.document,
  storage = getDefaultStorage(),
  cacheKey = HERO_CACHE_KEY,
  now = Date.now(),
  random = Math.random,
  viewportWidth = globalThis.innerWidth ?? 0,
  pixelRatio = globalThis.devicePixelRatio ?? 1,
  connection = globalThis.navigator?.connection,
  reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false,
} = {}) {
  const video = root?.querySelector?.("[data-hero-video]");
  const poster = root?.querySelector?.("[data-hero-poster]");
  const shell = root?.querySelector?.("[data-hero-shell]");
  if (!video || !poster || !shell) {
    return { index: -1, media: null, cleanup() {} };
  }

  const record = readHeroRecord(storage, cacheKey);
  const selection = resolveHeroSelection({ record, now, random });
  const media = resolveHeroVideo(getHeroMedia(selection.index), {
    viewportWidth,
    pixelRatio,
    saveData: connection?.saveData === true,
    effectiveType: connection?.effectiveType || "",
  });

  if (selection.shouldPersist) {
    writeHeroRecord(storage, cacheKey, selection.index, now);
  }

  poster.src = media.poster;
  video.poster = media.poster;
  video.dataset.heroVideoSelected = media.id;
  video.dataset.heroVideoQuality = media.quality;
  shell.dataset.heroState = "poster";

  if (reducedMotion) {
    return { index: selection.index, media, cleanup() {} };
  }

  let playRequested = false;

  const showPoster = () => {
    shell.dataset.heroState = "poster";
    playRequested = false;
  };
  const showVideo = () => {
    shell.dataset.heroState = "playing";
  };
  const tryPlay = () => {
    if (playRequested) return;
    playRequested = true;
    const result = video.play?.();
    result?.catch?.(showPoster);
  };

  const listeners = [
    ["loadeddata", tryPlay],
    ["canplay", tryPlay],
    ["playing", showVideo],
    ["error", showPoster],
    ["stalled", showPoster],
  ];
  listeners.forEach(([name, handler]) => video.addEventListener?.(name, handler));

  shell.dataset.heroState = "loading";
  video.src = media.video;
  video.load?.();

  return {
    index: selection.index,
    media,
    cleanup() {
      listeners.forEach(([name, handler]) => video.removeEventListener?.(name, handler));
    },
  };
}
