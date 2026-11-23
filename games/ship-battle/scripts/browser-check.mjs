import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,writeFile,cp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=await mkdtemp(path.join(tmpdir(),'gvy-ship-browser-'));
const site=path.join(output,'site');await cp(path.join(root,'dist'),site,{recursive:true});
const cli=path.join(root,'node_modules/@playwright/cli/playwright-cli.js');
const session=`ship-battle-${process.pid}`;
const run=promisify(execFile);
const invoke=async(...args)=>{const r=await run(process.execPath,[cli,`-s=${session}`,...args],{cwd:output,maxBuffer:4*1024*1024,timeout:600000});return r.stdout;};
const server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'preview','--outDir',site,'--host','127.0.0.1','--port','5189','--strictPort'],{cwd:root,stdio:'ignore'});
let devServer;
let exited=false;server.on('exit',()=>{exited=true;});
try{
  let ready=false;
  for(let n=0;n<80;n++){if(exited)throw new Error('测试服务器启动失败，检查 5189 端口是否占用。');try{const r=await fetch('http://127.0.0.1:5189/games/ship-battle/');if(r.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,250));}
  if(!ready)throw new Error('测试服务器未就绪');
  const body=(await readFile(path.join(root,'tests/browser-smoke.js'),'utf8')).replaceAll('__OUTPUT__',output.replaceAll('\\','/')).replaceAll('__SHIP_ART__',path.join(root,'public/assets/ships').replaceAll('\\','/'));
  const script=path.join(output,'browser-smoke.js');await writeFile(script,body);
  console.log(await invoke('open','http://127.0.0.1:5189/games/ship-battle/'));
  let result;try{result=await invoke('run-code','--filename',script);}catch(e){console.error(e.stdout||e.message);console.error(`Browser artifacts: ${output}`);throw e;}console.log(result);await writeFile(path.join(output,'result.txt'),result);
  // Calibration is absent from production; retain its PNG/WebP/import/export
  // regression in a separate local Vite dev surface using the same source.
  devServer=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5190','--strictPort'],{cwd:root,stdio:'ignore'});
  let devReady=false;
  for(let n=0;n<80;n++){try{const r=await fetch('http://127.0.0.1:5190/games/ship-battle/');if(r.ok){devReady=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,250));}
  if(!devReady)throw new Error('Local calibration test server did not start');
  await invoke('goto','http://127.0.0.1:5190/games/ship-battle/');
  const devBody=(await readFile(path.join(root,'tests/browser-assets-dev.js'),'utf8')).replaceAll('__OUTPUT__',output.replaceAll('\\','/')).replaceAll('__SHIP_ART__',path.join(root,'public/assets/ships').replaceAll('\\','/'));
  const devScript=path.join(output,'browser-assets-dev.js');await writeFile(devScript,devBody);
  const devResult=await invoke('run-code','--filename',devScript);console.log(devResult);await writeFile(path.join(output,'assets-dev-result.txt'),devResult);
  console.log(`Browser screenshots and results: ${output}`);
}finally{
  try{await invoke('close');}catch{}
  server.kill('SIGTERM');
  devServer?.kill('SIGTERM');
}
