(() => {
  "use strict";
  const field = document.querySelector("[data-member-brawl-field]");
  if (!field) return;
  const terminal = field.closest(".member-brawl-terminal");
  const ui = (name) => document.querySelector("[data-arena-" + name + "]");
  const start = document.querySelector("[data-brawl-start]");
  const setup = document.querySelector("[data-brawl-start-panel]");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const host = window.frameElement?.closest("dialog");
  const STEP = 1000 / 50; // Original fixed physics clock; rendering interpolates independently.
  // Combat follows the recovered native rules; result presentation is local UI.
  const browserTuning = Object.freeze({ resultDuration: 8000 });
  const PALETTE = ["#72ffd2", "#ff8fc8", "#ffe276", "#f18191"];
  const sprites = {};
  let weapons, weaponIds, Motion, Actions, WeaponProfile, Rig, Feedback, Combat, effects;
  let R, M, P, store, engine, members = [], fighters = [], walls = [], platforms = [];
  let particles = [], projectiles = [], pickups = [], well;
  let phase = "setup", manuallyPaused = false, frame = 0, lastFrame = 0, accumulator = 0;
  let simTime = 0, hudDue = 0, checkpointDue = 0;
  let roundElapsed = 0, celebration = null;
  let width = 0, height = 0, radius = 20, round = 0, roundId = "", outcomeSerial = 0;
  let options, pendingResize = true, destroyed = false, resultRecorded = false;
  let resultsUntil = Infinity, hits = 0, resizeObserver, visibilityObserver;
  let modifierUntil = Infinity, modifierEnded = false;
  let previousTerrain = "", rotationBag = [];
  let terrainPoints = null, arenaExtents = null;
  let terrainVisible = true, terrainDue = Infinity, terrainHideAt = Infinity;
  let props = [], zones = [], eventDue = Infinity, sceneEvents = 0, propSerial = 0;
  const random = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let roundPool = 0, reserveDue = Infinity, reserveSide = 0;
  let touching = new Set(), previousTouching = new Set(), impacts = new Map();
  let readyQueue = [], pendingBatch = null, spawnDue = 0, batchTeam = 0;
  let feedEntries = [];
  const pixelsPerUnit = () => sceneUnit();
  const fighterUnit = () => sceneUnit() * (options?.modifier === "giant" ? 1.45 : 1);
  const cameraSize = () => options?.mode === "teams" ? 9 : clamp(6 + roundPool / 15, 6, 14);
  const standardGravity = () => 9.81 * sceneUnit() / 1000;
  const velocityUnits = (speed) => speed * sceneUnit() / 60;
  function sceneUnit() {
    const camera = cameraSize();
    // One scale for bodies, hands, weapons and maps. Count sets the round camera;
    // portrait windows crop distant map ends instead of shrinking every weapon
    // to a few pixels. Wide/short windows fit height, never stretch either axis.
    return Math.max(1, Math.min(height - 18, width - 32) / (camera * 2));
  }
  const position = (f) => f.body.position;
  const mayRun = () => !destroyed && phase !== "setup" && !manuallyPaused &&
    !document.hidden && (!host || host.open);

  function element(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function image(className, src, alt = "") {
    const e = element("img", className);
    e.src = src; e.alt = alt; e.draggable = false; e.decoding = "async";
    return e;
  }
  function failure(message) {
    ui("error").textContent = message;
    ui("error").hidden = false;
    start.disabled = true;
    start.hidden = false;
  }
  function configure() {
    const allowed = {
      mode: ["auto", "royale", "teams", "score", "classic"], loadout: ["random", "mirrored", "same", "unarmed"],
      terrain: ["random", "flat", "platforms", "default", "smallhill", "pit", "slope", "canyon", "terrain01", "terrain02"],
      modifier: ["none", "low-gravity", "zero-gravity", "gravity-well", "explosive", "inverted", "drop-items", "bouncy", "instakill", "fast", "slow", "giant"],
    };
    return Object.fromEntries(Object.entries(allowed).map(([k, values]) => {
      const value = ui(k)?.value;
      return [k, values.includes(value) ? value : values[0]];
    }));
  }
  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }
  function resolveOptions() {
    const next = configure();
    next.rotation = next.mode === "auto";
    if (next.rotation) {
      if (!rotationBag.length) rotationBag = shuffle(["teams", "royale", "score"]);
      next.mode = rotationBag.shift();
    }
    next.randomTerrain = next.terrain === "random";
    if (next.randomTerrain) {
      const weights = next.mode === "classic" ? P.maps.classicWeights : P.maps.teamWeights;
      next.terrain = weighted(Object.fromEntries(Object.entries(weights).filter(([id]) => id !== previousTerrain)));
    }
    previousTerrain = next.terrain;
    return next;
  }
  function weighted(weights) {
    const entries = Object.entries(weights);
    let draw = Math.random() * entries.reduce((sum, [, weight]) => sum + weight, 0);
    for (const [value, weight] of entries) { draw -= weight; if (draw < 0) return value; }
    return entries.at(-1)[0];
  }
  const respawns = () => options.mode === "classic" || options.mode === "score";
  const activeModifier = (id) => options.modifier === id && simTime < modifierUntil;
  const simulationRate = () => phase === "result" ? 1 : activeModifier("fast") ? 1.5 : activeModifier("slow") ? 0.6 : 1;
  function equip(f, id, existingWeapon) {
    effects?.stop(f);
    f.rig?.dispose();
    removeStaged(f);
    f.weaponId = weapons[id] ? id : "fists";
    f.weapon = weapons[f.weaponId];
    f.ammo = f.weapon.ammo; f.equippedAt = simTime;
    f.chip.dataset.weapon = f.weaponId;
    f.weaponImage.src = f.weapon.variants?.length ? weightedSprite(f.weapon.variants) : (f.weapon.sprite || sprites.hand);
    f.weaponImage.alt = f.weapon.name;
    f.hand.src = f.weapon.handSprite;
    f.weaponImage.hidden = f.weaponId === "fists" || !f.weapon.sprite;
    f.rig = Rig.create({ Matter: M, motion: Motion, world: engine.world, ownerBody: f.body,
      definition: f.weapon, handProfile: WeaponProfile.hand, unit: fighterUnit(), collisionGroup: f.body.collisionFilter.group, existingWeapon });
    for (const body of f.rig.bodies) for (const part of body.parts) { part.plugin.rigOwner = f; delete part.plugin.arenaProjectile; }
    f.rig.command({ inverse: f.inverse, equipProgress: 0 }); f.rig.reset({ ...position(f), aim: f.aim });
    f.collisionShapes = null; f.attack = null; f.itemActive = false;
  }
  function weightedSprite(variants) {
    let draw = random(0, variants.reduce((n, v) => n + v.weight, 0));
    for (const variant of variants) { draw -= variant.weight; if (draw <= 0) return variant.sprite; }
    return variants.at(-1).sprite;
  }
  function killBadge(className, title) {
    const badge = element("span", "fighter-kill-badge " + className);
    badge.append(image("", WeaponProfile.killBadge.sprite), element("b", "", "0"));
    badge.title = title; badge.hidden = true; return badge;
  }
  function makeFighter(member, index, loadout, slot, pool) {
    const chip = element("div", "member-fighter");
    chip.dataset.index = String(index); chip.setAttribute("role", "img");
    chip.setAttribute("aria-label", member.name);
    const name = element("span", "fighter-name", member.name);
    const avatar = element("span", "fighter-avatar-wrap");
    const portrait = image("", member.avatar);
    portrait.loading = "eager";
    avatar.append(portrait);
    const health = element("span", "health-bar");
    health.setAttribute("aria-hidden", "true");
    const healthTail = element("span", "health-tail"), healthFill = element("span", "health-fill");
    health.append(healthTail, healthFill);
    const hand = image("arena-hand", sprites.hand);
    const weaponImage = image("arena-weapon", sprites.sword);
    const lifeBadge = killBadge("fighter-life-kills", "本次出场击杀"), totalBadge = killBadge("fighter-total-kills", "当前浏览器累计击杀");
    const bowString = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    bowString.classList.add("arena-bow-string"); bowString.setAttribute("aria-hidden", "true");
    bowString.append(document.createElementNS(bowString.namespaceURI, "polyline"));
    chip.append(name, avatar, bowString, weaponImage, hand, health, lifeBadge, totalBadge);
    field.append(chip);
    const team = R.teamFor(slot, pool, options.mode);
    const color = options.mode === "teams" ? ["#9fcbff", "#f1a0a4"][team] : PALETTE[index % PALETTE.length];
    chip.style.setProperty("--team-color", color);
    const body = M.Bodies.circle(width / 2, -radius * 2, radius, {
      restitution: options.modifier === "bouncy" ? 0.92 : 0.275,
      friction: 0.375, frictionAir: 0, collisionFilter: { group: M.Body.nextGroup(true) },
    });
    const f = {
      id: index, member, handle: member.handle || "snapshot-" + index, name: member.name, team, chip, body,
      hand, weaponImage, bowString, lifeBadge, totalBadge, portrait, avatar, healthFill, healthTail,
      healthVisual: Feedback.health(), hitShake: null, itemActive: false,
      color, alive: false, life: 0, hp: 100, maxHp: 100, kills: 0, deaths: 0, streak: 0, bestStreak: 0,
      careerBase: store.read().find((record) => record.handle.toLowerCase() === (member.handle || "snapshot-" + index).toLowerCase())?.kills || 0,
      badgeAt: -Infinity, inverse: team === 1, desiredAim: team === 1 ? Math.PI : 0, targetId: null, targetDistance: 0,
      damageSources: new Map(), healDivider: 0, previousPose: null, rig: null, reserve: false,
      savedKills: 0, savedDeaths: 0, aim: team === 1 ? Math.PI : 0, attack: null, nextAttack: 0,
      groundedAt: -1000, hitUntil: 0, deathAt: -Infinity,
      nextDetect: 0, nextMovement: 0, bodyMovement: null, movementAction: null,
      previousPosition: null,
      jumpStrength: 9, attackCooldownRange: [.175, .55],
      attacks: 1, throwAfter: Infinity,
    };
    M.Body.setMass(body, WeaponProfile.hand.bodyMass);
    body.plugin.fighter = f; chip.physicsItem = f;
    f.initialLoadout = loadout; f.weaponId = loadout; f.weapon = weapons[loadout];
    f.chip.hidden = true;
    return f;
  }
  function spawn(f, initial = false) {
    const left = options.mode === "teams" ? f.team === 0 : Math.random() < 0.5;
    const mapLeft = arenaExtents?.left ?? 0, mapRight = arenaExtents?.right ?? width;
    const span = mapRight - mapLeft;
    const x = options.mode === "teams" ? mapLeft + span * (left ? random(0.12, 0.38) : random(0.62, 0.88)) :
      random(mapLeft + radius + 5, mapRight - radius - 5);
    const ceiling = Math.max(radius + 32, Math.min(height * 0.32, (arenaExtents?.top ?? height * 0.5) - radius * 2));
    M.Body.setPosition(f.body, { x, y: initial ? random(radius + 30, ceiling) : -radius });
    M.Body.setVelocity(f.body, { x: velocityUnits(random(-2, 2)), y: 0 });
    M.Body.setAngle(f.body, random(-0.15, 0.15));
    M.Body.setAngularVelocity(f.body, 0);
    M.Body.setStatic(f.body, false);
    f.life++; f.cueKey = {}; f.body.collisionFilter.group = M.Body.nextGroup(true);
    f.alive = true; f.reserve = false; f.hp = 100; f.streak = 0; f.healDivider = 0; f.attack = null; f.hitUntil = 0; f.damageSources.clear();
    f.healthVisual = Feedback.health(); f.hitShake = null; f.itemActive = false;
    f.healthFill.style.transform = f.healthTail.style.transform = "scaleX(1)";
    f.avatar.style.transform = "none";
    f.nextAttack = simTime + 1000; f.attacks = 1;
    f.throwAfter = Math.random() <= .35 ? Math.floor(random(3, 7)) : Infinity;
    f.nextMovement = simTime + random(600, 1600); f.nextDetect = simTime;
    f.bodyMovement = null; f.movementAction = null;
    const cooldown = random(1, 2.9);
    f.attackCooldownRange = [.175 * cooldown, .55 * cooldown]; f.jumpStrength = random(9, 16.2);
    f.jumpAwayChance = random(0, .11); f.flipChance = random(.2, .8);
    if (["bow", "fire", "superfire", "bomb"].includes(f.weaponId)) f.jumpAwayChance = random(.3, .67);
    f.chip.hidden = false;
    f.chip.classList.remove("is-dead", "is-hit", "is-attacking");
    M.Composite.add(engine.world, f.body);
    equip(f, f.weaponId || f.initialLoadout);
    f.previousPose = { ...position(f), angle: f.body.angle };
    delete f.body.plugin.contactVx; delete f.body.plugin.contactVy;
  }
  function updateClassicQueue() {
    if (!respawns() || simTime < spawnDue) return;
    if (!pendingBatch) {
      if (!readyQueue.length) { spawnDue = simTime + 100; return; }
      const requested = Math.min(Number(weighted({ 1:2900,2:83,3:56,4:32,8:14,12:5 })), Math.max(1, Math.floor(roundPool / 2)));
      const batch = [];
      while (batch.length < requested && readyQueue.length) batch.push(readyQueue.splice(Math.random() < .75 ? 0 : Math.floor(Math.random() * readyQueue.length), 1)[0]);
      pendingBatch = { batch, requested, team: ++batchTeam };
    }
    const pending = pendingBatch;
    if (fighters.filter((f) => f.alive).length + pending.batch.length > roundPool) { spawnDue = simTime + 100; return; }
    const f = pending.batch.shift();
    f.team = options.mode === "score" ? f.id : pending.team; f.color = PALETTE[f.team % PALETTE.length]; f.chip.style.setProperty("--team-color", f.color);
    f.weaponId = ["same", "mirrored"].includes(options.loadout) ? f.initialLoadout : Combat.loadouts(1, options.mode === "score" ? "teams" : "classic", options.loadout)[0];
    spawn(f);
    // One actor per fixed update; one randomized wait per original batch.
    if (pending.batch.length) spawnDue = simTime + STEP;
    else { spawnDue = simTime + random(.95, 1.15) * clamp(pending.requested, 1, 3) * .67 * .7 * 1000; pendingBatch = null; }
  }
  function makePlatform(x, y, w, h) {
    const body = M.Bodies.rectangle(x, y, w, h, { isStatic: true, friction: 0.6, label: "terrain" });
    const node = element("span", "arena-platform");
    Object.assign(node.style, { left: x - w / 2 + "px", top: y - h / 2 + "px", width: w + "px", height: h + "px" });
    field.prepend(node); platforms.push({ body, node });
    M.Composite.add(engine.world, body);
  }
  function buildContour() {
    if (!terrainPoints?.length) return;
    // Original terrain uses world Y=0 above a complete arena floor. Re-basing
    // every minimum to an isolated island made all shapes look like little hills.
    const scale = sceneUnit();
    const baseline = height - 18, offset = width / 2;
    const top = terrainPoints.map((p) => ({ x: offset + p.x * scale, y: baseline - p.y * scale }));
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("arena-terrain");
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    svg.setAttribute("aria-hidden", "true");
    Object.assign(svg.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none" });
    const svgNode = (tag, attributes = {}) => {
      const node = document.createElementNS(svg.namespaceURI, tag);
      for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
      return node;
    };
    const defs = svgNode("defs");
    const gradient = svgNode("linearGradient", { id: "arena-metal", x1: "0", y1: "0", x2: "0.15", y2: "1" });
    for (const [offset, color] of [["0%", "#304859"], ["16%", "#1c3041"], ["65%", "#0e1e2c"], ["100%", "#08131e"]]) {
      gradient.append(svgNode("stop", { offset, "stop-color": color }));
    }
    const pattern = svgNode("pattern", { id: "arena-panels", width: "100", height: "80", patternUnits: "userSpaceOnUse" });
    pattern.append(svgNode("path", { d: "M0 0H100V80 M0 80L100 0", fill: "none", stroke: "#6e9ab3", "stroke-opacity": ".12", "stroke-width": ".7" }));
    const clip = svgNode("clipPath", { id: "arena-above-floor" });
    clip.append(svgNode("rect", { x: "0", y: "0", width, height: baseline }));
    const polygon = svgNode("polygon");
    polygon.setAttribute("points", top.map((p) => p.x + "," + p.y).join(" "));
    polygon.setAttribute("fill", "url(#arena-metal)");
    const seams = polygon.cloneNode(); seams.setAttribute("fill", "url(#arena-panels)");
    const edge = svgNode("polyline", { points: polygon.getAttribute("points"), fill: "none", stroke: "#7da9bf", "stroke-width": "1.3", "stroke-linejoin": "round" });
    const mesh = svgNode("g", { "clip-path": "url(#arena-above-floor)" });
    mesh.append(polygon, seams, edge);
    defs.append(gradient, pattern, clip); svg.append(defs, mesh); field.prepend(svg);
    // Each vertical strip is convex, so Matter needs no extra decomposition
    // library. The same authoritative contour draws the mesh and its colliders.
    for (let i = 1; i < top.length; i++) {
      let a = top[i - 1], b = top[i];
      if (b.x - a.x < 0.01) continue;
      // Source endpoints can extend below world Y=0. Clip before finding the
      // centroid: a strip crossing the floor otherwise forms a bow-tie polygon.
      if (a.y >= baseline && b.y >= baseline) continue;
      if (a.y > baseline || b.y > baseline) {
        const crossing = { x: a.x + (b.x - a.x) * (baseline - a.y) / (b.y - a.y), y: baseline };
        if (a.y > baseline) a = crossing;
        else b = crossing;
      }
      const vertices = [a, b, { x: b.x, y: baseline }, { x: a.x, y: baseline }]
        .filter((p, j, points) => j === 0 || Math.hypot(p.x - points[j - 1].x, p.y - points[j - 1].y) > 0.01);
      if (vertices.length > 1 && Math.hypot(vertices[0].x - vertices.at(-1).x, vertices[0].y - vertices.at(-1).y) <= 0.01) vertices.pop();
      if (vertices.length < 3 || Math.max(baseline - a.y, baseline - b.y) < 0.1) continue;
      const centre = M.Vertices.centre(vertices);
      const body = M.Bodies.fromVertices(centre.x, centre.y, [vertices], {
        isStatic: true, friction: 0.375, restitution: 0.275, label: "terrain",
      });
      if (!body) continue;
      platforms.push({ body, node: svg }); M.Composite.add(engine.world, body);
    }
  }
  function buildTerrain() {
    for (const p of platforms) { M.Composite.remove(engine.world, p.body); p.node.remove(); }
    for (const b of walls) M.Composite.remove(engine.world, b);
    platforms = []; walls = [];
    const t = 100;
    walls.push(M.Bodies.rectangle(-t / 2, height / 2, t, height + t * 4, { isStatic: true }));
    walls.push(M.Bodies.rectangle(width + t / 2, height / 2, t, height + t * 4, { isStatic: true }));
    walls.push(M.Bodies.rectangle(width / 2, -t * 2, width + t * 2, t, { isStatic: true }));
    M.Composite.add(engine.world, walls);
    arenaExtents = { left: 0, right: width, top: height - 18 };
    makePlatform(width / 2, height - 9, width, 18);
    if (terrainVisible && terrainPoints) buildContour();
    if (options.terrain === "platforms") {
      const count = width < 600 ? 2 : 3;
      for (let i = 0; i < count; i++) {
        const x = width * ((i + 1) / (count + 1));
        const y = height * (i % 2 ? 0.40 : 0.67);
        makePlatform(x, y, width / (count + 2), 11);
      }
    }
    if (options.modifier === "gravity-well") {
      if (!well) { well = element("span", "arena-gravity-well"); field.append(well); }
      const size = Math.min(width, height) * 0.48;
      Object.assign(well.style, { left: (width - size) / 2 + "px", top: height * 0.40 - size / 2 + "px", width: size + "px", height: size + "px" });
    }
  }
  function surfaceAt(x, includeProps = false) {
    let surface = height - 18;
    for (const item of includeProps ? [...platforms, ...props] : platforms) {
      const vertices = item.body.vertices;
      for (let i = 0; i < vertices.length; i++) {
        const a = vertices[i], b = vertices[(i + 1) % vertices.length];
        if (Math.abs(b.x - a.x) < .001 || x < Math.min(a.x, b.x) || x > Math.max(a.x, b.x)) continue;
        surface = Math.min(surface, a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x));
      }
    }
    return surface;
  }
  function keepAboveTerrain(f) {
    const p = position(f);
    if (platforms.some((item) => M.Vertices.contains(item.body.vertices, p))) {
      M.Body.setPosition(f.body, { x: p.x, y: surfaceAt(p.x) - radius - 1 });
      M.Body.setVelocity(f.body, { x: f.body.velocity.x, y: Math.min(0, f.body.velocity.y) });
    }
  }
  function addCrate(x, y, size, health, mass) {
    if (props.length >= 36) return;
    const node = element("span", "arena-crate");
    node.setAttribute("aria-hidden", "true");
    const body = M.Bodies.rectangle(x, y, size, size, { friction: .6, restitution: .08, frictionAir: .008, label: "crate" });
    M.Body.setMass(body, mass);
    const crate = { id: ++propSerial, body, node, size, hp: health, maxHp: health };
    body.plugin.crate = crate; node.physicsItem = crate;
    field.append(node); props.push(crate); M.Composite.add(engine.world, body);
  }
  function removeCrate(crate) {
    const index = props.indexOf(crate);
    if (index < 0) return;
    M.Composite.remove(engine.world, crate.body); crate.node.remove(); props.splice(index, 1);
  }
  function damageCrate(crate, amount) {
    if (!Number.isFinite(amount) || amount <= 0 || !props.includes(crate)) return;
    crate.hp -= amount; crate.hitAt = simTime;
    if (crate.hp <= 0) {
      const p = crate.body.position; burst(p.x, p.y, "#a7b6c1", 4, 2);
      removeCrate(crate);
    }
  }
  function prepareScene() {
    if (!options.randomTerrain) return;
    if (options.mode === "teams") {
      eventDue = random(...P.maps.eventDelay);
      if (Math.random() < P.maps.initialBoxesChance) {
        const points = P.maps.boxGroups[Math.random() < .5 ? "3x3Boxes" : "3x9Boxes"];
        const unit = sceneUnit();
        for (const point of points) addCrate(width / 2 + point.x * unit,
          height - 18 - (point.y + 1.5) * unit,
          P.maps.groupBox.size * unit, P.maps.groupBox.health, P.maps.groupBox.mass);
        terrainDue = Math.floor(random(12, 20)) * 1000;
      }
    } else if (options.mode === "classic") {
      terrainDue = Math.floor(random(90, 145)) * 1000;
    }
  }
  function eventNode(type) {
    const names = { gravity: "引力奇点", heal: "治疗区域", jump: "跃升区域" };
    const node = element("span", type === "gravity" ? "arena-event-gravity" : "arena-" + type + "-zone");
    node.setAttribute("aria-hidden", "true");
    node.append(element("span", "arena-event-ring"), element("span", "arena-event-symbol"), element("small", "arena-event-label", names[type]));
    if (type === "gravity") node.append(element("span", "arena-accretion-disk"), element("span", "arena-singularity"));
    field.append(node); return node;
  }
  function medicalPickup() {
    const node = element("span", "arena-pickup arena-medical-pickup");
    node.setAttribute("aria-hidden", "true");
    node.append(image("arena-medical-icon", sprites.heal), element("span", "arena-medical-cross"));
    return node;
  }
  function addJumpZones() {
    const count = Math.max(2, Math.min(8, Math.floor(width / sceneUnit() / 1.35 / 3)));
    const all = Math.random() < .2, even = all || Math.random() < .9;
    for (let i = 0; i < count; i++) {
      if (zones.length >= 8) break;
      if (!all && (even ? i % 2 : Math.random() > .6)) continue;
      const x = width * (i + 1) / (count + 1), r = sceneUnit() * P.maps.jump.radius;
      const node = eventNode("jump");
      zones.push({ type: "jump", x, y: surfaceAt(x) - r * .3, r, node, contacts: new Set(), expires: simTime + P.maps.jump.duration });
    }
    announce("场地事件 · 跃升区域");
  }
  function addSceneGravity() {
    if (zones.length >= 8 || zones.some((zone) => zone.type === "gravity")) return;
    const node = eventNode("gravity");
    zones.push({ type: "gravity", x: random(width * .2, width * .8), y: height * .4,
      r: Math.min(width * .7, sceneUnit() * P.maps.gravity.radius), node,
      direction: random(-Math.PI, Math.PI), directionAt: simTime + P.maps.gravity.directionInterval,
      expires: simTime + random(...P.maps.gravity.duration) });
    announce("场地事件 · 游移引力场");
  }
  function sceneEvent() {
    const weights = { ...P.maps.eventWeights };
    if (zones.some((zone) => zone.type === "jump")) delete weights.JumpZones;
    if (zones.length >= 8 || zones.some((zone) => zone.type === "gravity")) delete weights.GravityWell;
    const type = weighted(weights); sceneEvents++;
    if (type === "JumpZones") addJumpZones();
    else if (type === "GravityWell") addSceneGravity();
    else if (type === "Boxes") {
      const count = Math.random() < .03 ? Math.floor(random(6, 9)) : 3;
      for (let i = 0; i < count; i++) {
        const config = P.maps.droppedBox;
        addCrate(random(radius * 2, width - radius * 2), -30 - i * 35, sceneUnit() * config.size, config.health, config.mass);
      }
      announce("场地事件 · 货箱投放");
    } else {
      const count = Math.random() < .03 ? Math.floor(random(7, 10)) : Math.floor(random(3, 6));
      for (let i = 0; i < count; i++) addPickup(random(radius * 2, width - radius * 2), -20 - i * 30);
      announce("场地事件 · 医疗补给");
    }
  }
  function updateScene(dt) {
    if (simTime >= terrainDue) {
      terrainDue = Infinity; terrainVisible = true; buildTerrain();
      for (const f of fighters) if (f.alive) keepAboveTerrain(f);
      for (const crate of props) if (platforms.some((item) => M.Vertices.contains(item.body.vertices, crate.body.position))) {
        M.Body.setPosition(crate.body, { x: crate.body.position.x, y: surfaceAt(crate.body.position.x) - crate.size / 2 - 1 });
      }
      if (options.mode === "classic") terrainHideAt = simTime + Math.floor(random(33, 63)) * 1000;
      announce("地形变化 · " + terrainLabel());
    }
    if (simTime >= terrainHideAt) { terrainHideAt = Infinity; terrainVisible = false;
      if (options.mode === "classic") terrainDue = simTime + Math.floor(random(140, 260)) * 1000;
      buildTerrain(); announce("地形变化 · 恢复开阔场地"); }
    if (simTime >= eventDue) { sceneEvent(); eventDue = simTime + random(...P.maps.eventDelay); }
    for (const crate of [...props]) if (crate.body.position.y > height + 160) removeCrate(crate);
    for (let i = zones.length - 1; i >= 0; i--) {
      const zone = zones[i];
      if (simTime >= zone.expires) { zone.node.remove(); zones.splice(i, 1); continue; }
      if (zone.type === "heal") {
        if (simTime >= zone.tickAt && zone.ticks < 21 && simTime <= zone.healUntil) {
          for (const f of fighters) if (f.alive && Math.hypot(position(f).x - zone.x, position(f).y - zone.y) <= zone.r + radius) heal(f, Math.floor(random(5, 14)));
          zone.ticks++; zone.tickAt += 300;
        }
        zone.node.style.opacity = simTime > zone.healUntil ? String(Math.max(0, (zone.expires - simTime) / 2000)) : "1";
      } else if (zone.type === "jump") {
        zone.y = surfaceAt(zone.x) - zone.r * .3;
        const inside = new Set();
        for (const f of fighters) if (f.alive && Math.hypot(position(f).x - zone.x, position(f).y - zone.y) < radius + zone.r) {
          inside.add(f.id);
          if (!zone.contacts.has(f.id)) M.Body.setVelocity(f.body, { x: f.body.velocity.x, y: -velocityUnits(Math.max(9, P.maps.jump.strength + 3)) });
        }
        zone.contacts = inside;
      } else {
        if (simTime >= zone.directionAt) { zone.direction = random(-Math.PI, Math.PI); zone.directionAt = simTime + P.maps.gravity.directionInterval; }
        zone.x = clamp(zone.x + Math.cos(zone.direction) * 70 * dt, 30, width - 30);
        zone.y = clamp(zone.y + Math.sin(zone.direction) * 70 * dt, 35, height - 45);
        for (const f of fighters) if (f.alive) {
          const p = position(f), d = Math.max(30, Math.hypot(zone.x - p.x, zone.y - p.y));
          if (d < zone.r) M.Body.applyForce(f.body, p, { x: (zone.x - p.x) / d * .0007 * f.body.mass, y: (zone.y - p.y) / d * .0007 * f.body.mass });
        }
      }
    }
  }
  function renderScene() {
    for (const crate of props) {
      const p = crate.body.position;
      crate.node.style.setProperty("--crate-hit", reduced ? "0" : String(Math.max(0, 1 - (simTime - (crate.hitAt ?? -Infinity)) / 220)));
      crate.node.classList.toggle("is-damaged", crate.hp < crate.maxHp * .5);
      Object.assign(crate.node.style, { width: crate.size + "px", height: crate.size + "px",
        transform: "translate(" + (p.x - crate.size / 2).toFixed(1) + "px," + (p.y - crate.size / 2).toFixed(1) + "px) rotate(" + crate.body.angle.toFixed(3) + "rad)" });
    }
    for (const zone of zones) {
      zone.node.style.setProperty("--event-unit", sceneUnit() + "px");
      zone.node.style.setProperty("--event-angle", (reduced ? 0 : simTime / 35).toFixed(2) + "deg");
      zone.node.style.setProperty("--event-pulse", reduced ? ".5" : String((Math.sin(simTime / 300) + 1) / 2));
      Object.assign(zone.node.style, { width: zone.r * 2 + "px", height: zone.r * 2 + "px",
        transform: "translate(" + (zone.x - zone.r).toFixed(1) + "px," + (zone.y - zone.r).toFixed(1) + "px)" });
    }
  }
  function terrainLabel() {
    return ({ default: "起伏山地", smallhill: "小山丘", pit: "盆地", canyon: "峡谷", slope: "斜坡", terrain01: "高台", terrain02: "山脊", flat: "平地", platforms: "悬浮平台" })[options.terrain];
  }
  function resize() {
    pendingResize = false;
    const box = field.getBoundingClientRect();
    const w = Math.max(120, box.width), h = Math.max(120, box.height);
    if (Math.abs(width - w) < 0.5 && Math.abs(height - h) < 0.5) return;
    const sx = width ? w / width : 1, sy = height ? h / height : 1;
    const oldRadius = radius;
    const oldFloor = height - 18, oldUnit = sceneUnit();
    const stagedOffsets = new Map(projectiles.filter((p) => p.staged && p.constraint).map((p) => [p,
      { x: p.body.position.x - p.constraint.bodyA.position.x, y: p.body.position.y - p.constraint.bodyA.position.y }]));
    const groundGaps = fighters.map((f) => surfaceAt(position(f).x, true) - position(f).y - oldRadius);
    width = w; height = h;
    effects?.resize(w, h, sx, sy, sceneUnit() / oldUnit, window.devicePixelRatio || 1);
    radius = WeaponProfile.bodyDiameter * fighterUnit() / 2;
    field.style.setProperty("--fighter-size", radius * 2 + "px");
    for (const f of fighters) {
      M.Body.scale(f.body, radius / oldRadius, radius / oldRadius);
      M.Body.setPosition(f.body, { x: clamp(position(f).x * sx, radius + 1, width - radius - 1),
        y: Math.min(height - radius - 18, position(f).y * sy) });
      if (!f.body.isStatic) M.Body.setMass(f.body, WeaponProfile.hand.bodyMass);
      f.rig?.resize(fighterUnit(), () => ({ ...position(f) }));
      f.collisionShapes = null;
      f.previousPose = { ...position(f), angle: f.body.angle };
    }
    for (const p of projectiles) {
      const ratio = sceneUnit() / oldUnit;
      if (p.body) {
        const mass = p.body.mass;
        M.Body.scale(p.body, ratio, ratio); M.Body.setMass(p.body, mass);
        M.Body.setPosition(p.body, { x: p.body.position.x * sx, y: p.body.position.y * sy });
        M.Body.setVelocity(p.body, { x: p.body.velocity.x * ratio, y: p.body.velocity.y * ratio });
        if (p.originOffset) { p.originOffset.x *= ratio; p.originOffset.y *= ratio; }
        // The detach token shares originOffset. Its unit must follow this one
        // physical resize, or a subsequent pickup would scale the body twice.
        if (p.detached) p.detached.unit = fighterUnit();
        for (const constraint of p.constraints || []) for (const point of [constraint.pointA, constraint.pointB]) {
          point.x *= ratio; point.y *= ratio;
        }
      }
      p.x *= sx; p.y *= sy; p.radius *= ratio; p.displayWidth *= ratio; p.displayHeight *= ratio;
      p.node.style.width = p.displayWidth + "px"; p.node.style.height = p.displayHeight + "px";
    }
    for (const p of particles) { p.x *= sx; p.y *= sy; }
    for (const p of pickups) {
      const ratio = sceneUnit() / oldUnit;
      p.x *= sx; p.y *= sy; p.radius *= ratio; p.vy *= ratio; p.displayWidth *= ratio; p.displayHeight *= ratio;
      p.node.style.width = p.displayWidth + "px"; p.node.style.height = p.displayHeight + "px";
    }
    for (const crate of props) {
      const ratio = sceneUnit() / oldUnit, p = { ...crate.body.position };
      M.Body.scale(crate.body, ratio, ratio); crate.size *= ratio;
      M.Body.setPosition(crate.body, { x: p.x * sx, y: height - 18 + (p.y - oldFloor) * ratio });
    }
    for (const zone of zones) { zone.x *= sx; zone.y *= sy; zone.r *= sceneUnit() / oldUnit; }
    if (celebration) for (const p of celebration.pieces) { p.x *= sx; p.drift *= sx; }
    if (engine) buildTerrain();
    for (const [i, f] of fighters.entries()) {
      if (Math.abs(groundGaps[i]) < oldRadius * .8 && f.body.velocity.y >= -1) {
        M.Body.setPosition(f.body, { x: position(f).x, y: surfaceAt(position(f).x, true) - radius - Math.max(0, groundGaps[i]) * sy });
      } else keepAboveTerrain(f);
    }
    for (const f of fighters) {
      if (f.rig) f.rig.resize(fighterUnit(), () => ({ ...position(f) }));
      f.previousPose = { ...position(f), angle: f.body.angle };
    }
    for (const [p, offset] of stagedOffsets) {
      const parent = p.constraint.bodyA, ratio = sceneUnit() / oldUnit;
      M.Body.setPosition(p.body, { x: parent.position.x + offset.x * ratio, y: parent.position.y + offset.y * ratio });
      p.x = p.body.position.x; p.y = p.body.position.y; p.previous = { ...p.body.position };
    }
    if (engine) engine.gravity.y = activeModifier("zero-gravity") ? 0 : standardGravity() * (activeModifier("low-gravity") ? 1 / 6 : 1);
    render();
  }
  function nearest(f) {
    let closest = null, distance = Infinity;
    for (const other of fighters) {
      if (!R.isEnemy(f, other)) continue;
      const a = position(f), b = position(other), d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < distance) { distance = d; closest = other; }
    }
    return closest && { fighter: closest, distance };
  }
  function beginAttack(f, target, throwing = false) {
    const list = f.weapon.animations;
    const animation = throwing ? f.weapon.throwAnimation : list[Math.floor(random(0, list.length))];
    const timeline = animation ? Actions.compile(animation, Motion, WeaponProfile.hand.idlePosition) : null;
    f.attack = { start: simTime, aim: f.aim, inverse: f.inverse, fired: false,
      timeline, animation, throwing, duration: timeline?.duration || .625, target: { ...position(target.fighter) }, targetId: target.fighter.id };
    // Native timers start with the attack, concurrently with the hand animation.
    // The next stroke requires both its timer and visible path to be complete.
    f.nextAttack = simTime + Actions.attackCooldown(f.weapon, f.attackCooldownRange, animation,
      throwing ? "throw" : f.weaponId) * 1000;
    f.attacks++;
    if (throwing) f.attacks = 0;
    f.chip.classList.add("is-attacking");
    if (["fire", "superfire", "bomb"].includes(f.weaponId)) stageThrowable(f);
  }
  function updateAI(f) {
    if (!f.alive || f.attack || f.movementAction) return;
    if (simTime >= f.nextDetect) {
      const target = nearest(f); f.targetId = target?.fighter.id ?? null;
      f.nextDetect = simTime + random(1350, 2350);
    }
    const target = fighters.find((other) => other.id === f.targetId && other.alive);
    const a = position(f), b = target ? position(target) : a;
    f.targetDistance = target ? Math.hypot(b.x - a.x, b.y - a.y) : Infinity;
    if (target) f.desiredAim = Math.atan2(b.y - a.y, b.x - a.x);
    if (f.bodyMovement || simTime < f.nextMovement) return;
    if (f.weaponId === "fists" && Math.random() > .925) {
      const animation = Combat.movementAnimation, timeline = Actions.compile(animation, Motion, WeaponProfile.hand.idlePosition);
      f.movementAction = { start: simTime, aim: f.aim, inverse: f.inverse, animation, timeline,
        duration: timeline.duration, target: { ...b } };
      f.nextMovement = simTime + (timeline.cooldown + random(1.72, 2.65)) * 1000;
    } else {
      f.bodyMovement = { start: simTime, launched: false };
      f.nextMovement = simTime + random(1720, 2650);
    }
  }
  function updateBodyMovement(f) {
    const move = f.bodyMovement;
    if (!move) return;
    const elapsed = simTime - move.start;
    if (!move.launched && elapsed >= 800) {
      move.launched = true;
      const target = fighters.find((other) => other.id === f.targetId && other.alive), p = position(f), q = target ? position(target) : p;
      const jump = Combat.jump({ strength: f.jumpStrength, awayChance: f.jumpAwayChance, flipChance: f.flipChance,
        health: f.hp, maxHealth: f.maxHp, inverse: f.inverse, dx: q.x - p.x, dy: q.y - p.y, zeroGravity: engine.gravity.y === 0 });
      if (!f.body.isStatic) {
        M.Body.setVelocity(f.body, { x: f.body.velocity.x + velocityUnits(jump.x), y: f.body.velocity.y + velocityUnits(jump.y) });
        M.Body.setAngularVelocity(f.body, f.body.angularVelocity - jump.torque / (f.body.inertia / sceneUnit() ** 2) / 60);
      }
    }
    if (elapsed >= 975) f.bodyMovement = null;
  }
  function attemptAttack(f) {
    if (!f.alive || f.attack || f.movementAction || simTime < f.nextAttack) return;
    const other = fighters.find((candidate) => candidate.id === f.targetId);
    if (!R.isEnemy(f, other)) return;
    const a = position(f), b = position(other), distance = Math.hypot(b.x - a.x, b.y - a.y);
    const throwing = f.attacks >= f.throwAfter && f.weaponId !== "fists" && f.weapon.canBeThrown && distance > sceneUnit() * 7;
    const speed = Math.hypot(f.body.velocity.x, f.body.velocity.y) * 60 / sceneUnit();
    const reach = WeaponProfile.hand.length + f.weapon.stats.itemReach + speed * .25;
    if (!throwing && distance >= sceneUnit() * reach) return;
    // Source mask 4352 includes body12/crate8/bomb8, but excludes terrain0,
    // boundaries13, weapons6, physical fists0 and arrows/fireballs7. The owner
    // and target remain in the result, once per source collider, including starts.
    const obstacleHits = throwing || f.weaponId === "fists" ? 0 : M.Query.ray([
      ...fighters.filter((entry) => entry.alive).map((entry) => entry.body),
      ...props.map((entry) => entry.body), ...projectiles.filter((entry) => entry.kind === "bomb").map((entry) => entry.body)
    ], a, b).length + pickups.filter((entry) => !entry.weaponId &&
      R.distanceToSegment(entry.x, entry.y, a.x, a.y, b.x, b.y) <= entry.radius).length;
    if (!throwing && obstacleHits >= 3) {
      f.nextAttack = simTime + 300; f.attacks++; return;
    }
    beginAttack(f, { fighter: other, distance }, throwing);
  }
  function commandHand(f) {
    if (!f.rig) return;
    const attack = f.attack || f.movementAction;
    const enemy = fighters.find((entry) => entry.id === (attack?.targetId ?? f.targetId) && entry.alive);
    const lookTarget = enemy ? position(enemy) : attack?.target;
    if (enemy && attack) attack.target = { ...lookTarget };
    // Native animator re-reads GetTargetAngle on every update. Freeze the
    // inverse flag during an action, not its aim while the weapon follows a
    // different live target. Both commands share this tick's target point.
    const aim = lookTarget ? Math.atan2(lookTarget.y - position(f).y, lookTarget.x - position(f).x) : (attack?.aim ?? f.desiredAim);
    f.aim = aim;
    if (!attack) {
      if (Math.cos(aim) < -.2) f.inverse = true;
      else if (Math.cos(aim) > .2) f.inverse = false;
    }
    const inverse = attack?.inverse ?? f.inverse;
    if (enemy) f.targetDistance = Math.hypot(lookTarget.x - position(f).x, lookTarget.y - position(f).y);
    const targetDistance = Number.isFinite(f.targetDistance) ? Math.max(sceneUnit(), f.targetDistance) : sceneUnit() * 10;
    const elapsed = attack ? (simTime - attack.start) / 1000 : 0;
    const sample = attack?.timeline ? Actions.sample(attack.timeline, elapsed, Motion) : null;
    f.itemActive = Boolean(sample?.active);
    const local = sample?.target || WeaponProfile.hand.idlePosition;
    f.rig.command({ target: Actions.worldTarget(local, position(f), fighterUnit(), aim, inverse, attack?.animation),
      aim, inverse, equipProgress: clamp((simTime - f.equippedAt) / 150, 0, 1),
      animating: Boolean(attack), lockRotationToAngle: Boolean(attack?.animation?.lockRotationToAngle),
      pointingAt: f.weaponId === "bow" || ["fire", "superfire", "bomb"].includes(f.weaponId),
      targetDistance, lookTarget: lookTarget || {
        x: position(f).x + Math.cos(aim) * targetDistance,
        y: position(f).y + Math.sin(aim) * targetDistance } });
    if (!attack) return;
    // Native AI releases bows/Thrower after .525s; physical item throws detach
    // the original body .55s into their throw sequence.
    const release = attack.throwing ? .55 : f.weapon.actionTime?.[1] || .525;
    if (!attack.fired && elapsed + 1e-7 >= release) {
      if (attack.throwing) { throwWeapon(f); equip(f, "fists"); }
      else if (f.weaponId === "bow") fireArrow(f, Actions.bowPull(release));
      else if (f.staged) releaseThrowable(f);
      attack.fired = true;
    }
  }
  function finishAttack(f) {
    if (f.movementAction && simTime - f.movementAction.start >= f.movementAction.duration * 1000) f.movementAction = null;
    const attack = f.attack;
    if (!attack || simTime - attack.start < attack.duration * 1000) return;
    f.attack = null; f.itemActive = false; f.chip.classList.remove("is-attacking");
    if (attack.throwing || f.ammo === 0) equip(f, "fists");
  }
  function updateReserves() {
    if (options.mode !== "teams" || simTime < reserveDue) return;
    const side = reserveSide, own = fighters.filter((f) => f.alive && f.team === side).length;
    const opposite = fighters.filter((f) => f.alive && f.team !== side).length;
    const waiting = fighters.filter((f) => f.reserve && f.team === side);
    let count = own < opposite ? Math.min(waiting.length, Math.floor(random(2, 8))) : 0;
    if (count && waiting.length < 4) count = waiting.length;
    for (const f of waiting.slice(0, count)) spawn(f, true);
    if (count) announce((side ? "红" : "蓝") + "队增援 · " + count + " 人入场");
    reserveSide = 1 - side; reserveDue = simTime + (count ? 5000 : 1000);
    // If both sides are eliminated with reserves still available, release a
    // matched pair rather than leaving an empty arena until the round time cap.
    if (!own && !opposite && !count) {
      for (const team of [0, 1]) { const f = fighters.find((entry) => entry.reserve && entry.team === team); if (f) spawn(f, true); }
    }
  }
  function captureShapes(body) {
    if (!body) return null;
    const parts = body.parts.length > 1 ? body.parts.slice(1) : [body];
    return { body, velocity: { ...body.velocity }, angularVelocity: body.angularVelocity,
      position: { ...body.position }, parts: parts.map((part) => ({ circle: part.circleRadius || 0,
        center: { ...part.position }, vertices: part.vertices.map(({ x, y }) => ({ x, y })) })) };
  }
  const contactKey = (body, target) => body.id + ":" + target.id;
  function physicalHit(owner, body, stats, target, contact, prior, entered = false) {
    if (!stats?.collisionDamage || (!target.plugin.fighter?.alive && !target.plugin.crate)) return;
    const key = contactKey(body, target);
    if ((!entered && previousTouching.has(key)) || impacts.has(key)) return;
    const projectile = body.plugin.arenaProjectile;
    const active = projectile?.kind === "weapon" ? !projectile.staged : Boolean(owner?.itemActive);
    impacts.set(key, { owner: projectile?.kind === "weapon" ? null : owner, body, target, stats, active,
      contact: { x: contact.x, y: contact.y }, rig: owner?.rig, projectile,
      weaponId: projectile?.weaponId || owner?.weaponId,
      a: { x: body.plugin.contactVx ?? prior?.velocity.x ?? body.velocity.x, y: body.plugin.contactVy ?? prior?.velocity.y ?? body.velocity.y },
      b: { x: target.plugin.contactVx ?? target.velocity.x, y: target.plugin.contactVy ?? target.velocity.y } });
  }
  function applyImpacts() {
    for (const hit of impacts.values()) {
      if (!hit.active) continue;
      const fighter = hit.target.plugin.fighter, crate = hit.target.plugin.crate;
      if (fighter && !fighter.alive || crate && !props.includes(crate)) continue;
      const pose = hit.rig?.pose(), p = hit.projectile;
      const origin = p ? Motion.localToWorld(p.originOffset, p.body.position, p.body.angle) : pose?.origin;
      if (origin) origin.angle = p ? p.body.angle : pose.origin.angle;
      if (origin && !Combat.insideDamageBounds(hit.weaponId, hit.contact, origin, fighterUnit(), p?.scaleX || pose?.scaleX || 1, p?.scaleY || pose?.scaleY || 1)) continue;
      const result = {};
      const amount = R.physicalDamage(hit.stats, Combat.relativeSpeed(hit.a, hit.b, pixelsPerUnit()), Math.random, result);
      if (amount <= 0) continue;
      if (fighter) damage(hit.owner, fighter, amount, hit.contact, hit.body, result.critical);
      else if (crate) damageCrate(crate, amount);
    }
  }
  function shapeHits(previous, current, target, r, targetPrevious) {
    if (!previous || !current) return null;
    const tx = target.x - targetPrevious.x, ty = target.y - targetPrevious.y;
    for (let i = 0; i < current.parts.length; i++) {
      const now = current.parts[i], old = previous.parts[i];
      if (!old) continue;
      if (now.circle) {
        if (R.sweptCircleHit({ x: old.center.x - targetPrevious.x, y: old.center.y - targetPrevious.y },
          { x: now.center.x - target.x, y: now.center.y - target.y }, { x: 0, y: 0 }, r + now.circle) !== null) return now.center;
        continue;
      }
      if (M.Vertices.contains(now.vertices, target)) return target;
      for (let j = 0; j < now.vertices.length; j++) {
        const a = now.vertices[j], b = now.vertices[(j + 1) % now.vertices.length], before = old.vertices[j];
        if (R.distanceToSegment(target.x, target.y, a.x, a.y, b.x, b.y) <= r) return a;
        if (before && R.sweptCircleHit({ x: before.x - targetPrevious.x, y: before.y - targetPrevious.y },
          { x: a.x - target.x, y: a.y - target.y }, { x: 0, y: 0 }, r) !== null) return a;
        // Swept edge quad catches an edge crossing the circle even when neither
        // endpoint passes inside it. Work in the target's current moving frame.
        const oldB = old.vertices[(j + 1) % old.vertices.length];
        if (before && oldB) {
          const quad = [{ x: before.x + tx, y: before.y + ty }, { x: oldB.x + tx, y: oldB.y + ty }, b, a];
          if (pointInside(target, quad)) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        }
      }
    }
    return null;
  }
  function pointInside(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j];
      if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }
  function physicalContacts(f) {
    const body = f.rig?.weaponBody || f.rig?.fistBody;
    if (!body || !f.itemActive || !f.weapon.stats.collisionDamage) return;
    const previous = f.collisionShapes, current = captureShapes(body);
    if (!previous) return;
    const reach = fighterUnit() * 5;
    for (const target of fighters) {
      if (!target.alive || target.id === f.id || Math.hypot(position(target).x - position(f).x, position(target).y - position(f).y) > reach) continue;
      const contact = shapeHits(previous, current, position(target), target.body.circleRadius, target.previousPosition || position(target));
      if (contact) physicalHit(f, body, f.weapon.stats, target.body, contact, previous);
    }
    for (const crate of [...props]) {
      if (Math.hypot(crate.body.position.x - body.position.x, crate.body.position.y - body.position.y) > reach + crate.size) continue;
      const contact = shapeHits(previous, current, crate.body.position, crate.size * .6, crate.body.position);
      if (contact) physicalHit(f, body, f.weapon.stats, crate.body, contact, previous);
    }
  }
  function projectileNode(kind, definition) {
    const node = definition.sprite ? image("arena-projectile", definition.sprite) : element("span", "arena-projectile arena-fire-orb");
    if (kind === "superfire") node.classList.add("is-superfire");
    return node;
  }
  function addProjectile(kind, owner, body, originOffset = { x: 0, y: 0 }, extra = {}) {
    if (projectiles.length >= 96) { M.Composite.remove(engine.world, body); return null; }
    const def = kind === "weapon" ? owner.weapon : WeaponProfile.projectiles[kind], unit = fighterUnit();
    const p = { body, kind, owner, ownerLife: owner.life, ownerTeam: owner.team, definition: def, stats: def.stats, originOffset,
      x: body.position.x, y: body.position.y, previous: { ...body.position }, born: simTime,
      radius: (kind === "arrow" ? .05 : kind === "weapon" ? .1 : .3) * unit,
      expires: simTime + (kind === "weapon" ? 18000 : kind === "bomb" ? 3000 : 6000),
      displayWidth: (def.width || .6) * unit, displayHeight: (def.height || .6) * unit, ...extra };
    p.node = projectileNode(kind, def);
    Object.assign(p.node.style, { width: p.displayWidth + "px", height: p.displayHeight + "px", transformOrigin: "50% 50%" });
    if (kind === "weapon") p.node.src = owner.weaponImage.src;
    for (const part of body.parts) part.plugin.arenaProjectile = p;
    p.node.physicsItem = p;
    field.append(p.node); projectiles.push(p); return p;
  }
  function removeProjectile(p) {
    for (const constraint of p.constraints || []) M.Composite.remove(engine.world, constraint);
    if (p.body) M.Composite.remove(engine.world, p.body);
    p.node.remove(); const index = projectiles.indexOf(p); if (index >= 0) projectiles.splice(index, 1);
    if (p.owner?.staged === p) p.owner.staged = null;
  }
  function removeStaged(f) { if (f.staged) removeProjectile(f.staged); f.staged = null; }
  function stageThrowable(f) {
    if (!f.rig?.weaponBody || projectiles.length >= 96) return;
    const def = WeaponProfile.projectiles[f.weaponId], anchor = f.rig.pose().origin, unit = fighterUnit();
    const collider = def.colliders[0], offset = { x: collider.center.x * unit, y: -collider.center.y * unit };
    const at = Motion.localToWorld(offset, anchor, anchor.angle);
    const body = M.Bodies.circle(at.x, at.y, collider.radius * unit, { frictionAir: 0, restitution: .275,
      collisionFilter: { group: f.body.collisionFilter.group, category: 2, mask: 0 } });
    M.Body.setMass(body, def.mass); M.Body.setAngle(body, anchor.angle);
    M.Body.setVelocity(body, f.rig.weaponBody.velocity); M.Body.setAngularVelocity(body, f.rig.weaponBody.angularVelocity);
    M.Composite.add(engine.world, body);
    const constraint = M.Constraint.create({ bodyA: f.rig.weaponBody, bodyB: body,
      pointA: { x: body.position.x - f.rig.weaponBody.position.x, y: body.position.y - f.rig.weaponBody.position.y },
      length: 0, stiffness: 1, damping: .1 });
    // Two separated pin constraints reproduce a fixed joint's angular lock.
    // Neither the weapon PID angle nor the held charge is hard-set each frame.
    const axis = { x: Math.cos(anchor.angle) * unit * .2, y: Math.sin(anchor.angle) * unit * .2 };
    const angularLock = M.Constraint.create({ bodyA: f.rig.weaponBody, bodyB: body,
      pointA: { x: constraint.pointA.x + axis.x, y: constraint.pointA.y + axis.y }, pointB: axis,
      length: 0, stiffness: 1, damping: .1 });
    M.Composite.add(engine.world, [constraint, angularLock]);
    f.staged = addProjectile(f.weaponId, f, body, { x: -offset.x, y: -offset.y },
      { staged: true, expires: Infinity, constraint, constraints: [constraint, angularLock] });
  }
  function releaseThrowable(f) {
    const p = f.staged; if (!p) return;
    for (const constraint of p.constraints || []) M.Composite.remove(engine.world, constraint);
    p.constraints = []; p.constraint = null; p.staged = false; p.born = simTime;
    for (const part of p.body.parts) part.collisionFilter.mask = 0xffffffff;
    p.expires = simTime + (p.kind === "bomb" ? 3000 : 6000);
    // Release retains the actual staged body's velocity from its fixed joint.
    // It does not add a guessed muzzle speed or spawn a copy of a weapon icon.
    p.previous = { ...p.body.position }; f.staged = null;
    if (f.ammo > 0) f.ammo--;
  }
  function fireArrow(f, pull) {
    if (!f.rig?.weaponBody || projectiles.length >= 96) return;
    const def = WeaponProfile.projectiles.arrow, origin = f.rig.pose().origin, unit = fighterUnit();
    const heading = origin.angle, center = Motion.localToWorld({ x: .25 * unit, y: 0 }, origin, heading);
    const body = M.Bodies.rectangle(center.x, center.y, 1.05 * unit, .1 * unit, { isSensor: true, frictionAir: 0,
      chamfer: { radius: .05 * unit }, collisionFilter: { group: f.body.collisionFilter.group, category: 2, mask: 0 } });
    M.Body.setAngle(body, heading); M.Body.setMass(body, def.mass);
    // Native impulse is pull*30 and arrow mass is .75. Matter stores base-frame
    // velocity, so convert the resulting world units/second once at this boundary.
    const speed = pull * 30 / def.mass * unit;
    M.Body.setVelocity(body, { x: body.velocity.x + Math.cos(heading) * speed / 60,
      y: body.velocity.y + Math.sin(heading) * speed / 60 });
    M.Composite.add(engine.world, body); addProjectile("arrow", f, body, { x: -.25 * unit, y: 0 });
  }
  function throwWeapon(f) {
    if (projectiles.length >= 96) return;
    const detached = f.rig?.detachWeapon(); if (!detached) return;
    M.Body.setAngularVelocity(detached.body, detached.body.angularVelocity * .45);
    const p = addProjectile("weapon", f, detached.body, detached.originOffset,
      { detached, weaponId: f.weaponId, scaleX: detached.scaleX, scaleY: detached.scaleY });
    for (const part of detached.body.parts) delete part.plugin.rigOwner;
    if (p) p.node.src = f.weaponImage.src;
    f.weaponImage.hidden = true;
  }
  function explode(p) {
    const def = p.definition, reach = def ? def.explosionRadius * sceneUnit() : p.reach || sceneUnit() * 3;
    const maxDamage = def?.stats.maxDamage || p.damage || 24;
    for (const f of fighters) {
      if (!f.alive) continue;
      const q = position(f), d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d >= reach) continue;
      // Native radial damage is independent of melee velocity/crit thresholds.
      damage(null, f, maxDamage / clamp(d / sceneUnit(), 1, 10), q, null);
      const strength = def?.explosionStrength || 5, scale = d > 0 ? velocityUnits(strength) / d : 0;
      M.Body.setVelocity(f.body, { x: f.body.velocity.x + (q.x - p.x) * scale, y: f.body.velocity.y + (q.y - p.y) * scale });
    }
    for (const crate of [...props]) {
      const d = Math.hypot(crate.body.position.x - p.x, crate.body.position.y - p.y);
      if (d < reach) damageCrate(crate, maxDamage / clamp(d / sceneUnit(), 1, 10));
    }
    burst(p.x, p.y, "#edb67a", 14, reach * .025);
  }
  function sweepTerrain(from, to) {
    let earliest = Infinity, hitCrate = null;
    for (const terrain of [...platforms, ...props]) {
      const vertices = terrain.body.vertices;
      if (M.Vertices.contains(vertices, from)) return { time: 0, crate: terrain.body.plugin.crate };
      const rx = to.x - from.x, ry = to.y - from.y;
      for (let edge = 0; edge < vertices.length; edge++) {
        const a = vertices[edge], b = vertices[(edge + 1) % vertices.length];
        const sx = b.x - a.x, sy = b.y - a.y, cross = rx * sy - ry * sx;
        if (Math.abs(cross) < 1e-9) continue;
        const qx = a.x - from.x, qy = a.y - from.y;
        const t = (qx * sy - qy * sx) / cross, u = (qx * ry - qy * rx) / cross;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1 && t < earliest) { earliest = t; hitCrate = terrain.body.plugin.crate; }
      }
    }
    return { time: earliest, crate: hitCrate };
  }
  function updateProjectiles() {
    for (const p of [...projectiles]) {
      if (p.staged) continue;
      const from = p.previous, current = p.body.position;
      p.x = current.x; p.y = current.y;
      if (simTime - p.born >= 200 && p.kind !== "arrow") for (const part of p.body.parts) part.collisionFilter.group = 0;
      const wall = sweepTerrain(from, current);
      let earliest = Infinity, hit;
      if (p.kind !== "bomb") for (const f of fighters) {
        if (!f.alive || f.id === p.owner.id && f.life === p.ownerLife && (p.kind === "arrow" || simTime - p.born < 200)) continue;
        const previous = f.previousPosition || position(f), q = position(f);
        const t = R.sweptCircleHit({ x: from.x - previous.x, y: from.y - previous.y },
          { x: current.x - q.x, y: current.y - q.y }, { x: 0, y: 0 }, f.body.circleRadius + p.radius);
        if (t !== null && t < earliest) { earliest = t; hit = f; }
      }
      let remove = simTime >= p.expires || p.x < -sceneUnit() * 6 || p.x > width + sceneUnit() * 6 || p.y > height + sceneUnit() * 8;
      if (p.kind === "weapon") {
        // The detached original solid body keeps colliding with scenery. Its
        // original profile and current point velocity still determine damage.
        const currentShape = captureShapes(p.body);
        for (const f of fighters) if (f.alive && (f.id !== p.owner.id || f.life !== p.ownerLife || simTime - p.born >= 200) &&
          Math.hypot(position(f).x - p.x, position(f).y - p.y) < sceneUnit() * 5) {
          const contact = shapeHits(p.previousShapes, currentShape, position(f), f.body.circleRadius, f.previousPosition || position(f));
          if (contact) physicalHit(p.owner, p.body, p.stats, f.body, contact, p.previousShapes);
        }
        for (const f of fighters) if (f.alive && f.weaponId === "fists" && f.attack && simTime - p.born > 700 &&
          Math.hypot(f.rig.fistBody.position.x - p.x, f.rig.fistBody.position.y - p.y) < sceneUnit() * .7) {
          const detached = p.detached; p.node.remove(); projectiles.splice(projectiles.indexOf(p), 1);
          equip(f, p.weaponId, detached); remove = false; break;
        }
      } else if (p.kind !== "bomb" && (hit && earliest <= wall.time || wall.time < Infinity || p.collided)) {
        const t = hit && earliest <= wall.time ? earliest : wall.time;
        if (Number.isFinite(t)) { p.x = from.x + (current.x - from.x) * t; p.y = from.y + (current.y - from.y) * t; }
        if (p.kind === "arrow") {
          const speed = Combat.relativeSpeed({ x: p.body.plugin.contactVx ?? p.body.velocity.x, y: p.body.plugin.contactVy ?? p.body.velocity.y },
            hit ? { x: hit.body.plugin.contactVx ?? hit.body.velocity.x, y: hit.body.plugin.contactVy ?? hit.body.velocity.y } : { x: 0, y: 0 }, sceneUnit());
          const result = {}, amount = R.physicalDamage(p.stats, speed, Math.random, result);
          if (hit && earliest <= wall.time && amount > 0) damage(p.owner, hit, amount, { x: p.x, y: p.y }, p.body, result.critical);
          else if (wall.crate) damageCrate(wall.crate, amount);
        } else explode(p);
        remove = true;
      }
      if (remove) { if (p.kind === "bomb" && phase === "running" && simTime >= p.expires) explode(p); removeProjectile(p); }
      else p.previous = { ...current };
    }
  }
  function burst(x, y, color, count = 5, speed = 3) {
    if (reduced) return;
    for (let n = 0; n < count && particles.length < 100; n++) {
      const node = element("span", "arena-particle");
      Object.assign(node.style, { width: "4px", height: "4px", background: color });
      field.append(node); particles.push({ node, x, y, vx: random(-speed, speed), vy: random(-speed, 0), expires: simTime + random(250, 650) });
    }
  }
  function heal(f, amount) {
    const before = f.hp; f.hp = Math.min(f.maxHp, f.hp + amount);
    if (f.alive && f.hp > before) effects?.notify("heal", f.cueKey, position(f).x, position(f).y - radius, f.hp - before, simTime);
  }
  function damage(attacker, target, amount, point, source, critical = false) {
    if (phase !== "running" || !target.alive || !Combat.admit(target.damageSources, source, simTime)) return;
    const projectile = source?.plugin.arenaProjectile;
    const creditLife = projectile?.owner === attacker ? projectile.ownerLife : attacker?.life;
    const attackerTeam = projectile?.owner === attacker ? projectile.ownerTeam : attacker?.team;
    if (attacker && attacker.id !== target.id && attackerTeam === target.team) amount *= .3;
    if (activeModifier("inverted")) amount = -amount;
    if (activeModifier("instakill")) amount = target.hp;
    const before = target.hp;
    target.hp = clamp(target.hp - amount, 0, target.maxHp);
    if (amount < 0 && target.hp > before) effects?.notify("heal", target.cueKey, position(target).x, position(target).y - radius, target.hp - before, simTime);
    else if (critical && amount > 0) effects?.notify("critical", target.cueKey, position(target).x, position(target).y - radius, amount, simTime);
    target.hitShake = reduced ? null : Feedback.shake(amount, simTime, target.id * 65537 + hits);
    target.hitUntil = simTime + (target.hitShake?.duration || 0);
    hits++;
    const p = position(target), kick = Combat.impulse(amount, p, point, target.body.mass, sceneUnit());
    M.Body.setVelocity(target.body, { x: target.body.velocity.x + kick.x, y: target.body.velocity.y + kick.y });
    const contact = point;
    effects?.hit(target.portrait, contact.x, contact.y, amount, simTime, fighterUnit(),
      9.81 * engine.gravity.y / standardGravity());
    if (target.hp <= 0) die(target, attacker, creditLife);
  }
  function announce(text) {
    const node = element("li", "", text);
    ui("feed").prepend(node); feedEntries.unshift({ node, born: simTime });
    while (feedEntries.length > 4) feedEntries.pop().node.remove();
  }
  function renderFeed() {
    for (let i = feedEntries.length - 1; i >= 0; i--) {
      const entry = feedEntries[i], age = simTime - entry.born;
      if (age >= 5000) { entry.node.remove(); feedEntries.splice(i, 1); }
      else if (age > 3200) entry.node.style.opacity = ((5000 - age) / 1800).toFixed(3);
    }
  }
  function die(f, attacker, creditLife = attacker?.life) {
    if (!f.alive || phase !== "running") return;
    f.alive = false; f.hp = 0; f.deaths++; f.streak = 0; f.deathAt = simTime;
    f.attack = null; f.itemActive = false; effects?.stop(f);
    f.chip.classList.remove("is-attacking"); f.chip.classList.add("is-dead");
    removeStaged(f); f.rig?.dispose(); f.rig = null;
    M.Composite.remove(engine.world, f.body);
    if (attacker) {
      attacker.kills++;
      // A late arrow still credits its original member, but it cannot heal or
      // extend the streak of a later life that reuses that member's DOM actor.
      if (attacker.life === creditLife) {
        attacker.streak++; attacker.badgeAt = simTime; attacker.bestStreak = Math.max(attacker.bestStreak, attacker.streak);
        const recovery = Combat.killHeal(attacker.streak, attacker.healDivider, attacker.maxHp);
        attacker.healDivider = recovery.divider; heal(attacker, recovery.amount);
      }
      announce(attacker.name + "  淘汰  " + f.name + (attacker.life === creditLife && attacker.streak >= 3 ? " · " + attacker.streak + " 连胜" : ""));
    } else announce(f.name + "  离开了战场");
    const p = position(f);
    if (options.modifier === "drop-items") addPickup(p.x, p.y, f.weaponId);
    if (activeModifier("explosive")) {
      // Queue once, then drain after all current contacts. No recursive death chain.
      explosions.push({ x: p.x, y: p.y, damage: 24, owner: f });
    }
    if (respawns()) readyQueue.push(f);
  }
  let explosions = [];
  function addPickup(x = random((arenaExtents?.left ?? 0) + 25, (arenaExtents?.right ?? width) - 25), y = 15, weaponId) {
    if (pickups.length >= 8) return;
    const def = weaponId ? weapons[weaponId] : WeaponProfile.pickups.heal, unit = sceneUnit();
    const p = { x, y, vy: 0, born: simTime, expires: simTime + 16000, weaponId,
      radius: .3 * unit, displayWidth: (def.width || .6) * unit, displayHeight: (def.height || .6) * unit,
      node: weaponId ? image("arena-pickup", sprites[weaponId]) : medicalPickup() };
    Object.assign(p.node.style, { width: p.displayWidth + "px", height: p.displayHeight + "px" });
    field.append(p.node); pickups.push(p);
  }
  function updateItems(dt) {
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i], oldY = p.y;
      p.vy += 9.81 * sceneUnit() * dt; p.y += p.vy * dt;
      let landed = false;
      for (const platform of [...platforms, ...props]) {
        const b = platform.body.bounds;
        if (p.x < b.min.x || p.x > b.max.x) continue;
        // Use the actual sloped collider surface, not its bounding-box top.
        const vertices = platform.body.vertices;
        let surface = Infinity;
        for (let j = 0; j < vertices.length; j++) {
          const a = vertices[j], z = vertices[(j + 1) % vertices.length];
          if (Math.abs(z.x - a.x) < 0.001 || p.x < Math.min(a.x, z.x) || p.x > Math.max(a.x, z.x)) continue;
          surface = Math.min(surface, a.y + (z.y - a.y) * (p.x - a.x) / (z.x - a.x));
        }
        if (oldY + p.radius <= surface + 0.1 && p.y + p.radius >= surface) { p.y = surface - p.radius; p.vy = 0; landed = true; }
      }
      let remove = simTime > p.expires;
      if (!p.weaponId && landed && zones.length < 8) {
        const node = eventNode("heal");
        zones.push({ type: "heal", x: p.x, y: p.y, r: sceneUnit() * 1.5, node,
          ticks: 0, tickAt: simTime + 300, healUntil: simTime + 6600, expires: simTime + 8600 });
        remove = true;
      }
      for (const f of fighters) {
        if (remove) break;
        const q = position(f);
        if (!f.alive || Math.hypot(q.x - p.x, q.y - p.y) > radius + p.radius) continue;
        if (p.weaponId) equip(f, p.weaponId);
        else {
          if (zones.length < 8) {
            const node = eventNode("heal");
            zones.push({ type: "heal", x: p.x, y: p.y, r: sceneUnit() * 1.5, node,
              ticks: 0, tickAt: simTime + 300, healUntil: simTime + 6600, expires: simTime + 8600 });
          }
        }
        burst(p.x, p.y, "#b6e890"); remove = true; break;
      }
      if (remove) { p.node.remove(); pickups.splice(i, 1); }
    }
  }
  function collision(event) {
    for (const pair of event.pairs) {
      for (const [body, other] of [[pair.bodyA, pair.bodyB], [pair.bodyB, pair.bodyA]]) {
        const root = body.parent || body, otherRoot = other.parent || other;
        const f = root.plugin.fighter;
        const projectile = root.plugin.arenaProjectile;
        if (projectile && !projectile.staged && !["weapon", "arrow", "bomb"].includes(projectile.kind)) projectile.collided = true;
        if (projectile?.kind === "weapon") {
          touching.add(contactKey(root, otherRoot));
          if (event.name === "collisionStart") physicalHit(projectile.owner, root, projectile.stats, otherRoot,
            pair.collision.supports.find(Boolean) || root.position, projectile.previousShapes, true);
        }
        const owner = root.plugin.rigOwner;
        if (owner && body.plugin.heldCollisionDamage) {
          touching.add(contactKey(root, otherRoot));
          if (event.name === "collisionStart") physicalHit(owner, root, body.plugin.weaponDefinition.stats, otherRoot,
            pair.collision.supports.find(Boolean) || root.position, owner.collisionShapes, true);
        }
        if (f?.alive && (other.isStatic && other.label === "terrain" || other.plugin.crate) &&
          pair.collision.supports.some((point) => point && point.y > body.position.y + radius * 0.25)) f.groundedAt = simTime;
      }
    }
  }
  function tick() {
    const rate = simulationRate();
    simTime += STEP;
    if (phase === "result") {
      updateParticles();
      if (simTime >= resultsUntil) startRound();
      return;
    }
    roundElapsed += STEP / rate;
    previousTouching = touching; touching = new Set(); impacts.clear();
    updateScene(STEP / 1000);
    if (!modifierEnded && simTime >= modifierUntil) {
      modifierEnded = true; engine.gravity.y = standardGravity();
      for (const f of fighters) f.body.restitution = 0.275;
      announce("特殊规则结束 · 恢复标准战斗");
    }
    updateClassicQueue(); updateReserves();
    for (const f of fighters) updateAI(f);
    for (const f of fighters) {
      if (!f.alive) continue;
      if (options.modifier === "gravity-well") {
        const p = position(f), dx = width / 2 - p.x, dy = height * 0.4 - p.y;
        const d = Math.max(60, Math.hypot(dx, dy));
        M.Body.applyForce(f.body, p, { x: dx / d * 0.0009 * f.body.mass, y: dy / d * 0.0009 * f.body.mass });
      }
      updateBodyMovement(f);
      const velocity = f.body.velocity, speed = Math.hypot(velocity.x, velocity.y), cap = velocityUnits(100);
      if (speed > cap) M.Body.setVelocity(f.body, { x: velocity.x * cap / speed, y: velocity.y * cap / speed });
      attemptAttack(f); commandHand(f); f.rig?.beforeStep(STEP / 1000);
      f.collisionShapes = f.itemActive ? captureShapes(f.rig?.weaponBody || f.rig?.fistBody) : null;
      M.Body.setAngularVelocity(f.body, f.body.angularVelocity / (1 + .05 * STEP / 1000));
    }
    for (const p of projectiles) { p.previous = { ...p.body.position }; p.previousShapes = captureShapes(p.body); }
    for (const f of fighters) { f.previousPosition = { ...position(f) }; f.previousPose = { ...position(f), angle: f.body.angle }; }
    // Matter recommends <=16.667ms. Two internal 10ms solves retain the
    // source 50Hz controller/animation clock without a large-delta warning.
    Combat.stepPhysics(M, engine, STEP);
    for (const f of fighters) if (f.alive) {
      f.rig?.afterStep();
      physicalContacts(f); finishAttack(f);
      if (position(f).y > height + radius * 4) die(f, null);
    }
    updateProjectiles(STEP / 1000);
    applyImpacts();
    const pending = explosions; explosions = [];
    for (const p of pending) explode(p);
    updateItems(STEP / 1000); updateParticles();
    if (respawns() && simTime > checkpointDue) { checkpoint(); checkpointDue = simTime + 15000; }
    if (options.mode === "score" && roundElapsed >= 45000) finish(R.classicWinners(fighters));
    else if (!respawns()) checkResult();
  }
  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.1;
      if (simTime >= p.expires) { p.node.remove(); particles.splice(i, 1); }
    }
  }
  function checkResult() {
    const remaining = fighters.filter((f) => f.alive || f.reserve);
    const teams = new Set(remaining.map((f) => f.team));
    if (teams.size <= 1) finish(options.mode === "teams" && remaining.length ?
      fighters.filter((f) => f.team === remaining[0].team) : remaining);
  }
  function checkpoint(winnerHandles = []) {
    const entries = fighters.map((f) => ({ handle: f.handle, name: f.name,
      kills: f.kills - f.savedKills, deaths: f.deaths - f.savedDeaths, bestStreak: f.bestStreak }));
    store.record(entries, { id: roundId + "-" + (++outcomeSerial), winnerHandles,
      countMatch: outcomeSerial === 1 });
    for (const f of fighters) { f.savedKills = f.kills; f.savedDeaths = f.deaths; }
  }
  function finish(winners) {
    if (phase !== "running" || resultRecorded) return;
    resultRecorded = true; phase = "result";
    for (const f of fighters) {
      f.attack = null; f.chip.classList.remove("is-attacking");
      f.chip.classList.toggle("is-winner", winners.includes(f));
    }
    for (const p of [...projectiles]) removeProjectile(p);
    projectiles = []; explosions = [];
    checkpoint(winners.map((f) => f.handle));
    const winnerText = winners.length > 1 ? winners.length <= 2 ? winners.map((f) => f.name).join("、") + " 并列获胜" :
      winners.length + " 名成员并列获胜" : winners[0]?.name + " 获胜";
    ui("result-title").textContent = options.mode === "teams" && winners.length ?
      (winners[0].team === 0 ? "蓝队获胜" : "红队获胜") : winners.length ? winnerText : "本局平手";
    ui("result-detail").textContent = options.mode === "score" && winners.length ?
      "获胜战绩 " + winners[0].kills + " 次淘汰 · " + winners[0].deaths + " 次阵亡 · " + Math.floor(roundElapsed / 1000) + " 秒" :
      "本局 " + fighters.reduce((s, f) => s + f.kills, 0) + " 次淘汰 · " + Math.floor(roundElapsed / 1000) + " 秒";
    document.querySelector(".arena-result-note").textContent = options.mode === "score" ?
      "击杀相同按阵亡少者优先；两项相同则并列，无淘汰时平局。" : "也可点击「重赛」或「设置」更换规则";
    ui("result").hidden = false;
    ui("result").dataset.outcome = winners.length ? "victory" : "draw";
    // Result time always runs at 1x, including after fast/slow rounds. Both
    // the visible countdown and confetti share this pausable simulation clock.
    resultsUntil = simTime + browserTuning.resultDuration;
    celebrate(winners.length > 0);
    hud();
  }
  function clearCelebration() {
    celebration?.layer?.remove();
    celebration = null;
    ui("result")?.querySelector(".arena-victory-mark")?.remove();
  }
  function celebrate(victory) {
    clearCelebration();
    const mark = element("span", "arena-victory-mark", victory ? "✦" : "◇");
    mark.setAttribute("aria-hidden", "true");
    ui("result").querySelector(".arena-result-card")?.prepend(mark);
    if (reduced) return;
    const layer = element("div", "arena-confetti");
    layer.setAttribute("aria-hidden", "true");
    const palette = ["#d9b967", "#e1e9ef", "#7ec8de"];
    const pieces = Array.from({ length: width < 600 ? 40 : 72 }, (_, index) => {
      const node = element("span", "arena-confetti-piece");
      node.style.setProperty("--confetti-color", palette[index % palette.length]);
      layer.append(node);
      return { node, x: random(0, width), drift: random(18, 85), angle: random(-180, 180),
        spin: random(-160, 160), delay: random(0, 1.15), duration: random(3.7, 5.6), phase: random(0, Math.PI * 2) };
    });
    field.parentElement.append(layer);
    celebration = { layer, pieces, start: simTime };
    renderCelebration();
  }
  function renderCelebration() {
    if (!celebration) return;
    const elapsed = (simTime - celebration.start) / 1000;
    for (const p of celebration.pieces) {
      const t = elapsed - p.delay;
      const progress = t / p.duration;
      p.node.style.opacity = t < 0 || progress > 1 ? "0" : String(Math.min(1, (1 - progress) * 4));
      const x = p.x + Math.sin(t * 2 + p.phase) * p.drift;
      const y = -30 + progress * (height + 80);
      p.node.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${(p.angle + t * p.spin).toFixed(1)}deg)`;
    }
  }
  function renderClocks() {
    const seconds = phase === "setup" ? 0 : options.mode === "score" ? Math.ceil(Math.max(0, 45000 - roundElapsed) / 1000) : Math.floor(roundElapsed / 1000);
    const clockLabel = ui("clock-label"), clockText = options.mode === "score" ? "剩余" : "用时";
    if (clockLabel.textContent !== clockText) clockLabel.textContent = clockText;
    const label = Math.floor(seconds / 60).toString().padStart(2, "0") + ":" + (seconds % 60).toString().padStart(2, "0");
    if (ui("clock").textContent !== label) ui("clock").textContent = label;
    const limit = ui("round-limit"), text = phase === "setup" ? "待开局" : options.mode === "classic" ? "持续混战" : options.mode === "teams" ? "全灭决胜" : options.mode === "score" ? "限时击杀赛" : "最后一人";
    if (limit && limit.textContent !== text) limit.textContent = text;
    const resultRemaining = phase === "result" ? Math.max(0, resultsUntil - simTime) : browserTuning.resultDuration;
    const countdown = ui("result-countdown");
    const countText = String(Math.ceil(resultRemaining / 1000));
    if (countdown && countdown.textContent !== countText) countdown.textContent = countText;
    const resultProgress = ui("result-progress");
    if (resultProgress) resultProgress.style.width = (resultRemaining / browserTuning.resultDuration * 100).toFixed(3) + "%";
  }
  function renderBadge(f, badge, count, total = false) {
    badge.hidden = count <= 0;
    if (count <= 0) return;
    badge.querySelector("b").textContent = String(count);
    const colors = WeaponProfile.killBadge.colors.filter((entry) => count >= entry.threshold).at(-1)?.color;
    const rgb = (v) => "rgb(" + v.slice(0, 3).map((n) => Math.round(n * 255)).join(",") + ")";
    const text = badge.querySelector("b");
    if (total) text.style.color = rgb(WeaponProfile.killBadge.totalColor);
    else if (colors) {
      text.style.backgroundImage = "linear-gradient(" + rgb(colors.topLeft) + "," + rgb(colors.bottomLeft) + ")";
      text.style.backgroundClip = "text"; text.style.color = "transparent";
    } else { text.style.backgroundImage = "none"; text.style.color = "#fff"; }
    const t = clamp((simTime - f.badgeAt) / 300, 0, 1);
    const punch = reduced ? 1 : 1 + .25 * Math.sin(t * Math.PI * WeaponProfile.killBadge.punchVibrato) * (1 - t);
    badge.style.setProperty("--badge-punch", punch.toFixed(3));
  }
  function render() {
    const alpha = phase === "running" && mayRun() ? clamp(accumulator / STEP, 0, 1) : 1;
    for (const f of fighters) {
      if (!f.alive && simTime - f.deathAt > 180 || f.reserve) { f.chip.hidden = true; continue; }
      const current = { ...position(f), angle: f.body.angle };
      const p = f.previousPose ? Motion.interpolatePose(f.previousPose, current, alpha) : current;
      // Per-frame transforms stay on their own nodes. Inherited CSS variables
      // would invalidate every name, hand, weapon and health child each frame.
      f.chip.style.transform = `translate3d(${(p.x - radius).toFixed(2)}px,${(p.y - radius).toFixed(2)}px,0)`;
      Feedback.changeHealth(f.healthVisual, f.hp / f.maxHp, simTime, reduced);
      const health = Feedback.sampleHealth(f.healthVisual, simTime, reduced);
      const front = health.front.toFixed(4), back = health.back.toFixed(4);
      if (f.frontScale !== front) { f.healthFill.style.transform = "scaleX(" + front + ")"; f.frontScale = front; }
      if (f.backScale !== back) { f.healthTail.style.transform = "scaleX(" + back + ")"; f.backScale = back; }
      const shake = Feedback.sampleShake(f.hitShake, simTime, fighterUnit(), reduced);
      const hitX = shake.x.toFixed(2) + "px", hitY = shake.y.toFixed(2) + "px";
      const moveElapsed = f.bodyMovement ? (simTime - f.bodyMovement.start) / 1000 : 1;
      const squeeze = reduced ? 0 : moveElapsed < .375 ? Math.min(1, moveElapsed / .375) : moveElapsed < .8 ? 1 : Math.max(0, 1 - (moveElapsed - .8) / .175);
      const jumpX = (1 + .15 * squeeze).toFixed(3), jumpY = (1 - .25 * squeeze).toFixed(3);
      f.avatar.style.transform = `translate(${hitX},${hitY}) rotate(${p.angle.toFixed(4)}rad) scale(${jumpX},${jumpY})`;
      f.chip.classList.toggle("is-hit", f.alive && simTime < f.hitUntil);
      renderBadge(f, f.lifeBadge, f.streak);
      renderBadge(f, f.totalBadge, f.careerBase + f.kills, true);
      const pose = f.rig?.pose(alpha);
      if (!pose) { f.hand.hidden = true; f.weaponImage.hidden = true; f.bowString.style.display = "none"; continue; }
      const trail = Feedback.trails[f.weaponId];
      if (trail && pose.weapon) {
        const tip = Motion.localToWorld({ x: trail.x * fighterUnit() * pose.scaleX,
          y: -trail.y * fighterUnit() * pose.scaleY }, pose.origin, pose.origin.angle);
        effects?.trail(f, trail, tip, f.alive && f.itemActive, simTime, fighterUnit());
      }
      f.hand.hidden = false;
      const unit = fighterUnit(), handWidth = WeaponProfile.hand.width * unit, handHeight = WeaponProfile.hand.height * unit;
      const handOffset = { x: f.weapon.handPosition.x * unit * pose.scaleX, y: -f.weapon.handPosition.y * unit * pose.scaleY };
      const hand = pose.weapon ? Motion.localToWorld(handOffset, pose.origin, pose.origin.angle) : pose.hand;
      const handAngle = (pose.weapon ? pose.origin.angle : pose.hand.angle) + f.weapon.handRotation * pose.scaleX * pose.scaleY;
      Object.assign(f.hand.style, { width: handWidth + "px", height: handHeight + "px", transformOrigin: "50% 50%",
        transform: `translate(${(hand.x - p.x + radius - handWidth / 2).toFixed(2)}px,${(hand.y - p.y + radius - handHeight / 2).toFixed(2)}px) rotate(${handAngle.toFixed(4)}rad) scale(${pose.scaleX},${pose.scaleY})` });
      f.weaponImage.hidden = !pose.weapon || !f.weapon.sprite || f.weaponId === "bomb";
      if (pose.weapon && f.weapon.sprite) {
        const w = f.weapon.width * unit, h = f.weapon.height * unit;
        Object.assign(f.weaponImage.style, { width: w + "px", height: h + "px", transformOrigin: "50% 50%",
          transform: `translate(${(pose.origin.x - p.x + radius - w / 2).toFixed(2)}px,${(pose.origin.y - p.y + radius - h / 2).toFixed(2)}px) rotate(${pose.origin.angle.toFixed(4)}rad) scale(${pose.scaleX},${pose.scaleY})` });
      }
      f.bowString.style.display = f.weaponId === "bow" && pose.weapon ? "block" : "none";
      if (f.weaponId === "bow" && pose.weapon) {
        const elapsed = f.attack ? (simTime - f.attack.start) / 1000 : 0;
        const pull = f.attack ? Actions.bowPull(elapsed, .525) : 0;
        const w = unit * 2, h = unit * 2.38;
        f.bowString.setAttribute("viewBox", "-1 -1.19 2 2.38");
        f.bowString.firstElementChild.setAttribute("points", `0.1,-1.05 ${(.1 - pull).toFixed(4)},0 0.1,1.05`);
        Object.assign(f.bowString.style, { width: w + "px", height: h + "px", transformOrigin: "50% 50%",
          transform: `translate(${(pose.origin.x - p.x + radius - w / 2).toFixed(2)}px,${(pose.origin.y - p.y + radius - h / 2).toFixed(2)}px) rotate(${pose.origin.angle.toFixed(4)}rad) scale(${pose.scaleX},${pose.scaleY})` });
      }
    }
    for (const p of projectiles) {
      const origin = Motion.localToWorld(p.originOffset, p.body.position, p.body.angle);
      const angle = p.body.angle;
      p.node.style.transform = `translate(${(origin.x - p.displayWidth / 2).toFixed(2)}px,${(origin.y - p.displayHeight / 2).toFixed(2)}px) rotate(${angle.toFixed(4)}rad) scale(${p.scaleX || 1},${p.scaleY || 1})`;
      const trail = Feedback.trails[p.kind === "weapon" ? p.weaponId : p.kind];
      if (trail) {
        const tip = Motion.localToWorld({ x: trail.x * fighterUnit() * (p.scaleX || 1),
          y: -trail.y * fighterUnit() * (p.scaleY || 1) }, origin, angle);
        effects?.trail(p, trail, tip, !p.staged, simTime, fighterUnit());
      }
    }
    for (const p of particles) p.node.style.transform = "translate(" + p.x.toFixed(1) + "px," + p.y.toFixed(1) + "px)";
    for (const p of pickups) {
      p.node.style.transform = "translate(" + (p.x - p.displayWidth / 2).toFixed(1) + "px," + (p.y - p.displayHeight / 2).toFixed(1) + "px)";
      if (!p.weaponId) p.node.style.setProperty("--event-pulse", reduced ? ".5" : String((Math.sin((simTime - p.born) / 220) + 1) / 2));
    }
    renderScene();
    renderClocks();
    renderFeed();
    renderCelebration();
    effects?.render(simTime);
  }
  function hud() {
    const active = fighters.filter((f) => f.alive);
    renderClocks();
    ui("round").textContent = String(round);
    const reserveCount = fighters.filter((f) => f.reserve).length;
    ui("live-count").textContent = active.length + " / " + members.length;
    ui("live-count").title = "在场 " + active.length + " 人 · 预备 " + reserveCount + " 人 · 全名单 " + members.length + " 人";
    ui("reserve-count").textContent = "预备 " + reserveCount + " 人";
    ui("reserve-count").hidden = reserveCount === 0;
    ui("status").textContent = phase === "setup" ? "准备就绪" : !mayRun() ? "已暂停" : phase === "result" ? "本局结束 · 自动续局" :
      options.mode === "teams" ? "蓝 " + active.filter((f) => f.team === 0).length + " : " + active.filter((f) => f.team === 1).length + " 红" :
        options.mode === "classic" ? "无尽混战" : options.mode === "score" ? "限时击杀赛" : "个人淘汰";
    ui("pause").textContent = manuallyPaused ? "继续" : "暂停";
    ui("pause").setAttribute("aria-pressed", String(manuallyPaused));
    ui("pause").disabled = phase === "setup";
    ui("restart").disabled = phase === "setup";
    const modes = { auto: "自动巡回", classic: "无尽混战", teams: "团队淘汰", royale: "个人淘汰", score: "限时击杀赛" };
    const terrains = { random: "随机场景", default: "起伏山地", smallhill: "小山丘", pit: "盆地",
      canyon: "峡谷", slope: "斜坡", terrain01: "高台", terrain02: "山脊", flat: "平地", platforms: "悬浮平台" };
    ui("scenario").textContent = (options.rotation ? "巡回 · " : "") + modes[options.mode] + " · " + terrains[options.terrain];
    const list = ui("leaderboard"); list.replaceChildren();
    const top = R.rankMatch(fighters).slice(0, 10);
    for (const { fighter: f, rank } of top) {
      const row = element("li");
      row.append(element("span", "arena-rank", rank), element("span", "arena-score-name", f.name),
        element("strong", "arena-score-kills", f.kills), element("span", "arena-score-deaths", f.deaths));
      list.append(row);
    }
    if (!top.length) list.append(element("li", "arena-score-empty", "开局后显示成员战绩"));
    const career = ui("career");
    if (career) {
      career.replaceChildren();
      const records = store.read().slice(0, 10);
      for (const [index, f] of records.entries()) {
        const row = element("li");
        row.append(element("span", "arena-rank", index + 1), element("span", "arena-score-name", f.name),
          element("strong", "arena-score-wins", f.wins), element("span", "arena-score-kills", f.kills));
        career.append(row);
      }
      if (!records.length) career.append(element("li", "arena-score-empty", "完成一局后记录本机战绩"));
    }
  }
  function loop(now) {
    frame = 0;
    const generation = round;
    if (!mayRun()) { lastFrame = 0; return; }
    if (pendingResize) resize();
    if (!lastFrame) lastFrame = now;
    accumulator += Math.min(84, now - lastFrame) * simulationRate();
    lastFrame = now;
    let steps = 0;
    while (accumulator >= STEP && steps++ < 6) {
      tick();
      // A completed round starts exactly one fresh RAF. Never schedule a second
      // loop from the old generation or fast-forward the new match.
      if (round !== generation) return;
      accumulator -= STEP;
    }
    if (steps >= 6) accumulator = 0;
    render();
    if (simTime >= hudDue) { hud(); hudDue = simTime + 350; }
    if (mayRun()) frame = requestAnimationFrame(loop);
  }
  function syncVisibility() {
    // Resizing is a geometry transaction, not a simulation step. A visible
    // paused window must update its floor, SVG and bodies before it resumes.
    if (pendingResize && engine && phase !== "setup" && !document.hidden && (!host || host.open)) resize();
    terminal.classList.toggle("is-arena-paused", !mayRun());
    if (mayRun()) { if (!frame) { lastFrame = 0; frame = requestAnimationFrame(loop); } }
    else { cancelAnimationFrame(frame); frame = 0; lastFrame = 0; accumulator = 0; }
    hud();
  }
  function clearWorld() {
    cancelAnimationFrame(frame); frame = 0; lastFrame = 0; accumulator = 0;
    clearCelebration();
    effects?.dispose(); effects = null;
    if (engine) { M.Events.off(engine); M.Composite.clear(engine.world, false); M.Engine.clear(engine); }
    engine = null; fighters = []; projectiles = []; particles = []; pickups = []; explosions = [];
    touching.clear(); previousTouching.clear(); impacts.clear();
    readyQueue = []; pendingBatch = null;
    props = []; zones = []; terrainDue = Infinity; terrainHideAt = Infinity; eventDue = Infinity; sceneEvents = 0; propSerial = 0;
    walls = []; platforms = []; well = null; terrainPoints = null; arenaExtents = null;
    field.replaceChildren();
    feedEntries = []; ui("feed").replaceChildren();
  }
  function startRound() {
    if (!R || !M || !members.length) return;
    if (phase === "running" && respawns()) checkpoint();
    clearWorld();
    options = resolveOptions(); roundPool = Math.min(members.length, 64); phase = "running"; manuallyPaused = false; resultRecorded = false;
    terrainVisible = !options.randomTerrain || ["royale", "score"].includes(options.mode);
    round++; roundId = Date.now().toString(36) + "-" + round + "-" + Math.random().toString(36).slice(2);
    outcomeSerial = 0; simTime = 0; roundElapsed = 0; resultsUntil = Infinity;
    hudDue = 0; checkpointDue = 15000;
    readyQueue = []; pendingBatch = null; spawnDue = 0; batchTeam = 0;
    const duration = P.timedModifiers[options.modifier];
    modifierUntil = duration ? random(duration[0], duration[1]) * 1000 : Infinity;
    modifierEnded = false;
    setup.hidden = true; ui("result").hidden = true;
    terminal.classList.remove("is-awaiting-battle"); terminal.classList.add("is-battle-live");
    const definition = P.terrains[options.terrain];
    if (definition) {
      const cameraHalfHeight = cameraSize();
      terrainPoints = R.sampleTerrainContour(R.buildTerrainPoints(definition, cameraHalfHeight / 6), definition);
    }
    start.disabled = false;
    engine = M.Engine.create({ positionIterations: 7, velocityIterations: 5, constraintIterations: 4, enableSleeping: false });
    engine.gravity.y = 0; // resize derives gravity from the same world-to-pixel scale.
    width = 0; height = 0; radius = 20; resize();
    effects = Feedback.createCanvas({ field, reduced, seed: round });
    effects?.resize(width, height, 1, 1, 1, window.devicePixelRatio || 1);
    prepareScene();
    // Fixed active pool bounds CPU/DOM work even for much larger future rosters.
    const pool = Math.min(members.length, 64);
    let selected = members.map((member, index) => ({ member, index }));
    if (members.length > pool) {
      const startAt = ((round - 1) * pool) % members.length;
      selected = Array.from({ length: pool }, (_, i) => selected[(startAt + i) % members.length]);
      announce("本轮 " + pool + " 人 · 全名单 " + members.length + " 人，" +
        "本轮结束后轮换");
    }
    const loadouts = Combat.loadouts(pool, ["royale", "score"].includes(options.mode) ? "teams" : options.mode, options.loadout);
    fighters = selected.map(({ member, index }, slot) => makeFighter(member, index, loadouts[slot], slot, pool));
    if (options.mode === "teams") {
      for (const team of [0, 1]) {
        const list = fighters.filter((f) => f.team === team), divisor = list.length < 12 ? 1 : list.length < 28 ? 3 : 4;
        const selected = new Set(shuffle([...list]).slice(0, Math.floor(list.length / divisor)));
        for (const f of list) { if (selected.has(f)) spawn(f, true); else f.reserve = true; }
      }
      reserveDue = simTime + random(22000, 37000); reserveSide = 0;
      if (fighters.some((f) => f.reserve)) announce("预备队待命 · 战斗中按双方存活人数分批增援");
    } else if (options.mode === "classic") { reserveDue = Infinity; readyQueue = [...fighters]; updateClassicQueue(); }
    else { reserveDue = Infinity; for (const f of fighters) spawn(f, true); }
    M.Events.on(engine, "collisionStart", collision); M.Events.on(engine, "collisionActive", collision);
    M.Events.on(engine, "beforeSolve", () => {
      for (const body of engine.world.bodies) {
        const scale = (1000 / 60) / (body.deltaTime || 1000 / 60);
        body.plugin.contactVx = body.velocity.x * scale; body.plugin.contactVy = body.velocity.y * scale;
      }
    });
    render(); hud(); syncVisibility();
  }
  function dispose() {
    if (phase === "running" && respawns()) checkpoint();
    destroyed = true; clearWorld(); resizeObserver?.disconnect(); visibilityObserver?.disconnect();
    document.removeEventListener("visibilitychange", syncVisibility);
  }
  try {
    R = window.GVYArenaRules; M = window.Matter; P = window.GVYArenaProfile;
    Motion = window.GVYArenaMotion; Actions = window.GVYArenaActions; Rig = window.GVYArenaRig; WeaponProfile = window.GVYArenaWeaponProfile;
    Feedback = window.GVYArenaFeedback; Combat = window.GVYArenaCombat;
    if (!R || !M || !P || !Motion || !Actions || !Rig || !WeaponProfile || !Feedback || !Combat) throw new Error("战斗组件加载失败，请刷新页面重试。");
    weapons = WeaponProfile.weapons; weaponIds = Object.keys(weapons);
    Object.assign(sprites, Object.fromEntries(weaponIds.map((id) => [id, weapons[id].sprite || WeaponProfile.hand.sprite])),
      { hand: WeaponProfile.hand.sprite, heal: WeaponProfile.pickups.heal.sprite });
    const raw = window.__gvyFleetRoster?.members;
    if (!Array.isArray(raw) || !raw.length) throw new Error("成员名单暂时不可用，请刷新页面重试。");
    members = raw.map((m, i) => {
      if (typeof m.name !== "string" || typeof m.avatar !== "string" || !/^\.\/assets\/member-avatars\/[a-f0-9]{64}\.(?:png|jpg|gif|webp)$/.test(m.avatar)) throw new Error("成员快照校验失败，请刷新页面重试。");
      return { ...m, handle: m.handle || "snapshot-" + i };
    });
    let storage;
    try { storage = localStorage; } catch { storage = null; }
    store = R.createStatsStorage(storage);
    options = configure();
    const renderModeHelp = () => {
      ui("mode-help").textContent = {
        auto: "随机轮换个人淘汰、团队淘汰和限时击杀赛；无尽混战单独选择。",
        royale: "每人一次机会，最后存活的成员获胜，没有时间限制。",
        teams: "红蓝两队对抗，计入预备队后全灭决胜，没有时间限制。",
        score: "45 秒内淘汰最多者获胜，同分时阵亡少者优先；完全相同则并列。",
        classic: "持续战斗，阵亡成员循环入场，不自动结算或切换模式。",
      }[ui("mode").value];
    };
    ui("mode").addEventListener("change", renderModeHelp); renderModeHelp();
    start.hidden = false; start.disabled = false;
    start.addEventListener("click", startRound);
    ui("restart").addEventListener("click", startRound);
    ui("pause").addEventListener("click", () => { manuallyPaused = !manuallyPaused; syncVisibility(); });
    ui("settings").addEventListener("click", () => {
      if (phase === "running" && respawns()) checkpoint();
      phase = "setup"; manuallyPaused = false; syncVisibility(); clearWorld();
      terminal.classList.remove("is-battle-live"); terminal.classList.add("is-awaiting-battle");
      setup.hidden = false; ui("result").hidden = true; start.focus({ preventScroll: true }); hud();
    });
    document.addEventListener("visibilitychange", syncVisibility);
    window.addEventListener("pagehide", (event) => { if (event.persisted) { cancelAnimationFrame(frame); frame = 0; lastFrame = 0; } else dispose(); });
    window.addEventListener("pageshow", (event) => { if (event.persisted) syncVisibility(); });
    resizeObserver = new ResizeObserver(() => {
      pendingResize = true;
      if (phase !== "setup") syncVisibility();
    });
    resizeObserver.observe(field);
    if (host) { visibilityObserver = new MutationObserver(syncVisibility); visibilityObserver.observe(host, { attributes: true, attributeFilter: ["open"] }); }
    window.__gvyArena = Object.freeze({ snapshot: () => ({ phase, paused: !mayRun(), round, simTime,
      roundElapsed, roundLimit: options.mode === "score" ? 45000 : null,
      roundRemaining: options.mode === "score" ? Math.max(0, 45000 - roundElapsed) : null,
      readyCount: readyQueue.length + (pendingBatch?.batch.length || 0),
      resultRemaining: phase === "result" ? Math.max(0, resultsUntil - simTime) : 0,
      confetti: celebration?.pieces.length || 0,
      map: { terrainVisible, terrainDue: Number.isFinite(terrainDue) ? terrainDue : null,
        unit: sceneUnit(), width, height, actorDiameter: radius * 2, cameraHalfHeight: cameraSize(), reserveCount: fighters.filter((f) => f.reserve).length,
        terrainPoints: terrainPoints?.length || 0, boxes: props.length, zones: zones.map((z) => ({ type: z.type, x: z.x, y: z.y, expires: z.expires })),
        eventDue: Number.isFinite(eventDue) ? eventDue : null, events: sceneEvents },
      hits, projectiles: projectiles.length, particles: particles.length, pickups: pickups.length,
      feedback: effects?.snapshot() || null,
      rosterCount: members.length, activePool: fighters.length, options: { ...options },
      fighters: fighters.map((f) => ({ id: f.id, handle: f.handle, name: f.name, life: f.life, alive: f.alive, hp: f.hp,
        kills: f.kills, streak: f.streak, reserve: f.reserve, deaths: f.deaths, team: f.team, weapon: f.weaponId, x: position(f).x, y: position(f).y })) }) });
    hud();
  } catch (error) { failure(error.message); }
})();
