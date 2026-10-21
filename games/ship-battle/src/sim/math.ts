import type { Vec, Ship } from './types';
export const TAU = Math.PI * 2;
export const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(n, high));
export const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
export const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export function randomGenerator(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296; }; }
export function mixSeed(seed:number){let h=seed>>>0;h=Math.imul(h^(h>>>16),0x7feb352d);h=Math.imul(h^(h>>>15),0x846ca68b);return (h^(h>>>16))>>>0;}
// Canonical local coordinates: x = starboard / beam, y = aft / length, nose at (0, -.5).
export function mountWorld(s: Ship, p: Vec): Vec {
  const forward = -p.y * s.spec.length, right = p.x * s.spec.beam;
  return { x: s.x + forward * Math.cos(s.heading) - right * Math.sin(s.heading), y: s.y + forward * Math.sin(s.heading) + right * Math.cos(s.heading) };
}
export function intercept(origin: Vec, target: Vec & {vx:number;vy:number}, speed: number): Vec {
  const dx=target.x-origin.x, dy=target.y-origin.y;
  const a=target.vx**2+target.vy**2-speed**2, b=2*(dx*target.vx+dy*target.vy), c=dx**2+dy**2;
  let time=0;
  if (Math.abs(a)<1e-7) time=b<0 ? -c/b : 0;
  else { const disc=b*b-4*a*c; if(disc>=0) { const roots=[(-b-Math.sqrt(disc))/(2*a),(-b+Math.sqrt(disc))/(2*a)].filter(t=>t>0); if(roots.length) time=Math.min(...roots); } }
  return {x:target.x+target.vx*Math.min(time,4),y:target.y+target.vy*Math.min(time,4)};
}
// Swept segment versus oriented hull ellipse; returns earliest impact fraction.
export function hullIntersection(from:Vec,to:Vec,s:Ship):number|null {
  const c=Math.cos(s.heading),n=Math.sin(s.heading), a=s.spec.length*.48+3,b=s.spec.beam*.48+3;
  const convert=(p:Vec)=>({x:((p.x-s.x)*c+(p.y-s.y)*n)/a,y:(-(p.x-s.x)*n+(p.y-s.y)*c)/b});
  const p=convert(from),q=convert(to),dx=q.x-p.x,dy=q.y-p.y;
  const A=dx*dx+dy*dy,B=2*(p.x*dx+p.y*dy),C=p.x*p.x+p.y*p.y-1;
  if(C<=0)return 0;
  if(A<1e-12)return null;
  const disc=B*B-4*A*C;
  if(disc<0)return null;
  const t=(-B-Math.sqrt(disc))/(2*A);
  return t>=0&&t<=1?t:null;
}
