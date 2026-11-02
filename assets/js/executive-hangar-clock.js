import {HANGAR_SOURCE, HANGAR_SYNC_MS, HANGAR_CACHE_KEY, validateHangarConfig,
  hangarState, hangarCountdown, hangarBeijing, readHangarCache} from './executive-hangar-rules.js';

const phases = {charging: '充能中', available: '可开启', resetting: '重置中'};

// Six rotor leaves adapted from PButcher/FlipDown (MIT); no second countdown
// engine or decrementing counter. One wall-clock sample drives both faces.
function flipFace(element, view) {
  element.replaceChildren();
  const digits = [];
  for (let group = 0; group < 3; group++) {
    const pair = element.ownerDocument.createElement('span'); pair.className = 'hangar-rotor-pair';
    for (let n = 0; n < 2; n++) {
      const rotor = element.ownerDocument.createElement('span'); rotor.className = 'hangar-rotor';
      rotor.innerHTML = '<span class="rotor-top">–</span><span class="rotor-bottom">–</span><span class="rotor-leaf"><span class="rotor-leaf-front">–</span><span class="rotor-leaf-rear">–</span></span>';
      const [top, bottom, front, rear] = ['.rotor-top','.rotor-bottom','.rotor-leaf-front','.rotor-leaf-rear'].map(s => rotor.querySelector(s));
      rotor.addEventListener('animationend', () => {bottom.textContent = front.textContent = rotor.dataset.value; rotor.classList.remove('is-flipping');});
      pair.append(rotor); digits.push({rotor, top, bottom, front, rear});
    }
    element.append(pair);
    if (group < 2) {const colon = element.ownerDocument.createElement('span'); colon.className = 'hangar-colon'; colon.textContent = ':'; element.append(colon);}
  }
  return (text, animate) => {
    text.replaceAll(':', '').split('').forEach((value, i) => {
      const d = digits[i]; if (d.rotor.dataset.value === value) return;
      const previous = d.rotor.dataset.value;
      d.rotor.classList.remove('is-flipping'); d.rotor.dataset.value = value;
      d.top.textContent = value; d.rear.textContent = value; d.front.textContent = previous || value;
      const flip = animate && previous && value !== '–' && !view.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      d.front.textContent = flip ? previous : value;
      d.bottom.textContent = flip ? previous : value;
      if (flip) {void d.rotor.offsetWidth; d.rotor.classList.add('is-flipping');}
    });
  };
}

