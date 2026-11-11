// Exercise the actual, unchanged Saltline input factory outside a browser.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class Element {
  constructor(){this.listeners=new Map();this.style={};this.dataset={};this.children=[];const classes=new Set();this.classList={add:n=>classes.add(n),remove:n=>classes.delete(n),toggle:(n,on)=>on?classes.add(n):classes.delete(n),contains:n=>classes.has(n)};this.parts=new Map()}
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(fn)}
  dispatch(type,event){for(const listener of this.listeners.get(type)||[])listener(event)}
  appendChild(child){this.children.push(child)}
  querySelector(selector){if(!this.parts.has(selector))this.parts.set(selector,new Element());return this.parts.get(selector)}
}
const page=new Element(),canvas=new Element(),ui=new Element(),document=new Element();
document.documentElement=new Element();document.getElementById=id=>id==='view'?canvas:ui;document.createElement=()=>new Element();
const context=vm.createContext({document,navigator:{},performance:{now:()=>100},innerWidth:800,innerHeight:600,console,addEventListener:page.addEventListener.bind(page)});
const source=fs.readFileSync(new URL('../upstream/saltline.original.js',import.meta.url),'utf8');
const begin=source.indexOf('var fE='),end=source.indexOf('var Nt=',begin);
assert.ok(begin>0&&end>begin);
vm.runInContext(source.slice(begin,end),context);
const input=context.gE({renderer:{domElement:canvas},events:{emit(){}}});
input.setGameplay(true);
const finger=(identifier,clientX,clientY)=>({identifier,clientX,clientY});
function touch(element,type,...changedTouches){const event={changedTouches,preventDefault(){},stopPropagation(){}};if(type==='touchstart')page.dispatch(type,event);element.dispatch(type,event)}
function frame(){input.update(1/60)}
touch(canvas,'touchstart',finger(1,80,450));
touch(canvas,'touchmove',finger(1,80,392));frame();
assert.equal(input.move.x,0);assert.equal(input.move.y,1,'upward thumb drag moves forward');
const controls=ui.children[0],stick=controls.querySelector('.t-stick');
assert.equal(stick.style.transform,'translate3d(80px,450px,0)','floating joystick origin follows the first touch');
touch(canvas,'touchmove',finger(1,138,392));frame();
assert.ok(Math.abs(Math.hypot(input.move.x,input.move.y)-1)<1e-9,'diagonal is normalized');
touch(canvas,'touchstart',finger(2,650,300));
touch(canvas,'touchmove',finger(2,690,320));frame();
assert.ok(input.look.dx>0&&input.look.dy>0,'right thumb still looks while moving');
const fire=controls.querySelector('.t-fire'),jump=controls.querySelector('.t-jump');
touch(fire,'touchstart',finger(3,730,520));touch(jump,'touchstart',finger(4,650,540));frame();
assert.equal(input.fire,true);assert.equal(input.pressed('jump'),true);assert.ok(input.move.y>0,'move, look, heart and jump coexist');
input.endFrame();touch(jump,'touchend',finger(4,650,540));touch(fire,'touchend',finger(3,730,520));
touch(canvas,'touchcancel',finger(1,138,392));frame();
assert.equal(input.move.x,0);assert.equal(input.move.y,0);assert.equal(input.fire,false);
touch(canvas,'touchstart',finger(5,90,430));touch(canvas,'touchmove',finger(5,90,488));frame();
assert.equal(input.move.y,-1,'downward drag walks backward');
input.setGameplay(false);frame();assert.equal(input.move.y,0);assert.equal(input.move.x,0);
input.setGameplay(true);touch(canvas,'touchstart',finger(6,75,440));touch(canvas,'touchmove',finger(6,104,440));frame();
assert.equal(input.move.x,.5,'joystick works again after pause/resume');
page.dispatch('blur',{});frame();assert.equal(input.move.x,0);

// The regression was hit-testing: a pointer-active overlay covered the canvas.
const css=fs.readFileSync(new URL('../style.css',import.meta.url),'utf8');
const rule=selector=>css.match(new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\{([^}]+)\\}'))?.[1]||'';
assert.match(rule('.t-stick'),/pointer-events:none/);
assert.match(rule('.t-stick'),/left:0;top:0;width:0;height:0/);
assert.match(rule('.t-ring'),/pointer-events:none/);
assert.match(rule('.t-nub'),/pointer-events:none/);
assert.match(rule('.touch button'),/pointer-events:auto/,'heart and jump buttons retain touch hit targets');
console.log('Passed original Saltline touch input: movement, diagonal, multitouch look + heart + jump, cancellation, pause/resume, blur, and joystick hit-testing CSS.');
