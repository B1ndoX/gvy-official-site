import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const sandbox={Math:Object.assign(Object.create(Math),{random(){throw Error('combat RNG must not be used');}})};
runInNewContext(readFileSync(new URL('../assets/js/member-arena-feedback.js',import.meta.url),'utf8'),sandbox);
const F=sandbox.GVYArenaFeedback;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);

test('damage health front reaches HP before the delayed loss tail and both settle',()=>{
  const h=F.health();F.changeHealth(h,.6,100);
  F.sampleHealth(h,350);near(h.front,.6);near(h.back,1);
  F.sampleHealth(h,799);near(h.back,1);
  F.sampleHealth(h,1300);near(h.back,.7);
  F.sampleHealth(h,1800);near(h.back,.6);assert.equal(h.change,null);
});
test('healing and a subsequent reversal replace the visible sequence without jumps or a stale destination',()=>{
  const h=F.health(.4);F.changeHealth(h,.8,0);
  F.sampleHealth(h,500);near(h.front,.4);near(h.back,.8);
  F.sampleHealth(h,1500);const front=h.front,back=h.back;
  F.changeHealth(h,.2,1500);near(h.front,front);near(h.back,back);
  F.sampleHealth(h,1750);near(h.front,.2);near(h.back,back);
  F.sampleHealth(h,3200);near(h.front,.2);near(h.back,.2);
});
test('health animation is simulation-time based and reduced-motion is immediate',()=>{
  const h=F.health();F.changeHealth(h,.3,0);F.sampleHealth(h,120);
  const sample=JSON.stringify(h);F.sampleHealth(h,120);assert.equal(JSON.stringify(h),sample);
  F.sampleHealth(h,120,true);near(h.front,.3);near(h.back,.3);
});
test('native damage counting uses nearest-even ties and hit shake remains local and finite',()=>{
  assert.equal(F.particleCount(10),2);assert.equal(F.particleCount(14),4);
  assert.equal(F.particleCount(1),1);assert.equal(F.particleCount(1000),40);
  const s=F.shake(30,100,42);near(s.duration,157.5);near(s.strength,.1575);
  for(let t=100;t<257.5;t+=1){const p=F.sampleShake(s,t,20);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(Math.hypot(p.x,p.y)<=s.strength*20+1e-6);}
  near(F.sampleShake(s,258,20).x,0);near(F.sampleShake(s,150,20,true).y,0);
});
function drawingFixture(){
  let appended=0,removed=0,strokes=0,images=0,texts=[];
  const ctx={setTransform(){},clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){strokes++},drawImage(){images++},strokeText(){},fillText(text){texts.push(text)}};
  const canvas={setAttribute(){},getContext(){return ctx},remove(){removed++}};
  const field={ownerDocument:{createElement(){return canvas}},append(){appended++}};
  return{field,canvas,get counts(){return{appended,removed,strokes,images,texts}}};
}
test('one bounded drawing surface reuses slots, expires effects and cannot connect across inactive attacks',()=>{
  const f=drawingFixture(),fx=F.createCanvas({field:f.field});fx.resize(8000,4000,1,1,1,3);
  assert.ok(f.canvas.width*f.canvas.height<2_010_000);
  const key={},p=F.trails.sword;
  fx.trail(key,p,{x:10,y:10},true,0,20);fx.trail(key,p,{x:30,y:10},true,20,20);
  fx.render(40);assert.equal(fx.snapshot().segments,1);
  fx.trail(key,p,{x:50,y:10},false,40,20);fx.trail(key,p,{x:200,y:10},true,60,20);
  fx.render(60);assert.equal(fx.snapshot().segments,1);
  const portrait={complete:true,naturalWidth:64,naturalHeight:64};
  for(let i=0;i<100;i++)fx.hit(portrait,20,20,100,60,20);
  fx.render(80);assert.equal(fx.snapshot().pieces,96);assert.equal(fx.snapshot().peakPieces,96);
  fx.render(5061);assert.equal(fx.snapshot().pieces,0);assert.equal(fx.snapshot().segments,0);
  fx.dispose();assert.equal(f.counts.appended,1);assert.equal(f.counts.removed,1);
  assert.ok(f.counts.strokes>0);assert.equal(f.counts.images,96);
});
test('reduced-motion makes no canvas, particle pool or random calls',()=>{
  const f=drawingFixture();assert.equal(F.createCanvas({field:f.field,reduced:true}),null);assert.equal(f.counts.appended,0);
});

test('critical and actual-healing cues merge and expire in a bounded simulation-clock pool without combat randomness',()=>{
 const f=drawingFixture(),fx=F.createCanvas({field:f.field});fx.resize(800,500);const actor={};
 fx.notify('heal',actor,100,100,5,0);fx.notify('heal',actor,100,100,7,100);fx.render(100);
 assert.equal(fx.snapshot().cues,1);assert.equal(fx.snapshot().lastCue.text,'+12');assert.ok(f.counts.texts.includes('+12'));
 const frozen=JSON.stringify(fx.snapshot().lastCue);fx.render(100);assert.equal(JSON.stringify(fx.snapshot().lastCue),frozen);
 for(let i=0;i<100;i++)fx.notify('critical',{},100+i,100,35,100);
 fx.render(100);assert.equal(fx.snapshot().cues,16);assert.equal(fx.snapshot().cueLimit,16);assert.ok(f.counts.texts.includes('暴击 35'));
 fx.render(1500);assert.equal(fx.snapshot().cues,0);fx.dispose();
});
