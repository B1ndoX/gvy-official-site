import assert from "node:assert/strict";
import test from "node:test";
import { initMemberBrawlDialog } from "../assets/js/member-brawl-dialog.js";

function fixture() {
  const target = () => ({
    listeners: new Map(), attributes: new Map(), dataset: {}, style: { overflow: "", setProperty(k,v) { this[k]=v; }, removeProperty(k) { delete this[k]; } },
    addEventListener(type, listener) { this.listeners.set(type, listener); },
    removeEventListener(type) { this.listeners.delete(type); },
    getAttribute(name) { return this.attributes.get(name) ?? null; },
    setAttribute(name, value) { this.attributes.set(name, value); },
    removeAttribute(name) { this.attributes.delete(name); },
    focus() { this.focused = true; },
  });
  const dialog = target(), frame = target(), viewport = target(), closeButton = target(), minimizeButton=target(), endButton=target(), restoreButton=target(), memberChoice=target(), opener = target(), view = target();
  const callbacks = new Map();let serial=0;
  Object.assign(view, {requestAnimationFrame(callback) { callbacks.set(++serial,callback);return serial; },cancelAnimationFrame(id) { callbacks.delete(id); }});
  viewport.clientWidth=960;viewport.clientHeight=600;
  dialog.showModal = () => { dialog.open = true;dialog.modal=true; };
  dialog.show = () => { dialog.open = true;dialog.modal=false; };
  dialog.close = () => { dialog.open = false;dialog.modal=false; };
  dialog.querySelector = (selector) => ({"[data-member-brawl-frame]":frame,"[data-member-brawl-viewport]":viewport,"[data-member-brawl-close]":closeButton,"[data-member-brawl-minimize]":minimizeButton,"[data-member-brawl-end]":endButton})[selector];
  memberChoice.dataset.gameSelect='members';
  dialog.querySelectorAll=selector=>selector==='[data-member-brawl-restore]'?[restoreButton]:selector==='[data-game-select]'?[memberChoice]:[];
  let observer;
  class Observer { constructor(callback) {observer=this;this.callback=callback;}observe(node) {this.observed=node;}disconnect() {this.disconnected=true;} }
  const root={body:{style:{overflow:"auto"}},querySelector:()=>dialog,querySelectorAll:()=>[opener]};
  const controller=initMemberBrawlDialog({root,view,ResizeObserverClass:Observer});
  const flush=()=>{for(const[id,callback]of callbacks){callbacks.delete(id);callback();}};
  return {root,dialog,frame,viewport,closeButton,minimizeButton,endButton,restoreButton,opener,memberChoice,view,controller,flush,observer};
}

test("opening is lazy; minimizing and restoring retain the same game viewport and release page scrolling", () => {
  const f=fixture();assert.equal(f.frame.getAttribute("src"),null);
  f.controller.open({currentTarget:f.opener});f.memberChoice.listeners.get("click")({currentTarget:f.memberChoice});f.flush();
  assert.equal(f.frame.getAttribute("src"),"./member-brawl.html");assert.equal(f.dialog.modal,true);
  assert.equal(f.root.body.style.overflow,"hidden");assert.equal(f.frame.style.transform,"none");
  f.frame.attributes.set("retained-match","one");
  f.controller.minimize();f.viewport.clientWidth=320;f.observer.callback();f.flush();
  assert.equal(f.dialog.dataset.windowState,"docked");assert.equal(f.dialog.open,true);assert.equal(f.dialog.modal,false);
  assert.equal(f.root.body.style.overflow,"auto");assert.equal(f.opener.focused,true);
  assert.equal(f.frame.getAttribute("src"),"./member-brawl.html");assert.equal(f.frame.style.width,"960px");assert.equal(f.frame.style.height,"600px");
  assert.equal(f.frame.inert,true);assert.match(f.frame.style.transform,/scale\(0\.3333/);
  f.viewport.clientWidth=960;f.controller.open({currentTarget:f.restoreButton});f.flush();
  assert.equal(f.dialog.dataset.windowState,"expanded");assert.equal(f.frame.getAttribute("retained-match"),"one");
  assert.equal(f.frame.style.transform,"none");assert.equal(f.frame.inert,false);
});

test("large close and Escape minimize, while ending the docked window unloads it and permits a new lazy session", () => {
  const f=fixture();f.controller.open({currentTarget:f.opener});f.memberChoice.listeners.get("click")({currentTarget:f.memberChoice});f.flush();
  f.closeButton.listeners.get("click")();assert.equal(f.dialog.dataset.windowState,"docked");
  f.restoreButton.listeners.get("click")();f.flush();let prevented=false;
  f.dialog.listeners.get("cancel")({preventDefault(){prevented=true;}});
  assert.equal(prevented,true);assert.equal(f.dialog.dataset.windowState,"docked");
  f.endButton.listeners.get("click")();assert.equal(f.dialog.open,false);assert.equal(f.dialog.dataset.windowState,"closed");
  assert.equal(f.frame.getAttribute("src"),null);assert.equal(f.root.body.style.overflow,"auto");
  f.controller.open({currentTarget:f.opener});f.memberChoice.listeners.get("click")({currentTarget:f.memberChoice});f.flush();assert.equal(f.dialog.modal,true);assert.equal(f.frame.getAttribute("src"),"./member-brawl.html");
  f.controller.open({currentTarget:f.opener});f.controller.close();assert.equal(f.root.body.style.overflow,"auto");
});

test("cleanup unloads a docked game and removes all owned listeners, observer and pending fit work", () => {
  const f=fixture();f.controller.open({currentTarget:f.opener});f.memberChoice.listeners.get("click")({currentTarget:f.memberChoice});f.flush();f.controller.minimize();f.controller.requestFit();
  f.controller.cleanup();f.flush();
  assert.equal(f.dialog.open,false);assert.equal(f.frame.getAttribute("src"),null);assert.equal(f.root.body.style.overflow,"auto");assert.equal(f.observer.disconnected,true);
  for(const t of [f.dialog,f.frame,f.opener,f.closeButton,f.minimizeButton,f.endButton,f.restoreButton,f.memberChoice,f.view]) assert.equal(t.listeners.size,0);
});

test("the game hub loads no game until selected and cannot keep a hidden battle alive", () => {
  const f=fixture();f.controller.open({currentTarget:f.opener});f.flush();
  assert.equal(f.frame.getAttribute('src'),null);
  assert.equal(f.dialog.dataset.activeGame,'');
  f.memberChoice.listeners.get('click')({currentTarget:f.memberChoice});f.flush();
  assert.equal(f.frame.getAttribute('src'),'./member-brawl.html');
  assert.equal(f.dialog.dataset.activeGame,'members');
  f.controller.close();
  f.controller.open({currentTarget:f.opener});f.flush();
  assert.equal(f.dialog.dataset.activeGame,'');
  assert.equal(f.frame.getAttribute('src'),null);
});
