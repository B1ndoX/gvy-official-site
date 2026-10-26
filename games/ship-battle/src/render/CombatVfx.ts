import { Container, Rectangle, Sprite, Texture, Mesh, MeshGeometry } from 'pixi.js';
import type { BattleEngine } from '../sim/engine';
import type { BattleEvent } from '../sim/types';
import { clamp, mountWorld } from '../sim/math';
import { battleSeconds } from '../sim/pacing';
import { TrailHistory, vfxNoise } from './TrailHistory';
import {fillTrailRibbon} from './TrailRibbon';
import {ExhaustTrail,mainExhaustActive,exhaustRibbonBlend} from './ExhaustTrail';

type Tile='glow'|'line'|'plume'|'ring'|'ribbon'|`fire${number}`;
const LIMIT=2048,TRAIL_LIMIT=1024;

/** One baked atlas, two bounded sprite batches; no filters or secondary clock. */
export class CombatVfx {
  readonly exhaust=new Container();
  readonly foreground=new Container();
  private atlas:Texture;
  private tiles=new Map<Tile,Texture>();
  private back:Sprite[]=[];private front:Sprite[]=[];private backUsed=0;private frontUsed=0;
  private trails=new Map<string,TrailHistory>();
  private ribbons=new Map<string,Mesh<MeshGeometry>>();
  private ribbonLife=new Map<string,number>();
  private fading:{mesh:Mesh<MeshGeometry>;at:number;life:number;alpha:number}[]=[];
  private exhausts=new Map<string,ExhaustTrail>();
  private thrusting=new Set<number>();
  private seen=new Set<string>();private lastTime=-1;private ships:BattleEngine['ships']|null=null;
  private px=1;private view={left:0,right:0,top:0,bottom:0};
  private reserve=160;
  constructor(){
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
    const c=canvas.getContext('2d',{willReadFrequently:true})!;
    const radial=(x:number,y:number,r:number,stops:[number,string][])=>{const g=c.createRadialGradient(x,y,0,x,y,r);for(const [at,color] of stops)g.addColorStop(at,color);c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);};
    radial(48,48,47,[[0,'#fff'],[.12,'#fff'],[.38,'rgba(255,255,255,.45)'],[1,'rgba(255,255,255,0)']]);
    // A feathered cone, opaque at the throat and diffuse at the trailing end.
    const plume=c.createImageData(192,96);
    for(let x=0;x<192;x++)for(let y=0;y<96;y++){const q=x/191,spread=4+q*21,a=Math.exp(-(((y-47.5)/spread)**2))*Math.pow(1-q,1.65),i=(y*192+x)*4;plume.data[i]=plume.data[i+1]=plume.data[i+2]=255;plume.data[i+3]=Math.round(a*255);}
    c.putImageData(plume,96,0);
    const ribbon=c.createImageData(256,128);
    for(let x=0;x<256;x++)for(let y=0;y<128;y++){
      const q=x/255,d=Math.abs(y-63.5)/63.5,core=Math.exp(-d*d*18),halo=Math.exp(-d*d*5),i=(y*256+x)*4;
      ribbon.data[i]=Math.round(55+core*170);ribbon.data[i+1]=Math.round(165+core*80);ribbon.data[i+2]=255;ribbon.data[i+3]=Math.round((halo*.8+core*.2)*Math.pow(q,1.1)*Math.min(1,(1-q)/.035)*255);
    }
    c.putImageData(ribbon,0,256);
    const line=c.createLinearGradient(0,96,0,128);line.addColorStop(0,'#fff0');line.addColorStop(.5,'#ffff');line.addColorStop(1,'#fff0');c.fillStyle=line;c.fillRect(0,96,192,32);
    // Small pre-antialiased expanding shock ring; animation only changes scale/alpha.
    const ring=c.createRadialGradient(64,192,52,64,192,64);ring.addColorStop(0,'#fff0');ring.addColorStop(.5,'#fff0');ring.addColorStop(.72,'#fffb');ring.addColorStop(.82,'#fff');ring.addColorStop(1,'#fff0');c.fillStyle=ring;c.fillRect(0,128,128,128);
    for(let frame=0;frame<16;frame++){
      const f=frame/15,ox=384+frame%4*96,oy=Math.floor(frame/4)*96;
      c.save();c.beginPath();c.rect(ox,oy,96,96);c.clip();
      for(let lobe=0;lobe<8;lobe++){
        const a=lobe*2.399,r=5+f*15,x=ox+48+Math.cos(a)*r,y=oy+48+Math.sin(a)*r;
        radial(x,y,Math.max(3,25*(1-f*.45)),[[0,`rgba(255,${Math.round(220-f*150)},70,${(1-f)*.8})`],[.3,`rgba(255,100,25,${(1-f)*.6})`],[.7,`rgba(120,44,18,${(1-f)*.3})`],[1,'rgba(40,18,10,0)']]);
      }
      radial(ox+48,oy+48,Math.max(3,29*(1-f*.65)),[[0,`rgba(255,255,230,${Math.max(0,1-f*2.5)})`],[.4,`rgba(255,203,99,${(1-f)*.6})`],[1,'rgba(255,80,20,0)']]);c.restore();
      // Bake mottled hot gas and an irregular edge once, rather than running noise shaders.
      const fire=c.getImageData(ox,oy,96,96);
      for(let y=0;y<96;y++)for(let x=0;x<96;x++){
        const i=(y*96+x)*4,d=Math.hypot(x-48,y-48)/46;
        const noise=(Math.sin(x*.31+Math.sin(y*.19+f*2)*2.2)+Math.sin(y*.37+Math.sin(x*.23-f*3)*1.9))*.25+.5;
        const gas=.55+noise*.45;
        fire.data[i]*=gas;fire.data[i+1]*=gas*gas;fire.data[i+2]*=gas*gas;
        fire.data[i+3]*=clamp((.8+noise*.26-d)*7,0,1)*(.7+noise*.3);
      }
      c.putImageData(fire,ox,oy);
    }
    this.atlas=Texture.from(canvas);
    const add=(key:Tile,x:number,y:number,width:number,height:number)=>this.tiles.set(key,new Texture({source:this.atlas.source,frame:new Rectangle(x,y,width,height)}));
    add('glow',0,0,96,96);add('plume',96,0,192,96);add('line',0,96,192,32);add('ring',0,128,128,128);add('ribbon',0,256,256,128);
    for(let i=0;i<16;i++)add(`fire${i}`,384+i%4*96,Math.floor(i/4)*96,96,96);
    this.exhaust.label='engine-wakes';this.foreground.label='weapon-feedback';
  }
  get stats(){return {sprites:this.backUsed+this.frontUsed,allocated:this.back.length+this.front.length,ribbons:this.ribbons.size+this.fading.length,trails:this.trails.size+this.exhausts.size+this.fading.length,points:[...this.trails.values(),...this.exhausts.values()].reduce((sum,t)=>sum+t.points.length,0),spriteLimit:LIMIT,trailLimit:TRAIL_LIMIT,atlasBytes:1024*512*4};}
  private sprite(tile:Tile,x:number,y:number,width:number,height:number,rotation:number,tint:number,alpha:number,under=false,anchorX=.5){
    if(alpha<.005||width<=0||height<=0||this.backUsed+this.frontUsed>=LIMIT-this.reserve||under&&this.backUsed>=1152)return;
    const radius=Math.max(width,height);
    if(x+radius<this.view.left||x-radius>this.view.right||y+radius<this.view.top||y-radius>this.view.bottom)return;
    const pool=under?this.back:this.front,index=under?this.backUsed++:this.frontUsed++,container=under?this.exhaust:this.foreground;
    let s=pool[index];if(!s){
      if(this.back.length+this.front.length>=LIMIT){
        const other=under?this.front:this.back,used=under?this.frontUsed:this.backUsed;
        if(other.length<=used)return;
        s=other.pop()!;s.removeFromParent();
      }else{s=new Sprite();s.blendMode='add';}
      pool.push(s);container.addChild(s);
    }
    s.visible=true;s.texture=this.tiles.get(tile)!;s.anchor.set(anchorX,.5);s.position.set(x,y);s.width=width;s.height=height;s.rotation=rotation;s.tint=tint;s.alpha=alpha;
  }
  glow(x:number,y:number,radius:number,color:number,alpha:number,under=false){this.sprite('glow',x,y,radius*2,radius*2,0,color,alpha,under);}
  streak(x1:number,y1:number,x2:number,y2:number,width:number,color:number,alpha:number,under=false){
    const dx=x2-x1,dy=y2-y1;if(Math.abs(dx)+Math.abs(dy)<.001)return;this.sprite('line',(x1+x2)/2,(y1+y2)/2,Math.hypot(dx,dy)+width*.15,width,Math.atan2(dy,dx),color,alpha,under);
  }
  plume(x:number,y:number,angle:number,length:number,width:number,color:number,alpha:number,under=false){this.sprite('plume',x,y,length,width,angle,color,alpha,under,0);}
  begin(engine:BattleEngine,px:number,view:{left:number;right:number;top:number;bottom:number}){
    if(this.ships!==engine.ships||engine.time<this.lastTime)this.reset();
    this.ships=engine.ships;this.lastTime=engine.time;this.px=px;this.view=view;this.backUsed=this.frontUsed=0;this.reserve=160;this.seen.clear();
    if(engine.phase==='ready')return;
    for(const s of engine.ships){
      if(!s.alive)continue;
      const active=mainExhaustActive(s.vx,s.vy,s.heading,s.spec.speed,this.thrusting.has(s.id));
      if(!active){this.thrusting.delete(s.id);continue;}this.thrusting.add(s.id);
      const power=clamp(Math.hypot(s.vx,s.vy)/Math.max(1,s.spec.speed),0,1),throat=clamp(s.spec.length*.012+s.spec.beam*.008,.5,5),blend=exhaustRibbonBlend(power);
      for(let i=0;i<s.spec.engines.length;i++){
        const p=mountWorld(s,s.spec.engines[i]),key=`s${s.id}:${i}`,maxAge=.5+power*.55;
        const width=Math.max(px*4.5,throat*(8+power*6));
        const gap=Math.min(s.spec.length*.035,Math.max(px*1.6,throat*.85)),x=p.x-Math.cos(s.heading)*gap,y=p.y-Math.sin(s.heading)*gap;
        if(blend>0)this.shipRibbon(key,x,y,engine.time,maxAge,Math.max(100,s.spec.speed*.65+s.spec.length),width,power,s.vx,s.vy,s.heading,blend);
        if(blend<1){
          const length=Math.max(px*2.5,throat*(2.2+power*5)),width=Math.max(px*.9,throat*2.2),alpha=1-blend;
          this.plume(x,y,s.heading+Math.PI,length,width*2.4,0x2b94ed,.4*alpha,true);
          this.plume(x,y,s.heading+Math.PI,length*.72,width,0xc1edff,.85*alpha,true);
        }
      }
    }
  }
  private shipRibbon(key:string,x:number,y:number,time:number,age:number,jump:number,width:number,power:number,vx:number,vy:number,heading:number,blend:number){
    this.seen.add(key);let trail=this.exhausts.get(key);
    if(!trail){if(this.trails.size+this.exhausts.size+this.fading.length>=TRAIL_LIMIT)return;trail=new ExhaustTrail();this.exhausts.set(key,trail);}
    trail.update({x,y},{x:vx,y:vy},heading,10+Math.hypot(vx,vy)*.72,time,age,jump);
    let ribbon=this.ribbons.get(key);
    if(!ribbon){
      const vertices=20,indices=new Uint32Array((vertices-1)*6);
      for(let i=0;i<vertices-1;i++){const a=i*2,k=i*6;indices.set([a,a+1,a+2,a+1,a+3,a+2],k);}
      const geometry=new MeshGeometry({positions:new Float32Array(vertices*4),uvs:new Float32Array(vertices*4),indices});
      ribbon=new Mesh({geometry,texture:this.tiles.get('ribbon')!});ribbon.blendMode='add';this.exhaust.addChildAt(ribbon,0);this.ribbons.set(key,ribbon);
    }
    const first=trail.points[0],distance=first?Math.hypot(x-first.x,y-first.y):0;
    ribbon.visible=power>.04&&distance>width*.12;
    if(!ribbon.visible)return;
    fillTrailRibbon(trail.points,{x,y,time},age,width,ribbon.geometry.positions,ribbon.geometry.uvs);
    ribbon.geometry.getBuffer('aPosition').update();ribbon.geometry.getBuffer('aUV').update();ribbon.alpha=(.7+power*.25)*blend;
    this.ribbonLife.set(key,age);
  }
  /** Append only real sampled positions; old segments never rotate with the hull. */
  wake(key:string,x:number,y:number,time:number,maxAge:number,maxJump:number,width:number,color:number,alpha:number,under=false){
    this.seen.add(key);let trail=this.trails.get(key);
    if(!trail){if(this.trails.size+this.exhausts.size+this.fading.length>=TRAIL_LIMIT)return;trail=new TrailHistory();this.trails.set(key,trail);}
    trail.sample(x,y,time,maxAge,maxJump);
    const points=trail.points;
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[i+1]??{x,y,time},fade=clamp(1-(time-a.time)/maxAge,0,1);
      this.streak(a.x,a.y,b.x,b.y,width*(.4+fade*.6)*3,color,alpha*fade*fade,under);
    }
  }
  events(engine:BattleEngine){
    this.reserve=0;
    for(const ev of engine.events){
      const age=battleSeconds(engine.time-ev.time);if(age<0)continue;
      if(ev.kind==='destroy')this.explosion(ev,age);
      else if((ev.kind==='hit'||ev.kind==='shield')&&age<.22){
        const f=age/.22,color=ev.kind==='shield'?0x78bcff:0xffb46f;
        this.glow(ev.x,ev.y,(3+f*5)*this.px,color,(1-f)*.75);
        if(ev.kind==='shield')this.sprite('ring',ev.x,ev.y,(7+f*15)*this.px,(7+f*15)*this.px,0,color,(1-f)*.4);
        else for(let i=0;i<3;i++){const a=vfxNoise(ev.id*11+i)*Math.PI*2,d=(3+f*12)*this.px;this.streak(ev.x+Math.cos(a)*d*.5,ev.y+Math.sin(a)*d*.5,ev.x+Math.cos(a)*d,ev.y+Math.sin(a)*d,this.px*1.2,color,(1-f)*.65);}
      }
    }
  }
  private explosion(ev:BattleEvent,age:number){
    const px=this.px,life=ev.radius>80?1.65:1.1,f=age/life;if(f>1)return;
    const radius=Math.max(ev.radius,9*px),count=ev.radius>80?3:1;
    for(let i=0;i<count;i++){
      const t=(age-i*.13)/(life*.8);if(t<0||t>=1)continue;
      const a=vfxNoise(ev.id*7+i)*Math.PI*2,d=i?radius*.42:0;
      this.sprite(`fire${Math.min(15,Math.floor(t*16))}`,ev.x+Math.cos(a)*d,ev.y+Math.sin(a)*d,radius*(1.3+t),radius*(1.3+t),a,0xffffff,1-t*.25);
    }
    if(age<.11)this.glow(ev.x,ev.y,radius*(.4+age*3),0xfff0c0,(1-age/.11)*.8);
    if(age<.75){const t=age/.75;this.sprite('ring',ev.x,ev.y,radius*(.8+t*3.5),radius*(.8+t*3.5),0,0xffc487,(1-t)**2*.5);}
    for(let i=0;i<12;i++){
      const a=vfxNoise(ev.id*19+i)*Math.PI*2,speed=radius*(.65+vfxNoise(ev.id*31+i)*1.2),d=age*speed,len=Math.max(2*px,radius*.05)*(1-f);
      this.streak(ev.x+Math.cos(a)*d,ev.y+Math.sin(a)*d,ev.x+Math.cos(a)*(d+len),ev.y+Math.sin(a)*(d+len),Math.max(.8*px,radius*.013),i%3?0xe68d49:0xffd9a1,(1-f)**1.5*.8);
    }
  }
  end(){
    for(let i=this.backUsed;i<this.back.length;i++)this.back[i].visible=false;
    for(let i=this.frontUsed;i<this.front.length;i++)this.front[i].visible=false;
    for(const key of this.trails.keys())if(!this.seen.has(key))this.trails.delete(key);
    for(const key of this.exhausts.keys())if(!this.seen.has(key))this.exhausts.delete(key);
    for(const [key,ribbon] of this.ribbons)if(!this.seen.has(key)){
      this.ribbons.delete(key);
      // Detached gas stays in world space. It must not rotate or reconnect to
      // the new nozzle when a sharp turn briefly extinguishes the engine.
      if(ribbon.visible)this.fading.push({mesh:ribbon,at:this.lastTime,life:this.ribbonLife.get(key)??1,alpha:ribbon.alpha});
      else{ribbon.geometry.destroy();ribbon.destroy({texture:false});}
      this.ribbonLife.delete(key);
    }
    for(let i=this.fading.length-1;i>=0;i--){
      const f=this.fading[i],remaining=clamp(1-(this.lastTime-f.at)/f.life,0,1);f.mesh.alpha=f.alpha*remaining*remaining;
      if(remaining<=0){f.mesh.geometry.destroy();f.mesh.destroy({texture:false});this.fading.splice(i,1);}
    }
  }
  reset(){this.trails.clear();this.exhausts.clear();this.thrusting.clear();for(const r of [...this.ribbons.values(),...this.fading.map(f=>f.mesh)]){r.geometry.destroy();r.destroy({texture:false});}this.ribbons.clear();this.ribbonLife.clear();this.fading=[];this.ships=null;this.lastTime=-1;this.backUsed=this.frontUsed=0;for(const s of this.back)s.visible=false;for(const s of this.front)s.visible=false;}
  destroy(){this.reset();this.exhaust.destroy({children:true,texture:false});this.foreground.destroy({children:true,texture:false});for(const tile of this.tiles.values())tile.destroy(false);this.tiles.clear();this.atlas.destroy(true);this.back=[];this.front=[];}
}
