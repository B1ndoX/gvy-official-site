import type {Ship,Vec} from './types';
import {clamp,distance,randomGenerator} from './math';
import {hullRadiusAt} from './collisions';
export interface Asteroid extends Vec {id:number;radius:number;rotation:number}
/** Circle against the same oriented hull ellipse used by weapon intersections. */
export function asteroidContact(ship:Ship,rock:Asteroid,padding=0){
 const c=Math.cos(ship.heading),s=Math.sin(ship.heading),dx=rock.x-ship.x,dy=rock.y-ship.y;
 const a=ship.spec.length*.48+3,b=ship.spec.beam*.48+3,r=rock.radius+padding;
 if(Math.hypot(dx,dy)>=Math.max(a,b)+r)return null;
 const x=dx*c+dy*s,y=-dx*s+dy*c;
 if((x/a)**2+(y/b)**2<=1){
  const d=Math.hypot(dx,dy),nx=d>1e-6?dx/d:c,ny=d>1e-6?dy/d:s;
  return {nx,ny,depth:hullRadiusAt(ship,Math.atan2(ny,nx))+r-d};
 }
 // Closest point on an ellipse, solved monotonically; no bounding-circle hit.
 let lo=0,hi=Math.max(a,b)*Math.hypot(x,y);
 for(let i=0;i<28;i++){const t=(lo+hi)/2,value=(a*x/(t+a*a))**2+(b*y/(t+b*b))**2;if(value>1)lo=t;else hi=t;}
 const t=(lo+hi)/2,ex=x-a*a*x/(t+a*a),ey=y-b*b*y/(t+b*b),d=Math.hypot(ex,ey);
 if(d>=r)return null;
 return {nx:(ex*c-ey*s)/d,ny:(ex*s+ey*c)/d,depth:r-d};
}
export function createAsteroids(ships:Ship[],arena:number,seed:number):Asteroid[]{
 const random=randomGenerator(seed^0xa57e),rocks:Asteroid[]=[];
 // Twenty cells retain the existing footprint, with a modest gap and no central pile.
 const bands=[[.08,.45,6],[.45,.66,7],[.66,.86,7]],offset=random()*Math.PI*2;
 for(let band=0,i=0;band<bands.length;band++){
 const [inner,outer,sectors]=bands[band];
 for(let sector=0;sector<sectors;sector++,i++)for(let attempt=0;attempt<150;attempt++){
  const slot=attempt<75?sector+.15+random()*.7:random()*sectors;
  const angle=offset+(slot+band*.31)*Math.PI*2/sectors;
  const radius=arena*Math.sqrt(inner*inner+random()*(outer*outer-inner*inner));
  const rock={id:i+1,x:Math.cos(angle)*radius,y:Math.sin(angle)*radius,radius:i===13||i===17?110+random()*75:i%3===1?45+random()*45:16+random()*18,rotation:random()*Math.PI*2};
  if(Math.hypot(rock.x,rock.y)+rock.radius>arena*.94||ships.some(s=>distance(s,rock)<s.radius+rock.radius+150)||rocks.some(r=>distance(r,rock)<r.radius+rock.radius+135))continue;
  rocks.push(rock);break;
 }}return rocks;
}
export function avoidAsteroids(ship:Ship,rocks:Asteroid[]){
 let x=0,y=0;const speed=Math.hypot(ship.vx,ship.vy),look=Math.min(1.6,.65+ship.spec.length/220),px=ship.x+ship.vx*look,py=ship.y+ship.vy*look;
 for(const rock of rocks){const safe=hullRadiusAt(ship,Math.atan2(rock.y-ship.y,rock.x-ship.x))+rock.radius+70,d=Math.hypot(ship.x-rock.x,ship.y-rock.y),future=Math.hypot(px-rock.x,py-rock.y);if(Math.min(d,future)>safe+speed*.4)continue;
  const nx=ship.x-rock.x,ny=ship.y-rock.y,n=Math.max(1,Math.hypot(nx,ny)),weight=clamp(1-Math.min(d,future)/(safe+speed*.4),0,1)*2;
  // Lateral steering gives a passing lane instead of braking head-on into the obstacle.
  const side=(Math.cos(ship.heading)*(rock.y-ship.y)-Math.sin(ship.heading)*(rock.x-ship.x))>0?-1:1;
  x+=nx/n*weight-Math.sin(ship.heading)*side*weight;y+=ny/n*weight+Math.cos(ship.heading)*side*weight;
 }return {x,y};
}
export function segmentRock(from:Vec,to:Vec,rock:Pick<Asteroid,'x'|'y'|'radius'>):number|null{
 const dx=to.x-from.x,dy=to.y-from.y,x=from.x-rock.x,y=from.y-rock.y,a=dx*dx+dy*dy,c=x*x+y*y-rock.radius**2;
 if(c<=0)return 0;if(a<1e-9)return null;const b=2*(x*dx+y*dy),disc=b*b-4*a*c;if(disc<0)return null;const t=(-b-Math.sqrt(disc))/(2*a);return t>=0&&t<=1?t:null;
}
