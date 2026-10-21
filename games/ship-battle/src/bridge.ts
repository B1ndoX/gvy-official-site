export const PROTOCOL='gvy.ship-battle';
export function sendHost(type:'ready'|'state'|'result'|'members-accepted'|'error',payload:unknown){if(window.parent!==window)window.parent.postMessage({source:PROTOCOL,version:1,type,payload},window.location.origin);}
export function listenHost(onCommand:(command:string,value?:unknown)=>void){const listener=(event:MessageEvent)=>{
  if(event.origin!==window.location.origin||event.source!==window.parent||event.data?.source!==PROTOCOL||event.data?.version!==1||event.data?.type!=='command')return;
  const {command,value,members}=event.data;
  if(['pause','resume','reset'].includes(command))onCommand(command);
  if(command==='set-speed'&&[1,2,4].includes(value))onCommand(command,value);
  if(command==='set-mode'&&['random','bounty','brawl','challenge','teams'].includes(value))onCommand(command,value);
  if(command==='set-members')onCommand(command,members);
};window.addEventListener('message',listener);return()=>window.removeEventListener('message',listener);}
