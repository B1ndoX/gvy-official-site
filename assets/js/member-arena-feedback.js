// IntroFighters 3.2: native Damage/UpdateHealthbar and sharedassets0 TR827–837.
// Visual adaptation only. This module owns no timers, physics or combat RNG.
(() => {
  "use strict";
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const outQuad = (t) => 1 - (1 - clamp(t, 0, 1)) ** 2;
  const tween = (from, to, t) => from + (to - from) * outQuad(t);
  const trail = (x, y, width, spacing = .35, life = 75, color = "#fff", alpha = 80 / 255) =>
    Object.freeze({ x, y, width, spacing, life, color, alpha });
  const trails = Object.freeze({
    spear: trail(0, 1.6, .2), shortsword: trail(0, .9575, .075),
    mace: trail(0, .9, .3, .5), pitchfork: trail(0, .9, .2),
    magic: trail(0, 1.098, .075), sword: trail(0, 1.375, .075),
    special: trail(0, 1.098, .075), axe: trail(-.15, .575, .175, .5),
    arrow: trail(-.68, 0, .075, .3, 175),
    fire: trail(0, 0, .65, .3, 175, "#ff4f00", 160 / 255),
    superfire: trail(0, 0, .4, .3, 175, "#a939ff", 160 / 255),
  });
  function randomSource(seed) {
    let state = seed >>> 0;
    return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
  }
  function health(value = 1) {
    return { target: value, front: value, back: value, change: null };
  }
  function sampleHealth(state, now, reduced = false) {
    const c = state.change;
    if (!c || reduced) { state.front = state.back = state.target; state.change = null; return state; }
    const elapsed = now - c.at;
    state.front = tween(c.front, state.target, (elapsed - (c.healing ? 1250 : 0)) / (c.healing ? 1000 : 250));
    state.back = tween(c.back, state.target, (elapsed - (c.healing ? 0 : 700)) / (c.healing ? 500 : 1000));
    // Reversals cancel the old sequence at its visible values, as in the source.
    state.back = Math.max(state.front, state.back);
    if (elapsed >= (c.healing ? 2250 : 1700)) { state.front = state.back = state.target; state.change = null; }
    return state;
  }
  function changeHealth(state, value, now, reduced = false) {
    value = clamp(value, 0, 1);
    if (value === state.target) return state;
    sampleHealth(state, now, reduced);
    const healing = value > state.target;
    state.target = value;
    state.change = { at: now, front: state.front, back: state.back, healing };
    return sampleHealth(state, now, reduced);
  }
  function particleCount(damage) {
    const n = Math.max(0, damage) * .25, floor = Math.floor(n), fraction = n - floor;
    // Unity Mathf.RoundToInt uses nearest even at exact .5 ties.
    return clamp(fraction === .5 ? floor + floor % 2 : Math.round(n), 1, 40);
  }
  function shake(damage, now, seed) {
    const rng = randomSource(seed), keys = [{ x: 0, y: 0 }];
    let angle = rng() * Math.PI * 2;
    for (let i = 1; i < 30; i++) {
      angle += Math.PI + (rng() - .5) * Math.PI;
      const fade = 1 - i / 30;
      keys.push({ x: Math.cos(angle) * fade, y: Math.sin(angle) * fade });
    }
    keys.push({ x: 0, y: 0 });
    return { at: now, duration: clamp(damage * .00525, .01, .375) * 1000,
      strength: clamp(damage * .00525, .01, .32), keys };
  }
  function sampleShake(state, now, unit, reduced = false) {
    if (!state || reduced || now >= state.at + state.duration) return { x: 0, y: 0 };
    const p = clamp((now - state.at) / state.duration, 0, 1) * 30, i = Math.min(29, Math.floor(p));
    const a = state.keys[i], b = state.keys[i + 1], t = p - i, scale = state.strength * unit;
    return { x: (a.x + (b.x - a.x) * t) * scale, y: (a.y + (b.y - a.y) * t) * scale };
  }
  function createCanvas({ field, reduced = false, seed = 1 }) {
    if (reduced) return null;
    const canvas = field.ownerDocument.createElement("canvas");
    canvas.className = "arena-feedback"; canvas.setAttribute("aria-hidden", "true");
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return null;
    field.append(canvas);
    const rng = randomSource(seed), pieces = Array.from({ length: 96 }, () => ({ active: false }));
    const segments = Array.from({ length: 512 }, () => ({ active: false }));
    const cues = Array.from({ length: 16 }, () => ({ active: false }));
    let cueIndex = 0, lastCues = 0, peakCues = 0, lastCue = null;
    let tracks = new WeakMap(), pieceIndex = 0, segmentIndex = 0, w = 0, h = 0, ratio = 1, dirty = false;
    let peakPieces = 0, peakSegments = 0, lastPieces = 0, lastSegments = 0, draws = 0;
    return {
      resize(width, height, sx = 1, sy = 1, scale = 1, dpr = 1) {
        w = width; h = height;
        // At most two million backing pixels, even in standalone 4K windows.
        ratio = Math.min(dpr, 1.5, Math.sqrt(2_000_000 / Math.max(1, w * h)));
        canvas.width = Math.max(1, Math.floor(w * ratio)); canvas.height = Math.max(1, Math.floor(h * ratio));
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.textAlign = "center"; ctx.font = '600 12px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif';
        for (const p of pieces) if (p.active) {
          p.x *= sx; p.y *= sy; p.vx *= scale; p.vy *= scale; p.gravity *= scale; p.size *= scale;
        }
        for (const cue of cues) if (cue.active) { cue.x *= sx; cue.y *= sy; }
        for (const s of segments) s.active = false;
        tracks = new WeakMap(); lastSegments = 0; dirty = false;
      },
      stop(key) { tracks.delete(key); },
      trail(key, definition, point, active, now, unit) {
        if (!active || !definition) { tracks.delete(key); return; }
        const prior = tracks.get(key);
        if (!prior || prior.definition !== definition || now - prior.at > definition.life) {
          tracks.set(key, { ...point, at: now, definition }); return;
        }
        const distance = Math.hypot(point.x - prior.x, point.y - prior.y);
        if (distance < definition.spacing * unit || now === prior.at) return;
        const s = segments[segmentIndex++ % segments.length];
        Object.assign(s, { active: true, ax: prior.x, ay: prior.y, bx: point.x, by: point.y,
          born: now, definition, unit });
        Object.assign(prior, point, { at: now });
      },
      hit(portrait, x, y, damage, now, unit, gravity = 9.81) {
        if (!portrait?.complete || !portrait.naturalWidth) return;
        const count = particleCount(damage), iw = portrait.naturalWidth, ih = portrait.naturalHeight;
        for (let i = 0; i < count; i++) {
          const p = pieces[pieceIndex++ % pieces.length], angle = rng() * Math.PI * 2, speed = (3 + rng() * 2) * unit;
          Object.assign(p, { active: true, portrait, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            born: now, gravity: gravity * unit, size: (.125 + rng() * .1) * unit,
            sx: rng() * iw * .75, sy: rng() * ih * .75, sw: iw * .25, sh: ih * .25 });
        }
      },
      notify(kind, key, x, y, amount, now) {
        if (!["critical", "heal"].includes(kind) || !Number.isFinite(amount) || amount <= 0) return;
        let cue = kind === "heal" && cues.find((c) => c.active && c.key === key && c.kind === kind && now - c.born < 900 && now < c.until);
        if (cue) { cue.amount += amount; cue.x = x; cue.y = y; cue.until = Math.min(cue.born + 1200, now + 650); }
        else { cue = cues[cueIndex++ % cues.length]; Object.assign(cue, { active:true, key, kind, x, y, amount, born:now, until:now + 850 }); }
        cue.text = kind === "heal" ? "+" + Number(cue.amount.toFixed(1)) : "暴击 " + Math.round(cue.amount);
        lastCue = { kind, text:cue.text, at:now };
      },
      render(now) {
        let countPieces = 0, countSegments = 0, countCues = 0;
        if (dirty) ctx.clearRect(0, 0, w, h);
        ctx.lineCap = "round";
        for (const s of segments) if (s.active) {
          const t = (now - s.born) / s.definition.life;
          if (t >= 1) { s.active = false; continue; }
          countSegments++;
          // Source width is zero at either end, with its peak near .365.
          const taper = t < .365 ? outQuad(t / .365) : 1 - outQuad((t - .365) / .635);
          ctx.strokeStyle = s.definition.color; ctx.globalAlpha = s.definition.alpha * (1 - t);
          ctx.lineWidth = Math.max(.1, s.definition.width * s.unit * taper);
          ctx.beginPath(); ctx.moveTo(s.ax, s.ay); ctx.lineTo(s.bx, s.by); ctx.stroke();
        }
        for (const p of pieces) if (p.active) {
          const age = (now - p.born) / 1000;
          if (age >= 5) { p.active = false; p.portrait = null; continue; }
          countPieces++;
          const x = p.x + p.vx * age, y = p.y + p.vy * age + .5 * p.gravity * age ** 2;
          if (x + p.size < 0 || x - p.size > w || y - p.size > h || y + p.size < 0) continue;
          ctx.globalAlpha = clamp((5 - age) / 1.25, 0, 1);
          ctx.drawImage(p.portrait, p.sx, p.sy, p.sw, p.sh, x - p.size / 2, y - p.size / 2, p.size, p.size);
        }
        for (const cue of cues) if (cue.active) {
          if (now >= cue.until) { cue.active = false; cue.key = null; continue; }
          countCues++;
          const t = clamp((now - cue.born) / 850, 0, 1), x = clamp(cue.x, 38, w - 38), y = clamp(cue.y - 20 - t * 22, 14, h - 10);
          ctx.globalAlpha = Math.min(1, (1 - t) * 3); ctx.lineWidth = 3; ctx.strokeStyle = "#02080c";
          ctx.fillStyle = cue.kind === "heal" ? "#b7efc6" : "#f1cf83";
          ctx.strokeText(cue.text, x, y); ctx.fillText(cue.text, x, y);
        }
        lastCues = countCues; peakCues = Math.max(peakCues, countCues);
        ctx.globalAlpha = 1; dirty = countPieces + countSegments + countCues > 0;
        lastPieces = countPieces; lastSegments = countSegments;
        peakPieces = Math.max(peakPieces, countPieces); peakSegments = Math.max(peakSegments, countSegments);
        draws++;
      },
      snapshot() { return { cues:lastCues, peakCues, cueLimit:cues.length, lastCue, pieces: lastPieces, segments: lastSegments, peakPieces, peakSegments, draws,
        pieceLimit: pieces.length, segmentLimit: segments.length, backingPixels: canvas.width * canvas.height }; },
      dispose() { canvas.remove(); tracks = new WeakMap(); for (const cue of cues) { cue.active = false; cue.key = null; } for (const p of pieces) { p.active = false; p.portrait = null; } },
    };
  }
  const api = Object.freeze({ trails, health, changeHealth, sampleHealth, particleCount, shake, sampleShake, createCanvas });
  if (typeof window !== "undefined") window.GVYArenaFeedback = api;
  else globalThis.GVYArenaFeedback = api;
})();
