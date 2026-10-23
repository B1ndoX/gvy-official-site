import type { Projectile, Ship } from './types';
import { clamp,wrap,randomGenerator,mixSeed } from './math';
import {simulationSeconds} from './pacing';
import {hullRadiusAt} from './collisions';

export interface Evasion { until:number; readyAt:number; scanAt:number; side:number; angle?:number }
/** Seconds/metres remain simulation units. Larger hulls manoeuvre, but never dodge like fighters. */
export function handling(ship:Ship){
 const fighter=ship.spec.class==='fighter',heavy=ship.spec.class==='heavy';
 const combat=ship.spec.defenseRole?.startsWith('fighter')||['stealth','racing'].includes(ship.spec.defenseRole??'');
 const light=fighter&&ship.spec.length<=24&&combat;
 return {duration:light?1.65:fighter?1.45:heavy?2.1:3.2,interval:light?5:fighter?6.2:heavy?8:12,
   lateral:light?.85:fighter?.65:heavy?.32:.12,boost:light?1.65:fighter?1.4:heavy?1.15:1.03,
   horizon:light?1:fighter?.9:heavy?1.2:1.6};
}
export function evasion(ship:Ship,ships:Map<number,Ship>,projectiles:Projectile[],time:number,state:Evasion,random:()=>number=()=>.5):Evasion{
 if(time<state.readyAt||time<state.scanAt)return state;
 const profile=handling(ship);let threat:Projectile|null=null,earliest=Infinity;
 for(const p of projectiles){
  const owner=ships.get(p.owner);if(p.owner===ship.id||(ship.team&&owner?.team===ship.team))continue;
  const dx=p.x-ship.x,dy=p.y-ship.y,vx=p.vx-ship.vx,vy=p.vy-ship.vy,v2=vx*vx+vy*vy;
  if(v2<1)continue;
  const t=-(dx*vx+dy*vy)/v2;
  // React to a plausible impact, not every laser anywhere on the battlefield.
  if(t<0||t>profile.horizon||t>=earliest)continue;
  const miss=Math.hypot(dx+vx*t,dy+vy*t),margin=Math.min(ship.spec.length,ship.spec.beam)*.55+18;
  if(miss>margin)continue;threat=p;earliest=t;
 }
 const damaged=time-ship.lastHit<.4;
 if(!threat&&!damaged)return {...state,scanAt:time+.16+(ship.id%4)*.025};
 // Move out of the incoming line, choosing the side that requires less reversal.
 const angle=threat?threat.angle:ship.heading,dx=threat?ship.x-threat.x:0,dy=threat?ship.y-threat.y:0;
 const cross=Math.cos(angle)*dy-Math.sin(angle)*dx;
 const side=Math.abs(cross)>2?Math.sign(cross):(random()<.5?1:-1);
 return {until:time+profile.duration*(.9+random()*.2),readyAt:time+profile.interval*(.85+random()*.3),scanAt:time+.2,side,angle};
}
export function evasionVelocity(ship:Ship,bearing:number,state:Evasion,time:number){
 if(time>=state.until)return {x:0,y:0,boost:1};
 const p=handling(ship),fade=clamp((state.until-time)/.35,0,1),speed=ship.spec.speed*p.lateral*p.boost*fade;
 const axis=state.angle??bearing;
 return {x:-Math.sin(axis)*state.side*speed,y:Math.cos(axis)*state.side*speed,boost:1+(p.boost-1)*fade};
}

