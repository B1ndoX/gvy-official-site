// Pixi's CSP compatibility module replaces generated functions with static
// implementations, so the official site's script policy stays unchanged.
import 'pixi.js/unsafe-eval';
import { Application, Container, Graphics, Sprite, Text, Texture, Assets, Rectangle } from 'pixi.js';
import { BattleEngine, STEP } from '../sim/engine';
import { simulationSeconds } from '../sim/pacing';
import type { Ship, BattleSnapshot, BattleEvent, Vec } from '../sim/types';
import { clamp, mountWorld } from '../sim/math';
import { assetURL, type ShipAsset } from '../assets/library';
import { CombatDirector, engagementFrame, shipFocusSpan, trackedCenter, spectatorSpan } from './CombatDirector';
import {CameraHandoff} from './CameraHandoff';
import { drawWeaponEffects } from './WeaponEffects';
import { CombatVfx } from './CombatVfx';
import { createHullMask, HullImpactAnchors, type HullMask } from './HullImpact';
import type {WeaponHullProfile} from '../sim/weapon-hull';

interface Visual { root:Container; annotation:Container; sprite:Sprite|null; marker:Graphics; label:Text; bars:Graphics; textureId:string }
export class BattleRenderer {
  app=new Application(); world=new Container(); effects=new Graphics(); grid=new Graphics();terrain=new Graphics();terrainSprites=new Container();private rockTexture:Texture|null=null;private rockSprites=new Map<number,Sprite>(); labels=new Container();
  visuals=new Map<number,Visual>(); textures=new Map<string,Texture>();private outlines=new Map<string,{x:number;y:number}[]>();
  private hullMasks=new Map<string,HullMask>();private impactAnchors=new HullImpactAnchors();
  private weaponHulls=new Map<string,WeaponHullProfile>();
  selected:number|null=null; speed=1; zoom=1; scale=.3; center={x:0,y:0}; fps=60; onSnapshot:(s:BattleSnapshot)=>void=()=>{};
  private mounted=false;private disposed=false;private accumulator=0;private hud=0;private pointer:{x:number;y:number;startX:number;startY:number;centerX:number;centerY:number}|null=null;
  private resizeObserver:ResizeObserver|null=null;
  private vfx:CombatVfx|null=null;
  private pointers=new Map<number,{x:number;y:number}>();private pinching=false;private pinch:{distance:number;zoom:number;world:{x:number;y:number}}|null=null;
  private assetMap=new Map<string,ShipAsset>();private fittedSpan=3000;private referenceSpan=3000;private cameraMode:'overview'|'combat'|'follow'|'free'='combat';private followed:number|null=null;private tracking:{id:number;x:number;y:number}|null=null;private director=new CombatDirector();private engagement:{subject:Ship;target:Ship|null;active:boolean}|null=null;private frameSeconds=1/60;private loadedURLs=new Set<string>();private assetRequest=0;
  constructor(public element:HTMLDivElement,public engine:BattleEngine){}
  private handoff=new CameraHandoff();
  async init(){
    // Native asynchronous ImageBitmap decoding works under the site's CSP;
    // Pixi's generated blob worker would be blocked by that same policy.
    Assets.setPreferences({preferWorkers:false});
    await this.app.init({width:Math.max(1,this.element.clientWidth),height:Math.max(1,this.element.clientHeight),backgroundAlpha:0,antialias:true,resolution:Math.min(devicePixelRatio,2),autoDensity:true,preference:'webgl',powerPreference:'high-performance'});
    this.mounted=true;
    if(this.disposed){this.app.destroy(true,{children:true,texture:false});return;}
    this.element.appendChild(this.app.canvas);this.app.canvas.setAttribute('aria-label','星际飞船自动战斗画面，双指或滚轮缩放，单指拖动，点击舰船查看状态');this.app.canvas.style.touchAction='none';
    this.vfx=new CombatVfx();
    await this.vfx.loadOrdnance();if(this.disposed)return;
    this.app.stage.addChild(this.world);this.world.addChild(this.grid,this.terrain,this.terrainSprites,this.vfx.exhaust,this.effects,this.vfx.foreground,this.labels);
    this.app.canvas.addEventListener('wheel',this.wheel,{passive:false});
    this.app.canvas.addEventListener('pointerdown',this.down);this.app.canvas.addEventListener('pointermove',this.move);this.app.canvas.addEventListener('pointerup',this.up);this.app.canvas.addEventListener('pointercancel',this.cancel);this.app.canvas.addEventListener('lostpointercapture',this.cancel);
    this.resizeObserver=new ResizeObserver(()=>{const width=this.element.clientWidth,height=this.element.clientHeight;if(width<2||height<2||this.disposed)return;this.app.renderer.resize(width,height);this.scale=Math.min(width,height)/this.fittedSpan;this.camera();});this.resizeObserver.observe(this.element);
    try{const texture=await Assets.load<Texture>(new URL('assets/environment/asteroid.png',document.baseURI).href);if(!this.disposed)this.rockTexture=texture;}catch{/* Keep the geometry fallback if environment artwork is unavailable. */}
    this.app.ticker.add(ticker=>{
      if(document.hidden){this.accumulator=0;return;}
      this.frameSeconds=Math.min(.1,ticker.elapsedMS/1000);
      this.fps=this.fps*.94+Math.min(120,1000/Math.max(1,ticker.elapsedMS))*.06;
      if(this.engine.phase==='running'){
        this.accumulator+=simulationSeconds(Math.min(ticker.elapsedMS/1000,.1),this.speed);
        let budget=0;while(this.accumulator>=STEP&&budget<30){this.engine.step();this.accumulator-=STEP;budget++;}
        if(budget===30)this.accumulator=0;
      }else this.accumulator=0;
      this.draw();this.hud+=ticker.elapsedMS;if(this.hud>100){this.hud=0;this.onSnapshot(this.engine.snapshot(this.selected));}
    });this.fit();
  }
  get activeAssetURLs(){return [...this.loadedURLs];}
  async setAssets(assets:ShipAsset[],ids:string[],onProgress?:(loaded:number,total:number)=>void){
    const request=++this.assetRequest,next=new Map<string,Texture>(),outlines=new Map<string,{x:number;y:number}[]>(),masks=new Map<string,HullMask>();
    const needed=new Set(ids),urls=new Set(assets.filter(a=>needed.has(a.shipId)).map(assetURL));
    const selected=assets.filter(a=>needed.has(a.shipId));let loaded=0;onProgress?.(0,selected.length);
    await Promise.all(selected.map(async a=>{const texture=await Assets.load<Texture>(assetURL(a));next.set(a.shipId,texture);const hull=this.outline(texture);outlines.set(a.shipId,hull.points);if(hull.mask)masks.set(a.shipId,hull.mask);if(request===this.assetRequest&&!this.disposed)onProgress?.(++loaded,selected.length);}));
    if(this.disposed||request!==this.assetRequest)return;
    const stale=[...this.loadedURLs].filter(url=>!urls.has(url));
    this.assetMap=new Map(assets.map(a=>[a.shipId,a]));this.textures=next;this.outlines=outlines;this.hullMasks=masks;
    this.weaponHulls=new Map(selected.flatMap(asset=>{const mask=masks.get(asset.shipId);return mask?[[asset.shipId,{asset:{center:{...asset.center},noseDegrees:asset.noseDegrees},mask}] as const]:[];}));
    this.engine.weaponHulls=this.weaponHulls;
    this.clearVisuals();
    this.loadedURLs=urls;await Promise.all(stale.map(url=>Assets.unload(url)));
  }
  clearVisuals(){for(const v of this.visuals.values()){v.root.destroy({children:true,texture:false});v.annotation.destroy({children:true,texture:false});}this.visuals.clear();this.impactAnchors.reset();this.vfx?.reset();}
  get vfxStats(){return this.vfx?.stats??null;}
  private outline(texture:Texture){
    // Sample the real alpha silhouette once, so rotated transparent corners do not push names away.
    try{const canvas=document.createElement('canvas');canvas.width=texture.width;canvas.height=texture.height;const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(texture.source.resource as CanvasImageSource,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data,points:{x:number;y:number}[]=[];
      for(let y=0;y<canvas.height;y+=Math.max(1,Math.floor(canvas.height/100))){let left=0,right=canvas.width-1;while(left<canvas.width&&pixels[(y*canvas.width+left)*4+3]<32)left++;while(right>=left&&pixels[(y*canvas.width+right)*4+3]<32)right--;if(right>=left){points.push({x:left/canvas.width,y:y/canvas.height},{x:right/canvas.width,y:y/canvas.height});}}
      if(points.length)return {points,mask:createHullMask(canvas.width,canvas.height,pixels)};
    }catch{/* A readable alpha mask is optional; imported textures still render. */}
    return {points:[{x:0,y:0},{x:1,y:0},{x:0,y:1},{x:1,y:1}],mask:null};
  }
  private hitImpact=(ev:BattleEvent)=>{
    const ship=this.engine.ships.find(s=>s.id===ev.ship),asset=ship&&this.assetMap.get(ship.spec.id),mask=ship&&this.hullMasks.get(ship.spec.id);
    return ship&&asset&&mask?this.impactAnchors.event(ev,ship,asset,mask):ev;
  };
  private beamImpact=(id:number|undefined,from:Vec,to:Vec)=>{
    const ship=this.engine.ships.find(s=>s.id===id),asset=ship&&this.assetMap.get(ship.spec.id),mask=ship&&this.hullMasks.get(ship.spec.id);
    return ship&&asset&&mask?this.impactAnchors.beam(from,to,ship,asset,mask):to;
  };
  private bounds(){const ships=this.engine.phase==='ready'?this.engine.ships:this.engine.living;if(!ships.length)return {x:0,y:0,span:3000};const left=Math.min(...ships.map(s=>s.x-s.radius)),right=Math.max(...ships.map(s=>s.x+s.radius)),top=Math.min(...ships.map(s=>s.y-s.radius)),bottom=Math.max(...ships.map(s=>s.y+s.radius));return {x:(left+right)/2,y:(top+bottom)/2,span:Math.max(650,right-left+350,bottom-top+450)};}
  get focusEnabled(){return this.cameraMode==='combat';}
  get zoomPercent(){return this.scale*this.zoom*this.referenceSpan/Math.max(1,Math.min(this.element.clientWidth,this.element.clientHeight))*100;}
  get cameraInfo(){return {mode:this.cameraMode,subject:this.cameraMode==='follow'?this.engine.ships.find(s=>s.id===this.followed)?.label??'':this.engagement?.subject.label??'',target:this.cameraMode==='combat'?this.engagement?.target?.label??'':'',active:this.engagement?.active??false};}
  fit(){this.handoff.reset();const box=this.bounds();this.center={x:box.x,y:box.y};this.fittedSpan=this.referenceSpan=box.span;this.scale=Math.max(1,Math.min(this.element.clientWidth,this.element.clientHeight))/box.span;this.zoom=1;this.cameraMode='overview';this.selected=null;this.followed=null;this.tracking=null;this.engagement=null;this.director.reset();this.camera();this.onSnapshot(this.engine.snapshot(this.selected));}
  resetCamera(){this.fit();this.toggleFocus();}
  toggleFocus(){this.handoff.reset();this.selected=null;if(this.focusEnabled)this.freeCamera();else{this.cameraMode='combat';this.followed=null;this.tracking=null;this.fittedSpan/=this.zoom;this.scale*=this.zoom;this.zoom=1;this.director.reset();this.engagement=null;}this.onSnapshot(this.engine.snapshot(this.selected));}
  private freeCamera(){this.handoff.reset();this.cameraMode='free';this.followed=null;this.tracking=null;this.engagement=null;}
  private cameraArea(combat=true){
    const width=this.element.clientWidth,height=this.element.clientHeight,ui=parseFloat(getComputedStyle(this.element).fontSize)/14;
    if(!combat)return {width,height,x:width/2,y:height/2,ui};
    const hud=this.element.parentElement?.querySelector<HTMLElement>('.member-hud');
    const reserve=hud&&!hud.hidden?Math.min(width*.45,hud.clientWidth+24*ui):0;
    const boss=this.element.parentElement?.querySelector<HTMLElement>('.boss-hud');
    const top=boss?Math.min(height*.25,boss.offsetTop+boss.offsetHeight+8*ui):0;
    const bottom=Math.min(height*.15,(width<=700?32:55)*ui);
    return {width:Math.max(1,width-reserve),height:Math.max(1,height-top-bottom),x:(width-reserve)/2,y:top+(height-top-bottom)/2,ui};
  }
  private cameraFrame(ship:Ship,target:Ship|null,combat:boolean){
    const area=this.cameraArea(combat),side=Math.max(1,Math.min(this.element.clientWidth,this.element.clientHeight));
    const frame=combat?engagementFrame(ship,target,area.width,area.height,area.ui):{x:ship.x,y:ship.y,span:shipFocusSpan(ship,area.width,area.height,area.ui)};
    const span=frame.span*side/Math.max(1,Math.min(area.width,area.height)),k=side/span*this.zoom;
    return {x:ship.x+(frame.x-ship.x)/this.zoom+(this.element.clientWidth/2-area.x)/k,y:ship.y+(frame.y-ship.y)/this.zoom+(this.element.clientHeight/2-area.y)/k,span};
  }
  focusShip(id:number,frame=true){this.handoff.reset();const ship=this.engine.ships.find(s=>s.id===id);if(!ship)return;this.selected=id;this.cameraMode='follow';this.followed=id;this.tracking={id:ship.id,x:ship.x,y:ship.y};this.engagement=null;const box=this.cameraFrame(ship,null,false);this.center={x:box.x,y:box.y};if(frame){this.fittedSpan=box.span;this.scale=Math.max(1,Math.min(this.element.clientWidth,this.element.clientHeight))/this.fittedSpan;this.zoom=1;}this.camera();this.onSnapshot(this.engine.snapshot(id));}
  camera(){if(!this.mounted)return;this.world.scale.set(this.scale*this.zoom);this.world.position.set(this.element.clientWidth/2-this.center.x*this.scale*this.zoom,this.element.clientHeight/2-this.center.y*this.scale*this.zoom);}
  private boundedZoom(value:number){const ui=parseFloat(getComputedStyle(this.element).fontSize)/14,side=Math.max(1,Math.min(this.element.clientWidth,this.element.clientHeight)),minimum=side/(Math.max(this.bounds().span,this.engine.arena*2)*4);return clamp(this.scale*value,minimum,32*ui)/this.scale;}
  zoomBy(factor:number){if(!['follow','combat'].includes(this.cameraMode))this.freeCamera();this.zoom=this.boundedZoom(this.zoom*factor);this.camera();this.onSnapshot(this.engine.snapshot(this.selected));}
  private screenToWorld(x:number,y:number){return {x:(x-this.element.clientWidth/2)/(this.scale*this.zoom)+this.center.x,y:(y-this.element.clientHeight/2)/(this.scale*this.zoom)+this.center.y};}
  private wheel=(event:WheelEvent)=>{event.preventDefault();if(['follow','combat'].includes(this.cameraMode)){this.zoomBy(Math.exp(-event.deltaY*.0015));return;}const r=this.app.canvas.getBoundingClientRect(),x=event.clientX-r.left,y=event.clientY-r.top,before=this.screenToWorld(x,y);this.zoomBy(Math.exp(-event.deltaY*.0015));const after=this.screenToWorld(x,y);this.center.x+=before.x-after.x;this.center.y+=before.y-after.y;this.camera();};
  private beginPinch(){const [a,b]=[...this.pointers.values()];if(!a||!b)return;const r=this.app.canvas.getBoundingClientRect();if(!['follow','combat'].includes(this.cameraMode))this.freeCamera();this.pointer=null;this.pinching=true;this.pinch={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),zoom:this.zoom,world:this.screenToWorld((a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top)};}
  private down=(event:PointerEvent)=>{
    if(event.button!==0)return;if(event.pointerType==='touch')event.preventDefault();
    this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});this.app.canvas.setPointerCapture(event.pointerId);
    if(this.pointers.size>=2){this.beginPinch();return;}
    this.pointer={x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,centerX:this.center.x,centerY:this.center.y};
  };
  private move=(event:PointerEvent)=>{
    if(!this.pointers.has(event.pointerId))return;this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(this.pinch&&this.pointers.size>=2){
      const [a,b]=[...this.pointers.values()],r=this.app.canvas.getBoundingClientRect(),g=this.pinch;
      this.zoom=this.boundedZoom(g.zoom*Math.hypot(a.x-b.x,a.y-b.y)/g.distance);
      if(['follow','combat'].includes(this.cameraMode)){this.camera();return;}
      this.center={x:g.world.x-((a.x+b.x)/2-r.left-this.element.clientWidth/2)/(this.scale*this.zoom),y:g.world.y-((a.y+b.y)/2-r.top-this.element.clientHeight/2)/(this.scale*this.zoom)};
      this.camera();return;
    }
    // The remaining finger at the end of a pinch belongs to that gesture; it
    // must not turn the final zoom movement into a new drag that unlocks a ship.
    if(this.pinching)return;
    if(!this.pointer||Math.hypot(event.clientX-this.pointer.startX,event.clientY-this.pointer.startY)<=6)return;
    const following=this.cameraMode==='follow'||this.cameraMode==='combat'||this.selected!==null;
    this.selected=null;this.freeCamera();this.center.x=this.pointer.centerX-(event.clientX-this.pointer.x)/(this.scale*this.zoom);this.center.y=this.pointer.centerY-(event.clientY-this.pointer.y)/(this.scale*this.zoom);this.camera();
    if(following)this.onSnapshot(this.engine.snapshot(null));
  };
  private endPointer(event:PointerEvent,cancelled=false){
    if(!this.pointers.has(event.pointerId))return;const p=this.pointer;this.pointers.delete(event.pointerId);
    if(this.app.canvas.hasPointerCapture(event.pointerId))this.app.canvas.releasePointerCapture(event.pointerId);
    if(this.pinching||cancelled){
      this.pinch=null;this.pointer=null;
      if(this.pointers.size>=2)this.beginPinch();
      else if(this.pointers.size===1){const a=[...this.pointers.values()][0];this.pointer={x:a.x,y:a.y,startX:a.x,startY:a.y,centerX:this.center.x,centerY:this.center.y};}
      else this.pinching=false;
      this.onSnapshot(this.engine.snapshot(this.selected));return;
    }
    this.pointer=null;if(!p)return;
    if(Math.hypot(event.clientX-p.startX,event.clientY-p.startY)>6){this.onSnapshot(this.engine.snapshot(this.selected));return;}
    const r=this.app.canvas.getBoundingClientRect(),w=this.screenToWorld(event.clientX-r.left,event.clientY-r.top);let closest:Ship|null=null,distance=Infinity;
    for(const ship of this.engine.living){const d=Math.hypot(ship.x-w.x,ship.y-w.y);if(d<Math.max(ship.radius,22/(this.scale*this.zoom))&&d<distance){closest=ship;distance=d;}}
    if(closest)this.focusShip(closest.id);else{this.freeCamera();this.selected=null;this.onSnapshot(this.engine.snapshot(null));}
  }
  private up=(event:PointerEvent)=>this.endPointer(event);
  private cancel=(event:PointerEvent)=>this.endPointer(event,true);
  private makeVisual(s:Ship):Visual {
    const root=new Container(),annotation=new Container(),marker=new Graphics(),bars=new Graphics(),texture=this.textures.get(s.spec.id);
    const sprite=texture?new Sprite(texture):null;if(sprite)root.addChild(sprite);root.addChild(marker);
    const label=new Text({text:s.label,style:{fontFamily:'system-ui, sans-serif',fontSize:s.npc==='boss'?15:13,fill:s.npc?'#ffa28b':'#e4edf8',stroke:{color:'#040912',width:3},fontWeight:'500'},resolution:2});annotation.addChild(label);annotation.addChild(bars);this.labels.addChild(annotation);this.world.addChildAt(root,this.world.getChildIndex(this.vfx?.foreground??this.labels));
    return {root,annotation,sprite,marker,label,bars,textureId:s.spec.id};
  }
  draw(){
    // Dialogs may preload an iframe at 0×0. Do not create infinite screen-size geometry.
    if(this.disposed||!this.mounted||this.element.clientWidth<2||this.element.clientHeight<2||this.scale<=0||!Number.isFinite(this.scale*this.zoom))return;
    if(!this.pointers.size||this.cameraMode==='follow'||this.cameraMode==='combat'&&this.pinching){
      let box:{x:number;y:number;span:number}|null=null,subject:Ship|null=null;
      if(this.cameraMode==='overview'&&this.engine.phase==='running')box=this.bounds();
      if(this.cameraMode==='combat'&&this.engine.phase!=='ready'){
        const dt=this.engine.phase==='running'?this.frameSeconds:0;
        const previous=this.engagement;
        if(!this.engagement||this.engine.phase==='running')this.engagement=this.director.update(this.engine.ships,this.engine.projectiles,this.engine.events,this.engine.time,dt,this.handoff.active);
        if(this.engagement){
          subject=this.engagement.subject;box=this.cameraFrame(subject,this.engagement.target,true);
          if(previous&&(previous.subject.id!==subject.id||previous.target?.id!==this.engagement.target?.id))this.handoff.begin({...this.center,span:this.fittedSpan},box);
        }
      }
      if(this.cameraMode==='follow'){const ship=this.engine.ships.find(s=>s.id===this.followed);if(ship){subject=ship;box=this.cameraFrame(ship,null,false);}else this.freeCamera();}
      if(box){
        const follow=1-Math.exp(-this.frameSeconds*(this.cameraMode==='overview'?1.5:this.cameraMode==='combat'?1:4));
        const transfer=this.cameraMode==='combat'?this.handoff.step({...this.center,span:this.fittedSpan},box,this.engine.phase==='running'?this.frameSeconds:0,subject?.alive):null;
        this.fittedSpan=transfer?.span??(this.cameraMode==='combat'?spectatorSpan(this.fittedSpan,box.span,this.frameSeconds):Math.exp(Math.log(this.fittedSpan)+(Math.log(box.span)-Math.log(this.fittedSpan))*follow));
        this.scale=Math.min(this.element.clientWidth,this.element.clientHeight)/this.fittedSpan;
        if(transfer){this.center={x:transfer.x,y:transfer.y};this.tracking=subject?{id:subject.id,x:subject.x,y:subject.y}:null;}
        else if(subject){
          this.center=trackedCenter(this.center,this.tracking,subject,box,follow);this.tracking={id:subject.id,x:subject.x,y:subject.y};
          // Automatic composition already fits both ships. A subject-only
          // correction here would push the opponent back outside the shot.
          if(this.cameraMode==='follow'){
            const area=this.cameraArea(false),k=this.scale*this.zoom,screenX=this.element.clientWidth/2+(subject.x-this.center.x)*k,screenY=this.element.clientHeight/2+(subject.y-this.center.y)*k;
            const marginX=Math.min(area.width*.22,90*area.ui),marginY=Math.min(area.height*.22,90*area.ui);
            const left=area.x-area.width/2+marginX,right=area.x+area.width/2-marginX,top=area.y-area.height/2+marginY,bottom=area.y+area.height/2-marginY;
            this.center.x+=(screenX-clamp(screenX,left,right))/k;this.center.y+=(screenY-clamp(screenY,top,bottom))/k;
          }
        }else{this.tracking=null;this.center.x+=(box.x-this.center.x)*follow;this.center.y+=(box.y-this.center.y)*follow;}
        this.camera();
      }
    }
    const g=this.grid,e=this.effects,k=this.scale*this.zoom,ui=parseFloat(getComputedStyle(this.element).fontSize)/14,px=ui/k;g.clear();e.clear();
    this.vfx?.begin(this.engine,px,{left:-this.world.x/k,right:(this.element.clientWidth-this.world.x)/k,top:-this.world.y/k,bottom:(this.element.clientHeight-this.world.y)/k});
    this.terrain.clear();
    const rockIds=new Set(this.engine.asteroids.map(r=>r.id));for(const [id,sprite] of this.rockSprites)if(!rockIds.has(id)){sprite.destroy();this.rockSprites.delete(id);}
    for(const rock of this.engine.asteroids){if(this.rockTexture){let sprite=this.rockSprites.get(rock.id);if(!sprite){sprite=new Sprite(this.rockTexture);sprite.anchor.set(.5);this.terrainSprites.addChild(sprite);this.rockSprites.set(rock.id,sprite);}sprite.position.set(rock.x,rock.y);sprite.rotation=rock.rotation;sprite.width=rock.radius*2;sprite.height=rock.radius*2*this.rockTexture.height/this.rockTexture.width;continue;}const points:number[]=[];for(let i=0;i<11;i++){const a=i*Math.PI*2/11+rock.rotation,rad=rock.radius*(.83+.17*Math.sin(i*2.39+rock.id)**2);points.push(rock.x+Math.cos(a)*rad,rock.y+Math.sin(a)*rad);}this.terrain.poly(points).fill({color:0x39434c,alpha:.95}).stroke({color:0x8d9caa,alpha:.55,width:1.2*px});this.terrain.circle(rock.x-rock.radius*.2,rock.y-rock.radius*.12,rock.radius*.3).fill({color:0x171f29,alpha:.6});this.terrain.circle(rock.x+rock.radius*.27,rock.y+rock.radius*.3,rock.radius*.17).fill({color:0x1e2731,alpha:.65});}
    const occupied:{left:number;right:number;top:number;bottom:number}[]=[];
    for(const s of this.engine.ships){
      let v=this.visuals.get(s.id);if(!v){v=this.makeVisual(s);this.visuals.set(s.id,v);}
      const {root,annotation,sprite,marker,label,bars}=v;root.visible=annotation.visible=s.alive;if(!s.alive)continue;
      root.position.set(s.x,s.y);annotation.position.set(s.x,s.y);marker.clear();bars.clear();
      const color=s.npc?0xff755f:s.team==='red'?0xff8e92:s.team==='blue'?0x7cc6ff:s.id%2?0xf1cc87:0x91c9ff,asset=this.assetMap.get(s.spec.id);
      if(sprite&&asset){
        sprite.anchor.set(asset.center.x,asset.center.y);const sideways=Math.abs(Math.sin(asset.noseDegrees*Math.PI/180))>.7;
        sprite.width=sideways?s.spec.length:s.spec.beam;sprite.height=sideways?s.spec.beam:s.spec.length;
        sprite.rotation=s.heading+Math.PI/2-asset.noseDegrees*Math.PI/180;
      }else{
        const rad=Math.max(s.radius*.7,5*px);marker.circle(0,0,rad).fill({color,alpha:.07}).stroke({color,alpha:.85,width:1.3*px});
        marker.moveTo(Math.cos(s.heading)*rad,Math.sin(s.heading)*rad).lineTo(Math.cos(s.heading)*(rad+10*px),Math.sin(s.heading)*(rad+10*px)).stroke({color,width:px});
      }
      const selected=s.id===this.selected;
      if(selected&&s.npc!=='boss')marker.circle(0,0,s.radius+9*px).stroke({color:0xf4d290,width:1.2*px,alpha:.85});
      label.style.fill=s.npc?'#ffa28b':s.team==='red'?'#ffa1a5':s.team==='blue'?'#9ed7ff':'#e4edf8';label.scale.set(px);label.alpha=selected?1:.86;
      const textWidth=label.getLocalBounds().width*px;
      let bottom=s.radius,centerX=0;
      if(sprite&&asset){const sin=Math.sin(sprite.rotation),cos=Math.cos(sprite.rotation),points=this.outlines.get(s.spec.id)??[];let left=Infinity,right=-Infinity,lower=-Infinity;for(const p of points){const x=(p.x-asset.center.x)*sprite.width,y=(p.y-asset.center.y)*sprite.height,rx=cos*x-sin*y,ry=sin*x+cos*y;left=Math.min(left,rx);right=Math.max(right,rx);lower=Math.max(lower,ry);}if(points.length){bottom=lower;centerX=(left+right)/2;}}
      const below=bottom+4*px,choices=[{x:centerX-textWidth/2,y:below}];
      for(const offset of [22,44])choices.push({x:centerX-textWidth/2,y:below+offset*px});
      let position=choices[0];for(const candidate of choices){const left=(s.x+candidate.x)*k+this.world.x,top=(s.y+candidate.y)*k+this.world.y,rect={left,right:left+textWidth*k,top,bottom:top+27*ui};if(left<4||rect.right>this.element.clientWidth-4||top<3||rect.bottom>this.element.clientHeight-3)continue;if(occupied.some(o=>rect.left<o.right+5&&rect.right>o.left-5&&rect.top<o.bottom+3&&rect.bottom>o.top-3))continue;position=candidate;occupied.push(rect);break;}
      label.position.set(position.x,position.y);
      if(this.engine.ships.length>70&&this.zoom<1.2&&!selected&&s.npc!=='boss')label.visible=false;else label.visible=true;
      bars.visible=label.visible&&(this.engine.phase!=='ready'||selected);
      const barX=position.x+(textWidth-32*px)/2;
      bars.rect(barX,position.y+20*px,32*px,2*px).fill({color:0x20354d,alpha:.9});bars.rect(barX,position.y+20*px,32*px*(s.shield/s.spec.shield),2*px).fill(0x71b9f1);
      bars.rect(barX,position.y+24*px,32*px,2*px).fill({color:0x3b3022,alpha:.8});bars.rect(barX,position.y+24*px,32*px*(s.hull/s.spec.hull),2*px).fill(0xd9bb7a);
      if(s.spec.class==='capital'&&k>.3)for(let i=0;i<s.spec.mounts.length;i++){
        const m=s.spec.mounts[i];if(m.kind!=='turret')continue;const p=mountWorld(s,m),angle=s.heading+s.turretAngles[i];
        const x=p.x-s.x,y=p.y-s.y,base=Math.min(2.2*px,s.spec.beam*.008);
        marker.circle(x,y,base*(m.impact==='heavy-cannon'?1.5:1)).fill({color:0x92a8bb,alpha:.8});
        for(let barrel=0;barrel<(m.barrels??1);barrel++){
          const offset=(barrel-((m.barrels??1)-1)/2)*(m.barrelSpacing??0),bx=x-Math.sin(angle)*offset,by=y+Math.cos(angle)*offset;
          marker.moveTo(bx,by).lineTo(bx+Math.cos(angle)*base*(m.barrels?4:2.5),by+Math.sin(angle)*base*(m.barrels?4:2.5)).stroke({color:0xccd7df,width:Math.min(px,base*.65)});
        }
      }
    }
    if(this.vfx){drawWeaponEffects(this.engine,e,px,this.vfx,this.beamImpact);this.vfx.events(this.engine,this.hitImpact);this.vfx.end();}
    // Wakes sit beneath hulls; weapon feedback sits above hulls and beneath labels.
  }
  destroy(){this.handoff.reset();this.disposed=true;this.resizeObserver?.disconnect();this.impactAnchors.reset();if(this.engine.weaponHulls===this.weaponHulls)this.engine.weaponHulls=new Map();this.weaponHulls.clear();this.hullMasks.clear();this.outlines.clear();if(!this.mounted)return;this.app.canvas.removeEventListener('wheel',this.wheel);this.app.canvas.removeEventListener('pointerdown',this.down);this.app.canvas.removeEventListener('pointermove',this.move);this.app.canvas.removeEventListener('pointerup',this.up);this.app.canvas.removeEventListener('pointercancel',this.cancel);this.app.canvas.removeEventListener('lostpointercapture',this.cancel);this.pointers.clear();this.pointer=null;this.pinch=null;this.vfx?.destroy();this.vfx=null;this.app.destroy(true,{children:true,texture:false});}
}
