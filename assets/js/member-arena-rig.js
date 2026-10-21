(() => {
  "use strict";
  // Original masses, grip geometry and PID gains are source measurements. Matter
  // has no Box2D slider motor: the moving rail anchor and torque calibration below
  // are explicit cross-engine approximations, not a frame-equivalent Unity port.
  const finite = Number.isFinite, DEG = Math.PI / 180, BASE = 1 / 60;
  const valid = (p) => p && finite(p.x) && finite(p.y);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const rotate = (p, a) => ({ x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) });
  const copy = (p) => ({ x: p.x, y: p.y });

  function create({ Matter: M, motion, world, ownerBody, definition: def, handProfile: hand = {}, unit, collisionGroup, existingWeapon }) {
    if (!M?.Body || !motion?.triangulateConvexParts || !world || !valid(ownerBody?.position) ||
        !def || !finite(unit) || unit <= 0 || unit > 10000) throw new TypeError("Invalid arena rig configuration");
    if (existingWeapon && (!valid(existingWeapon.body?.position) || !finite(existingWeapon.body.angle) ||
        !Array.isArray(existingWeapon.body.parts) || !valid(existingWeapon.originOffset) ||
        !finite(existingWeapon.unit) || existingWeapon.unit <= 0 || existingWeapon.body.plugin?.arenaRig)) {
      throw new TypeError("Invalid detached arena weapon");
    }
    const group = Number.isInteger(collisionGroup) && collisionGroup < 0 ? collisionGroup : M.Body.nextGroup(true);
    ownerBody.collisionFilter.group = group;
    const filter = () => ({ group, category: 1, mask: 0xffffffff });
    const fistOnly = def.pid == null && def.forwardAngle == null;
    if (fistOnly && existingWeapon) throw new TypeError("Fists cannot adopt a detached weapon");
    const length = finite(hand.length) && hand.length > 0 ? hand.length : 1.2;
    const armMass = finite(hand.armMass) && hand.armMass > 0 ? hand.armMass : 1;
    const fistMass = finite(hand.fistMass) && hand.fistMass > 0 ? hand.fistMass : 1;
    const weaponMass = finite(def.mass) && def.mass > 0 ? def.mass : 3;
    const radius = finite(hand.fistRadius) && hand.fistRadius > 0 ? hand.fistRadius : .2;
    const makePID = (g, fallback) => motion.createPID(g?.Kp ?? fallback[0], g?.Ki ?? fallback[1], g?.Kd ?? fallback[2]);
    const armGains = hand.rotationPid || { Kp: 10, Ki: 0, Kd: 1 };
    const weaponGains = def.pid || armGains;
    const armPID = makePID(armGains, [10, 0, 1]), sliderPID = makePID(hand.sliderPid, [32.5, 0, .1]);
    const weaponPID = makePID(weaponGains, [6, 0, 1]);
    const anchor = valid(def.anchor) ? copy(def.anchor) : { x: 0, y: 0 };
    let inverse = Boolean(existingWeapon?.inverse), disposed = false, detached = false;
    let scaleX = inverse && def.invertX ? -1 : 1, scaleY = inverse && def.invertY ? -1 : 1;
    let weaponBody = null, grip = null, com = { x: 0, y: 0 }, extension = 0;
    let previous, current, rig;
    let command = { target: copy(ownerBody.position), aim: 0, inverse, equipProgress: 1,
      sourceRotation: false, animating: false, lockRotation: false, pointingAt: false,
      targetDistance: 10 * unit, lookTarget: null };
    const sourcePixel = (p) => ({ x: p.x * unit * scaleX, y: -p.y * unit * scaleY });
    const options = (label) => ({ label, friction: .375, restitution: .275, frictionAir: 0, collisionFilter: filter() });
    const shapes = [];
    if (!fistOnly) {
      for (const collider of def.colliders || []) {
        if (collider.type === "circle" && (collider.center == null || valid(collider.center)) && finite(collider.radius) && collider.radius > 0) {
          shapes.push({ circle: copy(collider.center || { x: 0, y: 0 }), radius: collider.radius });
        } else if (collider.type === "polygon") {
          const triangles = motion.triangulateConvexParts(collider.points);
          if (!triangles.length) throw new TypeError("Invalid weapon collider polygon");
          for (const triangle of triangles) shapes.push({ vertices: triangle });
        } else throw new TypeError("Unsupported weapon collider");
      }
      if (!shapes.length) throw new TypeError("Weapon has no solid collider");
    }
    const forward = -(def.forwardAngle || 0) * DEG;
    const direction = { x: Math.cos(forward), y: Math.sin(forward) };
    let tip = copy(anchor), projection = -Infinity;
    for (const shape of shapes) {
      const points = shape.vertices || [{ x: shape.circle.x + direction.x * shape.radius, y: shape.circle.y + direction.y * shape.radius }];
      for (const p of points) {
        const d = (p.x - anchor.x) * direction.x + (p.y - anchor.y) * direction.y;
        if (d > projection) { projection = d; tip = copy(p); }
      }
    }
    const armBody = M.Bodies.circle(ownerBody.position.x, ownerBody.position.y, .08 * unit,
      { ...options("arena-arm"), isSensor: true, collisionFilter: { ...filter(), mask: 0 } });
    const fistBody = M.Bodies.circle(ownerBody.position.x, ownerBody.position.y, radius * unit, options("arena-fist"));
    M.Body.setMass(armBody, armMass); M.Body.setMass(fistBody, fistMass);
    // Effective rail inertia prevents a point-sized carrier receiving unbounded
    // rotational impulses. Source mass remains one; this is Matter calibration.
    const railInertia = () => M.Body.setInertia(armBody, armMass * (length * unit) ** 2 / 3);
    railInertia();
    const hinge = M.Constraint.create({ bodyA: ownerBody, bodyB: armBody, length: 0, stiffness: 1, damping: .15 });
    // Motor compliance lets real scenery block the hand/weapon instead of a
    // kinematic anchor dragging the blade through a contact after collision solve.
    const rail = M.Constraint.create({ bodyA: armBody, bodyB: fistBody, length: 0,
      stiffness: .03, damping: .2, angularStiffness: 1 });
    M.Composite.add(world, [armBody, fistBody, hinge, rail]);

    function buildParts() {
      return shapes.map((shape) => {
        if (shape.circle) {
          const p = sourcePixel(shape.circle);
          return M.Bodies.circle(p.x, p.y, shape.radius * unit, options("arena-weapon"));
        }
        const vertices = shape.vertices.map(sourcePixel);
        const centre = M.Vertices.centre(vertices);
        return M.Body.create({ ...options("arena-weapon"), position: centre, vertices });
      });
    }
    function markBodies() {
      for (const [body, kind] of [[armBody, "arm"], [fistBody, "fist"], [weaponBody, "weapon"]]) {
        if (!body) continue;
        for (const part of body.parts) {
          part.collisionFilter = kind === "arm" ? { ...filter(), mask: 0 } : filter();
          part.plugin.arenaRig = rig;
          part.plugin.arenaKind = kind;
          part.plugin.weaponDefinition = def;
          part.plugin.heldCollisionDamage = kind === "fist" ? fistOnly : kind === "weapon" && Boolean(def.stats?.collisionDamage);
        }
      }
    }
    function gripVector() {
      const p = sourcePixel({ x: anchor.x * command.equipProgress, y: anchor.y * command.equipProgress });
      return { x: p.x - com.x, y: p.y - com.y };
    }
    function desiredWeaponAngle(position) {
      // Unity Rigidbody.position is the weapon root, whereas Matter positions
      // compound bodies at their centre of mass. A nearby target may lie between
      // these points: aiming from COM can reverse the blade by half a turn.
      if (!position) position = weaponBody ? motion.localToWorld({ x: -com.x, y: -com.y }, weaponBody.position, weaponBody.angle) : fistBody.position;
      if (command.sourceRotation) {
        // Selected BehaviourController + Item.RotateItem native semantics. The
        // physical fist's right axis, not the hand sprite rotation, is authority.
        const locked = command.animating && command.lockRotation;
        const dx = command.target.x - armBody.position.x, dy = command.target.y - armBody.position.y;
        const factor = locked ? 1 : clamp(Math.hypot(dx, dy) / (unit * length), 0, 1);
        const target = locked || command.pointingAt ? command.lookTarget || {
          x: ownerBody.position.x + Math.cos(command.aim) * command.targetDistance,
          y: ownerBody.position.y + Math.sin(command.aim) * command.targetDistance,
        } : {
          x: ownerBody.position.x + Math.cos(fistBody.angle) * 10 * unit,
          y: ownerBody.position.y + Math.sin(fistBody.angle) * 10 * unit,
        };
        const adjusted = (inverse ? 2 - factor : factor) * (def.forwardAngle || 0);
        const offset = inverse ? adjusted - (def.holdAngle || 0) : adjusted + (def.holdAngle || 0);
        return Math.atan2(target.y - position.y, target.x - position.x) - offset * DEG;
      }
      const axis = sourcePixel(direction);
      return command.aim - Math.atan2(axis.y, axis.x) + (def.holdAngle || 0) * DEG;
    }
    function placeWeapon(angle, handPoint) {
      const at = sourcePixel({ x: anchor.x * command.equipProgress, y: anchor.y * command.equipProgress });
      const delta = rotate({ x: com.x - at.x, y: com.y - at.y }, angle);
      M.Body.setAngle(weaponBody, angle);
      M.Body.setPosition(weaponBody, { x: handPoint.x + delta.x, y: handPoint.y + delta.y });
      if (grip) { grip.pointB = rotate(gripVector(), angle); grip.angleB = angle; }
    }
    function rebuildWeapon() {
      if (!weaponBody || detached) return;
      const angle = weaponBody.angle, velocity = copy(weaponBody.velocity), spin = weaponBody.angularVelocity;
      // Rebuilding occurs only on the caller's hysteretic facing transition.
      // Keep the same actual body identity; never hard-set its angle per frame.
      M.Body.setAngle(weaponBody, 0);
      M.Body.setPosition(weaponBody, { x: 0, y: 0 });
      M.Body.setParts(weaponBody, buildParts());
      com = copy(weaponBody.position);
      M.Body.setMass(weaponBody, weaponMass);
      placeWeapon(angle, fistBody.position);
      M.Body.setVelocity(weaponBody, velocity); M.Body.setAngularVelocity(weaponBody, spin);
      markBodies();
    }
    if (!fistOnly) {
      if (existingWeapon) {
        // Pickup transfers the same real body, including its compound geometry.
        // The release token's offset is body-local CSS pixels, not world space.
        weaponBody = existingWeapon.body;
        const ratio = unit / existingWeapon.unit;
        if (weaponBody.isStatic) M.Body.setStatic(weaponBody, false);
        if (ratio !== 1) M.Body.scale(weaponBody, ratio, ratio);
        com = { x: -existingWeapon.originOffset.x * ratio, y: -existingWeapon.originOffset.y * ratio };
      } else {
        weaponBody = M.Body.create({ ...options("arena-weapon"), parts: buildParts() });
        com = copy(weaponBody.position);
      }
      M.Body.setMass(weaponBody, weaponMass);
      placeWeapon(desiredWeaponAngle(), fistBody.position);
      grip = M.Constraint.create({ bodyA: fistBody, bodyB: weaponBody,
        pointB: rotate(gripVector(), weaponBody.angle), length: 0, stiffness: 1, damping: .15 });
      if (!M.Composite.allBodies(world).includes(weaponBody)) M.Composite.add(world, weaponBody);
      M.Composite.add(world, grip);
    }
    function capture() {
      return { owner: { ...copy(ownerBody.position), angle: ownerBody.angle },
        hand: { ...copy(fistBody.position), angle: fistBody.angle },
        weapon: weaponBody ? { ...copy(weaponBody.position), angle: weaponBody.angle } : null };
    }
    const synchronize = () => { previous = current = capture(); };
    function limitVelocity(body, speed) {
      const vx = body.velocity.x - ownerBody.velocity.x, vy = body.velocity.y - ownerBody.velocity.y;
      const magnitude = Math.hypot(vx, vy), maximum = speed * unit * BASE;
      if (magnitude > maximum) M.Body.setVelocity(body, { x: ownerBody.velocity.x + vx / magnitude * maximum, y: ownerBody.velocity.y + vy / magnitude * maximum });
      if (Math.abs(body.angularVelocity) > 18 * BASE) M.Body.setAngularVelocity(body, Math.sign(body.angularVelocity) * 18 * BASE);
    }
    function limitRail() {
      // Matter has no prismatic hard limit. Project only an exceeded source
      // slider upper bound after solving; move the held pair together, never
      // overwrite the weapon's rotation or break its actual grip hinge.
      const dx = fistBody.position.x - armBody.position.x, dy = fistBody.position.y - armBody.position.y;
      const distance = Math.hypot(dx, dy), reach = Math.min(length * unit,
        Math.hypot(command.target.x - ownerBody.position.x, command.target.y - ownerBody.position.y));
      if (distance <= reach || distance < 1e-8) return;
      const nx = dx / distance, ny = dy / distance, delta = { x: nx * (reach - distance), y: ny * (reach - distance) };
      for (const body of [fistBody, ...(weaponBody ? [weaponBody] : [])]) {
        M.Body.translate(body, delta);
        const outward = (body.velocity.x - armBody.velocity.x) * nx + (body.velocity.y - armBody.velocity.y) * ny;
        if (outward > 0) M.Body.setVelocity(body, { x: body.velocity.x - outward * nx, y: body.velocity.y - outward * ny });
      }
    }
    function torque(body, pid, gains, targetAngle, errorLimit, dt) {
      const error = clamp(motion.wrapRadians(targetAngle - body.angle) / DEG, -errorLimit, errorLimit);
      const output = pid.step(error, dt), gain = 20;
      const omega = body.angularVelocity / BASE;
      // Source PID is retained; extra damping compensates engine/inertia units.
      const damping = Math.max(0, 2 * Math.sqrt(Math.max(0, gains.Kp * gain)) - gains.Kd * gain);
      const acceleration = clamp(output * DEG * gain - damping * omega, -250, 250);
      if (finite(acceleration) && finite(body.inertia)) body.torque += body.inertia * acceleration / 1e6;
    }
    rig = {
      get armBody() { return armBody; }, get fistBody() { return fistBody; },
      get weaponBody() { return weaponBody; }, get unit() { return unit; },
      get bodies() { return disposed ? [] : [armBody, fistBody, ...(weaponBody ? [weaponBody] : [])]; },
      get constraints() { return disposed ? [] : [hinge, rail, ...(grip ? [grip] : [])]; },
      command(next = {}) {
        if (disposed) return;
        if (valid(next.target)) command.target = copy(next.target);
        if (finite(next.aim)) command.aim = motion.wrapRadians(next.aim);
        if (finite(next.equipProgress)) command.equipProgress = clamp(next.equipProgress, 0, 1);
        for (const key of ["animating", "pointingAt", "lockRotation"]) {
          if (typeof next[key] === "boolean") { command[key] = next[key]; command.sourceRotation = true; }
        }
        if (typeof next.lockRotationToAngle === "boolean") {
          command.lockRotation = next.lockRotationToAngle; command.sourceRotation = true;
        }
        if (finite(next.targetDistance) && next.targetDistance >= 0) {
          command.targetDistance = next.targetDistance; command.sourceRotation = true;
        }
        if (valid(next.lookTarget) || next.lookTarget === null) {
          command.lookTarget = valid(next.lookTarget) ? copy(next.lookTarget) : null;
          if (command.lookTarget) command.sourceRotation = true;
        }
        if (typeof next.sourceRotation === "boolean") command.sourceRotation = next.sourceRotation;
        if (typeof next.inverse === "boolean" && next.inverse !== inverse) {
          inverse = next.inverse; command.inverse = inverse;
          scaleX = inverse && def.invertX ? -1 : 1; scaleY = inverse && def.invertY ? -1 : 1;
          rebuildWeapon(); synchronize();
        }
      },
      beforeStep(dt) {
        if (disposed || !finite(dt) || dt <= 0 || dt > .1) return;
        previous = capture();
        for (const body of rig.bodies) { M.Sleeping.set(body, false); limitVelocity(body, 40); }
        const dx = command.target.x - ownerBody.position.x, dy = command.target.y - ownerBody.position.y;
        const distance = Math.min(length, Math.hypot(dx, dy) / unit);
        const targetAngle = Math.hypot(dx, dy) > 1e-6 ? Math.atan2(dy, dx) : command.aim;
        torque(armBody, armPID, armGains, targetAngle, hand.rotationMaxErrorDegrees || 50, dt);
        // Source fist is joined by a SliderJoint2D to the rotating hand body.
        // It has no second chasing PID. Enforce the joint's relative angle;
        // the weapon remains an independent hinged body driven by real torque.
        M.Body.setAngle(fistBody, armBody.angle);
        M.Body.setAngularVelocity(fistBody, armBody.angularVelocity);
        const mismatch = Math.abs(motion.wrapRadians(targetAngle - armBody.angle)) / DEG;
        const desired = clamp(distance - mismatch * .005, 0, length);
        const axis = { x: Math.cos(armBody.angle), y: Math.sin(armBody.angle) };
        const translation = ((fistBody.position.x - armBody.position.x) * axis.x + (fistBody.position.y - armBody.position.y) * axis.y) / unit;
        const motor = clamp(sliderPID.step(desired - translation, dt), -12, 12);
        extension = clamp(translation + motor * dt, 0, length);
        rail.pointA = { x: axis.x * extension * unit, y: axis.y * extension * unit }; rail.angleA = armBody.angle;
        if (weaponBody) {
          grip.pointB = rotate(gripVector(), weaponBody.angle); grip.angleB = weaponBody.angle;
          torque(weaponBody, weaponPID, weaponGains, desiredWeaponAngle(), def.angleErrorClamp || 30, dt);
        }
      },
      afterStep() {
        if (disposed) return;
        limitRail();
        M.Body.setAngle(fistBody, armBody.angle);
        M.Body.setAngularVelocity(fistBody, armBody.angularVelocity);
        for (const body of rig.bodies) limitVelocity(body, 40);
        current = capture();
      },
      pose(alpha = 1) {
        if (!finite(alpha)) alpha = 1;
        const h = previous === current ? { ...current.hand } : motion.interpolatePose(previous.hand, current.hand, alpha);
        const w = previous.weapon && current.weapon ? previous === current ? { ...current.weapon } :
          motion.interpolatePose(previous.weapon, current.weapon, alpha) : null;
        const origin = w ? motion.localToWorld({ x: -com.x, y: -com.y }, w, w.angle) : { ...h };
        origin.angle = w ? w.angle : h.angle;
        const toWorld = (p) => motion.localToWorld(sourcePixel(p), origin, origin.angle);
        return { hand: h, weapon: w, origin, anchor: w ? toWorld({ x: anchor.x * command.equipProgress, y: anchor.y * command.equipProgress }) : copy(h),
          tip: w ? toWorld(tip) : motion.localToWorld({ x: radius * unit, y: 0 }, h, h.angle), inverse, scaleX, scaleY };
      },
      reset({ x = ownerBody.position.x, y = ownerBody.position.y, aim = command.aim } = {}) {
        if (disposed || !finite(x) || !finite(y) || !finite(aim)) return;
        command.aim = motion.wrapRadians(aim);
        const idle = valid(hand.idlePosition) ? hand.idlePosition : { x: .4, y: 0 };
        const offset = rotate({ x: idle.x * unit, y: -idle.y * unit }, aim);
        command.target = { x: x + offset.x, y: y + offset.y };
        extension = Math.min(length, Math.hypot(offset.x, offset.y) / unit);
        M.Body.setPosition(armBody, { x, y }); M.Body.setAngle(armBody, aim);
        M.Body.setPosition(fistBody, command.target); M.Body.setAngle(fistBody, aim);
        rail.pointA = rotate({ x: extension * unit, y: 0 }, aim); rail.angleA = aim;
        if (weaponBody) placeWeapon(desiredWeaponAngle(fistBody.position), fistBody.position);
        for (const body of rig.bodies) { M.Body.setVelocity(body, ownerBody.velocity); M.Body.setAngularVelocity(body, 0); body.force.x = body.force.y = body.torque = 0; }
        for (const pid of [armPID, sliderPID, weaponPID]) pid.reset();
        synchronize();
      },
      resize(newUnit, transformPoint) {
        if (disposed || !finite(newUnit) || newUnit <= 0 || newUnit > 10000) return;
        const oldOwner = current.owner, nextOwner = typeof transformPoint === "function" ? transformPoint(copy(oldOwner)) : ownerBody.position;
        if (!valid(nextOwner)) return;
        const ratio = newUnit / unit;
        for (const body of rig.bodies) {
          const p = copy(body.position), v = copy(body.velocity), mass = body.mass;
          M.Body.scale(body, ratio, ratio);
          if (!body.isStatic) M.Body.setMass(body, mass);
          M.Body.setPosition(body, { x: nextOwner.x + (p.x - oldOwner.x) * ratio, y: nextOwner.y + (p.y - oldOwner.y) * ratio });
          M.Body.setVelocity(body, { x: v.x * ratio, y: v.y * ratio });
        }
        command.target = { x: nextOwner.x + (command.target.x - oldOwner.x) * ratio, y: nextOwner.y + (command.target.y - oldOwner.y) * ratio };
        if (command.lookTarget) command.lookTarget = { x: nextOwner.x + (command.lookTarget.x - oldOwner.x) * ratio,
          y: nextOwner.y + (command.lookTarget.y - oldOwner.y) * ratio };
        command.targetDistance *= ratio;
        unit = newUnit; com = { x: com.x * ratio, y: com.y * ratio }; railInertia();
        rail.pointA = rotate({ x: extension * unit, y: 0 }, armBody.angle); rail.angleA = armBody.angle;
        if (grip) { grip.pointB = rotate(gripVector(), weaponBody.angle); grip.angleB = weaponBody.angle; }
        for (const pid of [armPID, sliderPID, weaponPID]) pid.reset();
        synchronize();
      },
      detachWeapon() {
        if (disposed || !weaponBody) return null;
        const body = weaponBody, originOffset = { x: -com.x, y: -com.y };
        M.Composite.remove(world, grip); grip = null; weaponBody = null; detached = true;
        for (const part of body.parts) { part.plugin.arenaRig = null; part.plugin.heldCollisionDamage = false; }
        synchronize();
        return { body, originOffset, tip: copy(tip), unit, inverse, scaleX, scaleY };
      },
      dispose() {
        if (disposed) return;
        for (const constraint of rig.constraints) M.Composite.remove(world, constraint);
        for (const body of rig.bodies) M.Composite.remove(world, body);
        disposed = true; weaponBody = null; grip = null;
      },
    };
    markBodies(); rig.reset();
    return Object.freeze(rig);
  }
  globalThis.GVYArenaRig = Object.freeze({ create });
})();
