(() => {
  "use strict";
  // Cross-engine helpers informed by selected native evidence, not a Unity
  // physics/tween reimplementation. Angles are radians except PID error units.
  const finite = Number.isFinite;
  const point = (p) => p && finite(p.x) && finite(p.y);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function wrap(value, period) {
    if (!finite(value)) return 0;
    const unit = ((value % period) + period) % period;
    return unit > period / 2 ? unit - period : unit;
  }
  const wrapRadians = (value) => wrap(value, Math.PI * 2);
  const wrapDegrees = (value) => wrap(value, 360);

  function createPID(kp, ki, kd) {
    if (![kp, ki, kd].every(finite)) throw new TypeError("Finite PID gains required");
    let integral = 0, previous = 0;
    return Object.freeze({
      step(error, dt) {
        if (!finite(error) || !finite(dt) || dt <= 0) return 0;
        const next = integral + error * dt;
        const derivative = (error - previous) / dt;
        const result = kp * error + ki * next + kd * derivative;
        // Invalid/overflowing steps do not poison subsequent valid state.
        if (![next, derivative, result].every(finite)) return 0;
        integral = next; previous = error;
        return result;
      },
      reset(error = 0) { integral = 0; previous = finite(error) ? error : 0; },
    });
  }
  // Original torque helper feeds clamped DEGREE error into its PID. The caller
  // owns physical torque conversion; clampDegrees is not an output torque cap.
  function pidTorque(pid, position, target, rotationRadians, clampDegrees, dt) {
    if (!pid || typeof pid.step !== "function" || !point(position) || !point(target) ||
        !finite(rotationRadians) || !finite(clampDegrees) || clampDegrees < 0) return 0;
    const angle = Math.atan2(target.y - position.y, target.x - position.x);
    const error = wrapRadians(angle - wrapRadians(rotationRadians)) * 180 / Math.PI;
    const output = pid.step(clamp(error, -clampDegrees, clampDegrees), dt);
    return finite(output) ? output : 0;
  }
  function localToWorld(p, origin, angle, scale = 1, mirror = 1) {
    if (!point(p) || !point(origin) || !finite(angle) || !finite(scale) || scale <= 0 ||
        (mirror !== 1 && mirror !== -1)) return null;
    const c = Math.cos(angle), s = Math.sin(angle), x = p.x * scale * mirror, y = p.y * scale;
    const result = { x: origin.x + x * c - y * s, y: origin.y + x * s + y * c };
    return point(result) ? result : null;
  }
  function worldToLocal(p, origin, angle, scale = 1, mirror = 1) {
    if (!point(p) || !point(origin) || !finite(angle) || !finite(scale) || scale <= 0 ||
        (mirror !== 1 && mirror !== -1)) return null;
    const c = Math.cos(angle), s = Math.sin(angle), x = p.x - origin.x, y = p.y - origin.y;
    const result = { x: (x * c + y * s) / scale * mirror, y: (-x * s + y * c) / scale };
    return point(result) ? result : null;
  }
  function interpolatePose(a, b, alpha) {
    if (!point(a) || !point(b) || !finite(a.angle) || !finite(b.angle) || !finite(alpha)) return null;
    const t = clamp(alpha, 0, 1), angle = wrapRadians(a.angle);
    const result = { x: a.x * (1 - t) + b.x * t, y: a.y * (1 - t) + b.y * t,
      angle: wrapRadians(angle + wrapRadians(wrapRadians(b.angle) - angle) * t) };
    return point(result) ? result : null;
  }

  const paths = new WeakSet();
  function compilePath(input, resolution = 5) {
    if (!Array.isArray(input) || !input.length || input.length > 256 || !input.every(point) ||
        !Number.isInteger(resolution) || resolution < 1 || resolution > 64) return null;
    const points = input.filter((p, i) => !i || p.x !== input[i - 1].x || p.y !== input[i - 1].y)
      .map(({ x, y }) => ({ x, y }));
    const samples = [{ ...points[0] }], lengths = [0];
    const extrapolate = (a, b) => ({ x: 2 * a.x - b.x, y: 2 * a.y - b.y });
    const catmull = (a, b, c, d, t) => .5 * ((2 * b) + (-a + c) * t +
      (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i - 1] || extrapolate(points[i], points[i + 1]);
      const b = points[i], c = points[i + 1], d = points[i + 2] || extrapolate(c, b);
      for (let step = 1; step <= resolution; step++) {
        const t = step / resolution;
        const p = step === resolution ? { ...c } : {
          x: catmull(a.x, b.x, c.x, d.x, t), y: catmull(a.y, b.y, c.y, d.y, t) };
        if (!point(p)) return null;
        const previous = samples[samples.length - 1];
        const length = lengths[lengths.length - 1] + Math.hypot(p.x - previous.x, p.y - previous.y);
        if (!finite(length)) return null;
        samples.push(p); lengths.push(length);
      }
    }
    const path = Object.freeze({ points: Object.freeze(samples.map(Object.freeze)),
      lengths: Object.freeze(lengths), length: lengths[lengths.length - 1] });
    paths.add(path);
    return path;
  }
  function samplePath(path, progress) {
    if (!paths.has(path) || !finite(progress)) return null;
    const last = path.points.length - 1, distance = clamp(progress, 0, 1) * path.length;
    if (!path.length || distance <= 0) return { ...path.points[0] };
    if (distance >= path.length) return { ...path.points[last] };
    let left = 0, right = last;
    while (right - left > 1) {
      const middle = (left + right) >> 1;
      if (path.lengths[middle] < distance) left = middle; else right = middle;
    }
    const span = path.lengths[right] - path.lengths[left];
    const t = span ? (distance - path.lengths[left]) / span : 0;
    const a = path.points[left], b = path.points[right];
    return { x: a.x * (1 - t) + b.x * t, y: a.y * (1 - t) + b.y * t };
  }

  // Ear clipping returns triangles only after the whole simple polygon succeeds.
  // Normalize for geometric predicates, retaining original coordinates in output.
  function triangulateConvexParts(input) {
    if (!Array.isArray(input) || input.length < 3 || input.length > 64) return [];
    const raw = input.map((p) => Array.isArray(p) ? { x: p[0], y: p[1] } : p);
    if (!raw.every(point)) return [];
    const xs = raw.map((p) => p.x), ys = raw.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const scale = Math.max(maxX - minX, maxY - minY);
    if (!finite(scale) || scale <= 0) return [];
    const cx = minX / 2 + maxX / 2, cy = minY / 2 + maxY / 2, eps = 1e-10;
    const normalized = raw.map((p) => ({ x: (p.x - cx) / scale, y: (p.y - cy) / scale, original: p }));
    const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const same = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) <= eps;
    const polygon = normalized.filter((p, i) => !i || !same(p, normalized[i - 1]));
    if (polygon.length > 1 && same(polygon[0], polygon[polygon.length - 1])) polygon.pop();
    for (let i = 0; i < polygon.length; i++) for (let j = i + 1; j < polygon.length; j++) {
      if (same(polygon[i], polygon[j])) return [];
    }
    let changed = true;
    while (changed && polygon.length >= 3) {
      changed = false;
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[(i + polygon.length - 1) % polygon.length], b = polygon[i], c = polygon[(i + 1) % polygon.length];
        if (Math.abs(cross(a, b, c)) > eps) continue;
        if ((b.x - a.x) * (b.x - c.x) + (b.y - a.y) * (b.y - c.y) > eps) return [];
        polygon.splice(i, 1); changed = true; break;
      }
    }
    if (polygon.length < 3) return [];
    const onSegment = (p, a, b) => Math.abs(cross(a, b, p)) <= eps &&
      p.x >= Math.min(a.x, b.x) - eps && p.x <= Math.max(a.x, b.x) + eps &&
      p.y >= Math.min(a.y, b.y) - eps && p.y <= Math.max(a.y, b.y) + eps;
    const intersects = (a, b, c, d) => {
      const abC = cross(a, b, c), abD = cross(a, b, d), cdA = cross(c, d, a), cdB = cross(c, d, b);
      return ((abC > eps && abD < -eps || abC < -eps && abD > eps) &&
        (cdA > eps && cdB < -eps || cdA < -eps && cdB > eps)) ||
        onSegment(c, a, b) || onSegment(d, a, b) || onSegment(a, c, d) || onSegment(b, c, d);
    };
    for (let i = 0; i < polygon.length; i++) for (let j = i + 1; j < polygon.length; j++) {
      if (j === i + 1 || i === 0 && j === polygon.length - 1) continue;
      if (intersects(polygon[i], polygon[(i + 1) % polygon.length], polygon[j], polygon[(j + 1) % polygon.length])) return [];
    }
    const twiceArea = polygon.reduce((sum, p, i) => {
      const next = polygon[(i + 1) % polygon.length]; return sum + p.x * next.y - next.x * p.y;
    }, 0);
    if (!finite(twiceArea) || Math.abs(twiceArea) <= eps) return [];
    if (twiceArea < 0) polygon.reverse();
    const remaining = [...polygon], parts = [];
    const inside = (p, a, b, c) => cross(a, b, p) >= -eps && cross(b, c, p) >= -eps && cross(c, a, p) >= -eps;
    while (remaining.length > 3) {
      let found = false;
      for (let i = 0; i < remaining.length; i++) {
        const a = remaining[(i + remaining.length - 1) % remaining.length], b = remaining[i], c = remaining[(i + 1) % remaining.length];
        if (cross(a, b, c) <= eps || remaining.some((p) => p !== a && p !== b && p !== c && inside(p, a, b, c))) continue;
        parts.push([a, b, c]); remaining.splice(i, 1); found = true; break;
      }
      if (!found) return [];
    }
    if (cross(...remaining) <= eps) return [];
    parts.push(remaining);
    const area = parts.reduce((sum, triangle) => sum + cross(...triangle), 0);
    if (parts.length !== polygon.length - 2 || Math.abs(area - Math.abs(twiceArea)) > eps * polygon.length) return [];
    return parts.map((triangle) => triangle.map(({ original: { x, y } }) => ({ x, y })));
  }

  globalThis.GVYArenaMotion = Object.freeze({ wrapRadians, wrapDegrees, createPID, pidTorque,
    localToWorld, worldToLocal, compilePath, samplePath, interpolatePose, triangulateConvexParts });
})();
