(() => {
  const memberField = document.querySelector("[data-member-brawl-field]");
  if (!memberField) return;
  const memberTerminal = memberField.closest(".member-brawl-terminal");
  const startButton = document.querySelector("[data-brawl-start]");

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let brawlRendered = false;
  let brawlActive = false;
  let battleStarted = false;
  let shouldRunBrawl = false;

const rsiMediaBase = "https://robertsspaceindustries.com";
const defaultAvatar =
  "https://cdn.robertsspaceindustries.com/static/images/account/avatar_default_big.jpg";

const members = [
  ["qiufen", "星舰船员", defaultAvatar],
  ["shadedaihan", "远航先锋", defaultAvatar],
  ["Momonga", "深航舰长", "/media/1yyevnowv62s4r/avatar/6279ce07-C034-406f-88ad-6c1f4bcba2be.jpg"],
  ["CC089", "远航先锋", "/media/gypz0wmyuimiur/avatar/Bb7735fa-Bcc2-4433-Bf56-C8b4abb981a2.jpg"],
  ["ApriliaPeng", "深航舰长", defaultAvatar],
  ["HcyKira", "星舰指挥官", "/media/mxrysmpavtd0kr/avatar/151099c3-545a-48b3-87de-A5959034b4f3.jpg"],
  ["KongFeng", "远航先锋", "/media/n587v96nilww4r/avatar/_20220713013031.jpg"],
  ["earlscuro", "深航舰长", "/media/fgoqd8xcyfw29r/avatar/8a1efdd1-97ce-48be-816c-7afcd5b9c3e8.jpg"],
  ["06310", "远航先锋", defaultAvatar],
  ["cssdwa", "远航先锋", defaultAvatar],
  ["Mikey", "远航先锋", "/media/6xduwazwfzq2gr/avatar/E3cbb345-1ea6-413f-90e2-C2b838c1d147.jpg"],
  ["A22-RCL", "深航舰长", "/media/f8eywvpk9wiz3r/avatar/88ac77c4-A4bc-4dcd-B64f-56b1b2309d33.jpg"],
  ["chenfeng12344", "远航先锋", defaultAvatar],
  ["LIANG11918", "星舰指挥官", "/media/lb8sr4mu04quir/avatar/0516e100-867a-4cb8-Abc8-F3e5348b2e37.png"],
  ["Biuboom", "远航先锋", defaultAvatar],
  ["OKNPLM159", "深航舰长", defaultAvatar],
  ["missvalue", "星舰指挥官", defaultAvatar],
  ["lb1742", "星舰指挥官", "/media/f32vi98tr38rwr/avatar/media.jpg"],
  ["SupremeLeaderNA", "星舰指挥官", "/media/zdl0m04by4kujr/avatar/United_Empire_of_Earth.jpg"],
  ["Cola_Wang", "深航舰长", "/media/m4af4y51ln223r/avatar/A466a11e-607a-438f-Ae09-66231e7b1f8e.jpg"],
  ["pagelevel218", "远航先锋", defaultAvatar],
  ["lAQIL", "统御司令", "/media/c3b86d64zayjsr/avatar/00239-852073150-1man-holding-Scythe-masterpiece-Best-Quality-scythe-Red_fog-dynamic-Angle-Masterpiece-Best-Quality-_lora_-super-Saiya.png"],
  ["CN-ECHO", "星舰指挥官", "/media/6zyvwnoqhlh91r/avatar/F9930b39-40ec-4afa-B8d5-D1d525551b0c.jpg"],
  ["125486393", "星舰指挥官", defaultAvatar],
  ["RyouSuke", "深航舰长", defaultAvatar],
  ["Kaman-Luo", "星舰指挥官", "/media/n0kl5ybfzr4x5r/avatar/Ba9f967bdab44aed6af2202ff61c8701a38bfbc2.jpg"],
  ["humor0126", "星舰指挥官", "/media/irpx4n2q3sy7fr/avatar/CCA2190B343AAD2DF842DF29CEDE76B7.jpg"],
  ["Zack1982", "星舰指挥官", "/media/f27lo04cgmie2r/avatar/Ce7df7d1-5616-45c9-A2ee-4e9ac6faa842.jpg"],
  ["BookWorm", "深航舰长", defaultAvatar],
  ["BindoX", "联邦元帅", "/media/uly7bcps1h3cnr/avatar/Death-Stranding-Cliff-Uhdpapercom-4K-61.jpg"],
  ["9523", "统御司令", "/media/gae24l3hu5nvmr/avatar/E6aa8464-C7de-4834-B9f5-Cc720e797296.jpg"],
];

const chipColors = ["pink", "green", "yellow", "red", "yellow", "green"];
const maxHp = 100;
const weapons = [
  {
    name: "星辉长剑",
    kind: "blade",
    damage: 11,
    range: 104,
    cooldown: 1050,
    effect: "slash",
    maxHp: 100,
    aimOffset: 50,
    icon: "./assets/weapons-runtime/flame-sword.png",
  },
  {
    name: "破舰巨剑",
    kind: "heavy",
    damage: 34,
    range: 118,
    cooldown: 3600,
    effect: "heavy",
    knockback: 1.35,
    maxHp: 118,
    aimOffset: 50,
    icon: "./assets/weapons-runtime/storm-hammer.png",
  },
  {
    name: "突击长矛",
    kind: "spear",
    damage: 13,
    range: 132,
    cooldown: 1250,
    effect: "stab",
    maxHp: 96,
    aimOffset: 45,
    icon: "./assets/weapons-runtime/ice-spear.png",
  },
  {
    name: "裂甲战斧",
    kind: "axe",
    damage: 30,
    range: 108,
    cooldown: 3200,
    effect: "heavy",
    knockback: 1.5,
    maxHp: 112,
    aimOffset: 40,
    icon: "./assets/weapons-runtime/blood-axe.png",
  },
  {
    name: "远航长弓",
    kind: "bow",
    damage: 10,
    range: 280,
    cooldown: 1200,
    effect: "arrow",
    projectile: "arrow",
    projectileIcon: "./assets/weapons-generated/arrow.svg",
    maxHp: 74,
    aimOffset: 0,
    icon: "./assets/weapons-runtime/war-bow.png",
  },
  {
    name: "舰载弩",
    kind: "crossbow",
    damage: 14,
    range: 320,
    cooldown: 1450,
    effect: "bolt",
    projectile: "bolt",
    projectileIcon: "./assets/weapons-generated/bolt.svg",
    maxHp: 78,
    aimOffset: 0,
    icon: "./assets/weapons-runtime/bone-crossbow.png",
  },
  {
    name: "手炮",
    kind: "pistol",
    damage: 12,
    range: 300,
    cooldown: 1350,
    effect: "bullet",
    projectile: "bullet",
    projectileIcon: "./assets/weapons-generated/bullet.svg",
    maxHp: 88,
    aimOffset: 0,
    icon: "./assets/weapons-runtime/gold-pistol.png",
  },
  {
    name: "折跃盾",
    kind: "shield",
    damage: 8,
    range: 84,
    cooldown: 1550,
    effect: "shield",
    blockChance: 0.36,
    damageReduction: 0.55,
    knockback: 1.55,
    maxHp: 124,
    aimOffset: 0,
    icon: "./assets/weapons-runtime/battle-shield.png",
  },
];
const weaponDeck = [
  "blade",
  "spear",
  "axe",
  "shield",
  "blade",
  "heavy",
  "spear",
  "axe",
  "shield",
  "blade",
  "spear",
  "heavy",
  "shield",
  "bow",
  "crossbow",
  "pistol",
];
const weaponsByKind = Object.fromEntries(weapons.map((weapon) => [weapon.kind, weapon]));
const memberLoadouts = [];
let physicsCleanup = null;
let resizeTimer = null;
let resizeListenerBound = false;
let activePhysicsDrag = null;
let combatants = [];
let combatTimer = null;
let winnerDeclared = false;
let activeArenaBounds = null;

function avatarSrc(src) {
  if (src.startsWith("/media/")) return `${rsiMediaBase}${src}`;
  return src;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function normalizeAngleDelta(delta) {
  return Math.atan2(Math.sin(delta), Math.cos(delta));
}

function clampInside(value, min, max) {
  if (min > max) return (min + max) / 2;
  return clamp(value, min, max);
}

function selectWeapon(index) {
  if (memberLoadouts[index]) return memberLoadouts[index];

  const kind = weaponDeck[Math.floor(Math.random() * weaponDeck.length)];
  memberLoadouts[index] = weaponsByKind[kind] || weapons[Math.floor(Math.random() * weapons.length)];
  return memberLoadouts[index];
}

function renderMemberWall() {
  if (!memberField) return;
  memberTerminal?.classList.add("is-awaiting-battle");

  memberField.innerHTML = members
    .map(([name, rank, avatar], index) => {
      const color = chipColors[index % chipColors.length];
      const weapon = selectWeapon(index);
      return `
        <button class="member-fighter ${color} fighter-${weapon.kind}" type="button" aria-label="${name}" data-index="${index}">
          <span class="fighter-name">${name}</span>
          <span class="fighter-avatar-wrap">
            <img src="${avatarSrc(avatar)}" alt="" loading="lazy" decoding="async" fetchpriority="low" />
            <span class="weapon-aim weapon-${weapon.kind}">
              <span class="weapon-icon">
                <img src="${weapon.icon}" alt="${weapon.name}" />
              </span>
            </span>
          </span>
          <span class="health-bar" aria-hidden="true"><span class="health-fill"></span></span>
        </button>
      `;
    })
    .join("");

  preloadWeaponImages();
  if (!resizeListenerBound) {
    resizeListenerBound = true;
    window.addEventListener("resize", () => {
      if (battleStarted) scheduleMemberPhysics(180);
      else applyChipSizing(calculateChipSizing(memberField.getBoundingClientRect().width, members.length));
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (physicsCleanup) physicsCleanup();
        brawlActive = false;
      }
      else if (shouldRunBrawl && battleStarted) scheduleMemberPhysics(180);
    });
  }
  applyChipSizing(calculateChipSizing(memberField.getBoundingClientRect().width, members.length));
}

function preloadWeaponImages() {
  const urls = [...new Set(weapons.flatMap((weapon) => [weapon.icon, weapon.projectileIcon].filter(Boolean)))];
  return Promise.allSettled(
    urls.map((url) => {
      const image = new Image();
      image.decoding = "async";
      image.src = url;
      if (typeof image.decode === "function") return image.decode().catch(() => undefined);
      return new Promise((resolve) => {
        image.onload = resolve;
        image.onerror = resolve;
      });
    }),
  );
}

function scheduleMemberPhysics(delay = 120) {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!shouldRunBrawl || prefersReducedMotion) return;

    const run = () => {
      requestAnimationFrame(() => requestAnimationFrame(initMemberPhysics));
    };

    if (document.fonts?.ready) document.fonts.ready.finally(run);
    else run();
  }, delay);
}

