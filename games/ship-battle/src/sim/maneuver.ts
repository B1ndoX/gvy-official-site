import type { Projectile, Ship } from './types';
import { clamp,wrap } from './math';

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
export function evasion(ship:Ship,ships:Map<number,Ship>,projectiles:Projectile[],time:number,state:Evasion):Evasion{
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
 const side=Math.abs(cross)>2?Math.sign(cross):(ship.id%2?1:-1);
 return {until:time+profile.duration,readyAt:time+profile.interval,scanAt:time+.2,side,angle};
}
export function evasionVelocity(ship:Ship,bearing:number,state:Evasion,time:number){
 if(time>=state.until)return {x:0,y:0,boost:1};
 const p=handling(ship),fade=clamp((state.until-time)/.35,0,1),speed=ship.spec.speed*p.lateral*p.boost*fade;
 const axis=state.angle??bearing;
 return {x:-Math.sin(axis)*state.side*speed,y:Math.cos(axis)*state.side*speed,boost:1+(p.boost-1)*fade};
}

export interface AttackRun {target:number;phase:'approach'|'flank'|'strike'|'extend';until:number;angle?:number}
/** Commit to a pass, coast out, then turn back. A capital is approached around its rear quarter. */
export function attackNavigation(ship:Ship,target:Ship,time:number,prior:AttackRun|undefined){
 if(ship.spec.length>=100)return null;
 const capital=target.spec.length>=Math.max(80,ship.spec.length*3),combat=ship.spec.doctrine!=='balanced';
 const initial=capital&&combat?'flank':'approach';
 let state:AttackRun=prior?.target===target.id?{...prior}:{target:target.id,phase:initial,until:time+18};
 const dx=ship.x-target.x,dy=ship.y-target.y,dist=Math.hypot(dx,dy),bearing=Math.atan2(dy,dx),rear=target.heading+Math.PI,angle=wrap(rear-bearing),small=ship.spec.length<35;
 if(capital&&ship.spec.doctrine==='bomber'){
  const range=target.radius+ship.radius+ship.spec.preferredRange*.95,radial=clamp((dist-range)/280,-.7,1),side=ship.id%2?1:-1;
  const inward=Math.atan2(-dy,-dx),rearSide=wrap(rear-bearing)>0?1:-1;
  return {state,heading:inward,boost:1.05,coast:false,velocity:{x:Math.cos(inward)*ship.spec.speed*radial-Math.sin(inward)*ship.spec.speed*.8*rearSide*side,y:Math.sin(inward)*ship.spec.speed*radial+Math.cos(inward)*ship.spec.speed*.8*rearSide*side}};
 }
 const closest=ship.radius+target.radius+Math.min(110,ship.spec.preferredRange*.2);
 if(state.phase==='approach'&&dist<Math.max(closest+120,ship.spec.preferredRange*.9))state={target:target.id,phase:'strike',until:time+(small?2.3:3.1)};
 if(state.phase==='flank'&&(Math.abs(angle)<.5||time>=state.until))state={target:target.id,phase:'strike',until:time+3.3};
 if(state.phase==='strike'&&(dist<closest||time>=state.until||Math.cos(ship.heading)*(target.x-ship.x)+Math.sin(ship.heading)*(target.y-ship.y)<-30))state={target:target.id,phase:'extend',until:time+(small?2:3),angle:ship.heading};
 else if(state.phase==='extend'&&time>=state.until)state={target:target.id,phase:initial,until:time+18};
 if(state.phase==='strike'||state.phase==='approach')return {state,heading:Math.atan2(target.y+target.vy*.3-ship.y,target.x+target.vx*.3-ship.x),boost:state.phase==='strike'?(small?1.22:1.06):1,coast:false};
 if(state.phase==='extend')return {state,heading:(state.angle??ship.heading)+(ship.id%2?1:-1)*.12,boost:small?1.28:1.08,coast:true};
 const safe=target.radius+ship.radius+Math.max(90,ship.spec.preferredRange*(ship.spec.doctrine==='bomber'?.95:.55)),waypointAngle=bearing+clamp(angle,-.6,.6),range=Math.max(safe,Math.min(dist,safe+180));
 const x=target.x+Math.cos(waypointAngle)*range-ship.x,y=target.y+Math.sin(waypointAngle)*range-ship.y;
 return {state,heading:Math.atan2(y,x),boost:small?1.12:1,coast:false};
}
