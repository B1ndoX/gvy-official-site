import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {access,mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {promisify} from 'node:util';
import test from 'node:test';
import {galleryFixture,galleryVerifyScripts} from './fixtures.mjs';
import {parseGalleryState} from '../lib/gallery-html.mjs';
import {PublisherService} from '../lib/publisher-service.mjs';
import {contentHash} from '../lib/preview-state.mjs';
import {openPublisherWorkspace,refreshPublisherWorkspace} from '../lib/publisher-workspace.mjs';
import {galleryChecksState,publishGallerySession} from '../lib/git-release.mjs';

const exec=promisify(execFile);
const git=async(root,...args)=>(await exec('git',['-C',root,...args])).stdout.trim();
const html=galleryFixture();
async function fixture(callback){
 const base=await mkdtemp(join(tmpdir(),'gvy-isolated-publisher-'));
 const source=join(base,'developer'),remote=join(base,'remote.git');
 try{
  await mkdir(source);
  await git(source,'init','-b','main');
  await git(source,'config','user.name','Fixture');await git(source,'config','user.email','fixture@example.invalid');
  await writeFile(join(source,'index.html'),html);
  await writeFile(join(source,'notes.md'),'committed notes');
  await writeFile(join(source,'package.json'),JSON.stringify({name:'fixture',scripts:galleryVerifyScripts('node -e "process.exit(0)"')}));
  const lock=JSON.stringify({name:'fixture',lockfileVersion:3,packages:{'':{name:'fixture'}}});
  await writeFile(join(source,'package-lock.json'),lock);
  await writeFile(join(source,'.gitignore'),'node_modules/\ntools/gallery-publisher/.runtime/\n');
  const item=parseGalleryState(html).items.find(item=>item.number===4);
  for(const path of [`assets/gallery/${item.fallbackName}`,'assets/gallery/optimized/team-04-1280.webp','assets/gallery/thumbs/team-04.jpg']){
   await mkdir(dirname(join(source,path)),{recursive:true});await writeFile(join(source,path),'fixture image');
  }
  await git(source,'add','.');await git(source,'commit','-m','baseline');
  await exec('git',['init','--bare',remote]);await git(source,'remote','add','origin',remote);await git(source,'push','-u','origin','main');
  await writeFile(join(source,'notes.md'),'staged user documentation');await git(source,'add','notes.md');
  await writeFile(join(source,'notes.md'),'staged plus unstaged user documentation');
  await writeFile(join(source,'index.html'),html+'<!-- user homepage draft -->');
  await writeFile(join(source,'untracked.txt'),'untracked user work');
  const snapshot=async()=>({head:await git(source,'rev-parse','HEAD'),status:await git(source,'status','--porcelain=v1','-z'),index:await git(source,'show',':notes.md'),notes:await readFile(join(source,'notes.md'),'utf8'),html:await readFile(join(source,'index.html'),'utf8'),untracked:await readFile(join(source,'untracked.txt'),'utf8')});
  const before=await snapshot();
  const service=new PublisherService({root:source,isolated:true,officialGalleryLoader:async()=>parseGalleryState(html)});
  await service.initialize();
  // Dependencies are not part of this Git/isolation fixture. Mark the tiny
  // verifier fixture installed so no network/package installation is needed.
  await mkdir(join(service.root,'node_modules/vite'),{recursive:true});await writeFile(join(service.root,'node_modules/vite/package.json'),'{}');
  await writeFile(join(service.runtimeDir,'workspace-dependencies.json'),JSON.stringify({lock:contentHash(lock)}));
  await callback({source,remote,service,before,snapshot});
 }finally{await rm(base,{recursive:true,force:true});}
}

test('dirty staged, unstaged and untracked development work does not block an isolated preview or rollback',async()=>{
 await fixture(async({service,before,snapshot})=>{
  assert.notEqual(service.root,service.sourceRoot);
  assert.equal(await readFile(service.indexPath,'utf8'),html);
  const result=await service.createDeletePreview([4]);
  assert.equal(result.session.publishAllowed,true);assert.equal(result.repository.isolated,true);
  assert.match(result.repository.branch,/^gallery-publisher\//);
  assert.deepEqual(await snapshot(),before);
  await service.rollback();
  assert.equal(await readFile(service.indexPath,'utf8'),html);
  assert.deepEqual(await snapshot(),before);
 });
});

test('restart restores the same isolated preview and keeps recovery paths outside developer files',async()=>{
 await fixture(async({source,service,before,snapshot})=>{
  await service.createDeletePreview([4]);
  const restarted=new PublisherService({root:source,isolated:true,officialGalleryLoader:async()=>parseGalleryState(html)});await restarted.initialize();
  assert.equal(restarted.root,service.root);assert.equal(restarted.session.id,service.session.id);
  await restarted.rollback();assert.deepEqual(await snapshot(),before);
 });
});

test('external changes in the owned workspace are retained and block refresh instead of being reset',async()=>{
 await fixture(async({service,before,snapshot})=>{
  await writeFile(join(service.root,'notes.md'),'external workspace draft');
  await assert.rejects(refreshPublisherWorkspace(service.root),/已保留现场/);
  assert.equal(await readFile(join(service.root,'notes.md'),'utf8'),'external workspace draft');
  assert.deepEqual(await snapshot(),before);
 });
});

test('an existing directory without workspace ownership is never overwritten or deleted',async()=>{
 const base=await mkdtemp(join(tmpdir(),'gvy-workspace-owner-'));
 try{
  const runtime=join(base,'runtime');await mkdir(join(runtime,'site-worktree'),{recursive:true});
  await writeFile(join(runtime,'site-worktree','keep.txt'),'keep');
  await assert.rejects(openPublisherWorkspace(base,runtime),/没有归属记录/);
  assert.equal(await readFile(join(runtime,'site-worktree','keep.txt'),'utf8'),'keep');
 }finally{await rm(base,{recursive:true,force:true});}
});

const successfulPr=candidate=>({state:'OPEN',headRefOid:candidate,statusCheckRollup:['Deployable site on Node 24','Affected tools and browser checks on Node 24'].map(name=>({name,status:'COMPLETED',conclusion:'SUCCESS'}))});
test('PR gating requires both real required checks on the exact candidate and rejects cancellation or changed heads',()=>{
 const candidate='a'.repeat(40),pr=successfulPr(candidate);
 assert.equal(galleryChecksState(pr,candidate),'ready');
 assert.equal(galleryChecksState({...pr,statusCheckRollup:pr.statusCheckRollup.slice(1)},candidate),'pending');
 assert.equal(galleryChecksState({...pr,statusCheckRollup:pr.statusCheckRollup.map(c=>({...c,conclusion:'SKIPPED'}))},candidate),'pending');
 assert.throws(()=>galleryChecksState({...pr,headRefOid:'b'.repeat(40)},candidate),/提交已经改变/);
 assert.throws(()=>galleryChecksState({...pr,statusCheckRollup:[{name:'browser',conclusion:'CANCELLED'}]},candidate),/检查失败/);
 assert.throws(()=>galleryChecksState({...pr,state:'CLOSED'},candidate),/已关闭/);
});

test('publishing stages only gallery files, pushes a branch, and merges through checks without changing developer main',async()=>{
 await fixture(async({remote,service,before,snapshot})=>{
  await service.createDeletePreview([4]);
  const session=service.session,calls=[];let merged=false,verified=false;
  const githubRun=async(command,args)=>{
   calls.push(args);assert.equal(command,'gh');
   if(args[1]==='list')return {stdout:'[]'};
   if(args[1]==='create')return {stdout:'https://github.com/fixture/site/pull/1'};
   if(args[1]==='view')return {stdout:JSON.stringify({...successfulPr(session.commitSha),state:merged?'MERGED':'OPEN',mergeCommit:merged?{oid:session.commitSha}:null})};
   if(args[1]==='merge'){assert.ok(args.includes('--match-head-commit'));assert.ok(!args.includes('--admin'));merged=true;return {stdout:''};}
   throw Error('Unexpected gh call');
  };
  const options={root:service.root,session,githubRun,onMerged:async()=>{session.published=true;}};
  await assert.rejects(publishGallerySession({...options,verifyDeploymentImpl:async()=>{throw Error('temporary edge deployment delay');}}),/temporary edge/);
  assert.equal(session.published,true);assert.equal(merged,true);
  const beforeRetry=calls.filter(args=>args[1]==='create'||args[1]==='merge').length;
  await publishGallerySession({...options,verifyDeploymentImpl:async()=>{assert.equal(merged,true);verified=true;}});
  assert.equal(calls.filter(args=>args[1]==='create'||args[1]==='merge').length,beforeRetry);
  assert.equal(verified,true);assert.ok(calls.some(args=>args[1]==='merge'));
  const changed=(await git(service.root,'diff-tree','--no-commit-id','--name-only','-r',session.commitSha)).split('\n');
  assert.deepEqual(changed.sort(),session.changedFiles);
  assert.equal((await exec('git',['--git-dir',remote,'rev-parse','refs/heads/main'])).stdout.trim(),before.head);
  assert.equal((await exec('git',['--git-dir',remote,'rev-parse',`refs/heads/${session.branch}`])).stdout.trim(),session.commitSha);
  assert.deepEqual(await snapshot(),before);
  await access(session.backupPath);
 });
});
