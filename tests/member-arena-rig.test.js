import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const warnings = [], context = { module: { exports: {} }, exports: {}, console: {
  ...console, warn: (...args) => warnings.push(args.join(" ")),
} };
for (const file of ["vendor/matter.min.js", "js/member-arena-motion.js", "js/member-arena-weapon-profile.js", "js/member-arena-rig.js"]) {
  runInNewContext(readFileSync(new URL("../assets/" + file, import.meta.url), "utf8"), context);
}
const M = context.module.exports, motion = context.GVYArenaMotion, profile = context.GVYArenaWeaponProfile;
const near = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const plain = (value) => JSON.parse(JSON.stringify(value));
function setup(id = "sword", unit = 30, definition = profile.weapons[id]) {
  const engine = M.Engine.create({ positionIterations: 10, velocityIterations: 10, constraintIterations: 6 });
  engine.gravity.y = 0;
  const owner = M.Bodies.circle(200, 200, .56 * unit, { isStatic: true });
  M.Composite.add(engine.world, owner);
  const rig = context.GVYArenaRig.create({ Matter: M, motion, world: engine.world, ownerBody: owner,
    definition, handProfile: profile.hand, unit, collisionGroup: M.Body.nextGroup(true) });
  const step = (count = 1) => {
    for (let i = 0; i < count; i++) { rig.beforeStep(.02); M.Engine.update(engine, 20); rig.afterStep(); }
  };
  return { engine, owner, rig, step };
}

test("all twelve source weapons have finite physical compound colliders and stable actual grip constraints", () => {
  const ids = Object.keys(profile.weapons).filter((id) => id !== "fists");
  assert.equal(ids.length, 12);
  for (const id of ids) {
    const { engine, owner, rig, step } = setup(id);
    assert.equal(rig.bodies.length, 3); assert.equal(rig.constraints.length, 3);
    near(rig.weaponBody.mass, profile.weapons[id].mass);
    near(rig.armBody.mass, 1); near(rig.fistBody.mass, 1);
    rig.command({ target: { x: 224, y: 200 }, aim: 0 }); step(200);
    const pose = rig.pose();
    assert.ok(distance(pose.hand, pose.anchor) < .1, `${id}: actual hinge must meet the fist`);
    assert.ok(distance(pose.hand, { x: 224, y: 200 }) < .1, `${id}: motor must reach the target`);
    for (const body of rig.bodies) {
      assert.ok([body.position.x, body.position.y, body.angle, body.mass, body.inertia].every(Number.isFinite));
      assert.equal(M.Detector.canCollide(body.collisionFilter, owner.collisionFilter), false);
    }
    assert.equal(rig.weaponBody.plugin.heldCollisionDamage, profile.weapons[id].stats.collisionDamage);
    rig.dispose(); assert.equal(M.Composite.allBodies(engine.world).length, 1);
  }
  assert.ok(!warnings.some((line) => /decomp|fromVertices/.test(line)), warnings.join("\n"));
});

test("fists have one actual contact body and a carrier, with no duplicated held weapon", () => {
  const { engine, rig, step } = setup("fists");
  assert.equal(rig.weaponBody, null); assert.equal(rig.bodies.length, 2); assert.equal(rig.constraints.length, 2);
  near(rig.fistBody.circleRadius, profile.hand.fistRadius * rig.unit);
  assert.equal(rig.fistBody.plugin.heldCollisionDamage, true);
  rig.command({ target: { x: 224, y: 200 }, aim: 0 }); step(100);
  assert.equal(rig.pose().weapon, null); assert.ok(distance(rig.pose().hand, { x: 224, y: 200 }) < .1);
  rig.dispose(); assert.equal(M.Composite.allBodies(engine.world).length, 1);
});

test("every canonical item can be created when optional circle centers are omitted", () => {
  for (const id of Object.keys(profile.weapons)) {
    const def = plain(profile.weapons[id]);
    for (const collider of def.colliders) if (collider.type === "circle") delete collider.center;
    const { rig, step } = setup(id, 30, def); step(5);
    assert.ok(rig.bodies.every((body) => Number.isFinite(body.position.x) && Number.isFinite(body.position.y)));
    rig.dispose();
  }
});

