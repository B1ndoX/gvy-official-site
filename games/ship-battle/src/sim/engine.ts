import type { ActiveBeam, BattlePhase, BattleMode, BattleOutcome, BattleSnapshot, Ship, ShipSpec, RosterEntry, Projectile, BattleEvent, KillRecord, Mount, Vec, WeaponKind, WeaponCycle, AimTracking } from './types';
import { clamp, distance, hullIntersection, intercept, mountWorld, randomGenerator, TAU, wrap } from './math';
import { rankMembers, BOSS_IDS } from './members';
import { bossDefense, bossPopulation } from './balance';
import bossRules from '../data/boss-mode-balance.json';
import defenseRules from '../data/defense-balance.json';
import {createAsteroids,avoidAsteroids,asteroidContact,asteroidSafeHeading,segmentRock,type Asteroid} from './asteroids';
import {battleSeconds,simulationSeconds} from './pacing';
import {evasion,evasionVelocity,attackNavigation,type AttackRun,type Evasion} from './maneuver';
import {fixedWeapon,turretControlled,guidedWeapon,projectileDamage} from './weapons';
import {shipContact,shipImpact,shipMass,SHIP_IMPACT_PER_SECOND} from './collisions';
import {WeaponCollisionGrid} from './weapon-collision-grid';
import simulationProfile from '../data/simulation-profile.json';
import {trackAim} from './turret-tracking';
import aimRules from '../data/aim-tracking-rules.json';
import {weaponCycle,rechargeWeapons,energyReady,spendEnergy,kineticGun} from './weapon-resources';
import {chargedWeapon,chargeDamageMultiplier,chooseChargeGoal} from './charged-weapon';
import resourceRules from '../data/weapon-resource-rules.json';
import {firingObstacle,terrainCourse,type TerrainLane} from './terrain-navigation';
import {trafficVelocity} from './traffic-avoidance';
import {naturalShieldRecovery} from './shield-recovery';
import {weaponHullIntersection,type WeaponHullProfile} from './weapon-hull';

