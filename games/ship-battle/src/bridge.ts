export const PROTOCOL='gvy.ship-battle';
import {validateMembers} from './sim/members';
import type {Member} from './sim/types';
export function sendHost(type:'ready'|'state'|'result'|'members-accepted'|'members-request'|'loading'|'error',payload:unknown){if(window.parent!==window)window.parent.postMessage({source:PROTOCOL,version:1,type,payload},window.location.origin);}
// Obtain the official roster before assigning or downloading any ship. Older
// embedding hosts still receive the normal ready event and can update later.
export function initialHostMembers():Promise<{members:Member[];firstLoad:boolean}|undefined>{
  if(window.parent===window)return Promise.resolve(undefined);
  return new Promise(resolve=>{
    const finish=(data?:{members:Member[];firstLoad:boolean})=>{clearTimeout(timer);window.removeEventListener('message',listener);resolve(data);};
    const listener=(event:MessageEvent)=>{
      const data=event.data;
      if(event.origin!==window.location.origin||event.source!==window.parent||data?.source!==PROTOCOL||data.version!==1||data.type!=='command'||data.command!=='set-members')return;
      try{const members=validateMembers(data.members,window.location.href);sendHost('members-accepted',{count:members.length});finish({members,firstLoad:data.firstLoad===true});}catch{finish();}
    };
    const timer=setTimeout(()=>finish(),1200);
    window.addEventListener('message',listener);
    sendHost('members-request',null);
  });
}
export function listenHost(onCommand:(command:string,value?:unknown)=>void){const listener=(event:MessageEvent)=>{
  if(event.origin!==window.location.origin||event.source!==window.parent||event.data?.source!==PROTOCOL||event.data?.version!==1||event.data?.type!=='command')return;
  const {command,value,members}=event.data;
  if(['pause','resume','reset'].includes(command))onCommand(command);
  if(command==='set-speed'&&[1,2,4].includes(value))onCommand(command,value);
  if(command==='set-mode'&&['random','bounty','brawl','challenge','teams'].includes(value))onCommand(command,value);
  if(command==='set-members')onCommand(command,members);
};window.addEventListener('message',listener);return()=>window.removeEventListener('message',listener);}