function calculateChipSizing(fieldWidth, memberCount) {
  const isMobile = fieldWidth < 560;
  const base = isMobile ? 50 : fieldWidth < 940 ? 62 : 66;
  const minimum = isMobile ? 34 : 48;
  const reduction = Math.max(0, memberCount - 18) * (isMobile ? 0.75 : 0.85);
  const size = Math.round(clamp(base - reduction, minimum, base));

  return {
    size,
    nameSize: Math.round(clamp(size / 5.2, isMobile ? 8 : 11, isMobile ? 10 : 13)),
    weaponSize: Math.round(clamp(size / 7.2, isMobile ? 7 : 8, isMobile ? 9 : 10)),
  };
}

function applyChipSizing(size) {
  memberField.style.setProperty("--fighter-size", `${size.size}px`);
  memberField.style.setProperty("--fighter-name-size", `${size.nameSize}px`);
  memberField.style.setProperty("--fighter-weapon-size", `${size.weaponSize}px`);
}

function initMemberPhysics() {
  if (!memberField || !window.Matter) return;
  if (physicsCleanup) physicsCleanup();

  const { Engine, Events, Runner, Bodies, Body, Composite } = window.Matter;
  winnerDeclared = false;
  memberField.querySelectorAll(".victory-celebration").forEach((item) => item.remove());
  const chips = [...memberField.querySelectorAll(".member-fighter")];
  const fieldBox = memberField.getBoundingClientRect();
  const width = fieldBox.width;
  const height = fieldBox.height;

  if (width < 80 || height < 160 || !chips.length) {
    scheduleMemberPhysics(180);
    return;
  }

  const sizing = calculateChipSizing(width, chips.length);
  applyChipSizing(sizing);
  resetFighterRenderState(chips);
  memberField.offsetWidth;

  const engine = Engine.create();
  engine.positionIterations = 4;
  engine.velocityIterations = 3;
  engine.constraintIterations = 1;
  engine.gravity.y = 0.5;
  const runner = Runner.create();
  const sideInset = Math.round(clamp(width * 0.003, 4, 8));
  const topLimit = Math.round(clamp(height * 0.006, 2, 6));
  const groundY = height - Math.round(clamp(height * 0.012, 4, 10));

  combatants = chips.map((chip, index) => {
    const chipBox = chip.getBoundingClientRect();
    const avatar = chip.querySelector(".fighter-avatar-wrap");
    const avatarBox = avatar?.getBoundingClientRect();
    const fighterSize = sizing.size;
    const chipW = chipBox.width || fighterSize + (width < 560 ? 22 : 34);
    const chipH = chipBox.height || fighterSize + (width < 560 ? 46 : 64);
    const avatarCenterX = avatarBox ? avatarBox.left - chipBox.left + avatarBox.width / 2 : chipW / 2;
    const avatarCenterY = avatarBox
      ? avatarBox.top - chipBox.top + avatarBox.height / 2
      : chipH - fighterSize / 2 - (width < 560 ? 10 : 12);
    const radius = Math.max(width < 560 ? 12 : 16, (avatarBox?.width || fighterSize) / 2);
    const weapon = selectWeapon(index);
    const spawnMinX = sideInset + radius;
    const spawnMaxX = width - sideInset - radius;
    const x = clampInside(randomRange(spawnMinX, Math.max(spawnMinX, spawnMaxX)), spawnMinX, spawnMaxX);
    const y = -randomRange(radius * 1.8, Math.max(radius * 5, height * 0.5)) - index * randomRange(3, 8);
    const body = Bodies.circle(x, y, radius, {
      restitution: 0.08,
      friction: 0.72,
      frictionAir: 0.012,
      density: 0.0018,
    });

    const item = {
      body,
      chip,
      width: chipW,
      height: chipH,
      avatarCenterX,
      avatarCenterY,
      radius,
      maxHp: weapon.maxHp || maxHp,
      hp: weapon.maxHp || maxHp,
      alive: true,
      nextAttackAt: 1000 + (index % 8) * 160,
      nextHopAt: 1200 + (index % 10) * 170,
      lastHopAt: 0,
      nextHitFeedbackAt: 0,
      nextCollisionBounceAt: 0,
      nextStompReactionAt: 0,
      actionUntil: 0,
      targetLockedUntil: 0,
      lastRenderAngle: null,
      lastRenderX: null,
      lastRenderY: null,
      lastWeaponAngle: null,
      lastWeaponAttackAngle: null,
      weaponAimAngle: null,
      weaponAttackAngle: null,
      desiredWeaponAngle: null,
      desiredWeaponAttackAngle: null,
      weapon,
    };
    chip.style.setProperty("--hp", "100%");
    body.fighterItem = item;
    chip.dataset.physicsIndex = String(index);
    chip.physicsItem = item;
    if (!chip.dataset.dragBound) {
      chip.dataset.dragBound = "true";
      chip.addEventListener("pointerdown", startPhysicsDrag);
    }
    return item;
  });

  const wallDepth = Math.max(220, sizing.size * 4);
  const wallOptions = {
    isStatic: true,
    friction: 1,
    frictionStatic: 1,
    restitution: 0,
    slop: 0,
  };
  const wallInnerLeft = sideInset;
  const wallInnerRight = width - sideInset;
  const wallInnerTop = topLimit;
  const wallInnerBottom = groundY;
  const walls = [
    Bodies.rectangle(wallInnerLeft - wallDepth / 2, height / 2, wallDepth, height + wallDepth * 2, {
      ...wallOptions,
      label: "arena-wall-left",
    }),
    Bodies.rectangle(wallInnerRight + wallDepth / 2, height / 2, wallDepth, height + wallDepth * 2, {
      ...wallOptions,
      label: "arena-wall-right",
    }),
    Bodies.rectangle(width / 2, wallInnerTop - wallDepth / 2, width + wallDepth * 2, wallDepth, {
      ...wallOptions,
      label: "arena-wall-top",
    }),
    Bodies.rectangle(width / 2, wallInnerBottom + wallDepth / 2, width + wallDepth * 2, wallDepth, {
      ...wallOptions,
      label: "arena-wall-bottom",
    }),
  ];
  walls.forEach((wall) => {
    wall.fleetWallEdge = wall.label.replace("arena-wall-", "");
  });

  Composite.add(engine.world, [...walls, ...combatants.map((item) => item.body)]);
  const arenaBounds = { width, groundY, sideInset, topLimit };
  activeArenaBounds = arenaBounds;
  Events.on(engine, "afterUpdate", () => {
    combatants.forEach((item) => {
      if (item.alive) keepFighterInBounds(item, arenaBounds, true);
    });
  });
  Events.on(engine, "collisionStart", handleCollisionStart);
  Events.on(engine, "collisionActive", handleWallCollisions);

  let frame = 0;
  function syncDom() {
    combatants.forEach((item) => {
      const { body, chip, alive } = item;
      if (!alive) return;
      const nextX = Math.round((body.position.x - item.avatarCenterX) * 10) / 10;
      const nextY = Math.round((body.position.y - item.avatarCenterY) * 10) / 10;
      const nextAngle = Math.round(body.angle * 1000) / 1000;
      if (nextX !== item.lastRenderX) {
        chip.style.setProperty("--chip-x", `${nextX}px`);
        item.lastRenderX = nextX;
      }
      if (nextY !== item.lastRenderY) {
        chip.style.setProperty("--chip-y", `${nextY}px`);
        item.lastRenderY = nextY;
      }
      if (nextAngle !== item.lastRenderAngle) {
        chip.style.setProperty("--body-rotation", `${nextAngle}rad`);
        item.lastRenderAngle = nextAngle;
      }
      syncWeaponAim(item);
    });
    frame = requestAnimationFrame(syncDom);
  }

  Runner.run(runner, engine);
  syncDom();
  startCombatLoop(engine);

  physicsCleanup = () => {
    cancelAnimationFrame(frame);
    clearInterval(combatTimer);
    combatTimer = null;
    Runner.stop(runner);
    Composite.clear(engine.world, false);
    Engine.clear(engine);
    memberField.querySelectorAll(".is-dragging").forEach((chip) => chip.classList.remove("is-dragging"));
    activeArenaBounds = null;
    physicsCleanup = null;
  };
}

