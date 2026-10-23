import type { ActiveBeam, BattlePhase, BattleMode, BattleOutcome, BattleSnapshot, Ship, ShipSpec, RosterEntry, Projectile, BattleEvent, KillRecord, Mount, Vec, WeaponKind } from './types';
import { clamp, distance, hullIntersection, intercept, mountWorld, randomGenerator, TAU, wrap } from './math';
import { rankMembers, BOSS_IDS } from './members';
import { bossDefense, bossPopulation } from './balance';
import defenseRules from '../data/defense-balance.json';
import {createAsteroids,avoidAsteroids,segmentRock,type Asteroid} from './asteroids';
import {battleSeconds,simulationSeconds} from './pacing';
import {evasion,evasionVelocity,attackNavigation,type AttackRun,type Evasion} from './maneuver';
import {fixedWeapon,guidedWeapon,projectileDamage} from './weapons';

export const STEP = 1 / 60;
export const MAX_SHIPS = 100;
export class BattleEngine {
  asteroids:Asteroid[]=[];collisionDeaths=0;private collisions=new Map<number,number>();
  ships: Ship[]=[]; projectiles: Projectile[]=[]; beams:ActiveBeam[]=[]; events: BattleEvent[]=[]; killLog: KillRecord[]=[];
  phase: BattlePhase='ready'; mode:BattleMode='brawl'; outcome:BattleOutcome=null; wave=1; nextWaveIn=0; private specMap=new Map<string,ShipSpec>(); private pendingBossId:string|null=null; private escortQueue:string[]=[];private nextEscortAt=0; time=0; shots=0; hits=0; arena=2400; seed=2956;
  private random=randomGenerator(this.seed); private sequence=0;private attackRuns=new Map<number,AttackRun>();private evasions=new Map<number,Evasion>();private burst=new Map<number,{time:number;available:number}>();
  private initialFleet:Ship[]=[];
  get living() { return this.ships.filter(s=>s.alive); }
  reset(roster: RosterEntry[], specs: ShipSpec[], seed=this.seed,mode:BattleMode='brawl') {
    this.mode=mode;this.outcome=null;this.wave=1;this.nextWaveIn=0;this.pendingBossId=null;this.escortQueue=[];this.nextEscortAt=0;this.seed=seed; this.random=randomGenerator(seed);this.sequence=0;
    this.asteroids=[];this.collisionDeaths=0;this.collisions.clear();this.ships=[];this.projectiles=[];this.beams=[];this.events=[];this.killLog=[];this.burst.clear();this.evasions.clear();this.attackRuns.clear();this.phase='ready';this.time=0;this.shots=0;this.hits=0;
    const byId=new Map(specs.map(s=>[s.id,s]));this.specMap=byId;
    const selected:{spec:ShipSpec;member?:RosterEntry['member'];npc?:RosterEntry['npc'];team?:string}[]=[];
    const members=new Set<string>();
    if(mode!=='brawl'){this.pendingBossId=roster.find(r=>r.npc==='boss')?.specId??null;this.escortQueue=mode==='bounty'?roster.filter(r=>r.npc==='escort').flatMap(r=>Array.from({length:r.count},()=>r.specId)):[];}
    const deployed=mode==='brawl'?roster:roster.filter(r=>!r.npc);
    for(const row of deployed){let spec=byId.get(row.specId);if(row.member&&members.has(row.member.handle))continue;if(row.member)members.add(row.member.handle);if(spec&&row.npc==='boss')spec={...spec,hull:spec.hull*(spec.id==='retribution'?1:2)};if(spec)for(let n=0;n<Math.min(row.member?1:MAX_SHIPS,Math.max(0,Math.floor(row.count)));n++)if(selected.length<(row.npc?MAX_SHIPS+21:MAX_SHIPS))selected.push({spec,member:row.member,npc:row.npc,team:row.npc?row.team:mode==='brawl'||mode==='teams'?row.team:'members'});}
    this.arena=Math.max(2200,Math.sqrt(selected.reduce((sum,s)=>sum+(Math.max(s.spec.length,s.spec.beam)*.5+40)**2,0))*3.2);
    const positions:({x:number;y:number;radius:number}|undefined)[]=new Array(selected.length);
    // Reserve large hulls first while preserving original member IDs and tie order.
    const order=selected.map((s,index)=>({index,radius:Math.max(9,Math.max(s.spec.length,s.spec.beam)*.5)})).sort((a,b)=>b.radius-a.radius);
    for(const {index,radius} of order){
      let placed=false;
      for(let attempt=0;attempt<4000;attempt++){
        const angle=this.random()*TAU,r=Math.sqrt(this.random())*this.arena*.7,x=mode==='teams'?(selected[index].team==='red'?-1:1)*this.arena*(.5+this.random()*.22):Math.cos(angle)*r,y=mode==='teams'?(this.random()-.5)*this.arena:Math.sin(angle)*r;
        if(positions.every(p=>!p||Math.hypot(p.x-x,p.y-y)>p.radius+radius+45)){positions[index]={x,y,radius};placed=true;break;}
      }
      if(!placed)throw new Error('编队过于密集，请减少舰船数量');
    }
    const counts=new Map<string,number>();
    for(let index=0;index<selected.length;index++){
      const {spec,member,npc,team}=selected[index],{x,y,radius}=positions[index]!;
      const count=(counts.get(spec.id)??0)+1;counts.set(spec.id,count);
      this.ships.push({id:this.ships.length+1,spec,member,npc,team,label:member?.name??(npc==='boss'?`BOSS · ${spec.name}`:npc==='escort'?`剜度僚机 · ${spec.name} ${String(count).padStart(2,'0')}`:`${spec.name} ${String(count).padStart(2,'0')}`),x,y,vx:0,vy:0,heading:Math.atan2(-y,-x),hull:spec.hull,shield:spec.shield,kills:0,alive:true,radius,targetId:null,lastHit:-10,lastDealt:0,searchAt:0,cooldowns:spec.mounts.map(m=>this.random()*m.cooldown),turretAngles:spec.mounts.map(m=>m.facing*Math.PI/180),turretTargets:spec.mounts.map(()=>null)});
    }
    this.initialFleet=this.ships.filter(s=>!s.npc);
    this.asteroids=createAsteroids(this.ships,this.arena,seed);
  }
  start(){if(this.ships.length>=2&&this.phase==='ready'){this.phase='running';if(this.pendingBossId){this.spawnEnemy(this.pendingBossId,'boss');this.pendingBossId=null;this.nextEscortAt=this.time+2;}}}
  pause(){if(this.phase==='running')this.phase='paused';else if(this.phase==='paused')this.phase='running';}
  private target(s:Ship, candidates:Ship[], origin:Vec=s, mount?:Mount, previous:number|null=null):Ship|null {
    // Fixed capital guns share the hull's committed target; turrets still defend independently.
    if(mount&&fixedWeapon(mount)&&(s.npc==='boss'||s.spec.length>=100)){
      const locked=candidates.find(other=>other.id===s.targetId&&other.alive);
      if(locked&&distance(origin,locked)<=mount.range+locked.radius&&Math.abs(wrap(Math.atan2(locked.y-origin.y,locked.x-origin.x)-s.heading-mount.facing*Math.PI/180))<=mount.arc*Math.PI/360)return locked;
    }
    let best:Ship|null=null,score=Infinity;
    for(const other of candidates){
      if(other.id===s.id||(s.team&&s.team===other.team))continue;
      const dist=distance(origin,other);
      if(mount){if(dist>mount.range+other.radius)continue;const delta=wrap(Math.atan2(other.y-origin.y,other.x-origin.x)-s.heading-mount.facing*Math.PI/180);if(Math.abs(delta)>mount.arc*Math.PI/360)continue;}
      const retaliation=other.targetId===s.id?.82:1,stickiness=other.id===(mount?previous:s.targetId)?(mount?.role==='point-defense'?.65:.55):1;
      const health=.65+.35*(other.hull/other.spec.hull);
      const doctrine=s.spec.doctrine;
      const threat=!s.npc&&other.npc?(other.npc==='boss'?(doctrine==='bomber'?.28:doctrine==='interceptor'?.85:.5):doctrine==='interceptor'?.25:.65):1;
      const counter=mount?.role==='point-defense'?clamp(other.spec.length/35,.55,3):mount?.role==='anti-capital'?clamp(100/other.spec.length,.2,4):mount?.role==='main'&&s.spec.length>=100?clamp((100/other.spec.length)**.8,.2,3):doctrine==='interceptor'&&other.spec.doctrine==='bomber'?.7:doctrine==='bomber'&&other.spec.length>=100?.65:1;
      const turning=!mount&&(s.npc==='boss'||s.spec.length>=100)?1+Math.min(5,Math.abs(wrap(Math.atan2(other.y-s.y,other.x-s.x)-s.heading))/Math.max(.01,s.spec.turnRate)*.35):1;
      const next=dist*retaliation*stickiness*health*threat*counter*turning;
      if(next<score){score=next;best=other;}
    }return best;
  }
  step(dt=STEP) {
    if(this.phase!=='running')return;
    if(!Number.isFinite(dt)||dt<=0||dt>STEP*1.01)throw new Error('BattleEngine.step requires a fixed 1/60s step');
    this.time+=dt;
    if(this.nextWaveIn>0){this.nextWaveIn=Math.max(0,this.nextWaveIn-dt);if(this.nextWaveIn===0)this.spawnNextBoss();return;}
    if(this.escortQueue.length&&this.time>=this.nextEscortAt){const boss=this.ships.filter(s=>s.npc==='boss').at(-1);if(boss?.alive){this.spawnEnemy(this.escortQueue.shift()!,'escort');this.nextEscortAt=this.time+.28;}else this.escortQueue=[];}
    const living=this.living, byId=new Map(living.map(s=>[s.id,s])),allById=new Map(this.ships.map(s=>[s.id,s]));
    if(this.checkOutcome())return;
    for(const s of living){
      if(s.enterUntil&&this.time<s.enterUntil){s.x+=s.vx*dt;s.y+=s.vy*dt;continue;}
      const committedHull=s.npc==='boss'||s.spec.length>=100;
      const busy=committedHull&&(this.beams.some(b=>b.owner===s.id)||s.weaponCycles?.some((c,i)=>fixedWeapon(s.spec.mounts[i])&&c.chargeLeft>0));
      if(this.time>=s.searchAt&&!busy||!byId.has(s.targetId??-1)) {
        const next=this.target(s,living);s.targetId=next?.id??null;
        const turn=next?Math.abs(wrap(Math.atan2(next.y-s.y,next.x-s.x)-s.heading))/Math.max(.01,s.spec.turnRate):0;
        s.searchAt=this.time+(committedHull?clamp(simulationSeconds(s.npc==='boss'?6:4)+turn,simulationSeconds(s.npc==='boss'?6:4),simulationSeconds(s.npc==='boss'?20:14)):.55+this.random()*.35);
      }
      const target=byId.get(s.targetId??-1);
      if(!target)continue;
      const lead=intercept(s,target,Math.max(450,s.spec.mounts[0]?.speed??900));
      const dist=distance(s,target),optimum=Math.max(s.spec.preferredRange,s.radius+target.radius+50);
      const attack=attackNavigation(s,target,this.time,this.attackRuns.get(s.id));
      if(attack)this.attackRuns.set(s.id,attack.state);else this.attackRuns.delete(s.id);
      let desired=attack?.heading??Math.atan2(lead.y-s.y,lead.x-s.x);
      const stalled=this.time-s.lastDealt>12;
      if(stalled&&!attack&&!committedHull){const angle=Math.atan2(target.y-s.y,target.x-s.x);desired=angle+(s.id%2?1:-1)*.65;}

      // Stable per-ship attack lanes and alternating passes prevent a stationary firing ball.
      const fighter=s.spec.class==='fighter',capital=s.spec.class==='capital';
      const phase=this.time/(fighter?6.5:11)+s.id*1.618;
      const lane=Math.sin(phase*Math.PI)>0?1:-1;
      const inCombat=dist<optimum*1.7;
      const radial=clamp((dist-optimum*.9)/(optimum*.55),-.3,1);
      let speed=s.spec.speed*radial;
      if(inCombat){
        if(fighter)speed+=Math.sin(phase*1.7)*s.spec.speed*.18;
        // Heavy hulls and bosses keep advancing rather than braking to zero at optimum range.
        else if(s.npc==='boss'||dist>optimum*.75)speed=Math.max(speed,s.spec.speed*(s.npc==='boss'?.24:capital?.16:.2));
      }
      let avoidX=0,avoidY=0;
      for(const other of living){if(other===s)continue;const d=distance(s,other),safe=s.radius+other.radius+(fighter?110:80);if(d<safe&&d>.001){const weight=(safe-d)/safe*Math.min(1,other.radius/s.radius);avoidX+=(s.x-other.x)/d*weight;avoidY+=(s.y-other.y)/d*weight;}}
      const obstacle=avoidAsteroids(s,this.asteroids);avoidX+=obstacle.x;avoidY+=obstacle.y;
      if(Math.hypot(avoidX,avoidY)>.7&&dist>optimum*.8)desired=Math.atan2(Math.sin(desired)+avoidY*1.3,Math.cos(desired)+avoidX*1.3);
      const delta=wrap(desired-s.heading);s.heading=wrap(s.heading+clamp(delta,-s.spec.turnRate*dt,s.spec.turnRate*dt));
      if(attack)speed=s.spec.speed*attack.boost;else if(stalled)speed=Math.max(speed,s.spec.speed*.65);
      else if(Math.abs(delta)>1)speed*=.65;
      // Brief aiming windows retain fixed-gun accuracy; no permanent stopped/aiming state.
      const aimWindow=stalled&&Math.sin(phase*2)>.3;
      const strafe=!attack&&inCombat?lane*s.spec.speed*(fighter?.34:capital?.1:.22)*(aimWindow?.3:1):0;
      const bearing=Math.atan2(target.y-s.y,target.x-s.x);
      const dodge=evasion(s,allById,this.projectiles,this.time,this.evasions.get(s.id)??{until:0,readyAt:0,scanAt:0,side:s.id%2?1:-1});this.evasions.set(s.id,dodge);
      const defensive=evasionVelocity(s,bearing,dodge,this.time),dodging=defensive.boost>1;
      let vx=(attack?.velocity?.x??Math.cos(s.heading)*speed)-Math.sin(bearing)*(dodging?0:strafe)+defensive.x+avoidX*s.spec.speed*.9;
      let vy=(attack?.velocity?.y??Math.sin(s.heading)*speed)+Math.cos(bearing)*(dodging?0:strafe)+defensive.y+avoidY*s.spec.speed*.9;
      // A boost is a short lateral burst, not a permanent change to the ship's base stats.
      if(dodging&&fighter){vx+=Math.cos(s.heading)*s.spec.speed*.18;vy+=Math.sin(s.heading)*s.spec.speed*.18;}
      const maxSpeed=s.spec.speed*(dodging?defensive.boost:attack?.boost??1),velocity=Math.hypot(vx,vy);
      if(velocity>maxSpeed&&velocity>0){vx*=maxSpeed/velocity;vy*=maxSpeed/velocity;}
      if(Math.hypot(s.x,s.y)>this.arena*.88){vx-=s.x/this.arena*s.spec.speed;vy-=s.y/this.arena*s.spec.speed;}
      const dvx=vx-s.vx,dvy=vy-s.vy,dv=Math.hypot(dvx,dvy),factor=dv?Math.min(1,s.spec.acceleration*(dodging&&fighter?2.2:1)*dt/dv):0;
      s.vx+=dvx*factor;s.vy+=dvy*factor;s.x+=s.vx*dt;s.y+=s.vy*dt;
      if(this.time-s.lastHit>defenseRules.shieldRecoveryDelay)s.shield=Math.min(s.spec.shield,s.shield+s.spec.shieldRegen*dt);
      this.fire(s,living,dt);
    }
    // Symmetric position correction prevents persistent overlaps; no collision damage or random teleports.
    for(let iteration=0;iteration<3;iteration++)for(let a=0;a<living.length;a++)for(let b=a+1;b<living.length;b++){
      const s=living[a],o=living[b],dx=o.x-s.x,dy=o.y-s.y,d=Math.hypot(dx,dy),minimum=s.radius+o.radius+3;
      if(d>=minimum)continue;
      const nx=d>.0001?dx/d:Math.cos(s.id),ny=d>.0001?dy/d:Math.sin(s.id),push=(minimum-d)*1.02,mass=s.radius*s.radius,otherMass=o.radius*o.radius,share=otherMass/(mass+otherMass);
      s.x-=nx*push*share;s.y-=ny*push*share;o.x+=nx*push*(1-share);o.y+=ny*push*(1-share);
    }
    for(const s of living)for(const rock of this.asteroids){
      if(!s.alive)break;const dx=s.x-rock.x,dy=s.y-rock.y,d=Math.hypot(dx,dy),minimum=s.radius+rock.radius;
      if(d>=minimum)continue;const nx=d>.001?dx/d:Math.cos(s.heading),ny=d>.001?dy/d:Math.sin(s.heading),speed=Math.hypot(s.vx,s.vy),inward=s.vx*nx+s.vy*ny;
      s.x=rock.x+nx*(minimum+2);s.y=rock.y+ny*(minimum+2);if(inward<0){s.vx-=nx*inward*1.5;s.vy-=ny*inward*1.5;}
      if(this.time-(this.collisions.get(s.id)??-100)<.8)continue;this.collisions.set(s.id,this.time);
      const fatal=s.spec.length<35&&speed>Math.max(185,s.spec.speed*.78),total=s.spec.hull+s.spec.shield;
      this.damage(s,fatal?total:total*Math.min(.45,.015+(speed/300)**2*.25),0,{x:rock.x+nx*rock.radius,y:rock.y+ny*rock.radius},true);
    }
    this.updateProjectiles(dt,byId);
    if(this.phase==='running')this.updateBeams(dt,byId);
    this.events=this.events.filter(e=>this.time-e.time<2.8).slice(-800);
    this.checkOutcome();
  }
  private fire(s:Ship,living:Ship[],dt:number){
    const cycles=s.weaponCycles??(s.weaponCycles=[]);
    s.spec.mounts.forEach((m,i)=>{
      s.cooldowns[i]=Math.max(0,s.cooldowns[i]-dt);if(m.kind==='ballistic'&&s.cooldowns[i]<1e-8)s.cooldowns[i]=0;
      const cycle=cycles[i]??(cycles[i]={chargeLeft:-1,burstLeft:0});
      if(cycle.chargeLeft>=0)cycle.chargeLeft=Math.max(0,cycle.chargeLeft-dt);
      if(m.kind==='beam'&&this.beams.some(b=>b.owner===s.id&&b.mount===i))return;
      const origin=mountWorld(s,m),target=this.target(s,living,origin,m,s.turretTargets[i]);s.turretTargets[i]=target?.id??null;
      if(!target){cycle.chargeLeft=-1;return;}
      const point=guidedWeapon(m)||m.kind==='beam'?target:intercept(origin,target,m.speed);
      const aimed=Math.atan2(point.y-origin.y,point.x-origin.x),relative=wrap(aimed-s.heading),facing=m.facing*Math.PI/180;
      if(Math.abs(wrap(relative-facing))>m.arc*Math.PI/360)return;
      const desired=fixedWeapon(m)?facing:relative;
      s.turretAngles[i]=wrap(s.turretAngles[i]+clamp(wrap(desired-s.turretAngles[i]),-m.turnRate*dt,m.turnRate*dt));
      const error=Math.abs(wrap(relative-s.turretAngles[i]));
      const tolerance=guidedWeapon(m)?.3:Math.max(.012,Math.atan2(Math.min(target.spec.beam,target.spec.length)*.28+2,distance(origin,target)));
      if(s.cooldowns[i]>0||error>tolerance||this.projectiles.length>=3500)return;
      if(m.charge&&cycle.chargeLeft<0){cycle.chargeLeft=m.charge;return;}
      if(cycle.chargeLeft>0)return;
      cycle.chargeLeft=-1;
      const angular=Math.abs((target.x-origin.x)*target.vy-(target.y-origin.y)*target.vx)/Math.max(1,distance(origin,target)**2);
      const spread=guidedWeapon(m)||m.kind==='beam'||m.kind==='railgun'?0:m.kind==='ballistic'?.006:m.role==='point-defense'?.0025:Math.min(s.spec.length>=100?.14:.035,.002+angular/Math.max(.1,m.turnRate)*(s.spec.length>=100?.08:.016));
      const angle=s.heading+s.turretAngles[i]+(this.random()-.5)*2*spread;
      if(m.kind==='beam'){
        this.beams.push({owner:s.id,mount:i,remaining:m.duration??1,elapsed:0,pending:0,segments:[]});
        s.cooldowns[i]=m.cooldown+(m.duration??1);
      }else{
        this.projectiles.push({id:++this.sequence,owner:s.id,target:target.id,kind:m.kind,role:m.role,turnRate:m.turnRate,x:origin.x,y:origin.y,vx:Math.cos(angle)*m.speed,vy:Math.sin(angle)*m.speed,angle,speed:m.speed,damage:m.damage,ttl:m.range/m.speed+dt,travel:0,range:m.range,color:m.color??(s.id%2?0xf3cc7e:0x84c4ff),width:m.width,...(m.kind==='torpedo'?{trail:[{...origin}],trailClock:0}:{})});
        if(m.burstCount){cycle.burstLeft=(cycle.burstLeft||m.burstCount)-1;s.cooldowns[i]=cycle.burstLeft?m.cooldown:m.burstCooldown??m.cooldown;}else s.cooldowns[i]=m.cooldown;
      }
      if(['beam','railgun','torpedo','ballistic'].includes(m.kind))this.events.push({id:++this.sequence,kind:'shot',weapon:m.kind,angle,...origin,time:this.time,radius:s.radius,ship:s.id,by:s.id,label:s.label});
      this.shots++;
    });
  }
  private updateBeams(dt:number,byId:Map<number,Ship>){
    const owners=new Map(this.ships.map(s=>[s.id,s])),active:ActiveBeam[]=[];
    for(const b of this.beams){
      const owner=owners.get(b.owner);if(!owner?.alive)continue;
      const m=owner.spec.mounts[b.mount];if(m?.kind!=='beam')continue;
      const delta=Math.min(dt,b.remaining);b.remaining-=delta;b.elapsed+=delta;b.pending+=delta;
      // Five damage ticks per 1× real second; elapsed time preserves the volley budget.
      const tick=b.pending>=simulationSeconds(.2)-1e-8||b.remaining<1e-8,seconds=tick?b.pending:0;
      if(tick)b.pending=0;
      const emitters=m.beamWidth?Array.from({length:9},(_,i)=>m.x+(i/8-.5)*m.beamWidth!/owner.spec.beam):m.emitters??[m.x],angle=owner.heading+m.facing*Math.PI/180,dx=Math.cos(angle),dy=Math.sin(angle);
      b.segments=[];const damage=new Map<number,{ship:Ship;amount:number;point:Vec}>();let broadDistance=1,broadVictim:Ship|null=null;
      for(const x of emitters){
        const from=mountWorld(owner,{x,y:m.y}),end={x:from.x+dx*m.range,y:from.y+dy*m.range};
        let nearest=1,victim:Ship|null=null;
        for(const s of byId.values()){
          if(!s.alive||s.id===owner.id||(owner.team&&s.team===owner.team))continue;
          const hit=hullIntersection(from,end,s);if(hit!==null&&hit<nearest){nearest=hit;victim=s;}
        }
        for(const rock of this.asteroids){const hit=segmentRock(from,end,rock);if(hit!==null&&hit<=nearest){nearest=hit;victim=null;}}
        const to={x:from.x+dx*m.range*nearest,y:from.y+dy*m.range*nearest};
        if(m.beamWidth){if(nearest<broadDistance){broadDistance=nearest;broadVictim=victim;}continue;}
        b.segments.push({from,to,hit:!!victim});
        if(victim&&seconds){const current=damage.get(victim.id)??{ship:victim,amount:0,point:to};current.amount+=m.damage*seconds/emitters.length;damage.set(victim.id,current);}
      }
      if(m.beamWidth){
        const from=mountWorld(owner,m),to={x:from.x+dx*m.range*broadDistance,y:from.y+dy*m.range*broadDistance};
        b.segments=[{from,to,hit:!!broadVictim}];
        if(broadVictim&&seconds)damage.set(broadVictim.id,{ship:broadVictim,amount:m.damage*seconds,point:to});
      }
      for(const hit of damage.values()){
        this.damage(hit.ship,hit.amount,owner.id,hit.point,false,'beam',seconds);
        if(this.checkOutcome()){this.beams=[];return;}
      }
      if(b.remaining>1e-8)active.push(b);
    }
    this.beams=active;
  }
  private updateProjectiles(dt:number,byId:Map<number,Ship>){
    const survivors:Projectile[]=[],owners=new Map(this.ships.map(s=>[s.id,s]));
    for(const p of this.projectiles){
      if(guidedWeapon(p)) { const target=byId.get(p.target);if(target?.alive){const aim=Math.atan2(target.y-p.y,target.x-p.x);p.angle=wrap(p.angle+clamp(wrap(aim-p.angle),-(p.turnRate??(p.role==='anti-capital'?.72:2.3))*dt,(p.turnRate??(p.role==='anti-capital'?.72:2.3))*dt));p.vx=Math.cos(p.angle)*p.speed;p.vy=Math.sin(p.angle)*p.speed;}}
      const next={x:p.x+p.vx*dt,y:p.y+p.vy*dt};
      let victim:Ship|null=null,impact=Infinity;
      const owner=owners.get(p.owner);
      for(const s of byId.values()){
        if(s.id===p.owner||!s.alive||(owner?.team&&owner.team===s.team))continue;
        if(Math.abs(s.x-p.x)>s.radius+p.speed*dt+5||Math.abs(s.y-p.y)>s.radius+p.speed*dt+5)continue;
        // Relative motion compensates for the target advancing during the same fixed step.
        const hit=hullIntersection({x:p.x+s.vx*dt,y:p.y+s.vy*dt},next,s);
        if(hit!==null&&hit<impact){impact=hit;victim=s;}
      }
      let terrain=Infinity;for(const rock of this.asteroids){const hit=segmentRock(p,next,rock);if(hit!==null&&hit<terrain)terrain=hit;}if(Number.isFinite(terrain)&&terrain<=impact)continue;
      if(victim){this.damage(victim,projectileDamage(p.kind,p.damage,p.travel+p.speed*dt*impact)*(p.role==='anti-capital'?clamp((victim.spec.length/40)**1.65,.12,24):1),p.owner,{x:p.x+(next.x-p.x)*impact,y:p.y+(next.y-p.y)*impact},false,p.kind);
        // Settle at the first last-survivor event, before later projectiles in this step.
        if(this.checkOutcome()){this.projectiles=[];return;}continue;}
      p.x=next.x;p.y=next.y;p.ttl-=dt;p.travel+=p.speed*dt;
      if(p.trail){p.trailClock=(p.trailClock??0)+dt;if(p.trailClock>=.08){p.trailClock=0;p.trail.push({x:p.x,y:p.y});if(p.trail.length>9)p.trail.shift();}}
      if(p.ttl>0&&p.travel<=p.range)survivors.push(p);
    }this.projectiles=survivors;
  }
  private damage(s:Ship,amount:number,owner:number,point:Vec,environment=false,weapon?:WeaponKind,beamSeconds=0){
    const rule=s.npc==='boss'&&(this.mode==='bounty'||this.mode==='challenge')?defenseRules.burst[this.mode]:defenseRules.burst.member,total=s.spec.hull+s.spec.shield;
    const bucket=this.burst.get(s.id)??{time:this.time,available:total*rule.capacity};
    bucket.available=Math.min(total*rule.capacity,bucket.available+(this.time-bucket.time)*total*rule.perSecond);bucket.time=this.time;
    // Capital beams use the same 50%-per-second ceiling (10% per 0.2-second tick).
    // Railgun bypasses ordinary protection; bosses retain their encounter cap.
    const protectedBoss=s.npc==='boss';
    if(!environment&&!(weapon==='railgun'&&!protectedBoss))amount=weapon==='beam'&&!protectedBoss?Math.min(amount,total*.5*battleSeconds(beamSeconds)):weapon==='torpedo'&&!protectedBoss?Math.min(amount,total*.55):Math.min(amount,bucket.available);bucket.available=Math.max(0,bucket.available-amount);this.burst.set(s.id,bucket);
    const absorbed=Math.min(s.shield,amount);s.shield-=absorbed;s.hull=Math.max(0,s.hull-(amount-absorbed));s.lastHit=this.time;this.hits++;
    const attacker=this.ships.find(o=>o.id===owner);if(attacker)attacker.lastDealt=this.time;
    this.events.push({id:++this.sequence,kind:absorbed>0?'shield':'hit',...point,time:this.time,radius:s.radius,ship:s.id,by:owner,label:s.label});
    if(s.hull<=0){if(environment)this.collisionDeaths++;s.alive=false;s.shield=0;if(attacker)attacker.kills++;const id=++this.sequence;this.events.push({id,kind:'destroy',x:s.x,y:s.y,time:this.time,radius:s.radius,ship:s.id,by:owner,label:s.label});this.killLog.push({id,time:this.time,victimId:s.id,victimName:s.label,killerId:owner,killerName:environment?'陨石撞击':attacker?.label??'未知成员'});this.killLog=this.killLog.slice(-12);}
  }
  private finish(outcome:BattleOutcome){this.phase='finished';this.outcome=outcome;this.projectiles=[];this.beams=[];}
  private checkOutcome(){
    if(this.phase==='finished')return true;
    const living=this.living;
    if(this.mode==='teams'){const red=living.some(s=>s.team==='red'),blue=living.some(s=>s.team==='blue');if(!red||!blue){this.finish(red?'red':blue?'blue':'draw');return true;}return false;}
    if(this.mode==='brawl'){
      if(living.length<=1||(living.length>0&&Boolean(living[0].team)&&living.every(s=>s.team===living[0].team))){this.finish(living[0]?.npc?'boss':'member');return true;}
      return false;
    }
    if(!living.some(s=>!s.npc)){this.finish('boss');return true;}
    const boss=this.ships.filter(s=>s.npc==='boss').at(-1);
    if(boss?.alive)return false;
    if(this.mode==='bounty'||this.wave>=BOSS_IDS.length){this.finish('players');return true;}
    if(this.nextWaveIn===0)this.nextWaveIn=defenseRules.intermission.seconds;
    this.projectiles=[];this.beams=[];return true;
  }
  private spawnNextBoss(){
    const id=BOSS_IDS[this.wave];if(!id){this.finish('players');return;}this.wave++;this.spawnEnemy(id,'boss');
    for(const member of this.living.filter(s=>!s.npc)){member.targetId=null;member.searchAt=0;member.hull=Math.min(member.spec.hull,member.hull+member.spec.hull*defenseRules.intermission.hullRecovery);member.shield=Math.min(member.spec.shield,member.shield+member.spec.shield*defenseRules.intermission.shieldRecovery);}
  }
  private spawnEnemy(specId:string,npc:'boss'|'escort'){
    const original=this.specMap.get(specId);if(!original)return;
    const crowd=clamp(Math.sqrt(this.ships.filter(s=>!s.npc).length/32),.45,1.5);
    const escortScale=defenseRules.escortDefenseMultiplier*crowd;
    const defense=npc==='boss'?bossDefense(original,this.mode,this.initialFleet,this.initialFleet.length,this.wave):{hull:Math.round(original.hull*escortScale),shield:Math.round(original.shield*escortScale),shieldRegen:original.shieldRegen*escortScale};
    const damageFactor=npc==='boss'?bossPopulation(this.initialFleet.length).damage*defenseRules.bossDamageMultiplier*(this.mode==='challenge'?defenseRules.challengeDamageMultiplier:1):defenseRules.escortDamageMultiplier*crowd;
    const mounts=damageFactor===1?original.mounts:original.mounts.map(m=>({...m,damage:m.damage*damageFactor}));
    const spec={...original,mounts,hull:defense.hull,shield:defense.shield,shieldRegen:defense.shieldRegen};
    const members=this.living.filter(s=>!s.npc),radius=Math.max(9,Math.max(spec.length,spec.beam)*.5);
    const center={x:members.reduce((n,s)=>n+s.x,0)/Math.max(1,members.length),y:members.reduce((n,s)=>n+s.y,0)/Math.max(1,members.length)};
    const field=Math.max(600,...members.map(s=>distance(s,center)+s.radius));
    // Every arrival gets an independent seeded bearing; ships fly inward from the perimeter.
    const angle=this.random()*TAU;
    let x=0,y=0;
    for(let attempt=0;attempt<300;attempt++){
      const range=field+radius+100+attempt*12;
      x=center.x+Math.cos(angle)*range;y=center.y+Math.sin(angle)*range;
      if(this.living.every(s=>distance(s,{x,y})>s.radius+radius+12))break;
    }
    const heading=Math.atan2(center.y-y,center.x-x);
    const id=Math.max(0,...this.ships.map(s=>s.id))+1,number=this.ships.filter(s=>s.npc==='escort').length+1;
    this.ships.push({id,spec,npc,team:'vanduul',enterUntil:this.time+(npc==='boss'?4:1.5),label:npc==='boss'?`BOSS · ${spec.name}`:`剜度 · ${String(number).padStart(2,'0')}`,x,y,vx:Math.cos(heading)*spec.speed,vy:Math.sin(heading)*spec.speed,heading,hull:spec.hull,shield:spec.shield,kills:0,alive:true,radius,targetId:null,lastHit:-10,lastDealt:this.time,searchAt:0,cooldowns:spec.mounts.map((m,i)=>.5+m.cooldown*i/spec.mounts.length),turretAngles:spec.mounts.map(m=>m.facing*Math.PI/180),turretTargets:spec.mounts.map(()=>null)});
    this.arena=Math.max(this.arena,Math.hypot(x,y)+radius+600);
  }
  snapshot(selectedId:number|null=null):BattleSnapshot {
    const alive=this.living,winner=this.phase==='finished'&&!['players','red','blue','draw'].includes(this.outcome??'')?(alive.find(s=>s.npc==='boss')??alive[0]):null;
    const standings=rankMembers(this.ships.map(s=>({id:s.id,member:s.member,npc:s.npc,name:s.label,shipName:s.spec.name,specId:s.spec.id,kills:s.kills,alive:s.alive})));
    return {phase:this.phase,mode:this.mode,outcome:this.outcome,wave:this.wave,waves:this.mode==='challenge'?BOSS_IDS.length:this.mode==='bounty'?1:0,nextWaveIn:battleSeconds(this.nextWaveIn),time:battleSeconds(this.time),alive:alive.length,total:this.ships.length,destroyed:this.ships.length-alive.length,winner:winner?standings.find(s=>s.id===winner.id)!:null,standings,recentKills:this.killLog.slice(-3).reverse().map(k=>({...k,time:battleSeconds(k.time)})),boss:this.ships.filter(s=>s.npc==='boss').at(-1)??null,escortsAlive:alive.filter(s=>s.npc==='escort').length,memberAlive:alive.filter(s=>!s.npc).length,memberTotal:this.ships.filter(s=>!s.npc).length,redAlive:alive.filter(s=>s.team==='red').length,blueAlive:alive.filter(s=>s.team==='blue').length,collisionDeaths:this.collisionDeaths,projectiles:this.projectiles.length,shots:this.shots,hits:this.hits,selected:this.ships.find(s=>s.id===selectedId)??null};
  }
}