test("a changed aim is followed by real torque rather than instant angle assignment", () => {
  const { rig, step } = setup("sword");
  rig.command({ target: { x: 224, y: 200 }, aim: 0 }); step(100);
  const start = rig.weaponBody.angle;
  rig.command({ target: { x: 200, y: 224 }, aim: Math.PI / 2 });
  near(rig.weaponBody.angle, start);
  rig.beforeStep(.02); near(rig.weaponBody.angle, start);
  let previous = start, maximumStep = 0;
  for (let i = 0; i < 200; i++) {
    step(); const angle = rig.weaponBody.angle;
    maximumStep = Math.max(maximumStep, Math.abs(motion.wrapRadians(angle - previous))); previous = angle;
    assert.ok(distance(rig.pose().anchor, rig.pose().hand) < .5);
  }
  assert.ok(maximumStep < .5, `one physical step moved ${maximumStep} radians`);
  assert.ok(Math.abs(motion.wrapRadians(rig.weaponBody.angle - Math.PI)) < .03);
  assert.ok(distance(rig.pose().hand, { x: 200, y: 224 }) < .3);
});

test("rapidly changing hand targets cannot stretch the physical rail beyond its source limit", () => {
  for (const id of ["fists", "sword", "axe", "bow"]) {
    const { owner, rig, step } = setup(id);
    for (let i = 0; i < 600; i++) {
      const angle = Math.sin(i * .04) * Math.PI, reach = (i < 400 ? 1.2 : .4) * rig.unit;
      rig.command({ target: { x: owner.position.x + Math.cos(angle) * reach,
        y: owner.position.y + Math.sin(angle) * reach }, aim: angle });
      step();
      assert.ok(distance(rig.fistBody.position, rig.armBody.position) <= reach + 1e-7,
        `${id}: slider stretched beyond ${reach} pixels`);
      assert.ok(distance(rig.pose().anchor, rig.pose().hand) < .6, `${id}: projection must retain the physical grip`);
      assert.ok(rig.bodies.every((b) => [b.position.x, b.position.y, b.angle].every(Number.isFinite)));
    }
    rig.dispose();
  }
});

test("native rotation uses physical fist.right, extension factor, inverse two-minus-factor and lock priority", () => {
  const { rig, step } = setup("sword");
  rig.command({ target: { x: 218, y: 200 }, aim: Math.PI / 2, animating: false,
    lockRotation: false, pointingAt: false, targetDistance: 300000 });
  step(400);
  // Physical fist.right remains horizontal, despite a vertical look aim. The
  // finite ten-unit target introduces the original COM parallax near 48deg.
  let degrees = motion.wrapDegrees(rig.weaponBody.angle / (Math.PI / 180));
  assert.ok(degrees > 45 && degrees < 50);
  rig.command({ pointingAt: true, aim: 0 }); step(400);
  near(motion.wrapDegrees(rig.weaponBody.angle / (Math.PI / 180)), 45, .01);
  rig.command({ inverse: true }); step(400);
  near(motion.wrapDegrees(rig.weaponBody.angle / (Math.PI / 180)), 135, .01);
  rig.command({ animating: true, lockRotationToAngle: true }); step(400);
  near(motion.wrapDegrees(rig.weaponBody.angle / (Math.PI / 180)), 90, .01);
});

test("weapon origin differs from compound COM and the actual source grip/shape mirror together", () => {
  const { rig, step } = setup("axe");
  rig.command({ target: { x: 224, y: 200 }, aim: 0 }); step(150);
  const originalBody = rig.weaponBody;
  assert.ok(distance(rig.pose().origin, rig.weaponBody.position) > 1);
  for (const inverse of [true, false, true]) {
    rig.command({ inverse });
    assert.equal(rig.weaponBody, originalBody);
    const pose = rig.pose(), def = profile.weapons.axe;
    assert.equal(pose.scaleX, inverse ? -1 : 1); assert.equal(pose.scaleY, 1);
    assert.ok(distance(pose.hand, pose.anchor) < 1e-6);
    const expectedGrip = motion.localToWorld({ x: def.anchor.x * rig.unit * pose.scaleX,
      y: -def.anchor.y * rig.unit * pose.scaleY }, pose.origin, pose.origin.angle);
    assert.ok(distance(expectedGrip, pose.anchor) < 1e-6);
    const vertices = originalBody.parts.slice(1).flatMap((part) => part.vertices);
    const source = def.colliders.flatMap((collider) => collider.points);
    for (const vertex of vertices) {
      const local = motion.worldToLocal(vertex, pose.origin, pose.origin.angle, rig.unit);
      assert.ok(source.some((p) => distance(local, { x: p.x * pose.scaleX, y: -p.y * pose.scaleY }) < 1e-7));
    }
    const minX = Math.min(...vertices.map((p) => p.x)), maxX = Math.max(...vertices.map((p) => p.x));
    near(originalBody.bounds.min.x, minX, .1); near(originalBody.bounds.max.x, maxX, .1);
    step(5);
  }
});