function resetFighterRenderState(chips) {
  chips.forEach((chip) => {
    chip.classList.remove("is-attacking", "is-blocking", "is-hit", "is-dragging", "is-winner");
    chip.style.setProperty("--chip-x", "0px");
    chip.style.setProperty("--chip-y", "0px");
    chip.style.setProperty("--body-rotation", "0rad");
    chip.style.setProperty("--weapon-angle", "-28deg");
    chip.style.setProperty("--weapon-attack-angle", "0rad");
  });
  memberField.querySelectorAll(".projectile").forEach((item) => item.remove());
}

function startCombatLoop(engine) {
  clearInterval(combatTimer);
  combatTimer = setInterval(() => {
    if (winnerDeclared) return;
    const now = performance.now();
    combatants.forEach((attacker) => {
      if (!attacker.alive || winnerDeclared) return;
      const target = getCombatTarget(attacker, now);
      if (target?.item !== attacker.target) {
        attacker.target = target?.item || null;
      }
      if (now < attacker.actionUntil) return;
      if (target) aimWeaponAt(attacker, target.item);
      hopFighter(attacker, now, target);
      if (target) chaseTarget(attacker, target, now);
      if (now < attacker.nextAttackAt) return;
      if (!target || target.distance > attacker.weapon.range) return;
      beginAttack(engine, attacker, target.item, now);
    });
  }, 220);
}

