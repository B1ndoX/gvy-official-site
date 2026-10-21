(() => {
  "use strict";

  const finitePoint = (point) => point && Number.isFinite(point.x) && Number.isFinite(point.y);
  const countOf = (count) => Number.isSafeInteger(count) && count > 0 ? count : 0;

  // Website timed-Classic policy. The original Classic mode has no timed
  // champion. Display and settlement must share this visible two-field score.
  const compareMatchScore = (a, b) => b.kills - a.kills || a.deaths - b.deaths;
  function rankMatch(fighters) {
    const sorted = [...fighters].sort(compareMatchScore);
    let rank = 0;
    return sorted.map((fighter, i) => {
      if (!i || compareMatchScore(fighter, sorted[i - 1]) !== 0) rank = i + 1;
      return { fighter, rank };
    });
  }
  function classicWinners(fighters) {
    const top = rankMatch(fighters), best = top[0]?.fighter;
    if (!best || best.kills <= 0) return [];
    return top.filter(({ fighter }) => compareMatchScore(fighter, best) === 0).map(({ fighter }) => fighter);
  }

  // All coordinates use the same arena/world unit (CSS pixels in the runtime).
  // Return the shortest distance in that unit, including segment endpoints.
  function distanceToSegment(px, py, ax, ay, bx, by) {
    if (![px, py, ax, ay, bx, by].every(Number.isFinite)) return Infinity;
    const dx = bx - ax, dy = by - ay;
    const length = Math.hypot(dx, dy);
    if (!length) return Math.hypot(px - ax, py - ay);
    const along = Math.max(0, Math.min(length, (px - ax) * (dx / length) + (py - ay) * (dy / length)));
    return Math.hypot(px - ax - along * (dx / length), py - ay - along * (dy / length));
  }

  // Coordinates and radius share the same arena/world unit; radius is the SUM
  // of the moving and target circles' radii. Return a dimensionless travel
  // fraction t in [0, 1], not seconds: contact = from + (to - from) * t.
  function sweptCircleHit(from, to, target, radius) {
    if (!finitePoint(from) || !finitePoint(to) || !finitePoint(target) || !Number.isFinite(radius) || radius < 0) return null;
    const sx = target.x - from.x, sy = target.y - from.y;
    if (Math.hypot(sx, sy) <= radius) return 0;
    const dx = to.x - from.x, dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (!length || !Number.isFinite(length)) return null;
    const ux = dx / length, uy = dy / length;
    const perpendicular = Math.abs(sx * uy - sy * ux);
    if (perpendicular > radius) return null;
    // Project onto the entire travel segment, so fast shots cannot tunnel through
    // a fighter between frames. This also avoids subtracting large quadratic terms.
    const entry = sx * ux + sy * uy - Math.sqrt(Math.max(0, (radius - perpendicular) * (radius + perpendicular)));
    const t = entry / length;
    const tolerance = Number.EPSILON * 8;
    return t >= -tolerance && t <= 1 + tolerance ? Math.max(0, Math.min(1, t)) : null;
  }

  function inShieldArc(defender, source, halfArc = Math.PI * .40) {
    if (!finitePoint(defender) || !finitePoint(source) || !Number.isFinite(defender.aim) || !Number.isFinite(halfArc) || halfArc < 0) return false;
    const dx = source.x - defender.x, dy = source.y - defender.y;
    if (!dx && !dy) return true;
    const difference = Math.atan2(dy, dx) - defender.aim;
    const angle = Math.abs(Math.atan2(Math.sin(difference), Math.cos(difference)));
    return angle <= Math.min(Math.PI, halfArc) + Number.EPSILON * 8;
  }

  function makeLoadout(count, policy, weaponIds, random = Math.random) {
    const length = countOf(count);
    const pool = Array.isArray(weaponIds) ? [...new Set(weaponIds.filter((id) => typeof id === "string" && id.trim()))] : [];
    if (!length) return [];
    if (policy === "unarmed" || !pool.length) return Array(length).fill("fists");
    const pick = () => {
      let value;
      try { value = typeof random === "function" ? random() : 0; } catch { value = 0; }
      const unit = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
      return pool[Math.min(pool.length - 1, Math.floor(unit * pool.length))];
    };
    if (policy === "same") return Array(length).fill(pick());
    if (policy === "mirrored") {
      const result = Array(length);
      for (let i = 0; i < Math.ceil(length / 2); i++) result[i] = result[length - 1 - i] = pick();
      return result;
    }
    return Array.from({ length }, pick);
  }

  function teamFor(index, count, mode) {
    if (!Number.isInteger(index) || index < 0 || index >= countOf(count)) return -1;
    return mode === "teams" ? (index < Math.ceil(count / 2) ? 0 : 1) : index;
  }

  function isEnemy(a, b) {
    return Boolean(a && b && a.alive === true && b.alive === true && a.id != null && b.id != null &&
      a.team != null && b.team != null && a.id !== b.id && a.team !== b.team);
  }

  // relativeSpeed has already been converted from arena pixels to the original
  // game's world units by the caller. Clamp normal damage before critical damage.
  function physicalDamage(stats, relativeSpeed, random = Math.random, result) {
    if (result) result.critical = false;
    if (!stats || !stats.collisionDamage || !Number.isFinite(relativeSpeed) || relativeSpeed < 0 ||
      ![stats.minDamageVelocity, stats.velocityMultiplier, stats.damageMultiplier, stats.minDamage, stats.maxDamage]
        .every((value) => Number.isFinite(value) && value >= 0) || stats.minDamage > stats.maxDamage ||
      relativeSpeed < stats.minDamageVelocity || typeof random !== "function") return 0;
    const scaled = relativeSpeed * stats.velocityMultiplier * stats.damageMultiplier;
    if (!Number.isFinite(scaled)) return 0;
    let damage = Math.max(stats.minDamage, Math.min(stats.maxDamage, scaled));
    try {
      const roll = random();
      if (!Number.isFinite(roll) || roll < 0 || roll > 1) return 0;
      if (roll <= .01) {
        const strength = random();
        if (!Number.isFinite(strength) || strength < 0 || strength > 1) return 0;
        damage *= 1.75 + strength * 2.25;
        if (result) result.critical = true;
      }
    } catch { return 0; }
    return Number.isFinite(damage) && damage >= 0 ? damage : 0;
  }

  // Reconstruct original Unity local XY points: one unit is one Unity unit and
  // positive Y points UP. The renderer handles fitting, Y inversion and smoothing.
  function buildTerrainPoints(definition, scale = 1, random = Math.random) {
    if (!definition || !Number.isFinite(scale)) return [];
    if (definition.generated === false) {
      const seed = definition.seedSplinePoints;
      if (!Array.isArray(seed) || seed.length < 2 || seed.length > 256 ||
        !seed.every((point) => Array.isArray(point) && point.length >= 2 && point.slice(0, 2).every(Number.isFinite))) return [];
      return seed.map(([x, y]) => ({ x, y }));
    }
    const curve = definition.curve;
    const keys = curve?.curve?.keys;
    if (definition.generated !== true || !Number.isFinite(definition.maxScale) || definition.maxScale < 1 ||
      definition.maxScale > 6 || !curve || !Number.isInteger(curve.points) || curve.points < 2 ||
      !Number.isFinite(curve.spacing) || curve.spacing <= 0 || !Number.isFinite(curve.amplitude) ||
      !Number.isFinite(curve.endPointYOffset) || typeof curve.addNoise !== "boolean" ||
      typeof curve.additionalRandomVariety !== "boolean" || !Array.isArray(keys) || !keys.length || keys.length > 256 ||
      !keys.every((key, index) => Array.isArray(key) && key.length === 7 && key.every(Number.isFinite) &&
        key[4] === 0 && (!index || key[0] > keys[index - 1][0])) ||
      (curve.addNoise && (!Array.isArray(curve.perlinRange) || curve.perlinRange.length !== 2 ||
        !curve.perlinRange.every(Number.isFinite) || curve.perlinRange[0] > curve.perlinRange[1]))) return [];
    const effectiveScale = Math.max(1, Math.min(definition.maxScale, scale));
    const count = Math.floor(curve.points * effectiveScale);
    if (count < 2 || count > 256) return [];
    const uniform = (min, max) => {
      const unit = typeof random === "function" ? random() : NaN;
      if (!Number.isFinite(unit) || unit < 0 || unit > 1) throw new Error("invalid terrain random sample");
      return min + (max - min) * unit;
    };
    const evaluate = (time) => {
      if (time <= keys[0][0]) return keys[0][1];
      if (time >= keys[keys.length - 1][0]) return keys[keys.length - 1][1];
      const right = keys.findIndex((key) => key[0] >= time);
      const from = keys[right - 1], to = keys[right];
      const duration = to[0] - from[0];
      const t = (time - from[0]) / duration, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * from[1] + (t3 - 2 * t2 + t) * duration * from[3] +
        (-2 * t3 + 3 * t2) * to[1] + (t3 - t2) * duration * to[2];
    };
    try {
      const spacing = curve.spacing + (curve.additionalRandomVariety ? uniform(0, .25) : 0);
      const amplitude = curve.amplitude * effectiveScale + (curve.additionalRandomVariety ? uniform(-.5, 1.75) : 0);
      const points = [];
      for (let i = 0; i < count; i++) {
        const x = (i - (count - 1) / 2) * spacing;
        const y = i === 0 || i === count - 1 ? curve.endPointYOffset : evaluate(i / (count - 1)) * amplitude +
          (curve.addNoise ? uniform(curve.perlinRange[0], curve.perlinRange[1]) : 0);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
        points.push({ x, y });
      }
      return points;
    } catch { return []; }
  }

  // Sample the original SpriteShape handles in Unity local XY. Fixed terrains
  // keep their zero-handle polygon corners, including vertical Terrain 01 edges.
  function sampleTerrainContour(points, definition) {
    if (!Array.isArray(points) || points.length < 2 || points.length > 256 || !points.every(finitePoint) ||
      !definition || typeof definition.generated !== "boolean" ||
      points.some((point, index) => index > 0 && point.x < points[index - 1].x)) return [];
    if (!definition.generated) return points.map(({ x, y }) => ({ x, y }));
    const tangentLength = definition.curve?.tangentLength;
    if (!Number.isFinite(tangentLength) || tangentLength < 0 ||
      points.some((point, index) => index > 0 && point.x <= points[index - 1].x)) return [];
    const handles = points.map(() => ({ left: { x: 0, y: 0 }, right: { x: 0, y: 0 } }));
    for (let i = 1; i < points.length - 1; i++) {
      const point = points[i], previous = points[i - 1], next = points[i + 1];
      const previousLength = Math.hypot(previous.x - point.x, previous.y - point.y);
      const nextLength = Math.hypot(next.x - point.x, next.y - point.y);
      if (!Number.isFinite(previousLength) || !previousLength || !Number.isFinite(nextLength) || !nextLength) return [];
      const a = { x: (previous.x - point.x) / previousLength, y: (previous.y - point.y) / previousLength };
      const b = { x: (next.x - point.x) / nextLength, y: (next.y - point.y) / nextLength };
      if (Math.abs(a.x * b.y - a.y * b.x) <= Number.EPSILON * 8) {
        handles[i] = { left: { x: a.x * tangentLength, y: a.y * tangentLength },
          right: { x: b.x * tangentLength, y: b.y * tangentLength } };
      } else {
        const length = Math.hypot(b.x - a.x, b.y - a.y);
        if (!Number.isFinite(length) || !length) return [];
        const right = { x: (b.x - a.x) / length * tangentLength, y: (b.y - a.y) / length * tangentLength };
        handles[i] = { left: { x: -right.x, y: -right.y }, right };
      }
    }
    const steps = Math.min(8, Math.floor(255 / (points.length - 1)));
    const output = [{ x: points[0].x, y: points[0].y }];
    const lerp = (a, b, t) => a * (1 - t) + b * t;
    const cubic = (a, b, c, d, t) => lerp(lerp(lerp(a, b, t), lerp(b, c, t), t), lerp(lerp(b, c, t), lerp(c, d, t), t), t);
    for (let i = 0; i < points.length - 1; i++) {
      const from = points[i], to = points[i + 1];
      const right = handles[i].right, left = handles[i + 1].left;
      const control1 = { x: from.x + right.x, y: from.y + right.y };
      const control2 = { x: to.x + left.x, y: to.y + left.y };
      if (!finitePoint(control1) || !finitePoint(control2) || control1.x < from.x || control2.x > to.x ||
        control1.x > control2.x) return [];
      for (let step = 1; step <= steps; step++) {
        const t = step / steps;
        const sample = step === steps ? { x: to.x, y: to.y } : {
          x: cubic(from.x, control1.x, control2.x, to.x, t), y: cubic(from.y, control1.y, control2.y, to.y, t),
        };
        if (!finitePoint(sample) || sample.x < output[output.length - 1].x || sample.x < from.x || sample.x > to.x) return [];
        output.push(sample);
      }
    }
    return output;
  }

  const LIMIT = 500;
  const handleKey = (handle) => typeof handle === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(handle) ? handle.toLowerCase() : null;
  const safeCounter = (value) => Number.isFinite(value) && value > 0 ? Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value)) : 0;
  const plus = (a, b) => Math.min(Number.MAX_SAFE_INTEGER, a + b);
  const validCounter = (value) => Number.isSafeInteger(value) && value >= 0;
  const validName = (value) => typeof value === "string" && value.length > 0 && value.length <= 100 && !/[\u0000-\u001f\u007f]/.test(value);
  const validOutcome = (value) => typeof value === "string" && value.length > 0 && value.length <= 200;

  function createStatsStorage(storage, key = "gvy-arena-stats-v1") {
    let records = new Map();
    let outcomes = new Set();
    let persistent = typeof storage?.getItem === "function" && typeof storage?.setItem === "function";
    const restore = () => { try {
      const raw = storage?.getItem(key);
      if (raw == null) { records = new Map(); outcomes = new Set(); }
      else {
        const parsed = JSON.parse(raw);
        if (parsed?.version !== 1 || !Array.isArray(parsed.records) || !Array.isArray(parsed.outcomes) ||
          parsed.records.length > LIMIT || parsed.outcomes.length > LIMIT) throw new Error("invalid stats version or size");
        const loaded = new Map();
        for (const record of parsed.records) {
          const identity = handleKey(record?.handle);
          if (!identity || loaded.has(identity) || !validName(record.name) ||
            ![record.matches, record.wins, record.kills, record.deaths, record.bestStreak].every(validCounter)) {
            throw new Error("invalid stats record");
          }
          loaded.set(identity, { handle: record.handle, name: record.name, matches: record.matches,
            wins: record.wins, kills: record.kills, deaths: record.deaths, bestStreak: record.bestStreak });
        }
        if (!parsed.outcomes.every(validOutcome) || new Set(parsed.outcomes).size !== parsed.outcomes.length) throw new Error("invalid stats outcomes");
        records = loaded;
        outcomes = new Set(parsed.outcomes);
      }
    } catch {
      // Private browsing, quota errors and malformed/old data must never stop a match.
      // Once persistence fails, retain this session rather than reload stale data.
      persistent = false;
    } };
    if (persistent) restore();

    const read = () => [...records.values()].map((record) => ({ ...record })).sort((a, b) =>
      b.wins - a.wins || b.kills - a.kills || a.handle.toLowerCase().localeCompare(b.handle.toLowerCase(), "en"));
    const persist = () => {
      if (!persistent) return;
      try { storage.setItem(key, JSON.stringify({ version: 1, records: [...records.values()], outcomes: [...outcomes] })); } catch { persistent = false; }
    };
    const record = (participants, outcome) => {
      if (!validOutcome(outcome?.id) || !Array.isArray(participants) || !Array.isArray(outcome.winnerHandles)) return read();
      // Another open arena can have committed since this instance was created.
      if (persistent) restore();
      if (outcomes.has(outcome.id)) return read();
      const winners = new Set(outcome.winnerHandles.map(handleKey).filter(Boolean));
      const unique = new Map();
      for (const participant of participants) {
        const identity = handleKey(participant?.handle);
        if (identity && !unique.has(identity)) unique.set(identity, participant);
      }
      if (!unique.size) return read();
      for (const [identity, participant] of unique) {
        const prior = records.get(identity) || { matches: 0, wins: 0, kills: 0, deaths: 0, bestStreak: 0 };
        const next = { handle: participant.handle, name: validName(participant.name) ? participant.name : prior.name || participant.handle,
          matches: plus(prior.matches, outcome.countMatch === false ? 0 : 1), wins: plus(prior.wins, winners.has(identity) ? 1 : 0),
          kills: plus(prior.kills, safeCounter(participant.kills)), deaths: plus(prior.deaths, safeCounter(participant.deaths)),
          bestStreak: Math.max(prior.bestStreak, safeCounter(participant.bestStreak)) };
        // Map insertion order retains the most recently participating 500 identities.
        records.delete(identity);
        records.set(identity, next);
      }
      while (records.size > LIMIT) records.delete(records.keys().next().value);
      outcomes.add(outcome.id);
      while (outcomes.size > LIMIT) outcomes.delete(outcomes.values().next().value);
      persist();
      return read();
    };
    return Object.freeze({ read, record });
  }

  globalThis.GVYArenaRules = Object.freeze({ distanceToSegment, sweptCircleHit, inShieldArc,
    makeLoadout, teamFor, isEnemy, physicalDamage, compareMatchScore, rankMatch, classicWinners, buildTerrainPoints, sampleTerrainContour, createStatsStorage });
})();