test("source spell bodies remain solid while held-item damage is disabled", () => {
  for (const id of ["bow", "fire", "superfire", "bomb"]) {
    const { rig } = setup(id);
    assert.equal(rig.weaponBody.isSensor, false);
    assert.ok(rig.weaponBody.parts.slice(1).every((part) => !part.isSensor));
    assert.equal(rig.weaponBody.plugin.heldCollisionDamage, false);
    assert.equal(rig.fistBody.plugin.heldCollisionDamage, false);
    rig.dispose();
  }
});

test("real scene contacts block a motor-driven blade instead of the hand target pulling it through", () => {
  for (const unit of [12, 30, 60]) {
    const { engine, rig, step } = setup("sword", unit);
    const wall = M.Bodies.rectangle(200 + 3.5 * unit, 200, unit / 3, unit * 7, { isStatic: true });
    M.Composite.add(engine.world, wall);
    rig.command({ target: { x: 200 + 1.2 * unit, y: 200 }, aim: 0 });
    let contacts = 0, worstSettledDepth = 0;
    for (let i = 0; i < 400; i++) {
      step();
      const collisions = M.Query.collides(rig.weaponBody, [wall]); contacts += collisions.length;
      if (i > 200) worstSettledDepth = Math.max(worstSettledDepth, 0, ...collisions.map((c) => c.depth));
    }
    assert.ok(contacts > 0, "weapon must participate in actual solid contacts");
    assert.ok(worstSettledDepth < unit * .04, `contact penetration ${worstSettledDepth} at unit ${unit}`);
    assert.ok(rig.pose().tip.x < wall.bounds.max.x, "blade must not cross the entire wall");
    assert.ok(distance(rig.pose().anchor, rig.pose().hand) < .1);
    rig.dispose();
  }
});

test("reset and resize synchronize both interpolation frames and preserve physical grip, mass and scale", () => {
  const { owner, rig, step } = setup("sword");
  rig.command({ target: { x: 224, y: 200 }, aim: 0 }); step(100);
  const before = rig.pose(), radius = rig.fistBody.circleRadius;
  M.Body.setPosition(owner, { x: 400, y: 300 });
  rig.resize(45, (p) => ({ x: p.x * 2, y: p.y * 1.5 }));
  near(rig.unit, 45); near(rig.fistBody.circleRadius, radius * 1.5); near(rig.weaponBody.mass, 3);
  const resized = rig.pose();
  near(resized.origin.x, 400 + (before.origin.x - 200) * 1.5);
  near(resized.origin.y, 300 + (before.origin.y - 200) * 1.5);
  assert.ok(distance(resized.anchor, resized.hand) < .1);
  assert.deepEqual(plain(rig.pose(.2)), plain(rig.pose(.8)));
  step(50); assert.ok(distance(rig.pose().anchor, rig.pose().hand) < .1);
  M.Body.setPosition(owner, { x: 40, y: 80 }); rig.reset({ x: 40, y: 80, aim: 1 });
  assert.deepEqual(plain(rig.pose(0)), plain(rig.pose(1)));
  assert.ok(distance(rig.armBody.position, owner.position) < 1e-8);
  step(20); assert.ok(distance(rig.pose().anchor, rig.pose().hand) < .2);
});

test("detaching transfers the real body and origin offset; disposal never removes it or unrelated objects", () => {
  const { engine, rig, step } = setup("sword"); step(50);
  const sentinel = M.Bodies.rectangle(500, 500, 20, 20, { isStatic: true }); M.Composite.add(engine.world, sentinel);
  const before = rig.pose(), original = rig.weaponBody, released = rig.detachWeapon();
  assert.equal(released.body, original); assert.equal(rig.weaponBody, null); assert.equal(rig.constraints.length, 2);
  const root = motion.localToWorld(released.originOffset, released.body.position, released.body.angle);
  assert.ok(distance(root, before.origin) < 1e-7);
  rig.dispose(); rig.dispose();
  assert.deepEqual(plain(M.Composite.allBodies(engine.world).map((b) => b.id).sort()),
    [engine.world.bodies[0].id, sentinel.id, original.id].sort());
  assert.ok(M.Composite.allBodies(engine.world).includes(original));
  assert.equal(M.Composite.allConstraints(engine.world).length, 0);
  M.Body.setVelocity(original, { x: 3, y: -1 });
  const x = original.position.x; M.Engine.update(engine, 20); assert.ok(original.position.x > x);
});