function getCombatTarget(attacker, now = performance.now()) {
  if (attacker.target?.alive) {
    const dx = attacker.target.body.position.x - attacker.body.position.x;
    const dy = attacker.target.body.position.y - attacker.body.position.y;
    const distance = Math.hypot(dx, dy);
    const holdRange = Math.max(260, attacker.weapon.range * 2.15);

    if (distance <= holdRange || now < attacker.targetLockedUntil) return { item: attacker.target, distance };
  }

  const target = findNearestTarget(attacker);
  if (target) attacker.targetLockedUntil = now + randomRange(2800, 4600);
  return target;
}

function keepFighterInBounds(item, bounds, strict = false) {
  if (!window.Matter) return;
  const { Body } = window.Matter;
  const { body } = item;
  const { minX, maxX, minY, maxY } = getFighterLimits(item, bounds);
  const nextX = clampInside(body.position.x, minX, maxX);
  const nextY = clampInside(body.position.y, minY, maxY);
  const maxVelocity = strict ? 7.5 : 9;
  const edgeEpsilon = 0.3;

  if (nextX !== body.position.x || nextY !== body.position.y) {
    const hitHorizontalWall = nextX !== body.position.x;
    const hitVerticalWall = nextY !== body.position.y;
    Body.setPosition(body, { x: nextX, y: nextY });
    Body.setVelocity(body, {
      x: hitHorizontalWall ? 0 : clamp(body.velocity.x, -maxVelocity, maxVelocity),
      y: hitVerticalWall ? 0 : clamp(body.velocity.y, -maxVelocity, maxVelocity),
    });
    if (hitHorizontalWall) body.force.x = 0;
    if (hitVerticalWall) body.force.y = 0;
    Body.setAngularVelocity(body, clamp(body.angularVelocity * 0.35, -0.04, 0.04));
    return;
  }

  if (strict) {
    const atLeftWall = body.position.x <= minX + edgeEpsilon;
    const atRightWall = body.position.x >= maxX - edgeEpsilon;
    const atTopWall = body.position.y <= minY + edgeEpsilon;
    const atFloor = body.position.y >= maxY - edgeEpsilon;
    const blockedX = (atLeftWall && body.velocity.x < 0) || (atRightWall && body.velocity.x > 0);
    const blockedY = (atTopWall && body.velocity.y < 0) || (atFloor && body.velocity.y > 0);
    const cappedX = blockedX ? 0 : clamp(body.velocity.x, -maxVelocity, maxVelocity);
    const cappedY = blockedY ? 0 : clamp(body.velocity.y, -maxVelocity, maxVelocity);

    if ((atLeftWall && body.force.x < 0) || (atRightWall && body.force.x > 0)) {
      body.force.x = 0;
    }
    if ((atTopWall && body.force.y < 0) || (atFloor && body.force.y > 0)) {
      body.force.y = 0;
    }
    if (cappedX !== body.velocity.x || cappedY !== body.velocity.y) {
      Body.setVelocity(body, { x: cappedX, y: cappedY });
    }
    Body.setAngularVelocity(body, clamp(body.angularVelocity, -0.1, 0.1));
  }
}

function lockArenaBoundary(item) {
  if (!item?.alive || !activeArenaBounds) return;
  keepFighterInBounds(item, activeArenaBounds, true);
}

