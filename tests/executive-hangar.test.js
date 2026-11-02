import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateHangarConfig, hangarState, hangarCountdown, hangarBeijing, readHangarCache,
  HANGAR_SOURCE, HANGAR_SYNC_MS, HANGAR_CACHE_KEY} from '../assets/js/executive-hangar-rules.js';

const raw = JSON.parse(await readFile(new URL('./fixtures/executive-hangar-config.json', import.meta.url)));
const config = validateHangarConfig(raw), epoch = Date.parse(raw.serverStartTimes.initialOpenTime);
const open = 3900123, closed = 7200227, period = open + closed, active = 3600000;

test('the public calibration retains its actual millisecond durations and UTC epoch', () => {
  assert.equal(config.serverStartTimes.openDurationMs, open);
  assert.equal(config.serverStartTimes.closeDurationMs, closed);
  assert.equal(new Date(epoch).toISOString(), '2026-10-29T22:01:09.073Z');
  assert.equal(hangarState(config, epoch).remainingMs, active);
});
test('availability, blackout reset and charging change at exact half-open boundaries', () => {
  for (const [offset, phase, remaining] of [[0,'available',active],[active-1,'available',1],
    [active,'resetting',300123],[open-1,'resetting',1],[open,'charging',closed],
    [period-1,'charging',1],[period,'available',active]]) {
    const s = hangarState(config, epoch + offset);
    assert.equal(s.phase, phase); assert.equal(s.remainingMs, remaining);
  }
});
test('long-running and pre-anchor calculations do not accumulate rounded cycle drift', () => {
  for (const k of [-1001, -1, 0, 1, 1001, 100001]) {
    const start = epoch + k * period, s = hangarState(config, start + open + 1234);
    assert.equal(s.nextOpenAt, epoch + (k + 1) * period);
    assert.equal(s.remainingMs, closed - 1234);
    assert.equal(s.windowEndAt, epoch + (k + 1) * period + open);
  }
});
test('five lights drain, black out and charge without inheriting a previous phase', () => {
  const at = offset => hangarState(config, epoch + offset).lights;
  assert.deepEqual(at(0), Array(5).fill('green'));
  assert.deepEqual(at(12*60000), ['green','green','green','green','off']);
  assert.deepEqual(at(active), Array(5).fill('off'));
  assert.deepEqual(at(open), Array(5).fill('red'));
  assert.deepEqual(at(open + Math.ceil(closed/5)), ['green','red','red','red','red']);
  assert.deepEqual(at(period-1), ['green','green','green','green','red']);
});
test('the display rounds only seconds, and Beijing formatting is device-timezone independent', () => {
  assert.equal(hangarCountdown(1), '00:00:01');
  assert.equal(hangarCountdown(3600001), '01:00:01');
  assert.equal(hangarCountdown(7200227), '02:00:01');
  assert.equal(hangarCountdown(0), '00:00:00');
  assert.match(hangarBeijing(epoch), /2026\/10\/30 06:01:09\.073/);
});
test('invalid or unsupported configurations never create a plausible timer', () => {
  const timing = config.serverStartTimes;
  for (const change of [{initialOpenTime:'bad'},{initialOpenTime:'2026-02-30T00:00:00Z'},
    {openDurationMs:0},{openDurationMs:'3900123'},{openDurationMs:active},
    {closeDurationMs:NaN},{closeDurationMs:-1},{closeDurationMs:2**53}]) {
    assert.throws(() => validateHangarConfig({...raw,serverStartTimes:{...timing,...change}}));
  }
  assert.throws(() => validateHangarConfig(null));
  assert.throws(() => validateHangarConfig({...raw,versionInfo:''}));
});
test('only a validated last-known config from the declared source can be restored', () => {
  const now = epoch + period, saved = {version:1,source:HANGAR_SOURCE,validatedAt:now-60000,config};
  const storage = {getItem(key) {assert.equal(key,HANGAR_CACHE_KEY); return JSON.stringify(saved);}};
  assert.deepEqual(readHangarCache(storage,now).config,config);
  for (const mutated of [{source:'https://example.invalid/config.json'},{version:2},{validatedAt:now+120000},{config:null}]) {
    assert.equal(readHangarCache({getItem:()=>JSON.stringify({...saved,...mutated})},now),null);
  }
  assert.equal(readHangarCache({getItem:()=>'{bad'},now),null);
  assert.equal(readHangarCache({getItem:()=>{throw new Error('blocked storage');}},now),null);
  assert.equal(HANGAR_SYNC_MS,900000);
});
test('the host keeps CSP narrow and makes the independent compact clock available without inline code', async () => {
  const home = await readFile(new URL('../index.html',import.meta.url),'utf8');
  const headers = JSON.parse(await readFile(new URL('../edgeone.json',import.meta.url),'utf8'));
  const csp = headers.headers.find(r=>r.source==='/*').headers.find(h=>h.key==='Content-Security-Policy').value;
  assert.match(csp, /connect-src 'self' https:\/\/raw\.githubusercontent\.com;/);
  assert.doesNotMatch(csp, /connect-src[^;]*\*/);
  assert.match(home,/popovertarget="executive-hangar-panel"/);
  assert.match(home,/社区计时预测，以游戏内状态为准/);
  assert.match(home,/不确认大门或领取状态/);
});
