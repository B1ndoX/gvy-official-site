// Community timing model: ArkanisCorporation/Exec-Hangar (MIT).
// Calibration and durations always come from a validated config, never defaults.
export const HANGAR_SOURCE = 'https://raw.githubusercontent.com/ArkanisCorporation/Exec-Hangar/main/config.json';
export const HANGAR_PROJECT = 'https://github.com/ArkanisCorporation/Exec-Hangar';
export const HANGAR_SYNC_MS = 15 * 60 * 1000;
export const HANGAR_CACHE_KEY = 'gvy.executive-hangar.v1';
// Upstream's five green lamps extinguish at 12-minute intervals. The rest
// of its configured online window is the blackout/reset tail (not extra time).
const GREEN_LIGHT_MS = 12 * 60 * 1000;
const ACTIVE_MS = GREEN_LIGHT_MS * 5;

export function validateHangarConfig(raw) {
  const timing = raw?.serverStartTimes;
  if (typeof raw?.versionInfo !== 'string' || !raw.versionInfo.trim() || raw.versionInfo.length > 240
    || typeof timing?.initialOpenTime !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(timing.initialOpenTime)) throw new Error('Invalid hangar calibration');
  const anchorMs = Date.parse(timing.initialOpenTime);
  if (!Number.isFinite(anchorMs) || new Date(anchorMs).toISOString().slice(0, 19) !== timing.initialOpenTime.slice(0, 19)) throw new Error('Invalid hangar epoch');
  const {openDurationMs, closeDurationMs} = timing;
  if (![openDurationMs, closeDurationMs].every(n => Number.isSafeInteger(n) && n > 0 && n <= 86400000)
    || openDurationMs <= ACTIVE_MS) throw new Error('Unsupported hangar durations');
  return {
    versionInfo: raw.versionInfo.trim(),
    serverStartTimes: {initialOpenTime: timing.initialOpenTime, openDurationMs, closeDurationMs},
  };
}

export function hangarState(config, nowMs) {
  if (!Number.isFinite(nowMs)) throw new Error('Invalid clock time');
  const {initialOpenTime, openDurationMs, closeDurationMs} = config.serverStartTimes;
  const anchorMs = Date.parse(initialOpenTime);
  const periodMs = openDurationMs + closeDurationMs;
  const cycleIndex = Math.floor((nowMs - anchorMs) / periodMs);
  const cycleStart = anchorMs + cycleIndex * periodMs;
  const elapsed = nowMs - cycleStart;
  const nextOpenAt = cycleStart + periodMs;
  const phase = elapsed < ACTIVE_MS ? 'available' : elapsed < openDurationMs ? 'resetting' : 'charging';
  const phaseStart = phase === 'available' ? cycleStart : phase === 'resetting' ? cycleStart + ACTIVE_MS : cycleStart + openDurationMs;
  const phaseEnd = phase === 'available' ? cycleStart + ACTIVE_MS : phase === 'resetting' ? cycleStart + openDurationMs : nextOpenAt;
  const green = phase === 'available' ? 5 - Math.floor(elapsed / GREEN_LIGHT_MS)
    : phase === 'charging' ? Math.min(4, Math.floor((elapsed - openDurationMs) * 5 / closeDurationMs)) : 0;
  return {
    phase, remainingMs: Math.max(0, phaseEnd - nowMs), phaseEnd, nextOpenAt,
    windowEndAt: (phase === 'charging' ? nextOpenAt : cycleStart) + openDurationMs,
    progress: Math.max(0, Math.min(1, (nowMs - phaseStart) / (phaseEnd - phaseStart))),
    lights: Array.from({length: 5}, (_, i) => i < green ? 'green' : phase === 'charging' ? 'red' : 'off'),
  };
}

export function hangarCountdown(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map(n => String(n).padStart(2, '0')).join(':');
}

const beijing = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3, hourCycle: 'h23',
});
export function hangarBeijing(ms) { return beijing.format(new Date(ms)); }

export function readHangarCache(storage, nowMs) {
  try {
    const saved = JSON.parse(storage.getItem(HANGAR_CACHE_KEY));
    if (saved?.version !== 1 || saved.source !== HANGAR_SOURCE
      || !Number.isFinite(saved.validatedAt) || saved.validatedAt <= 0 || saved.validatedAt > nowMs + 60000) return null;
    return {...saved, config: validateHangarConfig(saved.config)};
  } catch { return null; }
}