export interface AttackRun {target:number;phase:'approach'|'flank'|'strike'|'extend';until:number;angle?:number;entry?:number;spacing?:number;retreat?:number;caution?:number;side?:number;curve?:number;motionAt?:number;escape?:'sidestep'|'arc'|'break'}
/** React to target size and incoming danger; seeded choices persist for a coherent engagement. */
export function attackNavigation(ship:Ship,target:Ship,time:number,prior:AttackRun|undefined,threatened=false,random:()=>number=randomGenerator(mixSeed(ship.id*65537+target.id+Math.floor(time*60)))):{state:AttackRun;heading:number;boost:number;coast:boolean;velocity?:{x:number;y:number}}|null{
 if(ship.spec.length>=100)return null;
 const capital=target.spec.length>=Math.max(80,ship.spec.length*3),combat=ship.spec.doctrine!=='balanced';
 const initial=capital&&combat?'flank':'approach';
 let state:AttackRun=prior?.target===target.id?{...prior}:{target:target.id,phase:initial,until:time+18};
 const dx=ship.x-target.x,dy=ship.y-target.y,dist=Math.hypot(dx,dy),bearing=Math.atan2(dy,dx),rear=target.heading+Math.PI,angle=wrap(rear-bearing),small=ship.spec.length<35;
 if(capital){
  // A persistent curved course, sampled at decisions rather than jittering each frame.
  const side=()=>{const cross=dx*(ship.vy-target.vy)-dy*(ship.vx-target.vx);return Math.abs(cross)>ship.spec.speed*dist*.12?Math.sign(cross):(random()<.5?-1:1);};
  const plan=():AttackRun=>({target:target.id,phase:'approach',until:0,entry:bearing+(random()-.5)*.8,spacing:.82+random()*.28,retreat:90+random()*140,caution:.45+random()*.4,side:side(),curve:.65+random()*.7,motionAt:time});
  if(!prior||prior.target!==target.id)state=plan();
  const inward=Math.atan2(-dy,-dx),clearance=hullRadiusAt(target,bearing)+ship.radius+100;
  const standOff=Math.max(clearance+100,ship.spec.preferredRange*(state.spacing??.95));
  const danger=threatened||time-ship.lastHit<simulationSeconds(state.caution??.65),near=dist<clearance+35;
  if(state.phase!=='extend'&&(danger||near)){
   const choice=random();state={...state,phase:'extend',motionAt:time,side:side(),escape:near?'break':choice<.48?'sidestep':choice<.88?'arc':'break'};
  }else if(state.phase==='extend'&&!danger&&dist>clearance+70){
   // Rejoin from the current flank: never turn around to retrace an old waypoint.
   state={...plan(),phase:'strike',entry:bearing};
  }
  if(state.phase==='approach'&&dist<standOff+160)state={...state,phase:'strike',motionAt:time};
  const elapsed=time-(state.motionAt??time),sign=state.side??1,curve=state.curve??1;
  const course=(radial:number,tangent:number,boost=1)=>({state,heading:inward,boost,coast:false,velocity:{x:target.vx+(Math.cos(bearing)*radial-Math.sin(bearing)*tangent)*ship.spec.speed,y:target.vy+(Math.sin(bearing)*radial+Math.cos(bearing)*tangent)*ship.spec.speed}});
  if(state.phase==='extend'){
   const radius=standOff+(state.retreat??160),correction=clamp((radius-dist)/Math.max(150,standOff*.65),-.35,.65);
   const wave=Math.sin(elapsed*(.65+curve*.25));
   // Side slips, arcing passes and occasional outward breaks share a bounded range.
   // Even sustained fire cannot send a ship indefinitely straight backwards.
   const radial=near?Math.max(.65,correction):state.escape==='break'?correction:correction*.55;
   const tangent=sign*(state.escape==='sidestep'?.85:state.escape==='arc'?.7:.45)*(1+.12*wave);
   return course(radial,tangent,small?1.16:1.04);
  }
  if(state.phase==='strike'){
   const radial=clamp((standOff-dist)/Math.max(180,standOff*.6),-.45,.5);
   // Gentle S-turns and crossing passes, not a fixed station or a uniform circle.
   const tangent=sign*(.12+.32*Math.sin(elapsed*(.3+curve*.12)+curve));
   return course(radial,tangent);
  }
  const entry=state.entry??bearing,angular=wrap(entry-bearing);
  return course(clamp((standOff-dist)/Math.max(180,standOff*.6),-.85,.45),clamp(angular*.8,-.55,.55));
 }
 const closest=ship.radius+target.radius+Math.min(110,ship.spec.preferredRange*.2);
 if(state.phase==='approach'&&dist<Math.max(closest+120,ship.spec.preferredRange*.9))state={target:target.id,phase:'strike',until:time+(small?1.8+random()*1.3:2.6+random()*1.5)};
 if(state.phase==='flank'&&(Math.abs(angle)<.5||time>=state.until))state={target:target.id,phase:'strike',until:time+3.3};
 if(state.phase==='strike'&&(dist<closest||time>=state.until||Math.cos(ship.heading)*(target.x-ship.x)+Math.sin(ship.heading)*(target.y-ship.y)<-30))state={target:target.id,phase:'extend',until:time+(small?1.5+random():2.5+random()),angle:Math.hypot(ship.vx,ship.vy)>ship.spec.speed*.2?Math.atan2(ship.vy,ship.vx):ship.heading,side:random()<.5?-1:1,motionAt:time};
 else if(state.phase==='extend'&&time>=state.until)state={target:target.id,phase:initial,until:time+18};
 if(state.phase==='strike'||state.phase==='approach')return {state,heading:Math.atan2(target.y+target.vy*.3-ship.y,target.x+target.vx*.3-ship.x),boost:state.phase==='strike'?(small?1.22:1.06):1,coast:false};
 if(state.phase==='extend')return {state,heading:(state.angle??ship.heading)+(state.side??1)*clamp((time-(state.motionAt??time))*.55,0,1.1),boost:small?1.18:1.05,coast:true};
 const safe=target.radius+ship.radius+Math.max(90,ship.spec.preferredRange*(ship.spec.doctrine==='bomber'?.95:.55)),waypointAngle=bearing+clamp(angle,-.6,.6),range=Math.max(safe,Math.min(dist,safe+180));
 const x=target.x+Math.cos(waypointAngle)*range-ship.x,y=target.y+Math.sin(waypointAngle)*range-ship.y;
 return {state,heading:Math.atan2(y,x),boost:small?1.12:1,coast:false};
}