function getFighterLimits(item, bounds) {
  const visualGutter = Math.max(6, Math.round(item.radius * 0.14));
  const leftReach = item.avatarCenterX;
  const rightReach = item.width - item.avatarCenterX;
  const topReach = item.avatarCenterY;
  const bottomReach = item.height - item.avatarCenterY;

  return {
    minX: bounds.sideInset + leftReach + visualGutter,
    maxX: bounds.width - bounds.sideInset - rightReach - visualGutter,
    minY: bounds.topLimit + topReach + visualGutter,
    maxY: bounds.groundY - bottomReach - visualGutter,
  };
}

function beginAttack(engine, attacker, target, now) {
  const windup = attacker.weapon.projectile ? 180 : attacker.weapon.effect === "heavy" ? 260 : 140;
  const recovery = attacker.weapon.projectile ? 520 : attacker.weapon.effect === "heavy" ? 680 : 460;

  attacker.actionUntil = now + windup + recovery;
  attacker.nextAttackAt = attacker.actionUntil + attacker.weapon.cooldown + randomRange(520, 1300);
  attacker.chip.classList.add("is-attacking");
  aimWeaponAt(attacker, target, true);
  setTimeout(() => {
    if (target.alive) attackTarget(engine, attacker, target);
  }, windup);
  setTimeout(() => attacker.chip.classList.remove("is-attacking"), windup + recovery);
}

function aimWeaponAt(attacker, target, immediate = false) {
  const dx = target.body.position.x - attacker.body.position.x;
  const dy = target.body.position.y - attacker.body.position.y;
  const targetAngle = Math.atan2(dy, dx);
  const relativeAngle = targetAngle - attacker.body.angle + ((attacker.weapon.aimOffset || 0) * Math.PI) / 180;

  attacker.desiredWeaponAngle = relativeAngle;
  attacker.desiredWeaponAttackAngle = targetAngle;

  if (immediate || attacker.weaponAimAngle === null) {
    setWeaponAimAngles(attacker, relativeAngle, targetAngle);
  }
}

function syncWeaponAim(fighter) {
  if (fighter.desiredWeaponAngle === null || fighter.desiredWeaponAttackAngle === null) return;
  if (performance.now() < fighter.actionUntil) return;

  const currentWeaponAngle = fighter.weaponAimAngle ?? fighter.desiredWeaponAngle;
  const currentAttackAngle = fighter.weaponAttackAngle ?? fighter.desiredWeaponAttackAngle;
  const nextWeaponAngle = currentWeaponAngle + normalizeAngleDelta(fighter.desiredWeaponAngle - currentWeaponAngle) * 0.18;
  const nextAttackAngle = currentAttackAngle + normalizeAngleDelta(fighter.desiredWeaponAttackAngle - currentAttackAngle) * 0.2;

  setWeaponAimAngles(fighter, nextWeaponAngle, nextAttackAngle);
}

function setWeaponAimAngles(fighter, weaponAngle, attackAngle) {
  if (fighter.lastWeaponAngle === null || Math.abs(normalizeAngleDelta(weaponAngle - fighter.lastWeaponAngle)) > 0.004) {
    fighter.chip.style.setProperty("--weapon-angle", `${weaponAngle}rad`);
    fighter.lastWeaponAngle = weaponAngle;
  }
  if (fighter.lastWeaponAttackAngle === null || Math.abs(normalizeAngleDelta(attackAngle - fighter.lastWeaponAttackAngle)) > 0.004) {
    fighter.chip.style.setProperty("--weapon-attack-angle", `${attackAngle}rad`);
    fighter.lastWeaponAttackAngle = attackAngle;
  }
  fighter.weaponAimAngle = weaponAngle;
  fighter.weaponAttackAngle = attackAngle;
}

function hopFighter(fighter, now, target) {
  if (now < fighter.nextHopAt || !window.Matter) return;
  const { Body } = window.Matter;
  const hasTarget = Boolean(target?.item?.alive);
  const dx = hasTarget ? target.item.body.position.x - fighter.body.position.x : 0;
  const dy = hasTarget ? target.item.body.position.y - fighter.body.position.y : 0;
  const distance = Math.max(1, target?.distance || 1);
  const randomDirection = Math.random() < 0.5 ? -1 : 1;
  const targetDirection = hasTarget ? dx / distance : randomDirection;
  const direction = hasTarget && Math.random() > 0.12 ? Math.sign(targetDirection || randomDirection) : randomDirection;
  const leapScale = hasTarget ? clamp(distance / 180, 0.72, 1.28) : 1;
  const support = findJumpSupport(fighter);
  const horizontalVelocity = hasTarget
    ? targetDirection * randomRange(4.1, 7.4) * leapScale + randomRange(-0.9, 0.9)
    : randomRange(3.2, 6.1) * randomDirection;
  const supportLift = support ? randomRange(0.4, 1.1) : 0;
  const verticalVelocity =
    -randomRange(6.4, 10.2) - supportLift - (hasTarget && dy < -18 ? randomRange(0.5, 1.6) : 0);
  const spin = randomRange(0.024, 0.074) * direction;

  Body.setVelocity(fighter.body, {
    x: clamp(fighter.body.velocity.x * 0.22 + horizontalVelocity, -10, 10),
    y: clamp(fighter.body.velocity.y * 0.18 + verticalVelocity, -12, -5),
  });
  lockArenaBoundary(fighter);
  if (support) applyStompReaction(fighter, support, horizontalVelocity, direction, now);
  Body.setAngularVelocity(fighter.body, fighter.body.angularVelocity + spin);
  lockArenaBoundary(fighter);
  fighter.lastHopAt = now;
  fighter.nextHopAt = now + (hasTarget ? randomRange(1100, 2100) : randomRange(1400, 2600));
}

