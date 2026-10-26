import type { Projectile, Ship } from './types';
import { clamp,wrap,intercept,randomGenerator,mixSeed } from './math';
import {simulationSeconds} from './pacing';
import {hullRadiusAt} from './collisions';

export interface Evasion { until:number; readyAt:number; scanAt:number; side:number; angle?:number; emergencyUntil?:number; emergencyUsed?:boolean }
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
 // One escape for each visit to the critical band. Only actual hull recovery
 // above the boundary rearms it; shields, targets and waves do not reset it.
 if(state.emergencyUsed&&ship.hull>ship.spec.hull*.1)state={...state,emergencyUsed:false};
 const critical=ship.spec.length<200&&ship.hull<=ship.spec.hull*.1;
 const emergency=critical&&!state.emergencyUsed&&time>=state.until;
 const emergencyActive=time<(state.emergencyUntil??0);
 if(!emergency&&time<state.scanAt||time<state.until&&!emergencyActive||!emergency&&!emergencyActive&&time<state.readyAt)return state;
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
 if(emergencyActive){
  if(!threat&&time-(ship.hitStreak?.last??-100)>simulationSeconds(.55)){const until=Math.min(state.until,time+simulationSeconds(.35));return {...state,until,emergencyUntil:until,scanAt:time+simulationSeconds(.15)};}
  return {...state,scanAt:time+simulationSeconds(.15)};
 }
 if(!threat&&!damaged&&!emergency)return {...state,scanAt:time+.16+(ship.id%4)*.025};
 // Move out of the incoming line, choosing the side that requires less reversal.
 const attacker=ships.get(ship.lastAttacker??-1);
 const angle=threat?threat.angle:emergency&&attacker?Math.atan2(ship.y-attacker.y,ship.x-attacker.x):ship.heading,dx=threat?ship.x-threat.x:0,dy=threat?ship.y-threat.y:0;
 const cross=Math.cos(angle)*dy-Math.sin(angle)*dx;
 let side=Math.abs(cross)>2?Math.sign(cross):(random()<.5?1:-1);
 if(emergency){
  const lateral=-Math.sin(angle)*ship.vx+Math.cos(angle)*ship.vy;
  if(Math.abs(lateral)>ship.spec.speed*.12)side=Math.sign(lateral);
  const cost=(sign:number)=>{
   const x=ship.x-Math.sin(angle)*sign*ship.spec.speed,y=ship.y+Math.cos(angle)*sign*ship.spec.speed;
   let score=0;
   for(const other of ships.values()){if(!other.alive||other.id===ship.id)continue;const bearing=Math.atan2(other.y-y,other.x-x),safe=hullRadiusAt(ship,bearing)+hullRadiusAt(other,bearing+Math.PI)+50;score+=Math.max(0,1-Math.hypot(x-other.x,y-other.y)/safe);}
   return score;
  };
  if(cost(-side)+.35<cost(side))side=-side;
 }
 if(emergency){const until=time+simulationSeconds(1.2+ship.spec.length/200+random()*.4);return {...state,until,emergencyUntil:until,emergencyUsed:true,readyAt:Math.max(until,time+profile.interval),scanAt:time+.2,side,angle};}
 return {...state,until:time+profile.duration*(.9+random()*.2),readyAt:time+profile.interval*(.85+random()*.3),scanAt:time+.2,side,angle};
}
export function evasionVelocity(ship:Ship,bearing:number,state:Evasion,time:number){
 if(time>=state.until)return {x:0,y:0,boost:1};
 const p=handling(ship),emergency=time<(state.emergencyUntil??0),small=ship.spec.length<35,medium=ship.spec.length<100;
 const boost=emergency?Math.max(p.boost,small?1.7:medium?1.4:1.22):p.boost,lateral=emergency?Math.max(p.lateral,small?.75:medium?.5:.38):p.lateral;
 const fade=clamp((state.until-time)/.35,0,1),speed=ship.spec.speed*lateral*boost*fade;
 const axis=state.angle??bearing;
 return {x:-Math.sin(axis)*state.side*speed,y:Math.cos(axis)*state.side*speed,boost:1+(boost-1)*fade};
}

export interface AttackRun {target:number;phase:'approach'|'flank'|'strike'|'extend';until:number;angle?:number;entry?:number;spacing?:number;retreat?:number;caution?:number;side?:number;curve?:number;motionAt?:number;escape?:'sidestep'|'arc'|'break'}
/** React to target size and incoming danger; seeded choices persist for a coherent engagement. */
export function attackNavigation(ship:Ship,target:Ship,time:number,prior:AttackRun|undefined,threatened=false,random:()=>number=randomGenerator(mixSeed(ship.id*65537+target.id+Math.floor(time*60)))):{state:AttackRun;heading:number;boost:number;coast:boolean;velocity?:{x:number;y:number}}|null{
 if(ship.spec.length>=100)return capitalNavigation(ship,target,time,prior,threatened,random);
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

/** Heavy hulls translate across a firing lane instead of driving their nose
 * indefinitely into an obstacle/target. Decisions follow clearance and danger,
 * not a repeated attack/retreat timer. Their original acceleration still applies. */
function capitalNavigation(ship:Ship,target:Ship,time:number,prior:AttackRun|undefined,threatened:boolean,random:()=>number){
 const dx=ship.x-target.x,dy=ship.y-target.y,dist=Math.max(1,Math.hypot(dx,dy)),nx=dx/dist,ny=dy/dist,bearing=Math.atan2(dy,dx),inward=wrap(bearing+Math.PI);
 let state=prior?.target===target.id?{...prior}:undefined;
 if(!state){
  const cross=dx*(ship.vy-target.vy)-dy*(ship.vx-target.vx);
  state={target:target.id,phase:'approach',until:0,side:Math.abs(cross)>dist*ship.spec.speed*.08?Math.sign(cross):random()<.5?-1:1,spacing:.9+random()*.2,curve:.6+random()*.9,motionAt:time};
 }
 const clearance=hullRadiusAt(ship,inward)+hullRadiusAt(target,bearing)+65;
 const standOff=Math.max(clearance+140,ship.spec.preferredRange*(state.spacing??1));
 const near=dist<clearance+90,danger=threatened||time-ship.lastHit<simulationSeconds(.8);
 if(near||danger&&dist<standOff*1.1)state.phase='extend';
 else if(state.phase==='extend'&&dist>clearance+190)state.phase='strike';
 else if(state.phase!=='extend')state.phase=dist>standOff*1.3?'approach':'strike';
 const side=state.side??1,curve=state.curve??1,elapsed=time-(state.motionAt??time);
 let radial=clamp((standOff-dist)/Math.max(240,standOff*.55),-.85,.55);
 let tangent=side*(state.phase==='approach'?.1:.18+.12*Math.sin(elapsed*(.12+curve*.07)+curve));
 if(state.phase==='extend'){
  radial=Math.max(near?.35:.08,radial);tangent=side*(near?.65:.42);
 }
 const vx=target.vx*.4+(nx*radial-ny*tangent)*ship.spec.speed,vy=target.vy*.4+(ny*radial+nx*tangent)*ship.spec.speed;
 const forward=ship.spec.mounts.find(m=>!m.interceptsOnly&&['laser','ballistic','beam','railgun'].includes(m.kind));
 const aim=forward&&forward.kind!=='beam'?intercept(ship,target,forward.speed):target;
 return {state,heading:forward?Math.atan2(aim.y-ship.y,aim.x-ship.x):Math.atan2(vy,vx),boost:1,coast:false,velocity:{x:vx,y:vy}};
}
