import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const context={};
for(const name of ['motion','actions','weapon-profile'])runInNewContext(readFileSync(new URL(`../assets/js/member-arena-${name}.js`,import.meta.url),'utf8'),context);
const A=context.GVYArenaActions,M=context.GVYArenaMotion,P=context.GVYArenaWeaponProfile;
const near=(a,b,tolerance=1e-5)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
test('original sword sequence holds its wind-up delay and returns continuously to idle',()=>{
  const timeline=A.compile(P.weapons.sword.animations[0],M);
  near(timeline.duration,.795);near(timeline.cooldown,1.125);
  const windup=A.sample(timeline,.2,M),held=A.sample(timeline,.4,M);
  near(windup.target.x,-.75);near(windup.target.y,.1);
  near(held.target.x,windup.target.x);near(held.target.y,windup.target.y);
  assert.equal(windup.active,true);
  const end=A.sample(timeline,timeline.duration,M),before=A.sample(timeline,timeline.duration-.00001,M);
  near(end.target.x,.4);near(end.target.y,0);
  assert.ok(Math.hypot(end.target.x-before.target.x,end.target.y-before.target.y)<.001);
  assert.equal(end.complete,true);assert.equal(end.active,false);
});
test('bow releases the charge actually accumulated at .525s and returns its string after release',()=>{
  const pull=A.bowPull(.525);assert.ok(pull>.7&&pull<.75);
  near(A.bowPull(.525,.525),pull);
  near(A.bowPull(.625,.525),0);
  assert.ok(Number.isFinite(A.bowPull(100,.525)));
});
test('left and right attack paths keep their vertical arc while their forward direction reverses',()=>{
  const animation=P.weapons.sword.animations[0];
  const right=A.worldTarget({x:1,y:1},{x:100,y:100},20,0,false,animation);
  const left=A.worldTarget({x:1,y:1},{x:100,y:100},20,Math.PI,true,animation);
  near(right.x,120);near(left.x,80);near(right.y,80);near(left.y,80);
});

test('native cooldowns add personality, item and animation once, with separate ranged/throw formulas',()=>{
  const personality=[.175*2,.55*2],fixed=()=>.5;
  const sword=P.weapons.sword,animation=sword.animations[0];
  near(A.attackCooldown(sword,personality,animation,'sword',fixed),1.125+.725);
  near(A.attackCooldown(P.weapons.axe,personality,P.weapons.axe.animations[0],'axe',fixed),3.135+.725);
  near(A.attackCooldown(P.weapons.bow,personality,null,'bow',()=>0),1.275);
  near(A.attackCooldown(P.weapons.bow,personality,null,'bow',()=>1),2.025);
  near(A.attackCooldown(P.weapons.bomb,personality,null,'bomb',()=>0),2.275);
  near(A.attackCooldown(P.weapons.bomb,personality,null,'bomb',()=>1),4.025);
  near(A.attackCooldown(P.weapons.fire,personality,null,'fire',()=>1),3.275);
  near(A.attackCooldown(sword,personality,animation,'throw',fixed),.725);
});

test('all shipped diagonal attack paths match the native ZXY mirror matrix without negating aim twice',()=>{
 const angles=[45,-30,120,-147],local={x:.7,y:1.2},origin={x:100,y:80},unit=30;
 for(const weapon of Object.values(P.weapons))for(const animation of weapon.animations){
  assert.equal(animation.rotatePathAngle,true);assert.equal(animation.invertPathX,true);assert.equal(animation.invertPathY,false);
  for(const degrees of angles)for(const inverse of [false,true]){
   const angle=degrees*Math.PI/180,z=inverse?-angle:angle;
   // Apply Unity Euler's Z rotation, then X's planar reflection, then CSS Y flip.
   const ux=local.x*Math.cos(z)-local.y*Math.sin(z);
   const uy=(local.x*Math.sin(z)+local.y*Math.cos(z))*(inverse?-1:1);
   const actual=A.worldTarget(local,origin,unit,-angle,inverse,animation);
   near(actual.x,origin.x+ux*unit);near(actual.y,origin.y-uy*unit);
  }
 }
});
