import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const context={};
runInNewContext(readFileSync(new URL('../assets/js/member-arena-combat.js',import.meta.url),'utf8'),context);
const C=context.GVYArenaCombat;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('protection keys concrete items for 300ms, including the shared null source',()=>{
 const received=new Map(),a={},b={};
 assert.equal(C.admit(received,a,0),true);assert.equal(C.admit(received,a,299),false);
 assert.equal(C.admit(received,b,0),true);assert.equal(C.admit(received,null,0),true);
 assert.equal(C.admit(received,null,299),false);assert.equal(C.admit(received,a,300),true);
 assert.equal(C.admit(received,b,300),true);assert.equal(C.admit(received,null,300),true);
 for(let i=1;i<=1000;i++) C.admit(received,{},i*301);
 assert.equal(received.size,1);
});
test('damage bounds follow the rotated world AABB, including points outside the oriented blade',()=>{
 const origin={x:0,y:0,angle:Math.PI/4};
 assert.equal(C.insideDamageBounds('spear',{x:10,y:-10},origin,10),true);
 assert.equal(C.insideDamageBounds('spear',{x:-20,y:20},origin,10),false);
 assert.equal(C.insideDamageBounds('sword',{x:0,y:-12},{x:0,y:0,angle:0},10),true);
 assert.equal(C.insideDamageBounds('sword',{x:0,y:-20},{x:0,y:0,angle:0},10),false);
 assert.equal(C.insideDamageBounds('fists',{x:100,y:100},origin,10),true);
});
test('collision damage uses relative linear speed and impulses do not invent an upward kick',()=>{
 near(C.relativeSpeed({x:3,y:4},{x:0,y:0},30),10);
 near(C.relativeSpeed({x:3,y:4},{x:3,y:4},30),0);
 const kick=C.impulse(20,{x:100,y:50},{x:90,y:50},40,30);near(kick.x,2.5);near(kick.y,0);
 const center=C.impulse(20,{x:100,y:50},{x:100,y:50},40,30);near(center.x,0);near(center.y,0);
});
test('kill healing uses the life divider and resets on every seventh kill',()=>{
 let divider=0;const expected=[100,50,100/3,25,20,100/6,100,50];
 for(let kills=1;kills<=8;kills++) {const h=C.killHeal(kills,divider,100,()=>0);divider=h.divider;near(h.amount,expected[kills-1]);}
 near(C.killHeal(2,1,100,()=>1).amount,62.5);
});
test('native mirrored arsenals pair opposing slots while random teams use weighted weapons',()=>{
 let draws=0;const out=C.loadouts(8,'teams','mirrored',()=>++draws%2?.1:.9);
 for(let i=0;i<4;i++) assert.equal(out[i],out[4+i]);
 assert.equal(C.loadouts(4,'classic','random',()=>.9).every(id=>id==='fists'),true);
 assert.equal(C.loadouts(4,'teams','random',()=>.9).some(id=>id==='fists'),false);
 assert.equal(C.loadouts(4,'teams','unarmed',()=>.9).every(id=>id==='fists'),true);
});
test('jumps add a bounded impulse toward the target, reverse while fleeing, and have no grounded dependency',()=>{
 const args={strength:10,awayChance:0,flipChance:0,health:100,maxHealth:100,inverse:false,dx:100,dy:0,zeroGravity:false};
 const toward=C.jump(args,()=>.5);assert.ok(toward.x>0&&toward.y<0);near(Math.hypot(toward.x,toward.y),10);
 const away=C.jump({...args,awayChance:1},()=>.5);assert.ok(away.x<0&&away.y<0);
 const zero=C.jump({...args,zeroGravity:true},()=>.5);near(zero.x,5);near(zero.y,0);
});

test('two substeps preserve the full continuous controller force and torque',()=>{
 const physics={module:{exports:{}},exports:{},console:{...console,warn(){}}};
 runInNewContext(readFileSync(new URL('../assets/vendor/matter.min.js',import.meta.url),'utf8'),physics);
 const M=physics.module.exports;
 const make=()=>{const e=M.Engine.create();e.gravity.y=0;const b=M.Bodies.rectangle(0,0,20,30,{frictionAir:0});M.Body.setMass(b,1);M.Composite.add(e.world,b);b.force.x=.001;b.torque=.002;return{e,b};};
 const a=make(),b=make();M.Engine.update(a.e,20);C.stepPhysics(M,b.e,20);
 near(a.b.velocity.x,b.b.velocity.x);near(a.b.angularVelocity,b.b.angularVelocity);
 near(b.b.force.x,0);near(b.b.torque,0);
});