test("pickup adopts the same released body, rescales its source origin and transfers ownership exactly once", () => {
  const { engine, owner, rig, step } = setup("axe");
  rig.command({ inverse: true, target: { x: 224, y: 200 }, aim: 0 }); step(100);
  const released = rig.detachWeapon(), body = released.body, oldGroup = owner.collisionFilter.group;
  const originalParts = body.parts.map((part) => part.id);
  rig.dispose();
  const nextOwner = M.Bodies.circle(450, 200, .56 * 45, { isStatic: true });
  M.Composite.add(engine.world, nextOwner);
  const next = context.GVYArenaRig.create({ Matter: M, motion, world: engine.world, ownerBody: nextOwner,
    definition: profile.weapons.axe, handProfile: profile.hand, unit: 45,
    collisionGroup: M.Body.nextGroup(true), existingWeapon: released });
  assert.equal(next.weaponBody, body);
  assert.deepEqual(plain(body.parts.map((part) => part.id)), plain(originalParts));
  assert.equal(M.Composite.allBodies(engine.world).filter((candidate) => candidate === body).length, 1);
  assert.equal(M.Composite.allBodies(engine.world).length, 5);
  assert.notEqual(body.collisionFilter.group, oldGroup);
  assert.equal(M.Detector.canCollide(body.collisionFilter, nextOwner.collisionFilter), false);
  assert.equal(M.Detector.canCollide(body.collisionFilter, owner.collisionFilter), true);
  assert.equal(body.plugin.arenaRig, next); assert.equal(body.plugin.heldCollisionDamage, true);
  const pose = next.pose();
  assert.equal(pose.inverse, true); near(body.mass, profile.weapons.axe.mass);
  const root = motion.localToWorld({ x: released.originOffset.x * 1.5,
    y: released.originOffset.y * 1.5 }, body.position, body.angle);
  assert.ok(distance(root, pose.origin) < 1e-7);
  const source = profile.weapons.axe.colliders.flatMap((collider) => collider.points);
  for (const vertex of body.parts.slice(1).flatMap((part) => part.vertices)) {
    const local = motion.worldToLocal(vertex, pose.origin, pose.origin.angle, next.unit);
    assert.ok(source.some((p) => distance(local, { x: -p.x, y: -p.y }) < 1e-7));
  }
  next.command({ target: { x: 477, y: 200 }, aim: 0 });
  for (let i = 0; i < 200; i++) { next.beforeStep(.02); M.Engine.update(engine, 20); next.afterStep(); }
  assert.ok(distance(next.pose().hand, next.pose().anchor) < .1);
  assert.ok(distance(next.pose().hand, { x: 477, y: 200 }) < .1);
  next.dispose();
  assert.deepEqual(plain(M.Composite.allBodies(engine.world).map((b) => b.id).sort()), [owner.id, nextOwner.id].sort());
});

test("invalid commands and timestep values cannot poison a rig or add objects", () => {
  const { engine, rig, step } = setup("sword", 12);
  rig.command({ target: { x: NaN, y: Infinity }, aim: NaN, equipProgress: Infinity });
  for (const dt of [0, -1, NaN, Infinity]) rig.beforeStep(dt);
  rig.resize(0); rig.resize(Infinity); rig.reset({ x: NaN });
  step(50);
  assert.ok(rig.bodies.every((b) => [b.position.x, b.position.y, b.angle].every(Number.isFinite)));
  assert.equal(M.Composite.allBodies(engine.world).length, 4);
  assert.equal(M.Composite.allConstraints(engine.world).length, 3);
  rig.dispose(); rig.beforeStep(.02); rig.afterStep();
  assert.equal(rig.bodies.length, 0);
});

test('a nearby target uses the weapon root even when its COM suggests the opposite direction',()=>{
  const {rig,step}=setup('spear');
  rig.command({target:{x:224,y:200},aim:0,animating:true,lockRotationToAngle:true,pointingAt:false,lookTarget:{x:10000,y:200}});
  step(500);
  const pose=rig.pose(),center=rig.weaponBody.position;
  assert.ok(distance(pose.origin,center)>1);
  const target={x:(pose.origin.x+center.x)/2,y:(pose.origin.y+center.y)/2};
  rig.command({lookTarget:target});
  rig.weaponBody.torque=0;rig.beforeStep(.02);
  const acceleration=rig.weaponBody.torque/rig.weaponBody.inertia*1e6;
  const rootError=motion.wrapRadians(Math.atan2(target.y-pose.origin.y,target.x-pose.origin.x)+Math.PI/2-rig.weaponBody.angle);
  const comError=motion.wrapRadians(Math.atan2(target.y-center.y,target.x-center.x)+Math.PI/2-rig.weaponBody.angle);
  assert.notEqual(Math.sign(rootError),Math.sign(comError));
  assert.equal(Math.sign(acceleration),Math.sign(rootError),'torque must follow the source root, not Matter COM');
  step(20);
  assert.ok(Math.abs(motion.wrapRadians(rig.fistBody.angle-rig.armBody.angle))<1e-8,'slider must keep its relative angle without a second PID');
  rig.dispose();
});
