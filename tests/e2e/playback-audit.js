// Test-only instrumentation: never included in dist or the site's runtime.
export async function observePlayback(page, browserName) {
  const responses = [];
  let phase = "cold";
  if (browserName === "chromium") {
    const session = await page.context().newCDPSession(page);
    const requestPhases = new Map();
    await session.send("Network.enable");
    session.on("Network.requestWillBeSent", ({ requestId }) => requestPhases.set(requestId, phase));
    session.on("Network.responseReceived", ({ requestId, type, response }) => {
      if (type !== "Media") return;
      const headers = Object.fromEntries(Object.entries(response.headers).map(([key, value]) => [key.toLowerCase(), value]));
      responses.push({ phase: requestPhases.get(requestId) || phase, url: response.url, status: response.status,
        diskCache: Boolean(response.fromDiskCache), serviceWorker: Boolean(response.fromServiceWorker),
        cacheControl: headers["cache-control"], contentRange: headers["content-range"],
        responseBodyBytes: Number(headers["content-length"] || 0) });
    });
  }
  await page.addInitScript(() => {
    const records = [];
    const seen = new WeakSet();
    const finishWait = (record) => {
      if (record.waitStarted === null) return;
      record.rebufferMs += performance.now() - record.waitStarted;
      record.waitStarted = null;
    };
    const attach = () => document.querySelectorAll("video").forEach((video) => {
      if (seen.has(video)) return;
      seen.add(video);
      const record = { video, firstFrameMs: null, firstPlayingMs: null,
        rebufferCount: 0, rebufferMs: 0, waitStarted: null, errors: [] };
      records.push(record);
      video.requestVideoFrameCallback?.(() => { record.firstFrameMs = performance.now(); });
      video.addEventListener("playing", () => {
        record.firstPlayingMs ??= performance.now();
        finishWait(record);
      });
      video.addEventListener("waiting", () => {
        if (record.firstPlayingMs !== null && !video.paused && record.waitStarted === null) {
          record.rebufferCount += 1;
          record.waitStarted = performance.now();
        }
      });
      video.addEventListener("pause", () => finishWait(record));
      video.addEventListener("ended", () => finishWait(record));
      video.addEventListener("error", () => record.errors.push(video.error?.code));
    });
    new MutationObserver(attach).observe(document, { childList: true, subtree: true });
    attach();
    window.__gvyPlaybackAudit = () => records.map((record) => {
      const video = record.video;
      const quality = video.getVideoPlaybackQuality?.();
      return { role: video.matches("[data-hero-video]") ? "hero" : "operation",
        src: video.currentSrc, paused: video.paused, currentTime: video.currentTime,
        resolution: [video.videoWidth, video.videoHeight], firstFrameMs: record.firstFrameMs,
        firstPlayingMs: record.firstPlayingMs, rebufferCount: record.rebufferCount,
        rebufferMs: record.rebufferMs + (record.waitStarted === null ? 0 : performance.now() - record.waitStarted),
        decodedFrames: quality?.totalVideoFrames, droppedFrames: quality?.droppedVideoFrames,
        buffered: Array.from({ length: video.buffered.length }, (_, index) => [video.buffered.start(index), video.buffered.end(index)]),
        errors: [...record.errors] };
    });
  });
  return {
    setPhase(value) { phase = value; },
    async snapshot() {
      return { phase, media: await page.evaluate(() => window.__gvyPlaybackAudit?.() || []),
        responses: responses.filter((response) => response.phase === phase),
        resources: await page.evaluate(() => performance.getEntriesByType("resource")
          .filter((resource) => resource.initiatorType === "video")
          .map((resource) => ({ url: resource.name, transferBytes: resource.transferSize,
            encodedBodyBytes: resource.encodedBodySize, durationMs: resource.duration }))) };
    },
  };
}