function findJumpSupport(fighter) {
  let support = null;
  let bestScore = Infinity;

  combatants.forEach((candidate) => {
    if (!candidate.alive || candidate === fighter) return;
    const dx = candidate.body.position.x - fighter.body.position.x;
    const dy = candidate.body.position.y - fighter.body.position.y;
    const contactRange = fighter.radius + candidate.radius + 20;
    const distance = Math.hypot(dx, dy);
    const roughlyUnderfoot = dy > -fighter.radius * 0.25 && dy < contactRange;
    const closeEnough = Math.abs(dx) < contactRange * 0.78 && distance < contactRange;

    if (!roughlyUnderfoot || !closeEnough) return;
    const score = distance + Math.max(0, -dy) * 0.6;
    if (score < bestScore) {
      bestScore = score;
      support = candidate;
    }
  });

  return support;
}

function applyStompReaction(fighter, support, horizontalVelocity, direction, now) {
  if (!window.Matter || now < support.nextStompReactionAt) return;
  const { Body } = window.Matter;
  const dx = support.body.position.x - fighter.body.position.x;
  const pushDirection = Math.sign(dx || -direction || -horizontalVelocity || 1);
  const reverseKick = -Math.sign(horizontalVelocity || direction || 1);

  Body.setVelocity(support.body, {
    x: clamp(support.body.velocity.x * 0.45 + pushDirection * randomRange(1.1, 2.4) + reverseKick * randomRange(0.3, 0.9), -7, 7),
    y: clamp(support.body.velocity.y * 0.55 + randomRange(1.0, 2.2), -6, 8),
  });
  Body.setAngularVelocity(support.body, support.body.angularVelocity + pushDirection * randomRange(0.018, 0.052));
  lockArenaBoundary(support);
  support.nextStompReactionAt = now + randomRange(520, 900);
}

function chaseTarget(attacker, target, now) {
  if (!window.Matter || target.distance < 28) return;
  if (now - (attacker.lastHopAt || 0) < 760) return;

  const { Body } = window.Matter;
  const dx = target.item.body.position.x - attacker.body.position.x;
  const dy = target.item.body.position.y - attacker.body.position.y;
  const distance = Math.max(1, target.distance);
  const isRanged = Boolean(attacker.weapon.projectile);
  const rangeFactor = isRanged && distance < attacker.weapon.range * 0.72 ? -0.55 : 1;
  const chaseStrength = isRanged ? 0.0016 : attacker.weapon.kind === "shield" ? 0.0018 : 0.0022;

  Body.applyForce(attacker.body, attacker.body.position, {
    x: (dx / distance) * chaseStrength * rangeFactor,
    y: clamp((dy / distance) * chaseStrength * 0.12, -0.0006, 0.001),
  });
  lockArenaBoundary(attacker);
}

function handleCollisionStart(event) {
  if (!window.Matter) return;

  handleWallCollisions(event);
  event.pairs.forEach((pair) => {
    nudgeCollisionBody(pair.bodyA, pair.bodyB);
    nudgeCollisionBody(pair.bodyB, pair.bodyA);
  });
}

function handleWallCollisions(event) {
  if (!window.Matter) return;

  event.pairs.forEach((pair) => {
    absorbWallCollision(pair.bodyA, pair.bodyB);
    absorbWallCollision(pair.bodyB, pair.bodyA);
  });
}

function absorbWallCollision(body, otherBody) {
  const item = body.fighterItem;
  const edge = otherBody?.fleetWallEdge;
  if (!item?.alive || !edge) return;

  const { Body } = window.Matter;
  const velocity = { x: body.velocity.x, y: body.velocity.y };
  const bounds = activeArenaBounds;

  if (edge === "left" || edge === "right") {
    velocity.x = 0;
    body.force.x = 0;
  }
  if (edge === "top" || edge === "bottom") {
    velocity.y = 0;
    body.force.y = 0;
  }

  Body.setVelocity(body, velocity);
  Body.setAngularVelocity(body, clamp(body.angularVelocity * 0.45, -0.035, 0.035));
  if (bounds) {
    const limits = getFighterLimits(item, bounds);
    const nextPosition = {
      x: edge === "left" ? limits.minX : edge === "right" ? limits.maxX : clampInside(body.position.x, limits.minX, limits.maxX),
      y: edge === "top" ? limits.minY : edge === "bottom" ? limits.maxY : clampInside(body.position.y, limits.minY, limits.maxY),
    };
    Body.setPosition(body, nextPosition);
  }
  lockArenaBoundary(item);
}

function nudgeCollisionBody(body, otherBody) {
  const item = body.fighterItem;
  if (!item?.alive || !otherBody?.fighterItem) return;

  const now = performance.now();
  if (now < item.nextCollisionBounceAt) return;

  const { Body } = window.Matter;
  const relativeVelocityX = body.velocity.x - otherBody.velocity.x;
  const relativeVelocityY = body.velocity.y - otherBody.velocity.y;
  const impactSpeed = Math.hypot(relativeVelocityX, relativeVelocityY);
  const dx = body.position.x - otherBody.position.x;
  const dy = body.position.y - otherBody.position.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const bounce = clamp(impactSpeed * 0.0022, 0.005, 0.025);
  const sideBias = randomRange(-0.009, 0.009);

  Body.applyForce(body, body.position, {
    x: (dx / distance) * bounce + sideBias,
    y: (dy / distance) * bounce - randomRange(0.003, 0.014),
  });
  Body.setAngularVelocity(body, body.angularVelocity + randomRange(-0.08, 0.08));
  lockArenaBoundary(item);
  item.nextCollisionBounceAt = now + randomRange(120, 260);
}

function findNearestTarget(attacker) {
  let bestTarget = null;
  let bestDistance = Infinity;

  combatants.forEach((target) => {
    if (!target.alive || target === attacker) return;
    const dx = target.body.position.x - attacker.body.position.x;
    const dy = target.body.position.y - attacker.body.position.y;
    const distance = Math.hypot(dx, dy);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestTarget = target;
    }
  });

  return bestTarget ? { item: bestTarget, distance: bestDistance } : null;
}

function attackTarget(engine, attacker, target) {
  if (attacker.weapon.projectile) {
    fireProjectile(engine, attacker, target);
    return;
  }

  resolveAttackHit(engine, attacker, target);
}

