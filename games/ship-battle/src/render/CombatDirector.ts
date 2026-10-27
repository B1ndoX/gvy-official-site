import type { BattleEvent, Projectile, Ship } from '../sim/types';

export interface Engagement { subject:Ship; target:Ship|null; active:boolean }

/** Read-only spectator selection. Camera time is real time, independent of battle speed. */
export class CombatDirector {
  private subject:number|null=null;private target:number|null=null;private held=0;private deadFor=0;private shotLength=0;
  constructor(private random:()=>number=Math.random){}
  reset(){this.subject=null;this.target=null;this.held=0;this.deadFor=0;this.shotLength=0;}
  update(ships:Ship[],projectiles:Projectile[],events:BattleEvent[],time:number,dt:number,settling=false):Engagement|null {
    // Travel is not a close-up shot. Start its hold after arrival, while deaths
    // keep their real-time linger even when a destination dies on the way.
    this.held=settling?0:this.held+dt;
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
    const candidates=[...pairs.values()].map(p=>({...p,active:p.activity>0}));
    const old=byId.get(this.subject??-1),oldTarget=byId.get(this.target??-1);
    if(old&&(!old.alive||oldTarget&&!oldTarget.alive)){
      this.deadFor+=dt;
      // A short-lived new subject must not start a chain of rapid death cuts.
      if(this.deadFor<2.5||!settling&&this.held<6)return {subject:old,target:oldTarget??null,active:false};
    }else this.deadFor=0;
    const current=candidates.find(p=>p.subject.id===this.subject&&p.target.id===this.target);
    const active=candidates.filter(p=>p.active),selectable=active.length?active:candidates;
    const pick=(pool:typeof candidates)=>{
      // Draw a member first, then one of its engagements. Multiple turrets,
      // location, hull size and health do not buy extra camera probability.
      const groups=new Map<number,typeof candidates>();
      for(const pair of pool){const group=groups.get(pair.subject.id);if(group)group.push(pair);else groups.set(pair.subject.id,[pair]);}
      const all=[...groups.values()],others=all.filter(group=>group[0].subject.id!==this.subject),options=others.length?others:all;
      const draw=<T,>(items:T[])=>items.length>1?items[Math.min(items.length-1,Math.floor(this.random()*items.length))]:items[0];
      const group=draw(options);return group?draw(group):undefined;
    };
    let choice=current;
    if(!current){
      // A brief aiming/recharge gap does not invalidate the whole camera shot.
      if(old?.alive&&oldTarget?.alive&&(settling||this.held<this.shotLength))return {subject:old,target:oldTarget,active:false};
      choice=pick(selectable);
    }else if(!settling&&this.held>=Math.max(6,this.shotLength)&&active.length)choice=pick(active);
    if(choice){
      if(choice.subject.id!==this.subject||choice.target.id!==this.target||this.shotLength===0){this.held=0;this.shotLength=choice.target.npc==='boss'?7+this.random()*3:5+this.random()*3;}
      this.subject=choice.subject.id;this.target=choice.target.id;this.deadFor=0;
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

/** Fit both combatants and the firing corridor inside the unobscured viewport.
 * A giant opponent contributes its nearby hull region instead of a whole-map shot. */
export function engagementFrame(subject:Ship,target:Ship|null,width:number,height:number,ui=1){
  const side=Math.max(1,Math.min(width,height));
  if(!target)return {x:subject.x,y:subject.y,span:shipFocusSpan(subject,width,height,ui,48)};
  const base=shipFocusSpan(subject.spec.length<=target.spec.length?subject:target,width,height,ui,48);
  const hull=(ship:Ship)=>{const c=Math.abs(Math.cos(ship.heading)),s=Math.abs(Math.sin(ship.heading));return {x:ship.x,y:ship.y,rx:(ship.spec.length*c+ship.spec.beam*s)/2,ry:(ship.spec.length*s+ship.spec.beam*c)/2};};
  const member=hull(subject);let opponent=hull(target);
  const dx=target.x-subject.x,dy=target.y-subject.y,d=Math.hypot(dx,dy);
  if(Math.max(target.spec.length,target.spec.beam)>Math.max(subject.spec.length,subject.spec.beam)*4){
    const cos=Math.cos(target.heading),sin=Math.sin(target.heading),ux=d?(dx*cos+dy*sin)/d:1,uy=d?(-dx*sin+dy*cos)/d:0;
    const surface=1/Math.hypot(ux/(target.spec.length/2),uy/(target.spec.beam/2));
    const patch=Math.max(100,Math.max(subject.spec.length,subject.spec.beam)*2),inset=Math.min(patch*.35,surface*.25),gap=Math.max(0,d-surface+inset);
    opponent={x:subject.x+(d?dx/d*gap:0),y:subject.y+(d?dy/d*gap:0),rx:Math.min(opponent.rx,patch),ry:Math.min(opponent.ry,patch)};
  }
  const left=Math.min(member.x-member.rx,opponent.x-opponent.rx),right=Math.max(member.x+member.rx,opponent.x+opponent.rx);
  const top=Math.min(member.y-member.ry,opponent.y-opponent.ry),bottom=Math.max(member.y+member.ry,opponent.y+opponent.ry);
  const marginX=Math.min(width*.22,Math.max(32*ui,width*.1)),marginY=Math.min(height*.22,Math.max(42*ui,height*.12));
  const span=Math.max(base,(right-left)*side/Math.max(1,width-2*marginX),(bottom-top)*side/Math.max(1,height-2*marginY));
  return {x:(left+right)/2,y:(top+bottom)/2,span};
}

/** Carry the subject's displacement exactly; ease only the composition offset. */
export function trackedCenter(center:{x:number;y:number},previous:{id:number;x:number;y:number}|null,subject:{id:number;x:number;y:number},frame:{x:number;y:number},blend:number){
 const dx=previous?.id===subject.id?subject.x-previous.x:0,dy=previous?.id===subject.id?subject.y-previous.y:0;
 const x=center.x+dx,y=center.y+dy;
 return {x:x+(frame.x-x)*blend,y:y+(frame.y-y)*blend};
}

/** One real-time zoom transition: approach small ships, open out slowly for
 * large hulls. The user's zoom multiplier and simulation are independent. */
export function spectatorSpan(current:number,wanted:number,seconds:number){
 if(seconds<=0)return current;
 const delta=Math.log(wanted/current),opening=delta>0,magnitude=Math.abs(delta);
 if(!opening&&magnitude<=.06)return current;
 const response=opening?2:1.2,speed=opening?1.2:.7,threshold=speed/response;
 // Integrate the bounded log-speed response exactly, independent of frame rate.
 const linearSeconds=Math.max(0,(magnitude-threshold)/speed);
 const remaining=seconds<=linearSeconds?magnitude-speed*seconds:Math.min(magnitude,threshold)*Math.exp(-response*(seconds-linearSeconds));
 // A small approach keeps its breathing room instead of pumping the zoom.
 const error=opening?remaining:Math.max(.06,remaining);
 return wanted*Math.exp(opening?-error:error);
}
