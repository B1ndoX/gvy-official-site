import type { Graphics } from 'pixi.js';
import type { BattleEngine } from '../sim/engine';
import type { Projectile,Vec } from '../sim/types';
import { clamp,mountWorld } from '../sim/math';
import {simulationSeconds} from '../sim/pacing';
import type {CombatVfx} from './CombatVfx';
import {weaponBehavior,chargedWeapon} from '../sim/charged-weapon';

/** Weapon size changes the silhouette only; legacy custom rounds retain their scale. */
export function torpedoVisualScale(projectile:Pick<Projectile,'weaponSize'|'width'>){
  return projectile.weaponSize===undefined?projectile.width??1:clamp(.7+(projectile.weaponSize-5)*.2,.3,2.5);
}

/** Game silhouettes in world metres, not fixed screen pixels. Not source dimensions. */
export function ordnanceVisualLength(p:Pick<Projectile,'weaponSize'|'kind'>){
 const size=clamp(Math.round(p.weaponSize??(p.kind==='torpedo'?5:2)),1,12);
 return [.55,.8,1.2,1.8,2.4,3.6,4.8,6,8,10,12,14][size-1]*(p.kind==='torpedo'?4:1);
}

/** Physical rays/casings remain geometry; soft light is batched in the shared atlas. */
export function drawWeaponEffects(engine:BattleEngine,e:Graphics,px:number,vfx:CombatVfx,impactPoint?:(ship:number|undefined,from:Vec,to:Vec)=>Vec){
  for(const s of engine.ships){
    if(!s.alive)continue;
    s.weaponCycles?.forEach((cycle,i)=>{
      const m=s.spec.mounts[i];if(!m?.charge||cycle.chargeLeft<0||cycle.chargeLeft===0&&!chargedWeapon(m))return;
      const p=mountWorld(s,m),progress=clamp(1-cycle.chargeLeft/m.charge,0,1),color=m.color??0x80dfff;
      vfx.glow(p.x,p.y,(4+progress*7)*px,color,progress*.5);
      vfx.glow(p.x,p.y,(1.5+progress*2)*px,0xeefaff,progress*.9);
    });
  }
  for(const b of engine.beams){
    const owner=engine.ships.find(s=>s.id===b.owner),m=owner?.spec.mounts[b.mount];if(!owner?.alive||!m)continue;
    const color=m.color??0x6edbff,fade=Math.min(1,b.elapsed/.12,b.remaining/.16);
    const width=m.beamWidth??Math.max(1.2*px,Math.min(6*px,(m.width??3)*2));
    for(const {from,to,hit,ship} of b.segments){
      const end=hit?impactPoint?.(ship,from,to)??to:to;
      vfx.streak(from.x,from.y,end.x,end.y,width*(m.beamWidth?2.1:6),color,.15*fade);
      vfx.streak(from.x,from.y,end.x,end.y,width*(m.beamWidth?.65:1.1),0xe5f8ff,.9*fade);
      vfx.glow(from.x,from.y,width*2,color,.5*fade);
      if(hit)vfx.glow(end.x,end.y,width*2,0xffe8b3,.7*fade);
    }
  }
  for(const p of engine.projectiles){
    const dx=Math.cos(p.angle),dy=Math.sin(p.angle);
    if(p.kind==='torpedo'){
      const length=ordnanceVisualLength(p)/2,width=length*.12,exhaustWidth=width*1.8;
      vfx.wake(`p${p.id}`,p.x,p.y,engine.time,.85,Math.max(100,p.speed*.65),exhaustWidth*.5,0xffc383,.48);
      const point=(x:number,y:number)=>({x:p.x+dx*x-dy*y,y:p.y+dy*x+dx*y});
      const polygon=(points:number[])=>points.flatMap((_,i)=>i%2?[]:Object.values(point(points[i],points[i+1])));
      if(!vfx.ordnance?.(p,length*2)){
      // Fallback only: unverified models keep the prior world-scaled silhouette.
      e.poly(polygon([-length*.48,-width,-length*.83,-width*2.6,-length*1.02,-width*2.6,-length*.88,0,-length*1.02,width*2.6,-length*.83,width*2.6,-length*.48,width])).fill(0x8797a2);
      e.poly(polygon([length,0,length*.6,-width,-length*.83,-width,-length,-width*.55,-length,width*.55,-length*.83,width,length*.6,width])).fill(0xb9c7ce).stroke({color:0xe3edf2,width:Math.min(.55*px,width*.35),alpha:.8});
      e.poly(polygon([length*.48,-width*.55,-length*.73,-width*.55,-length*.84,width*.5,length*.57,width*.5])).fill(0x263642);
      const nose=point(length*.65,0),tip=point(length,0);e.moveTo(nose.x,nose.y).lineTo(tip.x,tip.y).stroke({color:0xf2f7fa,width:Math.min(.8*px,width*.4)});
      }
      const nozzle=point(-length,0);
      const flame=length*(2.4+.16*Math.sin(engine.time*37+p.id));
      vfx.plume(nozzle.x,nozzle.y,p.angle+Math.PI,flame,exhaustWidth*4.5,0xffad55,.9);
      vfx.plume(nozzle.x,nozzle.y,p.angle+Math.PI,flame*.72,exhaustWidth*1.8,0xfff2ca,1);
      vfx.glow(nozzle.x,nozzle.y,exhaustWidth*2.3,0xffe9bc,1);
    }else if(p.kind==='railgun'){
      const size=clamp((p.weaponSize??10)/10,.65,1.6),tail=Math.min(p.travel,65),width=4.2*px*size;
      vfx.streak(p.x-dx*tail,p.y-dy*tail,p.x,p.y,width*4,0x77beff,.24);
      vfx.streak(p.x-dx*tail*.6,p.y-dy*tail*.6,p.x,p.y,width,0xecf6ff,.95);
      const behavior=weaponBehavior(p.weaponId),glow=behavior?.projectileGlowMultiplier??1;
      vfx.glow(p.x,p.y,8*px*size*glow,0x8dccff,behavior?.projectileGlowAlpha??.58);
      vfx.glow(p.x,p.y,2.2*px*size*glow,0xfff8df,behavior?.projectileCoreAlpha??.95);
    }else{
      const missile=p.kind==='missile',ballistic=p.kind==='ballistic',missileLength=missile?ordnanceVisualLength(p):0,tail=Math.min(p.travel,missile?missileLength:ballistic?20:30),color=missile?0xffcf96:ballistic?0xffc78d:p.color;
      if(missile){
        vfx.wake(`p${p.id}`,p.x,p.y,engine.time,.7,Math.max(100,p.speed*.65),missileLength*.04,0xf0b082,.32);
        vfx.plume(p.x,p.y,p.angle+Math.PI,missileLength*.75,missileLength*.35,0xffbb79,.65);
      }
      const width=missile?missileLength*.12:ballistic?Math.min(2.4,p.width??1.2)*px:1.2*px;
      if(!missile||!vfx.ordnance?.(p,missileLength)){
        vfx.streak(p.x-dx*tail,p.y-dy*tail,p.x,p.y,width*3,color,.22);
        vfx.streak(p.x-dx*tail*.7,p.y-dy*tail*.7,p.x,p.y,width,color,.95);
      }
      if(p.impact==='heavy-cannon')vfx.glow(p.x,p.y,2.3*px,0xffe6bd,.6);
    }
  }
  for(const ev of engine.events){
    if(ev.kind==='intercept'){
      const age=engine.time-ev.time;if(ev.from&&age<simulationSeconds(.07)){const alpha=1-age/simulationSeconds(.07);vfx.streak(ev.from.x,ev.from.y,ev.x,ev.y,1.4*px,0x96dcff,alpha*.8);}
      continue;
    }
    if(ev.kind!=='shot')continue;
    const age=engine.time-ev.time,duration=ev.weapon==='railgun'?.45:ev.weapon==='torpedo'?.2:.1;if(age>duration)continue;
    const f=1-age/duration,color=ev.weapon==='railgun'?0x8bddff:0xffc176,angle=ev.angle??0,dx=Math.cos(angle),dy=Math.sin(angle);
    vfx.streak(ev.x,ev.y,ev.x+dx*(ev.weapon==='railgun'?22:7)*px,ev.y+dy*(ev.weapon==='railgun'?22:7)*px,(ev.weapon==='railgun'?4:2)*px,color,f*.85);
    vfx.glow(ev.x,ev.y,(ev.weapon==='railgun'?9:3)*px,color,f*.55);
  }
}