function fireProjectile(engine, attacker, target) {
  const { Body } = window.Matter;
  const dx = target.body.position.x - attacker.body.position.x;
  const dy = target.body.position.y - attacker.body.position.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const travelMs = Math.round(clamp(distance * 2.1, 280, 680));

  Body.applyForce(attacker.body, attacker.body.position, {
    x: (-dx / distance) * 0.008,
    y: -0.004,
  });
  lockArenaBoundary(attacker);
  drawProjectile(attacker.body.position, target.body.position, attacker.weapon, travelMs);
  setTimeout(() => {
    if (target.alive) {
      resolveAttackHit(engine, attacker, target);
    }
  }, Math.round(travelMs * 0.82));
}

function resolveAttackHit(engine, attacker, target) {
  const { Body, Composite } = window.Matter;
  const now = performance.now();
  let damage = Math.round(attacker.weapon.damage * (0.82 + Math.random() * 0.36));
  const dx = target.body.position.x - attacker.body.position.x;
  const dy = target.body.position.y - attacker.body.position.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const blocked = target.weapon.blockChance && Math.random() < target.weapon.blockChance;
  const showHitFeedback = now >= (target.nextHitFeedbackAt || 0);
  const knockbackScale = attacker.weapon.knockback || 1;
  const push = (0.012 + attacker.weapon.damage * 0.00125) * knockbackScale;

  if (blocked) {
    damage = Math.max(1, Math.round(damage * (1 - target.weapon.damageReduction)));
    aimWeaponAt(target, attacker);
    if (showHitFeedback) target.chip.classList.add("is-blocking");
    Body.applyForce(attacker.body, attacker.body.position, {
      x: (-dx / distance) * 0.028,
      y: (-dy / distance) * 0.018 - 0.012,
    });
    lockArenaBoundary(attacker);
    if (showHitFeedback) setTimeout(() => target.chip.classList.remove("is-blocking"), 260);
  }

  Body.applyForce(target.body, target.body.position, {
    x: (dx / distance) * push,
    y: (dy / distance) * push - 0.009 - attacker.weapon.damage * 0.00035,
  });
  lockArenaBoundary(target);

  target.hp = Math.max(0, target.hp - damage);
  target.chip.style.setProperty("--hp", `${(target.hp / target.maxHp) * 100}%`);
  if (showHitFeedback) {
    target.nextHitFeedbackAt = now + randomRange(560, 820);
    target.chip.classList.add("is-hit");
    setTimeout(() => target.chip.classList.remove("is-hit"), 260);
  }

  if (target.hp <= 0) {
    target.alive = false;
    target.chip.classList.add("is-dead");
    checkBattleWinner();
    setTimeout(() => {
      Composite.remove(engine.world, target.body);
      target.chip.remove();
    }, 240);
  }
}

function checkBattleWinner() {
  const alive = combatants.filter((item) => item.alive);
  if (alive.length === 0) {
    celebrateNoSurvivors();
    return;
  }
  if (winnerDeclared) return;
  if (alive.length === 1) celebrateWinner(alive[0]);
}

function celebrateWinner(winner) {
  if (!memberField || !winner?.alive) return;
  winnerDeclared = true;
  clearInterval(combatTimer);
  combatTimer = null;
  winner.chip.classList.add("is-winner");

  if (window.Matter) {
    const { Body } = window.Matter;
    Body.setVelocity(winner.body, {
      x: clamp(winner.body.velocity.x * 0.12, -1.8, 1.8),
      y: clamp(Math.max(winner.body.velocity.y, 0), 0, 3),
    });
    Body.setAngularVelocity(winner.body, clamp(winner.body.angularVelocity * 0.3, -0.03, 0.03));
    lockArenaBoundary(winner);
  }

  const winnerName = winner.chip.querySelector(".fighter-name")?.textContent?.trim() || "GVY";
  const celebration = document.createElement("div");
  const banner = document.createElement("div");
  const palette = ["pink", "green", "yellow", "red"];

  celebration.className = "victory-celebration";
  celebration.setAttribute("aria-hidden", "true");
  banner.className = "victory-banner";
  banner.textContent = `🎉 ${winnerName} 胜利！`;
  celebration.appendChild(banner);

  for (let index = 0; index < 72; index += 1) {
    const piece = document.createElement("span");
    const emojiPiece = index % 13 === 0;
    piece.className = `confetti-piece ${palette[index % palette.length]}${emojiPiece ? " party" : ""}`;
    piece.textContent = emojiPiece ? "🎉" : "";
    piece.style.setProperty("--confetti-x", `${randomRange(0, 100)}%`);
    piece.style.setProperty("--confetti-drift", `${randomRange(-120, 120)}px`);
    piece.style.setProperty("--confetti-delay", `${randomRange(0, 1.35)}s`);
    piece.style.setProperty("--confetti-duration", `${randomRange(3.1, 5.2)}s`);
    piece.style.setProperty("--confetti-spin", `${randomRange(-420, 420)}deg`);
    celebration.appendChild(piece);
  }

  memberField.appendChild(celebration);
  setTimeout(() => celebration.classList.add("is-fading"), 6200);
}

function celebrateNoSurvivors() {
  if (!memberField) return;
  winnerDeclared = true;
  clearInterval(combatTimer);
  combatTimer = null;
  combatants.forEach((item) => item.chip.classList.remove("is-winner"));
  memberField.querySelectorAll(".victory-celebration").forEach((item) => item.remove());

  const celebration = document.createElement("div");
  const banner = document.createElement("div");
  const palette = ["red", "yellow", "pink"];

  celebration.className = "victory-celebration no-survivors";
  celebration.setAttribute("aria-hidden", "true");
  banner.className = "victory-banner";
  banner.textContent = "💥 无人生还";
  celebration.appendChild(banner);

  for (let index = 0; index < 84; index += 1) {
    const piece = document.createElement("span");
    const burstPiece = index % 12 === 0;
    piece.className = `confetti-piece ${palette[index % palette.length]}${burstPiece ? " party" : ""}`;
    piece.textContent = burstPiece ? "✦" : "";
    piece.style.setProperty("--confetti-x", `${randomRange(0, 100)}%`);
    piece.style.setProperty("--confetti-drift", `${randomRange(-150, 150)}px`);
    piece.style.setProperty("--confetti-delay", `${randomRange(0, 1.2)}s`);
    piece.style.setProperty("--confetti-duration", `${randomRange(3.4, 5.6)}s`);
    piece.style.setProperty("--confetti-spin", `${randomRange(-540, 540)}deg`);
    celebration.appendChild(piece);
  }

  memberField.appendChild(celebration);
  setTimeout(() => celebration.classList.add("is-fading"), 6800);
}