export function initExecutiveHangar({root = globalThis.document, view = root?.defaultView || globalThis, fetcher = view.fetch?.bind(view)} = {}) {
  const trigger = root?.querySelector('[data-hangar-open]'), panel = root?.querySelector('[data-hangar-panel]');
  if (!trigger || !panel) return () => {};
  let storage; try {storage = view.localStorage;} catch {}
  let saved = readHangarCache(storage, Date.now());
  let lastAttempt = saved?.validatedAt || 0, syncing = false, failed = false, destroyed = false;
  let tickTimer = 0, leaveTimer = 0, timeoutTimer = 0, lastTick = 0, lastClose = 0, pinned = false, abort;
  const listeners = [], listen = (node, name, fn) => {node.addEventListener(name, fn); listeners.push(() => node.removeEventListener(name, fn));};
  for (const surface of [trigger, panel]) {
    const edge = surface.querySelector('.hangar-edge-glow'); if (!edge) continue;
    let angle = parseFloat(edge.style.getPropertyValue('--hangar-edge-angle')) || 0;
    const pointEdge = event => {
      if (event.pointerType === 'touch') return;
      const box = surface.getBoundingClientRect();
      const target = Math.atan2(event.clientY - box.top - box.height / 2, event.clientX - box.left - box.width / 2) * 180 / Math.PI + 103;
      // Unwrap the angle so crossing twelve o'clock never spins a full turn.
      angle += ((target - angle) % 360 + 540) % 360 - 180;
      edge.style.setProperty('--hangar-edge-angle', angle + 'deg');
    };
    listen(surface, 'pointerenter', pointEdge); listen(surface, 'pointermove', pointEdge);
  }
  const find = name => panel.querySelector('[data-hangar-' + name + ']');
  const compactFace = flipFace(trigger.querySelector('[data-hangar-flip]'), view);
  const fullFace = flipFace(find('flip'), view);
  const output = find('countdown'), compactOutput = trigger.querySelector('[data-hangar-countdown]');
  const isOpen = () => panel.matches(':popover-open');
  const position = () => {
    const box = trigger.getBoundingClientRect(), width = Math.min(380, view.innerWidth - 24);
    panel.style.setProperty('--hangar-left', Math.max(12, Math.min(view.innerWidth - width - 12, box.left + box.width / 2 - width / 2)) + 'px');
    panel.style.setProperty('--hangar-top', Math.min(box.bottom + 12, 118) + 'px');
  };
  function render(immediate = false) {
    if (destroyed) return;
    const now = Date.now(), animate = !immediate && lastTick && now - lastTick < 1600; lastTick = now;
    const state = saved ? hangarState(saved.config, now) : null;
    const phase = state?.phase || 'unavailable', time = state ? hangarCountdown(state.remainingMs) : '––:––:––';
    const previousPhase = panel.dataset.phase;
    trigger.dataset.phase = panel.dataset.phase = phase;
    const status = state ? phases[phase] : '暂不可用';
    trigger.querySelector('[data-hangar-compact-phase]').textContent = status;
    compactOutput.textContent = time; compactFace(time, animate);
    if (!isOpen()) return;
    fullFace(time, animate); output.textContent = state ? time : '暂不可用';
    if (find('phase').textContent !== status) find('phase').textContent = status;
    find('target').textContent = phase === 'charging' ? '距离可开启' : state ? '距离本阶段结束' : '等待有效计时数据';
    const ring = find('progress');
    // Same elapsed/dash-offset relationship as CountdownCircleTimer. Phase
    // changes, tab resumes and opening the panel snap to the real timestamp,
    // rather than animating backwards through a completed cycle.
    ring.style.transitionProperty = animate && previousPhase === phase ? '' : 'none';
    ring.style.strokeDashoffset = String(state ? 100 * state.progress : 100);
    ring.style.opacity = state ? '1' : '0';
    panel.querySelectorAll('[data-hangar-light]').forEach((light, i) => {light.dataset.color = state?.lights[i] || 'off';});
    find('lights').setAttribute('aria-label', state ? '预测状态灯：' + state.lights.map(c => ({green:'绿',red:'红',off:'熄灭'}[c])).join('、') : '状态灯暂无数据');
    find('window-label').textContent = phase === 'charging' ? '下次窗口结束（含重置）' : '本轮窗口结束（含重置）';
    for (const [name, value] of [['next',state?.nextOpenAt],['end',state?.windowEndAt],['calibration',saved ? Date.parse(saved.config.serverStartTimes.initialOpenTime) : null],['updated',saved?.validatedAt]]) {
      const el = find(name), full = value ? hangarBeijing(value) : '';
      const [date, clock] = full.split(' '), today = hangarBeijing(now).split(' ')[0];
      el.textContent = !value ? '—' : name === 'calibration' || name === 'updated'
        ? date.slice(5) + ' ' + clock.slice(0,5) : (date === today ? '' : date.slice(5) + ' ') + clock.slice(0,8);
      el.title = full ? full + ' 北京时间' : '';
      if (value) el.setAttribute('aria-label', full + ' 北京时间'); else el.removeAttribute('aria-label');
      if (value) el.dateTime = new Date(value).toISOString(); else el.removeAttribute('datetime');
    }
    const version = saved?.config.versionInfo, patch = version?.match(/\bPatch\s+([^\s]+)/i)?.[1];
    find('version').textContent = patch || version || '暂无有效版本';
    find('version').title = version || '';
    find('sync-row').hidden = !syncing && !failed;
    find('updated-row').hidden = !saved;
    find('sync').textContent = syncing ? '正在同步公开配置…' : failed ? saved ? '同步失败 · 保留上次有效配置' : '数据获取失败 · 暂不可用' : saved ? '已校验配置 · 每15分钟同步' : '暂无有效配置';
  }
  async function sync() {
    const now = Date.now();
    if (destroyed || syncing || now - lastAttempt < HANGAR_SYNC_MS) return;
    lastAttempt = now; syncing = true; render(true); abort = new view.AbortController();
    timeoutTimer = view.setTimeout(() => abort.abort(), 8000);
    try {
      // A shared 15-minute cache key avoids stale intermediary responses without
      // defeating caching on every display tick or inventing a proxy service.
      const response = await fetcher(HANGAR_SOURCE + '?gvy_sync=' + Math.floor(now / HANGAR_SYNC_MS), {cache:'no-cache', credentials:'omit', signal:abort.signal});
      if (!response.ok) throw new Error('Configuration request failed');
      const text = await response.text(); if (text.length > 65536) throw new Error('Configuration is too large');
      const config = validateHangarConfig(JSON.parse(text));
      if (destroyed) return;
      saved = {version:1, source:HANGAR_SOURCE, config, validatedAt:Date.now()}; failed = false;
      try {storage?.setItem(HANGAR_CACHE_KEY, JSON.stringify(saved));} catch {}
    } catch {if (!destroyed) failed = true;}
    finally {view.clearTimeout(timeoutTimer); timeoutTimer = 0; syncing = false; if (!destroyed) render(true);}
  }
  function tick() {
    view.clearTimeout(tickTimer); if (destroyed || root.visibilityState === 'hidden') return;
    render(); void sync();
    tickTimer = view.setTimeout(tick, 1000 - Date.now() % 1000);
  }
  const open = () => {view.clearTimeout(leaveTimer); position(); if (!isOpen()) panel.showPopover(); render(true);};
  const leave = () => {view.clearTimeout(leaveTimer); if (!pinned) leaveTimer = view.setTimeout(() => {if (!pinned && !panel.contains(root.activeElement) && isOpen()) panel.hidePopover();}, 180);};
  // A hover is temporary; the first click pins that same panel. Suppress the
  // native button action so a click on an already-hovered panel cannot close it.
  listen(trigger, 'click', event => {event.preventDefault(); if (pinned && isOpen()) panel.hidePopover(); else {pinned = true; open();}});
  listen(trigger, 'pointerenter', event => {if (event.pointerType !== 'touch' && view.matchMedia('(hover: hover)').matches) open();});
  const hoverLeave = event => {if (event.pointerType !== 'touch' && view.matchMedia('(hover: hover)').matches) leave();};
  listen(trigger, 'pointerleave', hoverLeave);
  listen(trigger, 'focus', () => {if (Date.now() - lastClose > 300 && trigger.matches(':focus-visible')) open();});
  listen(panel, 'pointerenter', () => view.clearTimeout(leaveTimer)); listen(panel, 'pointerleave', hoverLeave);
  listen(panel, 'beforetoggle', event => {if (event.newState === 'open') position(); else {pinned = false; lastClose = Date.now(); view.clearTimeout(leaveTimer);}});
  listen(panel, 'toggle', () => {trigger.setAttribute('aria-expanded', String(isOpen())); render(true);});
  listen(find('close'), 'click', () => {panel.hidePopover(); trigger.focus({preventScroll:true});});
  listen(view, 'resize', () => {if (isOpen()) position();});
  listen(root, 'visibilitychange', () => {view.clearTimeout(tickTimer); if (root.visibilityState !== 'hidden') {render(true); tick();}});
  listen(view, 'pageshow', () => {render(true); tick();});
  listen(view, 'storage', event => {if (event.key === HANGAR_CACHE_KEY) {const next = readHangarCache(storage, Date.now()); if (next && (!saved || next.validatedAt > saved.validatedAt)) {saved = next; lastAttempt = next.validatedAt; failed = false; render(true);}}});
  render(true); tick();
  return () => {destroyed = true; view.clearTimeout(tickTimer); view.clearTimeout(leaveTimer); view.clearTimeout(timeoutTimer); abort?.abort(); listeners.forEach(fn => fn()); if (isOpen()) panel.hidePopover();};
}