export const STEP = 1 / 60;
export const MAX_SHIPS = 100;
export class BattleEngine {
  constructor(readonly referenceMode=simulationProfile.mode==='reference'){}
  // Immutable asset geometry is installed with the artwork. Headless/custom
  // fleets without readable artwork retain the existing geometric fallback.
  weaponHulls:ReadonlyMap<string,WeaponHullProfile>=new Map();
  asteroids:Asteroid[]=[];collisionDeaths=0;private collisions=new Map<string,[number,number]>();
  ships: Ship[]=[]; projectiles: Projectile[]=[]; beams:ActiveBeam[]=[]; events: BattleEvent[]=[]; killLog: KillRecord[]=[];
  phase: BattlePhase='ready'; mode:BattleMode='brawl'; outcome:BattleOutcome=null; wave=1; nextWaveIn=0; private specMap=new Map<string,ShipSpec>(); private pendingBossId:string|null=null; private escortQueue:string[]=[];private nextEscortAt=0; time=0; shots=0; hits=0; defenseShots=0;interceptions=0; arena=2400; seed=2956;
  private random=randomGenerator(this.seed); private sequence=0;private attackRuns=new Map<number,AttackRun>();private evasions=new Map<number,Evasion>();private burst=new Map<number,{time:number;available:number}>();
  private initialFleet:Ship[]=[];
  private beamTurns=new Map<number,AimTracking>();
  private terrainLanes=new Map<number,TerrainLane>();
  private shipContacts=new Map<string,[number,number]>();
  private shipImpacts=new Map<number,{time:number;amount:number}[]>();
  get living() { return this.ships.filter(s=>s.alive); }
  reset(roster: RosterEntry[], specs: ShipSpec[], seed=this.seed,mode:BattleMode='brawl') {
    this.mode=mode;this.outcome=null;this.wave=1;this.nextWaveIn=0;this.pendingBossId=null;this.escortQueue=[];this.nextEscortAt=0;this.seed=seed; this.random=randomGenerator(seed);this.sequence=0;
    this.asteroids=[];this.collisionDeaths=0;this.collisions.clear();this.ships=[];this.projectiles=[];this.beams=[];this.events=[];this.killLog=[];this.burst.clear();this.evasions.clear();this.attackRuns.clear();this.beamTurns.clear();this.terrainLanes.clear();this.shipContacts.clear();this.shipImpacts.clear();this.phase='ready';this.time=0;this.shots=0;this.hits=0;this.defenseShots=0;this.interceptions=0;
    const byId=new Map(specs.map(s=>[s.id,s]));this.specMap=byId;
    const selected:{spec:ShipSpec;member?:RosterEntry['member'];npc?:RosterEntry['npc'];team?:string}[]=[];
    const members=new Set<string>();
    if(mode!=='brawl'){this.pendingBossId=roster.find(r=>r.npc==='boss')?.specId??null;this.escortQueue=mode==='bounty'?roster.filter(r=>r.npc==='escort').flatMap(r=>Array.from({length:r.count},()=>r.specId)):[];}
    const deployed=mode==='brawl'?roster:roster.filter(r=>!r.npc);
    for(const row of deployed){let spec=byId.get(row.specId);if(row.member&&members.has(row.member.handle))continue;if(row.member)members.add(row.member.handle);if(spec&&row.npc==='boss'&&!this.referenceMode)spec={...spec,hull:spec.hull*(spec.id==='retribution'?1:2)};if(spec)for(let n=0;n<Math.min(row.member?1:MAX_SHIPS,Math.max(0,Math.floor(row.count)));n++)if(selected.length<(row.npc?MAX_SHIPS+21:MAX_SHIPS))selected.push({spec,member:row.member,npc:row.npc,team:row.npc?row.team:mode==='brawl'||mode==='teams'?row.team:'members'});}
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
      const dx=origin.x-other.x,dy=origin.y-other.y;
      if(mount&&(Math.abs(dx)>mount.range+other.radius||Math.abs(dy)>mount.range+other.radius))continue;
      const dist=Math.sqrt(dx*dx+dy*dy);
      if(mount){if(dist>mount.range+other.radius)continue;const delta=wrap(Math.atan2(other.y-origin.y,other.x-origin.x)-s.heading-mount.facing*Math.PI/180);if(Math.abs(delta)>mount.arc*Math.PI/360)continue;}
      const retaliation=other.targetId===s.id?.82:1,stickiness=other.id===(mount?previous:s.targetId)?(mount?.role==='point-defense'?.65:.55):1;
      const health=.65+.35*(other.hull/other.spec.hull);
      const doctrine=s.spec.doctrine;
      const threat=!s.npc&&other.npc?(other.npc==='boss'?(doctrine==='bomber'?.28:doctrine==='interceptor'?.85:.5):doctrine==='interceptor'?.25:.65):1;
      const counter=mount?.role==='point-defense'?clamp(other.spec.length/35,.55,3):mount?.role==='anti-capital'?clamp(100/other.spec.length,.2,4):mount?.role==='main'&&s.spec.length>=100?clamp((100/other.spec.length)**.8,.2,3):doctrine==='interceptor'&&other.spec.doctrine==='bomber'?.7:doctrine==='bomber'&&other.spec.length>=100?.65:1;
      const turning=!mount&&(s.npc==='boss'||s.spec.length>=100)?1+Math.min(5,Math.abs(wrap(Math.atan2(other.y-s.y,other.x-s.x)-s.heading))/Math.max(.01,s.spec.turnRate)*.35):1;
      const next=dist*retaliation*stickiness*health*threat*counter*turning*(mount?1:.9+this.random()*.2);
      if(next<score){score=next;best=other;}
    }return best;
  }
  step(dt=STEP) {
    if(this.phase!=='running')return;
    if(!Number.isFinite(dt)||dt<=0||dt>STEP*1.01)throw new Error('BattleEngine.step requires a fixed 1/60s step');
    this.time+=dt;
    if(this.referenceMode)for(const ship of this.ships)if(ship.alive)rechargeWeapons(ship,this.time,dt);
    if(this.nextWaveIn>0){this.nextWaveIn=Math.max(0,this.nextWaveIn-dt);if(this.nextWaveIn===0)this.spawnNextBoss();return;}
    if(this.escortQueue.length&&this.time>=this.nextEscortAt){const boss=this.ships.filter(s=>s.npc==='boss').at(-1);if(boss?.alive){this.spawnEnemy(this.escortQueue.shift()!,'escort');this.nextEscortAt=this.time+.28;}else this.escortQueue=[];}
    const living=this.living, byId=new Map(living.map(s=>[s.id,s])),allById=new Map(this.ships.map(s=>[s.id,s]));
    const incoming=this.projectiles.filter(p=>guidedWeapon(p)&&!p.intercepted);
    const beamFiring=new Set(this.beams.filter(b=>b.remaining>0).map(b=>b.owner));
    for(const id of this.beamTurns.keys())if(!byId.has(id)||!beamFiring.has(id)&&!byId.get(id)!.spec.mounts.some(m=>chargedWeapon(m)))this.beamTurns.delete(id);
    for(const id of this.terrainLanes.keys())if(!byId.has(id))this.terrainLanes.delete(id);
    if(this.checkOutcome())return;
    for(const s of living){
      const committedHull=s.npc==='boss'||s.spec.length>=100;
      const busy=committedHull&&(this.beams.some(b=>b.owner===s.id)||s.weaponCycles?.some((c,i)=>fixedWeapon(s.spec.mounts[i])&&(c.chargeLeft>0||chargedWeapon(s.spec.mounts[i])&&c.chargeLeft===0)));
      if(this.time>=s.searchAt&&!busy||!byId.has(s.targetId??-1)) {
        const next=this.target(s,living);s.targetId=next?.id??null;
        const turn=next?Math.abs(wrap(Math.atan2(next.y-s.y,next.x-s.x)-s.heading))/Math.max(.01,s.spec.turnRate):0;
        s.searchAt=this.time+(committedHull?clamp(simulationSeconds(s.npc==='boss'?6:4)+turn,simulationSeconds(s.npc==='boss'?6:4),simulationSeconds(s.npc==='boss'?20:14)):.55+this.random()*.35);
      }
      const target=byId.get(s.targetId??-1);
      if(!target){this.terrainLanes.delete(s.id);continue;}
      // Continuous rays do not need projectile lead; tracking has physical response time.
      const usable=(m:Mount,i:number)=>!m.interceptsOnly&&(m.ammo===undefined||m.ammoReload||(s.weaponCycles?.[i]?.ammoLeft??m.ammo)>0);
      const mainWeapon=s.spec.mounts.find((m,i)=>fixedWeapon(m)&&usable(m,i))??s.spec.mounts.find(usable);
      const lead=beamFiring.has(s.id)||mainWeapon&&(mainWeapon.kind==='beam'||guidedWeapon(mainWeapon))?target:intercept(s,target,mainWeapon?.speed??900);
      const bearing=Math.atan2(target.y-s.y,target.x-s.x);
      const dodge=evasion(s,allById,this.projectiles,this.time,this.evasions.get(s.id)??{until:0,scanAt:0,side:s.id%2?1:-1},this.random);this.evasions.set(s.id,dodge);
      const attack=attackNavigation(s,target,this.time,this.attackRuns.get(s.id),this.time<dodge.until,this.random);
      this.attackRuns.set(s.id,attack.state);
      // Movement uses a stable hull origin. A turning muzzle must not alternate
      // the flight plan each tick; actual firing still tests each real muzzle.
      const terrain=mainWeapon?terrainCourse(s,target,s,this.asteroids,this.terrainLanes.get(s.id),this.random,this.seed):null;
      if(terrain)this.terrainLanes.set(s.id,terrain.state);else this.terrainLanes.delete(s.id);
      // One flight plan: obstruction route, otherwise combat course. Fixed
      // guns use their real lead during a firing pass, not a second .3s guess.
      let desired=terrain?.heading??(mainWeapon&&fixedWeapon(mainWeapon)&&!attack.coast?Math.atan2(lead.y-s.y,lead.x-s.x):attack.heading);
      const fighter=s.spec.class==='fighter';
      let speed=s.spec.speed*attack.boost;
      // The route already clears its own rock; only other rocks may amend it.
      const obstacle=avoidAsteroids(s,terrain?this.asteroids.filter(r=>r.id!==terrain.state.rock):this.asteroids),avoidX=obstacle.x,avoidY=obstacle.y;
      if(Math.hypot(avoidX,avoidY)>.7)desired=Math.atan2(Math.sin(desired)+avoidY*1.3,Math.cos(desired)+avoidX*1.3);
      const delta=wrap(desired-s.heading),previousHeading=s.heading;
      if(beamFiring.has(s.id)){
        // The ray stays hull-fixed. Every hull uses the same sampled bearing and
        // angular inertia as a gunner; NPC/boss status never grants live lock-on.
        const tracking=this.beamTurns.get(s.id)??{};
        const aimed=trackAim(tracking,s.heading,desired,target.id,this.time,dt,s.spec.turnRate*aimRules.beamHullTurnFraction,this.random);
        this.beamTurns.set(s.id,tracking);s.heading=aimed.angle;
      }else if(mainWeapon&&chargedWeapon(mainWeapon)&&!terrain&&Math.hypot(avoidX,avoidY)<=.7){
        const tracking=this.beamTurns.get(s.id)??{};
        const aimed=trackAim(tracking,s.heading,desired,target.id,this.time,dt,s.spec.turnRate,this.random,{origin:mountWorld(s,mainWeapon),target,speed:mainWeapon.speed});
        this.beamTurns.set(s.id,tracking);s.heading=aimed.angle;
      }else s.heading=wrap(s.heading+clamp(delta,-s.spec.turnRate*dt,s.spec.turnRate*dt));
      s.heading=asteroidSafeHeading({...s,heading:previousHeading},s.heading,this.asteroids);
      // Turrets retain world orientation while the hull turns. Hull yaw cannot
      // bypass their traverse limit or drag every gun straight onto a new target.
      for(let i=0;i<s.spec.mounts.length;i++)if(turretControlled(s.spec.mounts[i]))s.turretAngles[i]=wrap(s.turretAngles[i]-wrap(s.heading-previousHeading));
      if(!attack.velocity&&Math.abs(delta)>1)speed*=.65;
      const defensive=evasionVelocity(s,bearing,dodge,this.time),dodging=!terrain&&defensive.boost>1;
      // Curved combat courses already react to danger. Do not add a second
      // sideways escape on top of that route (or on top of terrain bypass).
      const evade=!terrain&&!attack.velocity;
      let vx=(terrain?.velocity.x??attack.velocity?.x??Math.cos(s.heading)*speed)+(evade?defensive.x:0)+avoidX*s.spec.speed*.9;
      let vy=(terrain?.velocity.y??attack.velocity?.y??Math.sin(s.heading)*speed)+(evade?defensive.y:0)+avoidY*s.spec.speed*.9;
      // A boost is a short lateral burst, not a permanent change to the ship's base stats.
      if(evade&&dodging&&fighter){vx+=Math.cos(s.heading)*s.spec.speed*.18;vy+=Math.sin(s.heading)*s.spec.speed*.18;}
      const traffic=trafficVelocity(s,living,{x:vx,y:vy});vx=traffic.x;vy=traffic.y;
      const maxSpeed=s.spec.speed*(dodging?defensive.boost:attack?.boost??1),velocity=Math.hypot(vx,vy);
      if(velocity>maxSpeed&&velocity>0){vx*=maxSpeed/velocity;vy*=maxSpeed/velocity;}
      const dvx=vx-s.vx,dvy=vy-s.vy,dv=Math.hypot(dvx,dvy),factor=dv?Math.min(1,s.spec.acceleration*(dodging?(fighter?2.2:this.time<(dodge.emergencyUntil??0)&&s.spec.length<200?1.35:1):1)*dt/dv):0;
      s.vx+=dvx*factor;s.vy+=dvy*factor;s.x+=s.vx*dt;s.y+=s.vy*dt;
      const recovery=naturalShieldRecovery(s.spec);
      if(this.time-s.lastHit>recovery.delay+1e-8)s.shield=Math.min(s.spec.shield,s.shield+recovery.perSecond*dt);
      // Arrival keeps its original weapon delay, while normal navigation and
      // obstacle avoidance stay active instead of forcing a straight rail.
      if(!s.enterUntil||this.time>=s.enterUntil)this.fire(s,living,dt,incoming,allById);
    }
    // Damage once per contact; separation hysteresis prevents grazing from grinding hulls.
    for(let iteration=0;iteration<3;iteration++)for(let a=0;a<living.length;a++)for(let b=a+1;b<living.length;b++){
      const s=living[a],o=living[b];if(!s.alive||!o.alive)continue;
      const contact=shipContact(s,o);if(!contact)continue;
      const {nx,ny,depth}=contact,key=`${s.id}:${o.id}`,mass=shipMass(s),otherMass=shipMass(o),share=otherMass/(mass+otherMass),closing=(s.vx-o.vx)*nx+(s.vy-o.vy)*ny;
      const impact=shipImpact(s,o,Math.max(0,closing));
      const push=depth+1;s.x-=nx*push*share;s.y-=ny*push*share;o.x+=nx*push*(1-share);o.y+=ny*push*(1-share);
      if(closing>0){const impulse=closing*1.05/(1/mass+1/otherMass);s.vx-=nx*impulse/mass;s.vy-=ny*impulse/mass;o.vx+=nx*impulse/otherMass;o.vy+=ny*impulse/otherMass;}
      if(this.shipContacts.has(key))continue;this.shipContacts.set(key,[s.id,o.id]);
      // The existing cap protects ordinary scrapes; it must not turn a
      // high-energy ram into a 5%/8% tap. Contact deduplication still applies.
      const first=this.limitShipImpact(s,impact.ordinaryA)+impact.severeA,second=this.limitShipImpact(o,impact.ordinaryB)+impact.severeB,point={x:(s.x+o.x)/2,y:(s.y+o.y)/2};
      // Resolve both hulls before checking the winner; a destroyed ship can still inflict its impact.
      if(first>0)this.damage(s,first,o.id,point,true,undefined,0,'collision');
      if(second>0)this.damage(o,second,s.id,point,true,undefined,0,'collision');
      if(!s.alive&&!o.alive){const records=this.killLog.filter(k=>k.time===this.time&&k.cause==='collision'&&(k.victimId===s.id||k.victimId===o.id));if(records.length===2){records[0].mutual=true;this.killLog=this.killLog.filter(k=>k.id!==records[1].id);}}
    }
    for(const [key,[a,b]]of this.shipContacts){const s=byId.get(a),o=byId.get(b);if(!s?.alive||!o?.alive||!shipContact(s,o,4))this.shipContacts.delete(key);}
    if(this.checkOutcome())return;
    for(const s of living)for(const rock of this.asteroids){
      if(!s.alive)break;const contact=asteroidContact(s,rock);if(!contact)continue;
      const {nx,ny,depth}=contact,closing=Math.max(0,s.vx*nx+s.vy*ny),key=`${s.id}:${rock.id}`;
      s.x-=nx*(depth+2);s.y-=ny*(depth+2);
      if(closing>0){s.vx-=nx*closing*1.05;s.vy-=ny*closing*1.05;}
      if(this.collisions.has(key))continue;this.collisions.set(key,[s.id,rock.id]);
      // Resting contact, separation correction and tangential flight do no damage.
      if(closing<=80)continue;
      const fatal=s.spec.length<35&&closing>Math.max(185,s.spec.speed*.78),total=s.spec.hull+s.spec.shield;
      const amount=fatal?total:this.limitShipImpact(s,total*Math.min(.05,.035*((closing-80)/200)**2*(s.spec.collisionDamageMultiplier??1)));
      if(amount>0)this.damage(s,amount,0,{x:rock.x-nx*rock.radius,y:rock.y-ny*rock.radius},true);
    }
    const rocksById=new Map(this.asteroids.map(r=>[r.id,r]));
    for(const [key,[shipId,rockId]]of this.collisions){const s=byId.get(shipId),rock=rocksById.get(rockId);if(!s?.alive||!rock||!asteroidContact(s,rock,4))this.collisions.delete(key);}
    this.updateProjectiles(dt,byId);
    if(this.phase==='running')this.updateBeams(dt,byId);
    this.events=this.events.filter(e=>this.time-e.time<2.8).slice(-800);
    this.checkOutcome();
  }
  private defend(s:Ship,m:Mount,index:number,cycle:WeaponCycle,incoming:Projectile[],owners:Map<number,Ship>,dt:number){
    s.turretTargets[index]=null;
    const origin=mountWorld(s,m),facing=m.facing*Math.PI/180;
    const eligible=(p:Projectile)=>{
      const owner=owners.get(p.owner);if(p.intercepted||p.owner===s.id||s.team&&owner?.team===s.team||distance(origin,p)>m.range)return false;
      if(Math.abs(wrap(Math.atan2(p.y-origin.y,p.x-origin.x)-s.heading-facing))>m.arc*Math.PI/360)return false;
      if(p.target===s.id)return true;
      const vx=p.vx-s.vx,vy=p.vy-s.vy,dx=p.x-s.x,dy=p.y-s.y,t=-(dx*vx+dy*vy)/Math.max(1,vx*vx+vy*vy);
      return t>0&&t<4&&Math.hypot(dx+vx*t,dy+vy*t)<s.radius+40;
    };
    let target=incoming.find(p=>p.id===cycle.interceptId&&eligible(p));
    if(!target){let score=Infinity;for(const p of incoming){if(!eligible(p))continue;const next=distance(origin,p)/Math.max(1,p.speed);if(next<score){score=next;target=p;}}}
    cycle.interceptId=target?.id;if(!target)return;
    const desired=wrap(Math.atan2(target.y-origin.y,target.x-origin.x)-s.heading);
    s.turretAngles[index]=wrap(s.turretAngles[index]+clamp(wrap(desired-s.turretAngles[index]),-m.turnRate*dt,m.turnRate*dt));
    if(s.cooldowns[index]>0)return;
    const angle=s.heading+s.turretAngles[index],to={x:origin.x+Math.cos(angle)*m.range,y:origin.y+Math.sin(angle)*m.range};
    const hit=segmentRock(origin,to,{x:target.x,y:target.y,radius:target.kind==='torpedo'?6:3});
    if(hit===null||this.asteroids.some(rock=>{const block=segmentRock(origin,to,rock);return block!==null&&block<=hit;}))return;
    s.cooldowns[index]=m.cooldown;this.defenseShots++;
    target.integrity=(target.integrity??(target.impact==='heavy-torpedo'?6:target.kind==='torpedo'?3:1))-1;
    const point={x:origin.x+(to.x-origin.x)*hit,y:origin.y+(to.y-origin.y)*hit};
    this.events.push({id:++this.sequence,kind:'intercept',...point,from:origin,time:this.time,radius:6,ship:0,by:0,label:'近防拦截',weapon:'turret'});
    if(target.integrity<=0){target.intercepted=true;this.projectiles=this.projectiles.filter(p=>p.id!==target!.id);this.interceptions++;}
  }
  private fire(s:Ship,living:Ship[],dt:number,incoming:Projectile[],owners:Map<number,Ship>){
    s.spec.mounts.forEach((m,i)=>{
      const carry=this.referenceMode&&!m.charge&&!m.burstCount&&m.kind!=='beam'&&!m.interceptsOnly;
      s.cooldowns[i]=Math.max(carry?-dt:0,s.cooldowns[i]-dt);if(!carry&&m.kind==='ballistic'&&s.cooldowns[i]<1e-8)s.cooldowns[i]=0;
      const cycle=weaponCycle(s,i);
      const chargeRule=chargedWeapon(m);
      if(cycle.chargeLeft>=0)cycle.chargeLeft=Math.max(0,cycle.chargeLeft-dt);
      if(m.interceptsOnly){this.defend(s,m,i,cycle,incoming,owners,dt);return;}
      if(cycle.ammoLeft===0){
        if(!m.ammoReload)return;
        cycle.reloadLeft=(cycle.reloadLeft??m.ammoReload)-dt;
        if(cycle.reloadLeft>0)return;
        cycle.ammoLeft=m.ammo;cycle.reloadLeft=undefined;
      }
      if(m.kind==='beam'&&this.beams.some(b=>b.owner===s.id&&b.mount===i))return;
      const origin=mountWorld(s,m),target=this.target(s,living,origin,m,s.turretTargets[i]);s.turretTargets[i]=target?.id??null;
      if(!target){cycle.chargeLeft=-1;cycle.chargeGoal=undefined;cycle.chargeTarget=undefined;return;}
      if(chargeRule&&cycle.chargeLeft>=0&&cycle.chargeTarget!==target.id){
        // Energy belongs to this firing opportunity. A cancelled lock cannot
        // lend a fully charged instant shot to a newly acquired target.
        cycle.chargeLeft=-1;cycle.chargeGoal=undefined;cycle.chargeTarget=undefined;
      }
      const point=guidedWeapon(m)||m.kind==='beam'?target:intercept(origin,target,m.speed);
      const hullAim=chargeRule?this.beamTurns.get(s.id):undefined;
      const aimed=chargeRule?hullAim?.aimAngle??s.heading:Math.atan2(point.y-origin.y,point.x-origin.x),facing=m.facing*Math.PI/180;
      let relative=wrap(aimed-s.heading),trackingReady=!chargeRule||hullAim?.aimTarget===target.id&&this.time>=(hullAim.acquireUntil??Infinity);
      if(Math.abs(wrap(relative-facing))>m.arc*Math.PI/360)return;
      const desired=fixedWeapon(m)?facing:relative;
      if(turretControlled(m)){
        const tracked=trackAim(cycle,wrap(s.heading+s.turretAngles[i]),aimed,target.id,this.time,dt,m.turnRate,this.random,{origin,target,speed:m.speed});
        s.turretAngles[i]=wrap(tracked.angle-s.heading);relative=wrap(tracked.goal-s.heading);trackingReady=tracked.ready;
      }else s.turretAngles[i]=fixedWeapon(m)?facing:wrap(s.turretAngles[i]+clamp(wrap(desired-s.turretAngles[i]),-m.turnRate*dt,m.turnRate*dt));
      const error=Math.abs(wrap(relative-s.turretAngles[i]));
      // Gunners may fire while settling on a solution. Rounds still leave the
      // actual barrel direction; requiring near-perfect aim made slow turrets
      // repeatedly withhold cooled volleys against moving small ships.
      const tolerance=guidedWeapon(m)?.3:Math.max(turretControlled(m)?aimRules.turretFiringToleranceDegrees*Math.PI/180:.012,Math.atan2(Math.min(target.spec.beam,target.spec.length)*.28+2,distance(origin,target)));
      if(!trackingReady||s.cooldowns[i]>0||error>tolerance||this.projectiles.length+(m.barrels??1)*(m.pellets??1)>3500)return;
      const direction=s.heading+s.turretAngles[i],reach=distance(origin,point),end={x:origin.x+Math.cos(direction)*reach,y:origin.y+Math.sin(direction)*reach};
      if(firingObstacle(origin,end,target,this.asteroids))return;
      const rounds=Math.min(m.barrels??1,cycle.ammoLeft??Infinity);
      if(this.referenceMode&&!energyReady(m,cycle,rounds))return;
      if(m.charge&&cycle.chargeLeft<0){cycle.chargeLeft=m.charge;if(chargeRule){cycle.chargeGoal=chooseChargeGoal(m,s,target,this.random);cycle.chargeTarget=target.id;}return;}
      const chargedFor=chargeRule?Math.max(0,m.charge!-cycle.chargeLeft):0;
      if(chargeRule?chargedFor<(cycle.chargeGoal??m.charge!):cycle.chargeLeft>0)return;
      const damageMultiplier=chargeRule?chargeDamageMultiplier(m,chargedFor):1,chargeCooldown=chargeRule?Math.max(0,m.charge!-chargedFor):0;
      cycle.chargeLeft=-1;
      cycle.chargeGoal=undefined;
      cycle.chargeTarget=undefined;
      const angular=Math.abs((target.x-origin.x)*target.vy-(target.y-origin.y)*target.vx)/Math.max(1,distance(origin,target)**2);
      const spread=guidedWeapon(m)||m.kind==='beam'||m.kind==='railgun'?0:m.kind==='ballistic'?.006:m.role==='point-defense'?.0025:Math.min(s.spec.length>=100?.14:.035,.002+angular/Math.max(.1,m.turnRate)*(s.spec.length>=100?.08:.016));
      const angle=s.heading+s.turretAngles[i]+(this.random()-.5)*2*spread;
      if(m.kind==='beam'){
        this.beams.push({owner:s.id,mount:i,remaining:m.duration??1,elapsed:0,pending:0,segments:[]});
        s.cooldowns[i]=m.cooldown+(m.duration??1);
      }else{
        const kind=m.projectileKind??m.kind;
        for(let barrel=0;barrel<rounds;barrel++){
          // A turret shares one target/rotation; each barrel still has its own real trajectory.
          const port=m.launcherCount?((m.ammo??0)-(cycle.ammoLeft??0))%m.launcherCount:barrel;
          const offset=(port-((m.launcherCount??rounds)-1)/2)*(m.barrelSpacing??0);
          const muzzle={x:origin.x-Math.sin(angle)*offset,y:origin.y+Math.cos(angle)*offset};
          const pellets=m.pellets??1;
          for(let pellet=0;pellet<pellets;pellet++){
            const shotAngle=angle+(pellets>1?(pellet/(pellets-1)-.5)*(m.scatterAngle??.09):0);
            this.projectiles.push({id:++this.sequence,owner:s.id,target:target.id,kind,role:m.role,impact:m.impact,referenceWeapon:!!m.weaponId,weaponId:m.weaponId,damageType:m.damageType,turnRate:m.turnRate,...muzzle,vx:Math.cos(shotAngle)*m.speed,vy:Math.sin(shotAngle)*m.speed,angle:shotAngle,speed:m.speed,damage:m.damage*damageMultiplier/pellets,ttl:m.range/m.speed+dt,travel:0,range:m.range,color:m.color??(s.id%2?0xf3cc7e:0x84c4ff),width:m.width,weaponSize:m.weaponSize,...(m.kind==='torpedo'?{trail:[{...muzzle}],trailClock:0}:{})});
          }
          if(m.projectileKind)this.events.push({id:++this.sequence,kind:'shot',weapon:kind,angle,...muzzle,time:this.time,radius:s.radius,ship:s.id,by:s.id,label:s.label});
        }
        if(cycle.ammoLeft!==undefined)cycle.ammoLeft-=rounds;
        if(this.referenceMode)spendEnergy(m,cycle,rounds,this.time);
        this.shots+=rounds*(m.pellets??1)-1;
        if(m.burstCount){cycle.burstLeft=(cycle.burstLeft||m.burstCount)-1;s.cooldowns[i]=cycle.burstLeft?m.cooldown:m.burstCooldown??m.cooldown;}else s.cooldowns[i]=(carry?Math.min(0,s.cooldowns[i]):0)+chargeCooldown+m.cooldown*(m.cooldownJitter?1+(this.random()-.5)*2*m.cooldownJitter:1);
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
          const profile=this.weaponHulls.size?this.weaponHulls.get(s.spec.id):undefined;
          const hit=profile?weaponHullIntersection(from,end,s,profile):hullIntersection(from,end,s);if(hit!==null&&hit<nearest){nearest=hit;victim=s;}
        }
        for(const rock of this.asteroids){const hit=segmentRock(from,end,rock);if(hit!==null&&hit<=nearest){nearest=hit;victim=null;}}
        const to={x:from.x+dx*m.range*nearest,y:from.y+dy*m.range*nearest};
        if(m.beamWidth){if(nearest<broadDistance){broadDistance=nearest;broadVictim=victim;}continue;}
        b.segments.push({from,to,hit:!!victim,...(victim?{ship:victim.id}:{})});
        if(victim&&seconds){const current=damage.get(victim.id)??{ship:victim,amount:0,point:to};current.amount+=m.damage*seconds/emitters.length;damage.set(victim.id,current);}
      }
      if(m.beamWidth){
        const from=mountWorld(owner,m),to={x:from.x+dx*m.range*broadDistance,y:from.y+dy*m.range*broadDistance};
        b.segments=[{from,to,hit:!!broadVictim,...(broadVictim?{ship:broadVictim.id}:{})}];
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
    const grid=byId.size>16?new WeaponCollisionGrid([...byId.values()],dt):null;
    for(const p of this.projectiles){
      if(guidedWeapon(p)) { const target=byId.get(p.target);if(target?.alive){const aim=Math.atan2(target.y-p.y,target.x-p.x);p.angle=wrap(p.angle+clamp(wrap(aim-p.angle),-(p.turnRate??(p.role==='anti-capital'?.72:2.3))*dt,(p.turnRate??(p.role==='anti-capital'?.72:2.3))*dt));p.vx=Math.cos(p.angle)*p.speed;p.vy=Math.sin(p.angle)*p.speed;}}
      const next={x:p.x+p.vx*dt,y:p.y+p.vy*dt};
      let victim:Ship|null=null,impact=Infinity,contact:Vec|null=null;
      const owner=owners.get(p.owner);
      for(const s of grid?grid.query(p,next):byId.values()){
        if(s.id===p.owner||!s.alive||(owner?.team&&owner.team===s.team))continue;
        if(Math.abs(s.x-p.x)>s.radius+p.speed*dt+5||Math.abs(s.y-p.y)>s.radius+p.speed*dt+5)continue;
        // Relative motion compensates for the target advancing during the same fixed step.
        const from={x:p.x+s.vx*dt,y:p.y+s.vy*dt},profile=this.weaponHulls.size?this.weaponHulls.get(s.spec.id):undefined;
        const hit=profile?weaponHullIntersection(from,next,s,profile):hullIntersection(from,next,s);
        if(hit!==null&&(hit<impact||hit===impact&&s.id<(victim?.id??Infinity))){impact=hit;victim=s;
          // The relative-motion ray lives in the target's current pose. Keep
          // its actual alpha contact there for local impact metadata as well.
          contact=profile?{x:from.x+(next.x-from.x)*hit,y:from.y+(next.y-from.y)*hit}:null;
        }
      }
      let terrain=Infinity;for(const rock of this.asteroids){const hit=segmentRock(p,next,rock);if(hit!==null&&hit<terrain)terrain=hit;}if(Number.isFinite(terrain)&&terrain<=impact)continue;
      if(victim){this.damage(victim,(this.referenceMode?p.damage:projectileDamage(p.kind,p.damage,p.travel+p.speed*dt*impact))*(!this.referenceMode&&p.role==='anti-capital'&&!p.impact&&!p.referenceWeapon?clamp((victim.spec.length/40)**1.65,.12,24):1),p.owner,contact??{x:p.x+(next.x-p.x)*impact,y:p.y+(next.y-p.y)*impact},false,p.kind,0,'weapon',p.impact,p.damageType);
        // Settle at the first last-survivor event, before later projectiles in this step.
        if(this.checkOutcome()){this.projectiles=[];return;}continue;}
      p.x=next.x;p.y=next.y;p.ttl-=dt;p.travel+=p.speed*dt;
      if(p.trail){p.trailClock=(p.trailClock??0)+dt;if(p.trailClock>=.08){p.trailClock=0;p.trail.push({x:p.x,y:p.y});if(p.trail.length>9)p.trail.shift();}}
      if(p.ttl>0&&p.travel<=p.range)survivors.push(p);
    }this.projectiles=survivors;
  }
  private limitShipImpact(ship:Ship,amount:number){
    if(amount<=0)return 0;
    const recent=(this.shipImpacts.get(ship.id)??[]).filter(hit=>this.time-hit.time<simulationSeconds(1)-1e-8),used=recent.reduce((sum,hit)=>sum+hit.amount,0);
    const allowed=Math.max(0,Math.min(amount,ship.spec.hull*SHIP_IMPACT_PER_SECOND-used));
    if(allowed>0)recent.push({time:this.time,amount:allowed});this.shipImpacts.set(ship.id,recent);return allowed;
  }
  private damage(s:Ship,amount:number,owner:number,point:Vec,environment=false,weapon?:WeaponKind,beamSeconds=0,cause:'weapon'|'asteroid'|'collision'=environment?'asteroid':'weapon',impact?:Mount['impact'],damageType?:Mount['damageType']){
    const attacker=this.ships.find(o=>o.id===owner);
    const kinetic=this.referenceMode&&!environment&&cause==='weapon'&&kineticGun(weapon??'');
    if(kinetic)amount*=resourceRules.ballistic.damageMultiplier;
    if(!environment&&cause==='weapon'&&amount>0)s.lastAttacker=owner;
    // Non-boss ships gain output once; boss weapons and encounter health budgets stay unchanged.
    if(!this.referenceMode&&!environment&&cause==='weapon'&&attacker){
      if(attacker.npc!=='boss'){
        amount*=defenseRules.nonBossWeaponDamageMultiplier;
        if(weapon==='beam')amount*=defenseRules.nonBossBeamDamageMultiplier;
      }
      if(!attacker.npc&&weapon==='beam')amount*=defenseRules.memberBeamDamageMultiplier;
    }
    const rule=s.npc==='boss'&&(this.mode==='bounty'||this.mode==='challenge')?defenseRules.burst[this.mode]:defenseRules.burst.member,total=s.spec.hull+s.spec.shield;
    const bucket=this.burst.get(s.id)??{time:this.time,available:total*rule.capacity};
    bucket.available=Math.min(total*rule.capacity,bucket.available+(this.time-bucket.time)*total*rule.perSecond);bucket.time=this.time;
    // Capital beams use the same 50%-per-second ceiling (10% per 0.2-second tick).
    // Designated heavy ordnance bypasses ordinary protection; bosses retain their encounter cap.
    const protectedBoss=s.npc==='boss';
    if(!this.referenceMode&&!environment&&!((weapon==='railgun'||impact==='heavy-cannon'||impact==='heavy-torpedo')&&!protectedBoss))amount=weapon==='beam'&&!protectedBoss?Math.min(amount,total*.5*battleSeconds(beamSeconds)):weapon==='torpedo'&&!protectedBoss?Math.min(amount,total*.55):Math.min(amount,bucket.available);if(!this.referenceMode&&cause!=='collision'){bucket.available=Math.max(0,bucket.available-amount);this.burst.set(s.id,bucket);}
    const absorbed=cause==='collision'?0:Math.min(s.shield,amount*(kinetic?1-resourceRules.ballistic.shieldBypass:1));s.shield-=absorbed;
    const physical=weapon==='ballistic'||weapon==='railgun'||weapon==='torpedo'||weapon==='missile';
    const armor=!environment&&cause==='weapon'?(physical?s.spec.armorPhysicalMultiplier:s.spec.armorEnergyMultiplier)??1:1;
    const previousHull=s.hull;
    s.hull=Math.max(0,s.hull-(amount-absorbed)*armor*(damageType==='distortion'?(this.referenceMode?0:.15):1));if(s.hull<1e-8)s.hull=0;s.lastHit=this.time;this.hits++;
    if(!environment&&cause==='weapon'&&s.hull<previousHull){const old=s.hitStreak;s.hitStreak=old&&this.time-old.last<simulationSeconds(.7)?{since:old.since,last:this.time,count:Math.min(20,old.count+1)}:{since:this.time,last:this.time,count:1};}
    if(attacker&&cause!=='collision')attacker.lastDealt=this.time;
    const dx=point.x-s.x,dy=point.y-s.y,c=Math.cos(s.heading),n=Math.sin(s.heading);
    this.events.push({id:++this.sequence,kind:absorbed>0?'shield':'hit',...point,localImpact:{x:(-dx*n+dy*c)/s.spec.beam,y:-(dx*c+dy*n)/s.spec.length},time:this.time,radius:s.radius,ship:s.id,by:owner,label:s.label});
    if(s.hull<=0){const friendly=cause==='collision'&&Boolean(attacker?.team&&attacker.team===s.team),credited=attacker&&!friendly;if(environment&&!credited)this.collisionDeaths++;s.alive=false;s.shield=0;if(credited)attacker.kills++;const id=++this.sequence;this.events.push({id,kind:'destroy',x:s.x,y:s.y,time:this.time,radius:s.radius,ship:s.id,by:owner,label:s.label});this.killLog.push({id,time:this.time,victimId:s.id,victimName:s.label,killerId:owner,killerName:cause==='asteroid'?'陨石撞击':attacker?.label??'未知成员',cause,...(friendly?{friendly:true}:{})});this.killLog=this.killLog.slice(-12);}
  }
  private finish(outcome:BattleOutcome){this.phase='finished';this.outcome=outcome;this.projectiles=[];this.beams=[];}
  private checkOutcome(){
    if(this.phase==='finished')return true;
    const living=this.living;
    // Resolve a genuine ammunition stalemate only after the last shell lands.
    // Empty test/unarmed hulls are not treated as ships that spent ammunition.
    const exhausted=this.referenceMode&&living.length>1&&!this.projectiles.length&&!this.beams.length&&living.some(s=>s.spec.mounts.some((m,i)=>!m.interceptsOnly&&m.ammo!==undefined&&s.weaponCycles?.[i]?.ammoLeft===0))&&living.every(s=>!s.spec.mounts.some((m,i)=>!m.interceptsOnly&&(m.ammo===undefined||m.ammoReload||(s.weaponCycles?.[i]?.ammoLeft??m.ammo)>0)));
    if(exhausted&&(this.mode==='brawl'||this.mode==='teams')){this.finish('draw');return true;}
    if(this.mode==='teams'){const red=living.some(s=>s.team==='red'),blue=living.some(s=>s.team==='blue');if(!red||!blue){this.finish(red?'red':blue?'blue':'draw');return true;}return false;}
    if(this.mode==='brawl'){
      if(living.length<=1||(living.length>0&&Boolean(living[0].team)&&living.every(s=>s.team===living[0].team))){this.finish(!living.length?'draw':living[0]?.npc?'boss':'member');return true;}
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
    const escortScale=this.referenceMode?1:defenseRules.escortDefenseMultiplier*crowd;
    const tuned=npc==='boss'&&this.mode==='challenge'?original.encounterTuning:undefined,ratio=Math.max(1,this.initialFleet.length)/(tuned?.populationReference??32),tunedHealth=tuned?tuned.health*ratio**tuned.healthPower:1;
    const tunedShield=tuned?tuned.shieldReference*(original.shield/tuned.shieldReference)**tuned.shieldPower*tunedHealth:original.shield;
    const defense=tuned?{hull:Math.round(tuned.hullReference*(original.hull/tuned.hullReference)**tuned.hullPower*tunedHealth),shield:Math.round(tunedShield),shieldRegen:original.shieldRegen*tunedShield/Math.max(1,original.shield)}:npc==='boss'?bossDefense(original,this.mode,this.initialFleet,this.initialFleet.length,this.wave,this.referenceMode):{hull:Math.round(original.hull*escortScale),shield:Math.round(original.shield*escortScale),shieldRegen:original.shieldRegen*escortScale};
    const bossDamage=npc==='boss'&&(this.mode==='challenge'||this.mode==='bounty')?(original.encounterTuning?.damage??1):1;
    const damageFactor=tuned?bossDamage*ratio**tuned.damagePower:this.referenceMode?bossDamage:npc==='boss'?bossDamage*bossPopulation(this.initialFleet.length).damage*bossRules.damageMultiplier*(this.mode==='challenge'?bossRules.challengeDamageMultiplier:1):defenseRules.escortDamageMultiplier*crowd;
    const mounts=damageFactor===1?original.mounts:original.mounts.map(m=>({...m,damage:m.damage*damageFactor}));
    const spec={...original,mounts,hull:defense.hull,shield:defense.shield,shieldRegen:defense.shieldRegen};
    const members=this.living.filter(s=>!s.npc),radius=Math.max(9,Math.max(spec.length,spec.beam)*.5);
    const center={x:members.reduce((n,s)=>n+s.x,0)/Math.max(1,members.length),y:members.reduce((n,s)=>n+s.y,0)/Math.max(1,members.length)};
    const field=Math.max(600,...members.map(s=>distance(s,center)+s.radius));
    // Every arrival gets an independent seeded bearing; ships fly inward from the perimeter.
    const angle=this.random()*TAU;
    let x=0,y=0;
    // The final candidate lies beyond every obstacle's bounding circle.
    // A fixed attempt cap could exhaust inside a long blocked arrival lane.
    const extent=Math.max(field,...this.living.map(s=>distance(s,center)+s.radius+12),...this.asteroids.map(rock=>distance(rock,center)+rock.radius+30));
    const attempts=Math.ceil((extent-field)/12)+1;
    for(let attempt=0;attempt<attempts;attempt++){
      const range=field+radius+100+attempt*12;
      x=center.x+Math.cos(angle)*range;y=center.y+Math.sin(angle)*range;
      if(this.living.every(s=>distance(s,{x,y})>s.radius+radius+12)&&this.asteroids.every(rock=>!asteroidContact({x,y,heading:angle+Math.PI,spec},rock,30)))break;
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
