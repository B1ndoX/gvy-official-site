// IntroFighters 3.2 native Damage / AddKill / ItemCollisionSensor rules.
// Units at this boundary: Matter pixels/base frame; source damage is unscaled.
(() => {
  "use strict";
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const bounds = Object.freeze({
    sword: [[-.2,-.625],[.2,-.625],[.2,1.625],[-.2,1.625]],
    magic: [[-.2,-.625],[.2,-.625],[.2,1.625],[-.2,1.625]],
    special: [[-.2,-.55],[.2,-.55],[.2,1.55],[-.2,1.55]],
    spear: [[-.2,.575],[.2,.575],[.2,1.825],[-.2,1.825]],
    pitchfork: [[-.4,.7],[.4,.7],[.4,1.7],[-.4,1.7]],
    mace: [[-.4,.475],[.4,.475],[.4,1.275],[-.4,1.275]],
    shortsword: [[-.15,-.45],[.15,-.45],[.15,1.15],[-.15,1.15]],
    axe: [[-.375,.325],[.375,.325],[.375,.775],[-.375,.775]],
  });
  const classicItems = Object.freeze({ axe:1000,bomb:90,bow:560,fire:200,mace:1050,pitchfork:950,shortsword:1050,spear:750,sword:1000,special:850,magic:8,superfire:8 });
  const teamItems = Object.freeze({ axe:105,bomb:9,bow:69,fire:22,mace:95,pitchfork:85,shortsword:105,spear:80,sword:100,special:105 });
  const movementAnimation = Object.freeze({ lockRotationToAngle:false,rotatePathAngle:true,invertPathX:true,invertPathY:false,
    idleTransitionSpeed:.5,idleTransitionDelay:.2,activateItem:false,setItemActivePosition:0,
    sets:[{speed:.125,delay:0,points:[[.25,.75,0]]},{speed:.1,delay:.33,points:[[-.75,-2,0]]}] });
  function weighted(weights, random = Math.random) {
    const entries = Object.entries(weights); let draw = random() * entries.reduce((n, e) => n + e[1], 0);
    for (const [key, weight] of entries) { draw -= weight; if (draw < 0) return key; }
    return entries.at(-1)[0];
  }
  function loadouts(count, mode, policy, random = Math.random) {
    const weights = mode === "teams" ? teamItems : classicItems, ids = Object.keys(weights);
    if (policy === "unarmed") return Array(count).fill("fists");
    if (policy === "same") return Array(count).fill(ids[Math.min(ids.length - 1, Math.floor(random() * ids.length))]);
    const chance = mode === "teams" ? Number(weighted({ ".5":200,".7":110,".96":10 }, random)) : .23;
    const pick = () => mode === "teams" && policy === "random" || random() <= chance ? weighted(weights, random) : "fists";
    if (policy === "mirrored" && mode === "teams") {
      const out = Array(count), half = Math.ceil(count / 2);
      for (let i = 0; i < half; i++) { const id = pick(); out[i] = id; if (half + i < count) out[half + i] = id; }
      return out;
    }
    return Array.from({ length: count }, pick);
  }
  function jump({ strength, awayChance, flipChance, health, maxHealth, inverse, dx, dy, zeroGravity }, random = Math.random) {
    const away = random() <= awayChance * (health < maxHealth * .1 ? 4 : 1);
    let x = 0, y = zeroGravity ? 0 : -strength;
    if (random() >= .05) {
      const length = Math.hypot(dx, dy), sign = away ? -1 : 1;
      if (length) { x += dx / length * strength * .5 * sign; y += dy / length * strength * .5 * sign; }
    }
    const cap = random() <= .005 ? strength * 2 : strength, length = Math.hypot(x, y);
    if (length > cap) { x *= cap / length; y *= cap / length; }
    let torque = -10 + random() * 20;
    if (random() <= flipChance) torque = (away !== inverse ? 1 : -1) * (.6 + random() * .4) * 360;
    return { x, y, torque };
  }
  function insideDamageBounds(id, point, origin, unit, scaleX = 1, scaleY = 1) {
    const corners = bounds[id];
    if (!corners) return true;
    const c = Math.cos(origin.angle), s = Math.sin(origin.angle);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of corners) {
      const dx = x * unit * scaleX, dy = -y * unit * scaleY;
      const wx = origin.x + dx * c - dy * s, wy = origin.y + dx * s + dy * c;
      minX = Math.min(minX, wx); maxX = Math.max(maxX, wx); minY = Math.min(minY, wy); maxY = Math.max(maxY, wy);
    }
    return point.x >= minX - 1e-6 && point.x <= maxX + 1e-6 && point.y >= minY - 1e-6 && point.y <= maxY + 1e-6;
  }
  function admit(sources, source, now) {
    // Native victim List<IItem>: different items may hit in the same frame;
    // null is one shared source. No victim-wide or attack-wide immunity.
    if (sources.get(source) > now) return false;
    for (const [item, until] of sources) if (until <= now) sources.delete(item);
    sources.set(source, now + 300); return true;
  }
  function relativeSpeed(a, b, unit) {
    return Math.hypot(a.x - b.x, a.y - b.y) * 60 / unit;
  }
  function impulse(amount, body, point, mass, unit) {
    const dx = body.x - point.x, dy = body.y - point.y, length = Math.hypot(dx, dy);
    const force = clamp(clamp(amount * 1.75, 1, 20) * 10, .01, 500);
    const speed = length && mass > 0 ? force / mass * unit / 60 / length : 0;
    return { x: dx * speed, y: dy * speed };
  }
  function killHeal(kills, divider, maxHealth, random = Math.random) {
    divider++;
    if (kills % 7 === 0) divider = 1;
    return { divider, amount: maxHealth / divider * (1 + random() * .25) };
  }
  function stepPhysics(Matter, engine, step) {
    // Engine.update clears force/torque after EACH solve. A 50Hz controller's
    // continuous force must act during both 10ms substeps, not just the first.
    const forces = engine.world.bodies.filter((b) => !b.isStatic && (b.force.x || b.force.y || b.torque))
      .map((b) => ({ b, x:b.force.x, y:b.force.y, torque:b.torque }));
    Matter.Engine.update(engine, step / 2);
    for (const f of forces) { f.b.force.x += f.x; f.b.force.y += f.y; f.b.torque += f.torque; }
    Matter.Engine.update(engine, step / 2);
  }
  const api = Object.freeze({ insideDamageBounds, admit, relativeSpeed, impulse, killHeal, loadouts, weighted, jump, movementAnimation, stepPhysics });
  if (typeof window !== "undefined") window.GVYArenaCombat = api;
  else globalThis.GVYArenaCombat = api;
})();
