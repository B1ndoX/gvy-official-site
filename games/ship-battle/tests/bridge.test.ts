import {expect,test,vi} from 'vitest';
import {listenHost,sendHost,PROTOCOL} from '../src/bridge';
test('host commands require same-origin parent, protocol and supported values; listener is removable',()=>{
 const callbacks=new Set<(event:MessageEvent)=>void>(),parent={postMessage:vi.fn()};
 vi.stubGlobal('window',{parent,location:{origin:'https://fleet.test'},addEventListener:(_name:string,fn:(event:MessageEvent)=>void)=>callbacks.add(fn),removeEventListener:(_name:string,fn:(event:MessageEvent)=>void)=>callbacks.delete(fn)});
 try{const on=vi.fn(),stop=listenHost(on),message={source:PROTOCOL,version:1,type:'command',command:'set-mode',value:'teams'};
 const emit=(patch:Record<string,unknown>={})=>callbacks.forEach(fn=>fn({origin:'https://fleet.test',source:parent,data:message,...patch} as unknown as MessageEvent));
 emit({origin:'https://elsewhere.test'});emit({source:{}});emit({data:{...message,version:2}});emit({data:{...message,value:'invalid'}});emit({data:{...message,command:'set-speed',value:8}});expect(on).not.toHaveBeenCalled();
 emit();expect(on).toHaveBeenLastCalledWith('set-mode','teams');emit({data:{...message,command:'pause'}});expect(on).toHaveBeenLastCalledWith('pause');stop();emit();expect(on).toHaveBeenCalledTimes(2);
 sendHost('ready',{modes:['teams']});expect(parent.postMessage).toHaveBeenCalledWith({source:PROTOCOL,version:1,type:'ready',payload:{modes:['teams']}},'https://fleet.test');
 }finally{vi.unstubAllGlobals();}
});

test('initial host roster is accepted before mounting, preserving the cache state and removing the temporary listener',async()=>{
 const callbacks=new Set<(event:MessageEvent)=>void>(),parent={postMessage:vi.fn()};
 vi.stubGlobal('window',{parent,location:{origin:'https://fleet.test',href:'https://fleet.test/games/ship-battle/'},addEventListener:(_name:string,fn:(event:MessageEvent)=>void)=>callbacks.add(fn),removeEventListener:(_name:string,fn:(event:MessageEvent)=>void)=>callbacks.delete(fn)});
 try{
  const {initialHostMembers}=await import('../src/bridge');
  const incoming=[{handle:'one',name:'新成员',avatar:'/assets/one.png'},{handle:'two',name:'改名成员',avatar:'/assets/two.png'}];
  const pending=initialHostMembers();
  expect(parent.postMessage).toHaveBeenCalledWith({source:PROTOCOL,version:1,type:'members-request',payload:null},'https://fleet.test');
  for(const fn of callbacks)fn({origin:'https://fleet.test',source:parent,data:{source:PROTOCOL,version:1,type:'command',command:'set-members',members:incoming,firstLoad:true}} as unknown as MessageEvent);
  const result=await pending;expect(result?.members.map(m=>m.name)).toEqual(['新成员','改名成员']);expect(result?.firstLoad).toBe(true);expect(callbacks.size).toBe(0);
 }finally{vi.unstubAllGlobals();}
});