function drawProjectile(from, to, weapon, travelMs) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = Math.atan2(dy, dx);
  const projectile = document.createElement("span");
  const img = document.createElement("img");

  projectile.className = `projectile projectile-${weapon.projectile}`;
  projectile.style.left = `${from.x}px`;
  projectile.style.top = `${from.y}px`;
  projectile.style.setProperty("--fly-x", `${dx}px`);
  projectile.style.setProperty("--fly-y", `${dy}px`);
  projectile.style.setProperty("--projectile-angle", `${angle}rad`);
  projectile.style.setProperty("--travel-ms", `${travelMs}ms`);
  img.src = weapon.projectileIcon;
  img.alt = "";
  projectile.appendChild(img);
  memberField.appendChild(projectile);
  setTimeout(() => projectile.remove(), travelMs + 80);
}

function startPhysicsDrag(event) {
  const item = event.currentTarget.physicsItem;
  if (!item || !window.Matter) return;
  event.preventDefault();

  const { Body } = window.Matter;
  const fieldBox = memberField.getBoundingClientRect();
  const chipLeft = fieldBox.left + item.body.position.x - item.avatarCenterX;
  const chipTop = fieldBox.top + item.body.position.y - item.avatarCenterY;

  activePhysicsDrag = {
    item,
    fieldBox,
    offsetX: event.clientX - chipLeft,
    offsetY: event.clientY - chipTop,
    lastX: event.clientX,
    lastY: event.clientY,
    lastTime: performance.now(),
    velocityX: 0,
    velocityY: 0,
  };

  Body.setVelocity(item.body, { x: 0, y: 0 });
  Body.setAngularVelocity(item.body, 0);
  Body.setStatic(item.body, true);
  item.chip.classList.add("is-dragging");
  item.chip.setPointerCapture?.(event.pointerId);
  window.addEventListener("pointermove", movePhysicsDrag);
  window.addEventListener("pointerup", endPhysicsDrag);
}

function movePhysicsDrag(event) {
  if (!activePhysicsDrag || !window.Matter) return;
  const { Body } = window.Matter;
  const now = performance.now();
  const { item, fieldBox } = activePhysicsDrag;
  const bounds = activeArenaBounds || {
    width: fieldBox.width,
    groundY: fieldBox.height - 20,
    topLimit: 20,
    sideInset: 14,
  };
  const { sideInset, groundY, topLimit } = bounds;
  const { minX, maxX, minY, maxY } = getFighterLimits(item, { ...bounds, sideInset, groundY, topLimit });
  const nextX = clampInside(
    event.clientX - fieldBox.left - activePhysicsDrag.offsetX + item.avatarCenterX,
    minX,
    maxX,
  );
  const nextY = clampInside(
    event.clientY - fieldBox.top - activePhysicsDrag.offsetY + item.avatarCenterY,
    minY,
    maxY,
  );
  const dt = Math.max(1, now - activePhysicsDrag.lastTime);

  activePhysicsDrag.velocityX = ((event.clientX - activePhysicsDrag.lastX) / dt) * 16;
  activePhysicsDrag.velocityY = ((event.clientY - activePhysicsDrag.lastY) / dt) * 16;
  Body.setPosition(item.body, { x: nextX, y: nextY });
  lockArenaBoundary(item);
  activePhysicsDrag.lastX = event.clientX;
  activePhysicsDrag.lastY = event.clientY;
  activePhysicsDrag.lastTime = now;
}

function endPhysicsDrag() {
  if (!activePhysicsDrag || !window.Matter) return;
  const { Body } = window.Matter;
  const { item, velocityX, velocityY } = activePhysicsDrag;

  Body.setStatic(item.body, false);
  Body.setVelocity(item.body, {
    x: clamp(velocityX, -12, 12),
    y: clamp(velocityY, -12, 12),
  });
  lockArenaBoundary(item);
  item.chip.classList.remove("is-dragging");
  activePhysicsDrag = null;
  window.removeEventListener("pointermove", movePhysicsDrag);
  window.removeEventListener("pointerup", endPhysicsDrag);
}

  function activateBrawl() {
    shouldRunBrawl = true;
    if (!brawlRendered) {
      brawlRendered = true;
      renderMemberWall();
      return;
    }

    if (battleStarted && !brawlActive && !prefersReducedMotion) {
      brawlActive = true;
      scheduleMemberPhysics(80);
    }
  }

  function pauseBrawl() {
    shouldRunBrawl = false;
    if (!brawlActive) return;
    if (physicsCleanup) physicsCleanup();
    brawlActive = false;
  }

  function startBattle() {
    if (!brawlRendered) {
      brawlRendered = true;
      renderMemberWall();
    }
    battleStarted = true;
    shouldRunBrawl = true;
    memberTerminal?.classList.remove("is-awaiting-battle");
    memberTerminal?.classList.add("is-battle-live");
    startButton?.setAttribute("disabled", "true");

    if (prefersReducedMotion) return;
    brawlActive = true;
    scheduleMemberPhysics(20);
  }

  startButton?.addEventListener("click", startBattle);

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) activateBrawl();
          else pauseBrawl();
        });
      },
      { rootMargin: "260px 0px", threshold: 0.08 },
    );
    observer.observe(memberField);
  } else {
    activateBrawl();
  }
})();
