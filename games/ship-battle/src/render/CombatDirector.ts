import type { BattleEvent, Projectile, Ship } from '../sim/types';

export interface Engagement { subject:Ship; target:Ship|null; active:boolean }

/** Read-only spectator selection. Camera time is real time, independent of battle speed. */
export class CombatDirector {
  private subject:number|null=null;private target:number|null=null;private held=0;private deadFor=0;private clock=0;
  private shown=new Map<number,number>();
  reset(){this.subject=null;this.target=null;this.held=0;this.deadFor=0;this.clock=0;this.shown.clear();}
  update(ships:Ship[],projectiles:Projectile[],events:BattleEvent[],time:number,dt:number):Engagement|null {
    this.clock+=dt;this.held+=dt;
    const byId=new Map(ships.map(s=>[s.id,s])),living=ships.filter(s=>s.alive),pairs=new Map<string,{subject:Ship;target:Ship;activity:number}>();
    const add=(a:number,b:number,activity:number)=>{
      let subject=byId.get(a),target=byId.get(b);
      if(!subject?.alive||!target?.alive||subject===target||(subject.team&&subject.team===target.team))return;
      if(subject.npc&&!target.npc)[subject,target]=[target,subject];
      if(subject.npc)return; // Spectate members, including members flying small ships.
      const key=`${subject.id}:${target.id}`,pair=pairs.get(key);
      if(pair)pair.activity+=activity;else pairs.set(key,{subject,target,activity});
    };
    for(const p of projectiles)add(p.owner,p.target,2);
    for(const ev of events)if(ev.kind!=='destroy'&&time-ev.time<1.8)add(ev.by,ev.ship,3*(1-(time-ev.time)/1.8));
    for(const s of living.filter(s=>!s.npc)){
      if(s.targetId!==null)add(s.id,s.targetId,0);
      for(const id of new Set(s.turretTargets))if(id!==null)add(s.id,id,0);
    }
    const candidates=[...pairs.values()].map(p=>{
      const distance=Math.max(0,Math.hypot(p.subject.x-p.target.x,p.subject.y-p.target.y)-p.subject.radius-p.target.radius);
      const range=Math.max(1,...p.subject.spec.mounts.map(m=>m.range));
      const active=p.activity>0;
      const last=this.shown.get(p.subject.id);
      const exposure=last===undefined?0:Math.max(0,1-(this.clock-last)/24)*7;
      return {...p,active,score:(active?30:0)+Math.min(12,p.activity)+Math.max(0,1-distance/range)*3+(1-p.subject.hull/p.subject.spec.hull)*2-exposure};
    }).sort((a,b)=>b.score-a.score||a.subject.id-b.subject.id||a.target.id-b.target.id);
    const old=byId.get(this.subject??-1),oldTarget=byId.get(this.target??-1);
    if(old&&(!old.alive||oldTarget&&!oldTarget.alive)){
      this.deadFor+=dt;
      // Keep the impact/explosion in view briefly before the next shot.
      if(this.deadFor<1.1)return {subject:old,target:oldTarget??null,active:false};
    }else this.deadFor=0;
    const current=candidates.find(p=>p.subject.id===this.subject&&p.target.id===this.target);
    const best=candidates[0];
    let choice=current;
    if(!current||this.deadFor>=1.1||(!current.active&&best?.active&&this.held>=2))choice=best;
    else if(this.held>=5){
      const next=candidates.find(p=>p.active&&p.subject.id!==this.subject);
      if(next)choice=next;
    }
    if(choice){
      if(choice.subject.id!==this.subject||choice.target.id!==this.target){this.subject=choice.subject.id;this.target=choice.target.id;this.held=0;this.deadFor=0;}
      this.shown.set(choice.subject.id,this.clock);
      return choice;
    }
    // Between waves or before weapons lock, keep a member in view without inventing combat.
    const subject=old?.alive?old:living.find(s=>!s.npc)??living[0];
    if(!subject)return null;
    this.subject=subject.id;this.target=null;return {subject,target:null,active:false};
  }
}

/** Equal apparent size across hull classes; UI scale keeps 4K/embedded framing consistent. */
export function shipFocusSpan(ship:Ship,width:number,height:number,ui=1,pixelsPerShip=100){
  const side=Math.max(1,Math.min(width,height));
  const pixels=Math.min(pixelsPerShip*ui,side*.4);
  return Math.max(1,ship.spec.length)*side/Math.max(1,pixels);
}

/** Keep the member readable; a distant opponent may remain outside the shot. */
export function engagementFrame(subject:Ship,target:Ship|null,width:number,height:number,ui=1){
  const side=Math.max(1,Math.min(width,height)),base=shipFocusSpan(subject,width,height,ui,48);
  if(!target)return {x:subject.x,y:subject.y,span:base};
  const dx=target.x-subject.x,dy=target.y-subject.y,d=Math.hypot(dx,dy);
  // A giant opponent contributes its facing hull surface rather than its distant centre.
  const cos=Math.cos(target.heading),sin=Math.sin(target.heading),ux=d?(dx*cos+dy*sin)/d:1,uy=d?(-dx*sin+dy*cos)/d:0;
  const a=target.spec.length/2,b=target.spec.beam/2;
  const surface=1/Math.sqrt(ux*ux/(a*a)+uy*uy/(b*b));
  const gap=Math.max(0,d-surface),tx=subject.x+(d?dx/d*gap:0),ty=subject.y+(d?dy/d*gap:0);
  const needed=Math.max(base,(Math.abs(tx-subject.x)+subject.spec.length+base*.12)*side/Math.max(1,width),(Math.abs(ty-subject.y)+subject.spec.length+base*.12)*side/Math.max(1,height));
  const span=Math.min(base*1.5,needed),k=side/span;
  // Leave room ahead without pulling a small subject off screen to fit a giant target.
  const maxX=Math.max(0,width/(2*k)-subject.spec.length*.5-35*ui/k),maxY=Math.max(0,height/(2*k)-subject.spec.length*.5-45*ui/k);
  const shift=(v:number,limit:number)=>Math.sign(v)*Math.min(Math.abs(v)*.35,limit*.6);
  return {x:subject.x+shift(tx-subject.x,maxX),y:subject.y+shift(ty-subject.y,maxY),span};
}

/** Carry the subject's displacement exactly; ease only the composition offset. */
export function trackedCenter(center:{x:number;y:number},previous:{id:number;x:number;y:number}|null,subject:{id:number;x:number;y:number},frame:{x:number;y:number},blend:number){
 const dx=previous?.id===subject.id?subject.x-previous.x:0,dy=previous?.id===subject.id?subject.y-previous.y:0;
 const x=center.x+dx,y=center.y+dy;
 return {x:x+(frame.x-x)*blend,y:y+(frame.y-y)*blend};
}

/** A previous giant hull/overview must not make the next fighter microscopic.
 * This constrains only automatic framing, leaving the user's zoom multiplier. */
export function spectatorSpan(current:number,wanted:number,changed:boolean){
 return changed?Math.max(wanted*.6,Math.min(wanted*1.7,current)):current;
}
