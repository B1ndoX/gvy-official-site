(() => {
  "use strict";
  // Fixed-clock reconstruction of the measured source animation sequence.
  // Matter owns the physical hand/item; these paths only command its target.
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const point = (p) => Array.isArray(p) ? { x: p[0], y: p[1] } : { x: p.x, y: p.y };
  const animationCooldown = (animation) => (animation?.sets || []).reduce((sum, set) => sum + (set.delay || 0) + (set.speed || 0) +
    (animation.idleTransitionDelay || 0) + (animation.idleTransitionSpeed || 0), 0);
  function attackCooldown(weapon, personalityRange, animation, kind, random = Math.random) {
    const uniform = ([a, b]) => a + (b - a) * random();
    if (kind === "throw") return uniform(personalityRange);
    if (["bow", "fire", "superfire", "bomb"].includes(kind)) return uniform(weapon.attackCooldown || [0, 0]) +
      uniform(weapon.actionTime || [.525, .525]) + uniform([.75, 1.5]);
    return uniform(personalityRange) + uniform(weapon.attackCooldown || [0, 0]) + animationCooldown(animation);
  }
  function compile(animation, motion, idle = { x: .4, y: 0 }, initial = idle) {
    let cursor = point(initial), time = 0;
    const segments = [];
    for (const set of animation.sets || []) {
      const delay = Math.max(0, set.delay || 0), duration = Math.max(.001, set.speed || 0);
      if (delay) segments.push({ start: time, end: time + delay, from: cursor, to: cursor });
      time += delay;
      const points = [cursor, ...set.points.map(point)];
      const path = motion.compilePath(points, 5);
      const end = points.at(-1);
      segments.push({ start: time, end: time + duration, path, from: cursor, to: end });
      time += duration; cursor = end;
    }
    const delay = Math.max(0, animation.idleTransitionDelay || 0);
    if (delay) segments.push({ start: time, end: time + delay, from: cursor, to: cursor });
    time += delay;
    const duration = Math.max(.001, animation.idleTransitionSpeed || .33);
    segments.push({ start: time, end: time + duration, from: cursor, to: point(idle) });
    time += duration;
    return { animation, segments, duration: time, idle: point(idle),
      activeAt: animation.activateItem ? Math.max(0, animation.setItemActivePosition || 0) : Infinity,
      // The source getter counts the idle timing once per set, separately from
      // the actual visible timeline. Do not use it to sample movement.
      cooldown: animationCooldown(animation) };
  }
  function sample(timeline, elapsed, motion) {
    const time = Math.max(0, elapsed);
    const segment = timeline.segments.find((s) => time <= s.end + 1e-7);
    let target = timeline.idle;
    if (segment) {
      const t = clamp((time - segment.start) / (segment.end - segment.start), 0, 1);
      target = segment.path ? motion.samplePath(segment.path, t) : {
        x: segment.from.x + (segment.to.x - segment.from.x) * t,
        y: segment.from.y + (segment.to.y - segment.from.y) * t,
      };
    }
    // Source durations are serialized float32, while this clock is float64.
    // Do not push a .2s activation into the next 20ms step for a 3ns roundoff.
    return { target, active: time + 1e-7 >= timeline.activeAt && time < timeline.duration - 1e-7,
      complete: time + 1e-7 >= timeline.duration };
  }
  function worldTarget(local, origin, unit, aim, inverse, animation) {
    // Unity Y up becomes CSS Y down. Mirroring the animator's X/Y Euler axes
    // reflects the perpendicular path; heading remains the chosen enemy ray.
    const x = local.x * (inverse && animation?.invertPathY ? -1 : 1) * unit;
    const y = -local.y * (inverse && animation?.invertPathX ? -1 : 1) * unit;
    const angle = animation?.rotatePathAngle === false ? 0 : aim;
    return { x: origin.x + x * Math.cos(angle) - y * Math.sin(angle),
      y: origin.y + x * Math.sin(angle) + y * Math.cos(angle) };
  }
  function bowPull(elapsed, releasedAt = Infinity) {
    // Native bow: OutExpo to -.75 in .85s; release at the AI's .525s.
    const t = clamp(Math.min(elapsed, releasedAt) / .85, 0, 1);
    const pulled = .75 * (t === 1 ? 1 : 1 - 2 ** (-10 * t));
    if (elapsed <= releasedAt) return pulled;
    const back = clamp((elapsed - releasedAt) / .1, 0, 1), c = 1.70158;
    const ease = 1 + (c + 1) * (back - 1) ** 3 + c * (back - 1) ** 2;
    return pulled * (1 - ease);
  }
  globalThis.GVYArenaActions = Object.freeze({ compile, sample, worldTarget, bowPull, animationCooldown, attackCooldown });
})();
