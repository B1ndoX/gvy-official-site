import type { Graphics } from 'pixi.js';
import type { BattleEngine } from '../sim/engine';
import { clamp,mountWorld } from '../sim/math';

/** Reuses the existing Graphics batch; no filters, timers, textures or DOM particles. */
export function drawWeaponEffects(engine:BattleEngine,e:Graphics,px:number){
  for(const s of engine.ships){
    if(!s.alive)continue;
    s.weaponCycles?.forEach((cycle,i)=>{
      const m=s.spec.mounts[i];if(!m?.charge||cycle.chargeLeft<=0)return;
      const p=mountWorld(s,m),progress=clamp(1-cycle.chargeLeft/m.charge,0,1),color=m.color??0x80dfff;
      e.circle(p.x,p.y,(4+progress*7)*px).fill({color,alpha:progress*.18}).stroke({color,alpha:.2+progress*.6,width:px});
      e.circle(p.x,p.y,(1.5+progress*2)*px).fill({color:0xeefaff,alpha:progress*.9});
    });
  }
  for(const b of engine.beams){
    const owner=engine.ships.find(s=>s.id===b.owner),m=owner?.spec.mounts[b.mount];if(!owner?.alive||!m)continue;
    const color=m.color??0x6edbff,fade=Math.min(1,b.elapsed/.12,b.remaining/.16);
    const width=m.beamWidth??Math.max(1.2*px,Math.min(6*px,(m.width??3)*2));
    for(const {from,to,hit} of b.segments){
      e.moveTo(from.x,from.y).lineTo(to.x,to.y).stroke({color,width:width*(m.beamWidth?1.3:3),alpha:.07*fade});
      e.moveTo(from.x,from.y).lineTo(to.x,to.y).stroke({color,width:width*(m.beamWidth?1:1.45),alpha:.42*fade});
      e.moveTo(from.x,from.y).lineTo(to.x,to.y).stroke({color:0xf5fcff,width:width*(m.beamWidth?.65:.45),alpha:.95*fade});
      e.circle(from.x,from.y,width*(m.beamWidth?.5:1.25)).fill({color,alpha:.35*fade});
      if(hit)e.circle(to.x,to.y,width*(m.beamWidth?.3:1.5)).fill({color:0xffe8b3,alpha:.6*fade});
    }
  }
  for(const p of engine.projectiles){
    const dx=Math.cos(p.angle),dy=Math.sin(p.angle);
    if(p.kind==='torpedo'){
      const size=p.width??1;
      const trail=[...(p.trail??[]),p];
      for(let i=1;i<trail.length;i++){const a=trail[i-1],b=trail[i];e.moveTo(a.x,a.y).lineTo(b.x,b.y).stroke({color:0xf39351,width:(1+i/trail.length*2)*px,alpha:.08+i/trail.length*.35});}
      const length=8*px*size,width=2.3*px*size;
      e.poly([p.x+dx*length,p.y+dy*length,p.x-dx*length-dy*width,p.y-dy*length+dx*width,p.x-dx*length+dy*width,p.y-dy*length-dx*width]).fill(0xd9e6ed);
      e.moveTo(p.x-dx*length,p.y-dy*length).lineTo(p.x-dx*length*2,p.y-dy*length*2).stroke({color:0xffd88f,width:2*px*size,alpha:.95});
    }else if(p.kind==='railgun'){
      const tail=Math.min(p.travel,35);
      e.moveTo(p.x-dx*tail,p.y-dy*tail).lineTo(p.x,p.y).stroke({color:0x51baff,width:5*px,alpha:.45});
      e.circle(p.x,p.y,24*px).fill({color:0x3c9dfc,alpha:.2});
      e.circle(p.x,p.y,14*px).fill({color:0x87d8ff,alpha:.7});
      e.circle(p.x,p.y,7.5*px).fill(0xffffff);
    }else{
      const missile=p.kind==='missile',ballistic=p.kind==='ballistic',tail=Math.min(p.travel,missile?70:ballistic?16:30);
      e.moveTo(p.x-dx*tail,p.y-dy*tail).lineTo(p.x,p.y).stroke({color:missile?0xeb9973:p.color,width:(missile?2:1.3)*px,alpha:.22});
      e.moveTo(p.x-dx*tail*.4,p.y-dy*tail*.4).lineTo(p.x,p.y).stroke({color:missile?0xffd29a:p.color,width:ballistic?1.8*px:1.2*px,alpha:.95});
    }
  }
  for(const ev of engine.events){
    if(ev.kind!=='shot')continue;
    const age=engine.time-ev.time,duration=ev.weapon==='railgun'?.45:ev.weapon==='torpedo'?.2:.1;if(age>duration)continue;
    const f=1-age/duration,color=ev.weapon==='railgun'?0x8bddff:0xffc176,angle=ev.angle??0,dx=Math.cos(angle),dy=Math.sin(angle);
    e.moveTo(ev.x,ev.y).lineTo(ev.x+dx*(ev.weapon==='railgun'?34:10)*px,ev.y+dy*(ev.weapon==='railgun'?34:10)*px).stroke({color,width:(ev.weapon==='railgun'?5:2)*px,alpha:f*.85});
    if(ev.weapon==='railgun')e.circle(ev.x,ev.y,(3+age*30)*px).stroke({color,alpha:f*.7,width:2*px});
  }
}
