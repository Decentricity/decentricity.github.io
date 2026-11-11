import * as THREE from './vendor/three.module.js';
import {HALF, foldSurface, faceId} from './cube.js';

const $ = id => document.getElementById(id);
const V = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
const storageKey = 'flipsidehearts.v1';
const touch = matchMedia('(pointer: coarse)').matches;
let saved={};
try { saved=JSON.parse(localStorage.getItem(storageKey)||'{}')||{}; } catch {}
const settings={sound:true,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,sensitivity:1,...saved.settings};
settings.sensitivity=THREE.MathUtils.clamp(Number(settings.sensitivity)||1,.3,2);
const names=['Poppy','Mallow','Clover','Peach','Juniper','Pip'];
const friends=new Set((Array.isArray(saved.friends)?saved.friends:[]).filter(n=>names.includes(n)));
let picnicDone=!!saved.picnicDone, mode='menu', settingsFrom='menu', ready=false;
let renderer,scene,camera,clock,worldGroup,heartTexture,petals;
let elapsed=0,toastTime=0,heartCooldown=0,fadeTime=0,placeTime=0,lastPlace='';
let target=null,audio=null,ambientNext=0,picnicView=false;
const keys=new Set(),look={x:0,y:0},joystick={x:0,y:0};
const player={pos:V(0,HALF,5.8),normal:V(0,1,0),forward:V(0,0,-1),pitch:0};
const cameraQ=new THREE.Quaternion(),targetQ=new THREE.Quaternion();
const upSmooth=V(0,1,0),camSmooth=V(),raycaster=new THREE.Raycaster();
const characters=[],obstacles=[],occluders=[],hearts=[],decorations=[],clouds=[];
const faceDefs=[
  {id:'+Y',name:'The picnic lawn',n:[0,1,0],u:[1,0,0],v:[0,0,1],grass:0xaebc86,flower:0xe6a1b0,npc:[-3,-2],friend:'Poppy',kind:'plain'},
  {id:'+Z',name:'The sleepy meadow',n:[0,0,1],u:[1,0,0],v:[0,-1,0],grass:0xb6c490,flower:0xf0d485,npc:[3,-2],friend:'Mallow',kind:'wizard'},
  {id:'+X',name:'Clover’s flower patch',n:[1,0,0],u:[0,0,-1],v:[0,-1,0],grass:0xa4bd91,flower:0xf0b5bc,npc:[-3,2],friend:'Clover',kind:'plain'},
  {id:'-Z',name:'The little orchard',n:[0,0,-1],u:[-1,0,0],v:[0,-1,0],grass:0xbbc38f,flower:0xefbd86,npc:[2,3],friend:'Peach',kind:'plain'},
  {id:'-X',name:'The mushroom grove',n:[-1,0,0],u:[0,0,1],v:[0,-1,0],grass:0xa6b49a,flower:0xd1bedb,npc:[-2,-3],friend:'Juniper',kind:'wizard'},
  {id:'-Y',name:'The cottage garden',n:[0,-1,0],u:[1,0,0],v:[0,0,-1],grass:0xb9c597,flower:0xe9c875,npc:[2,2],friend:'Pip',kind:'plain'}
];
const messages={Poppy:'“Oh! For me? I saved you a spot on the blanket.”',Mallow:'“A tiny spell of kindness. My favourite kind.”',Clover:'“You make the flowers grow a little taller.”',Peach:'“You’re sweet as a peach. Here, have a smile.”',Juniper:'“The world feels softer with you in it.”',Pip:'“I was hoping someone would say hello.”'};

function save(){try{localStorage.setItem(storageKey,JSON.stringify({friends:[...friends],settings,picnicDone}))}catch{}}
function toast(text,seconds=4){$('toast').textContent=text;$('toast').classList.add('show');toastTime=seconds}
function fatal(error){console.error(error);$('fatal-message').textContent='This garden needs WebGL 2 and its little art files to open. Try a current browser with hardware acceleration, then refresh. Your saved friends are safe.';$('fatal').hidden=false}
function mat(color,extra={}){return new THREE.MeshStandardMaterial({color,roughness:.96,...extra})}
const materials=new Map();
function colorMat(color){if(!materials.has(color))materials.set(color,mat(color));return materials.get(color)}
function mesh(geometry,color,parent,pos=[0,0,0]){const m=new THREE.Mesh(geometry,typeof color==='number'?colorMat(color):color);m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
function box(parent,x,y,z,w,h,d,color){return mesh(new THREE.BoxGeometry(w,h,d),color,parent,[x,y,z])}
function sphere(parent,x,y,z,r,color,scale=[1,1,1]){const m=mesh(new THREE.IcosahedronGeometry(r,2),color,parent,[x,y,z]);m.scale.set(...scale);return m}
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function faceWorld(def,x=0,y=0,z=0){return V(...def.n).multiplyScalar(HALF+y).addScaledVector(V(...def.u),x).addScaledVector(V(...def.v),z)}
function addObstacle(def,x,z,r){obstacles.push({face:def.id,x,z,r})}

function flower(parent,x,z,color,size=1){
  const g=new THREE.Group();g.position.set(x,.1,z);g.scale.setScalar(size);parent.add(g);
  const stem=mesh(new THREE.CylinderGeometry(.018,.025,.38,5),0x6c8d5b,g,[0,.19,0]);stem.castShadow=false;
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5;sphere(g,Math.cos(a)*.105,.4,Math.sin(a)*.105,.09,color,[1,.6,1])}
  sphere(g,0,.43,0,.06,0xf5dc8b);return g;
}
function tree(def,x,z,fruit=false){
  const parent=def.group;const h=fruit?2.4:2.9;
  mesh(new THREE.CylinderGeometry(.17,.26,h,7),0xa79171,parent,[x,h/2,z]);
  const top=sphere(parent,x,h+.35,z,1.55,fruit?0xa4b57b:0x8fa980,[1,1.05,1]);
  sphere(parent,x-.7,h+.2,z+.3,1.05,0xaabd89);
  if(fruit)for(let i=0;i<5;i++){const a=i*2.4;sphere(parent,x+Math.cos(a)*1.24,h+.2+(i%2)*.6,z+Math.sin(a)*1.24,.16,0xe8b28b)}
  occluders.push(top);addObstacle(def,x,z,.48);
}
function mushroom(parent,x,z,size,color){
  mesh(new THREE.CylinderGeometry(.12*size,.18*size,.6*size,8),0xf6ebd7,parent,[x,.3*size,z]);
  const cap=mesh(new THREE.SphereGeometry(.48*size,12,8,0,Math.PI*2,0,Math.PI/2),color,parent,[x,.6*size,z]);
  for(let i=0;i<4;i++){const a=i*2.1;sphere(parent,x+Math.cos(a)*.23*size,.91*size,z+Math.sin(a)*.23*size,.055*size,0xfff0da)}
  return cap;
}
function cottage(def,x,z){
  const p=new THREE.Group();p.position.set(x,0,z);def.group.add(p);
  const house=box(p,0,1,0,2.7,2,2.4,0xf0e3c7);occluders.push(house);
  const roof=mesh(new THREE.ConeGeometry(2.25,1.6,4),0xc28d80,p,[0,2.7,0]);roof.rotation.y=Math.PI/4;
  box(p,0,.65,1.22,.7,1.3,.06,0x9cac87);sphere(p,.2,.6,1.28,.04,0xe7c98a);
  for(const side of [-1,1]){box(p,side*.85,1.25,1.23,.55,.65,.05,0xfdf0c6);box(p,side*.85,1.25,1.27,.045,.68,.03,0xb6a187);box(p,side*.85,1.25,1.27,.58,.045,.03,0xb6a187)}
  box(p,1,3,0,.35,.9,.4,0xc1aa91);addObstacle(def,x,z,1.8);
  for(let i=0;i<5;i++)flower(def.group,x-1.5+i*.7,z+1.7,0xe6b2b9,.8);
}
function sign(def,x,z,text){
  const p=def.group;box(p,x,.55,z,.09,1.1,.09,0xac9473);
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=160;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#eee4ca';ctx.fillRect(0,0,512,160);ctx.strokeStyle='#c7b99b';ctx.lineWidth=8;ctx.strokeRect(4,4,504,152);ctx.fillStyle='#5d7156';ctx.font='500 31px Georgia';ctx.textAlign='center';ctx.fillText(text,256,91);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  mesh(new THREE.BoxGeometry(1.9,.58,.09),mat(0xeee4ca),p,[x,1,z]);
  const front=mesh(new THREE.PlaneGeometry(1.9,.58),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}),p,[x,1,z+.052]);
  front.castShadow=false;
}
function picnic(parent){
  const cloth=box(parent,0,.09,0,3.4,.035,2.7,0xf1d4c9);
  for(let i=-3;i<=3;i++)box(parent,i*.45,.112,0,.19,.006,2.65,0xf9e9d8);
  for(let i=-2;i<=2;i++)box(parent,0,.117,i*.45,3.35,.006,.17,0xf9e9d8);
  box(parent,.8,.35,-.35,.75,.5,.58,0xc4a37d);
  const handle=mesh(new THREE.TorusGeometry(.3,.035,6,16,Math.PI),0xb38b64,parent,[.8,.62,-.35]);handle.rotation.y=Math.PI/2;
  for(const [x,z] of [[-.7,.25],[.3,.7]]){mesh(new THREE.CylinderGeometry(.25,.23,.035,16),0xfff8e5,parent,[x,.15,z]);sphere(parent,x,.22,z,.12,0xe9b28c)}
  mesh(new THREE.CylinderGeometry(.12,.09,.23,12),0xf7ecdc,parent,[-.2,.25,-.4]);
  return cloth;
}
function makeFace(def,index){
  const g=new THREE.Group();def.group=g;g.position.copy(V(...def.n).multiplyScalar(HALF));
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(...def.u),V(...def.n),V(...def.v)));worldGroup.add(g);
  box(g,0,-.04,0,18,.12,18,def.grass);
  box(g,0,.025,0,1.45,.025,18,0xece3c9);box(g,0,.028,0,18,.025,1.45,0xece3c9);
  const r=rng(892+index*29);
  // Soft tile borders make the six-faced Cubewalker geometry legible.
  for(let i=-3;i<=3;i++){box(g,i*2.5,.035,0,.025,.014,17.8,0xcbd2a5);box(g,0,.035,i*2.5,17.8,.014,.025,0xcbd2a5)}
  for(let i=0;i<65;i++){
    const x=(r()-.5)*16,z=(r()-.5)*16;
    if(Math.abs(x)<1||Math.abs(z)<1||Math.hypot(x-def.npc[0],z-def.npc[1])<1.7)continue;
    if(index===0&&Math.hypot(x,z)<3)continue;
    flower(g,x,z,i%4===0?0xfff0cc:def.flower,.55+r()*.65);
  }
  for(let i=0;i<26;i++){
    const x=(r()-.5)*17,z=(r()-.5)*17;if(Math.abs(x)<1||Math.abs(z)<1)continue;
    const tuft=mesh(new THREE.ConeGeometry(.09,.33,3),0x8fa77b,g,[x,.16,z]);tuft.rotation.z=(r()-.5)*.4;tuft.castShadow=false;
  }
  if(index===0){picnic(g);tree(def,-5,-5);tree(def,5,-4);sign(def,2,4,'a little love goes a long way')}
  if(index===1){tree(def,-5,-4);tree(def,-5,4);mushroom(g,5,4,1.4,0xd7a2a4);sign(def,-2,3,'take your time')}
  if(index===2){tree(def,5,5);for(let i=0;i<7;i++)for(let j=0;j<3;j++)flower(g,2+i*.5,-5+j*.55,0xe8a8ba,1.15);sign(def,-3,-3,'you belong here')}
  if(index===3){for(const [x,z] of [[-5,-4],[-5,4],[5,-4]])tree(def,x,z,true);sign(def,-2,3,'sweet little things')}
  if(index===4){for(const [x,z,s]of [[-5,3,2.4],[4,-4,2],[5,4,1.7],[-4,-5,1.2]])mushroom(g,x,z,s,0xc7a6b6);tree(def,-5,-5);sign(def,2,3,'a pocket of quiet')}
  if(index===5){cottage(def,-4,-4);tree(def,5,4,true);sign(def,-2,3,'hello, lovely')}
  for(const [x,z]of [[-6.8,0],[6.8,0],[0,-6.8],[0,6.8]]){
    // Petal-shaped stepping stones gently invite the player across edges.
    const stone=mesh(new THREE.CylinderGeometry(.26,.29,.06,8),0xf8eed6,g,[x,.07,z]);stone.scale.z=.7;
  }
}
function batchGarden(def){
  // Combine static props by material: hundreds of flowers become a few draws.
  const group=def.group,batches=new Map();group.updateMatrixWorld(true);
  const inverse=group.matrixWorld.clone().invert();
  group.traverse(object=>{
    if(!object.isMesh)return;
    const key=object.material.uuid+':'+object.castShadow;
    if(!batches.has(key))batches.set(key,{material:object.material,cast:object.castShadow,geometries:[]});
    const geometry=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();
    geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,object.matrixWorld));
    batches.get(key).geometries.push(geometry);
  });
  group.clear();
  for(const batch of batches.values()){
    const merged=new THREE.BufferGeometry();
    for(const attribute of ['position','normal','uv']){
      const size=attribute==='uv'?2:3;
      const length=batch.geometries.reduce((total,g)=>total+g.getAttribute(attribute).array.length,0);
      const data=new Float32Array(length);let offset=0;
      for(const g of batch.geometries){const a=g.getAttribute(attribute).array;data.set(a,offset);offset+=a.length}
      merged.setAttribute(attribute,new THREE.BufferAttribute(data,size));
    }
    const object=new THREE.Mesh(merged,batch.material);object.castShadow=batch.cast;object.receiveShadow=true;group.add(object);
    for(const geometry of batch.geometries)geometry.dispose();
  }
}
function makeTexture(draw,w=128,h=128){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
function makeHeartTexture(){return makeTexture((c,w,h)=>{c.fillStyle='#d8849c';c.shadowColor='#ffdce7';c.shadowBlur=8;c.beginPath();c.moveTo(w/2,h*.85);c.bezierCurveTo(-w*.2,h*.4,w*.15,-h*.1,w/2,h*.3);c.bezierCurveTo(w*.85,-h*.1,w*1.2,h*.4,w/2,h*.85);c.fill()})}
async function loadCharacter(url){
  const image=await new THREE.TextureLoader().loadAsync(url);
  // Crop transparent padding so original illustrations share a consistent height.
  const img=image.image,c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
  const pixels=ctx.getImageData(0,0,c.width,c.height).data;let minX=c.width,minY=c.height,maxX=0,maxY=0;
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(pixels[(y*c.width+x)*4+3]>25){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)}
  const cropped=document.createElement('canvas');cropped.width=maxX-minX+1;cropped.height=maxY-minY+1;cropped.getContext('2d').drawImage(c,minX,minY,cropped.width,cropped.height,0,0,cropped.width,cropped.height);
  const texture=new THREE.CanvasTexture(cropped);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;image.dispose();return texture;
}
function createCharacter(def,index,texture){
  const root=new THREE.Group();root.position.copy(faceWorld(def,...[def.npc[0],.1,def.npc[1]]));worldGroup.add(root);
  const height=def.kind==='wizard'?2.15:1.85,width=height*texture.image.width/texture.image.height;
  const body=new THREE.Group();root.add(body);
  const plane=mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.08,side:THREE.DoubleSide}),body,[0,height/2,0]);plane.castShadow=false;
  const shadow=mesh(new THREE.CircleGeometry(.53,24),new THREE.MeshBasicMaterial({color:0x587349,transparent:true,opacity:.16,depthWrite:false}),root,[0,.015,0]);shadow.rotation.x=-Math.PI/2;
  const heart=new THREE.Sprite(new THREE.SpriteMaterial({map:heartTexture,transparent:true,opacity:.85,depthTest:true}));heart.position.set(0,height+.5,0);heart.scale.setScalar(.32);root.add(heart);
  const labelTexture=makeTexture((ctx,w,h)=>{ctx.fillStyle='#fff8e9';ctx.beginPath();ctx.roundRect(0,0,w,h,25);ctx.fill();ctx.fillStyle='#576a50';ctx.font='36px Georgia';ctx.textAlign='center';ctx.fillText(def.friend,w/2,49)},256,80);
  const label=mesh(new THREE.PlaneGeometry(1.35,.42),new THREE.MeshBasicMaterial({map:labelTexture,transparent:true,side:THREE.DoubleSide,depthWrite:false}),root,[0,-.0,.12]);label.position.y=height+.92;label.castShadow=false;
  characters.push({name:def.friend,def,root,body,height,heart,label,index,hop:0,base:root.position.clone(),normal:V(...def.n),friend:friends.has(def.friend),meeting:false});
}
function buildSky(){
  scene.background=new THREE.Color(0xe8ebdf);scene.fog=new THREE.FogExp2(0xe8ebdf,.007);
  const random=rng(89);
  for(let i=0;i<24;i++){
    const g=new THREE.Group();const a=random()*Math.PI*2,r=36+random()*35;g.position.set(Math.cos(a)*r,(random()-.2)*45,Math.sin(a)*r);
    const cloudMat=new THREE.MeshBasicMaterial({color:0xfaf7e9,transparent:true,opacity:.62,depthWrite:false});
    for(let j=0;j<3;j++)sphere(g,j*1.6,Math.sin(j)*.3,0,1.5+j*.2,cloudMat,[1.6,.6,1]);scene.add(g);clouds.push(g);
  }
  const count=110,positions=new Float32Array(count*3);for(let i=0;i<count;i++){positions[i*3]=(random()-.5)*80;positions[i*3+1]=(random()-.5)*70;positions[i*3+2]=(random()-.5)*80}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
  petals=new THREE.Points(geo,new THREE.PointsMaterial({color:0xfff7de,size:.1,transparent:true,opacity:.8}));scene.add(petals);
}

function initAudio(){
  if(!settings.sound)return;
  try{audio??=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{})}catch{}
}
function chime(frequency=523,volume=.07,duration=.6,delay=0){
  if(!audio||!settings.sound||audio.state!=='running')return;
  const o=audio.createOscillator(),gain=audio.createGain();o.type='sine';o.frequency.value=frequency;
  const start=audio.currentTime+delay;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume,start+.015);gain.gain.exponentialRampToValueAtTime(.001,start+duration);o.connect(gain);gain.connect(audio.destination);o.start(start);o.stop(start+duration+.01);o.onended=()=>{o.disconnect();gain.disconnect()};
}
function loveSound(){chime(523,.08,.65);chime(659,.06,.8,.1);chime(784,.04,.9,.22)}
function countUpdate(){
  $('friends-count').textContent=`${friends.size?'♥':'♡'} ${friends.size} / 6 friends`;
  $('picnic-button').hidden=mode!=='playing'||friends.size!==6||picnicDone;
  $('new-game').hidden=friends.size===0;
}
function syncSettings(){for(const [id,key]of [['sound','sound'],['reduced-motion','reducedMotion']])$(id).checked=!!settings[key];$('sensitivity').value=settings.sensitivity}
function clearInput(){keys.clear();joystick.x=joystick.y=0;look.x=look.y=0;$('joystick-knob').style.transform='';}
function requestCapture(){if(!touch){const result=renderer.domElement.requestPointerLock?.();result?.catch?.(()=>toast('Click the garden to look around, or drag to look.',3))}}
function releaseCapture(){if(document.pointerLockElement)document.exitPointerLock()}
function showMode(next){
  mode=next;clearInput();
  $('welcome').hidden=next!=='menu';$('pause').hidden=next!=='paused';$('celebration').hidden=next!=='celebration';
  for(const id of ['hud','place','reticle'])$(id).hidden=next!=='playing';
  $('desktop-hint').hidden=next!=='playing'||touch;$('touch-controls').hidden=next!=='playing'||!touch;
  $('capture').hidden=true;$('interaction').hidden=true;countUpdate();
  if(next!=='playing')releaseCapture();
}
function snapCamera(){
  upSmooth.copy(player.normal);camSmooth.copy(player.pos).addScaledVector(player.normal,1.05);setTargetQuaternion();cameraQ.copy(targetQ);camera.quaternion.copy(cameraQ);camera.position.copy(camSmooth);
}
function start(newGame=false){
  if(!ready)return;
  if(newGame){if(!confirm('Begin a brand-new day? Your saved friendships will start over.'))return;friends.clear();picnicDone=false;for(const c of characters){c.friend=false;c.meeting=false;c.normal.set(...c.def.n);c.root.position.copy(c.base)}save()}
  picnicView=false;player.pos.set(0,HALF,5.8);player.normal.set(0,1,0);player.forward.set(0,0,-1);player.pitch=-.06;snapCamera();
  showMode('playing');initAudio();requestCapture();toast(friends.size?'Welcome back. Your little friends missed you.':'Six little friends. One on every side. Send them a heart ♡',5);
}
function setTargetQuaternion(){
  const right=V().crossVectors(player.forward,player.normal).normalize();
  const direction=player.forward.clone().applyAxisAngle(right,player.pitch);
  const cameraUp=V().crossVectors(right,direction).normalize();
  targetQ.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,cameraUp,direction.negate()));
}
function blocked(position,normal){
  const def=faceDefs.find(d=>d.id===faceId(normal.toArray()));
  const x=position.dot(V(...def.u)),z=position.dot(V(...def.v));
  return obstacles.some(o=>o.face===def.id&&Math.hypot(x-o.x,z-o.z)<o.r+.32);
}
function movePlayer(dt){
  if(look.x){player.forward.applyAxisAngle(player.normal,-look.x*.0022*settings.sensitivity);player.forward.addScaledVector(player.normal,-player.forward.dot(player.normal)).normalize()}
  player.pitch=THREE.MathUtils.clamp(player.pitch-look.y*.0022*settings.sensitivity,-1.15,1.1);look.x=look.y=0;
  let x=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+joystick.x;
  let z=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-joystick.y;
  const length=Math.hypot(x,z);if(length>1){x/=length;z/=length}
  const right=V().crossVectors(player.forward,player.normal).normalize();
  const movement=player.forward.clone().multiplyScalar(z).addScaledVector(right,x).multiplyScalar(dt*(keys.has('ShiftLeft')?3.6:2.7));
  if(length>.01){
    const candidate=player.pos.clone().add(movement);
    const folded=foldSurface(candidate.toArray(),player.normal.toArray(),player.forward.toArray());
    const next=V(...folded.position),normal=V(...folded.normal);
    if(!blocked(next,normal)){player.pos.copy(next);player.normal.copy(normal);player.forward.set(...folded.heading).normalize();
      if(folded.turns&&settings.reducedMotion){fadeTime=.36;snapCamera()}
    }else{
      // Slide along garden objects rather than sticking at their edges.
      for(const direction of [player.forward,right]){
        const p=player.pos.clone().addScaledVector(direction,movement.dot(direction));
        if(Math.max(...p.toArray().map(Math.abs))<=HALF+.00001&&!blocked(p,player.normal))player.pos.copy(p);
      }
    }
  }
  setTargetQuaternion();cameraQ.slerp(targetQ,1-Math.exp(-dt*9));camera.quaternion.copy(cameraQ);
  upSmooth.lerp(player.normal,1-Math.exp(-dt*10)).normalize();
  const desired=player.pos.clone().addScaledVector(upSmooth,1.05);camSmooth.lerp(desired,1-Math.exp(-dt*15));camera.position.copy(camSmooth);
  const place=faceDefs.find(d=>d.id===faceId(player.normal.toArray()));
  if(place.name!==lastPlace){lastPlace=place.name;$('place-name').textContent=place.name;placeTime=5}
}
function acquireTarget(){
  camera.updateMatrixWorld();raycaster.setFromCamera(new THREE.Vector2(0,0),camera);
  let best=null,bestDistance=9;
  for(const c of characters){
    if(c.normal.dot(player.normal)<.95)continue;
    const center=c.root.position.clone().addScaledVector(c.normal,c.height*.55);
    const hit=raycaster.ray.intersectSphere(new THREE.Sphere(center,c.height*.52),V());
    if(hit){const distance=camera.position.distanceTo(hit);if(distance<bestDistance){bestDistance=distance;best=c}}
  }
  if(best){raycaster.far=bestDistance;const hits=raycaster.intersectObjects(occluders,false);raycaster.far=Infinity;if(hits.length)best=null}
  target=best;$('reticle').classList.toggle('active',!!best);$('interaction').hidden=!best;
  if(best){$('target-name').textContent=best.name+(best.friend?' · your friend':'');document.querySelector('#interaction .key').textContent=touch?'tap ♡':'click'}
}
function heartSprite(pos,size=.25){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:heartTexture,transparent:true,depthWrite:false}));s.position.copy(pos);s.scale.setScalar(size);scene.add(s);return s}
function burst(c){for(let i=0;i<7;i++){const right=V(...c.def.u),forward=V(...c.def.v);const origin=c.root.position.clone().addScaledVector(c.normal,c.height*.8);const sprite=heartSprite(origin,.16+Math.random()*.15);hearts.push({sprite,origin,age:0,duration:1.5,velocity:c.normal.clone().multiplyScalar(.7+Math.random()).addScaledVector(right,(Math.random()-.5)*1.8).addScaledVector(forward,(Math.random()-.5)*1.8),burst:true})}}
function sendHeart(){
  if(mode!=='playing'||heartCooldown>0)return;heartCooldown=.6;initAudio();
  acquireTarget();
  const direction=V();camera.getWorldDirection(direction);const right=V(1,0,0).applyQuaternion(camera.quaternion);
  const origin=camera.position.clone().addScaledVector(direction,.65).addScaledVector(player.normal,-.3).addScaledVector(right,.2);
  const recipient=target;const end=recipient?recipient.root.position.clone().addScaledVector(recipient.normal,recipient.height*.65):origin.clone().addScaledVector(direction,3.4).addScaledVector(player.normal,.4);
  const control=origin.clone().lerp(end,.5).addScaledVector(player.normal,.65);
  const sprite=heartSprite(origin,.24);hearts.push({sprite,origin,end,control,age:0,duration:recipient?.65:1.2,recipient});chime(440,.025,.4);
}
function receiveHeart(c){
  c.hop=1;burst(c);loveSound();
  if(!friends.has(c.name)){friends.add(c.name);c.friend=true;save();countUpdate();toast(`${c.name} ${messages[c.name]}`,5);if(friends.size===6){setTimeout(()=>{if(mode==='playing')toast('Every little heart found a home. A picnic is waiting ♡',6)},4500)}}
  else toast(`${c.name} sends a little love right back. ♡`,2.8);
}
function updateHearts(dt){
  for(let i=hearts.length-1;i>=0;i--){const h=hearts[i];h.age+=dt;const t=Math.min(1,h.age/h.duration);
    if(h.burst)h.sprite.position.copy(h.origin).addScaledVector(h.velocity,h.age);
    else h.sprite.position.copy(h.origin).multiplyScalar((1-t)**2).addScaledVector(h.control,2*(1-t)*t).addScaledVector(h.end,t*t);
    h.sprite.material.opacity=h.burst||!h.recipient?Math.sin(Math.PI*Math.min(.99,t)):.9;
    h.sprite.scale.setScalar((h.burst?.25:.26)*(1+.4*Math.sin(t*Math.PI)));
    if(t>=1){scene.remove(h.sprite);h.sprite.material.dispose();hearts.splice(i,1);if(h.recipient)receiveHeart(h.recipient)}
  }
}
function updateCharacters(dt){
  for(const c of characters){
    const toCamera=camera.position.clone().sub(c.root.position);toCamera.addScaledVector(c.normal,-toCamera.dot(c.normal));
    if(toCamera.lengthSq()>.001){toCamera.normalize();const right=V().crossVectors(c.normal,toCamera).normalize();c.root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,c.normal,toCamera))}
    c.hop=Math.max(0,c.hop-dt*1.6);const bob=settings.reducedMotion?0:Math.sin(elapsed*1.8+c.index)*.035;
    c.body.position.y=bob+Math.sin(c.hop*Math.PI)*.35;
    c.body.rotation.z=settings.reducedMotion?0:Math.sin(elapsed*1.2+c.index)*.018;
    c.heart.position.y=c.height+.5+(settings.reducedMotion?0:Math.sin(elapsed*2+c.index)*.06);
    c.heart.material.opacity=c.friend?.9:.42;c.heart.scale.setScalar(c.friend?.32:.23);
    const distance=camera.position.distanceTo(c.root.position);c.label.visible=mode==='playing'&&distance<7;
  }
}
function joinPicnic(){
  if(friends.size!==6)return;
  picnicDone=true;picnicView=true;save();
  const home=faceDefs[0];
  characters.forEach((c,i)=>{const a=i/6*Math.PI*2;c.root.position.copy(faceWorld(home,Math.cos(a)*2.5,.1,Math.sin(a)*2.5));c.normal.set(0,1,0);c.meeting=true;c.hop=1});
  fadeTime=.8;showMode('celebration');loveSound();setTimeout(()=>loveSound(),700);
}
function overview(dt){
  const targetPosition=picnicView?V(8,19,11):V(25,22,28);
  if(!picnicView){targetPosition.x+=Math.sin(elapsed*.09)*2;targetPosition.z+=Math.cos(elapsed*.09)*2}
  camera.position.lerp(targetPosition,1-Math.exp(-dt*2));
  const aim=picnicView?V(0,9,0):V(-2,1,0);camera.up.set(0,1,0);camera.lookAt(aim);
}
function animate(){
  const dt=Math.min(clock.getDelta(),.045);elapsed+=dt;heartCooldown=Math.max(0,heartCooldown-dt);
  if(mode==='playing'){movePlayer(dt);acquireTarget();}
  else if(mode==='menu'||mode==='celebration')overview(dt);
  updateCharacters(dt);updateHearts(dt);
  if(toastTime>0){toastTime-=dt;if(toastTime<=0)$('toast').classList.remove('show')}
  if(fadeTime>0){fadeTime=Math.max(0,fadeTime-dt);$('fade').style.opacity=Math.min(1,fadeTime/.25)}else $('fade').style.opacity=0;
  if(!settings.reducedMotion){petals.rotation.y=elapsed*.012;petals.position.y=Math.sin(elapsed*.08)*2;for(let i=0;i<clouds.length;i++)clouds[i].position.x+=Math.sin(elapsed*.05+i)*dt*.02}
  if(mode==='playing'&&settings.sound&&elapsed>ambientNext){ambientNext=elapsed+5+Math.random()*8;chime([262,330,392,440][Math.floor(Math.random()*4)],.009,2)}
  renderer.render(scene,camera);
}
function openSettings(){settingsFrom=mode;showMode('settings');$('settings').hidden=false;syncSettings()}
function bindUI(){
  $('play').onclick=()=>start();$('new-game').onclick=()=>start(true);$('retry').onclick=()=>location.reload();
  $('pause-button').onclick=()=>showMode('paused');$('resume').onclick=()=>{showMode('playing');initAudio();requestCapture()};
  $('back-home').onclick=()=>{picnicView=false;showMode('menu')};
  $('intro-settings').onclick=openSettings;$('pause-settings').onclick=openSettings;
  $('close-settings').onclick=()=>{$('settings').hidden=true;showMode(settingsFrom);save()};
  for(const [id,key]of [['sound','sound'],['reduced-motion','reducedMotion']])$(id).onchange=e=>{settings[key]=e.target.checked;save();if(key==='sound'&&settings.sound)initAudio()};
  $('sensitivity').oninput=e=>{settings.sensitivity=Number(e.target.value);save()};
  $('picnic-button').onclick=joinPicnic;
  $('keep-exploring').onclick=()=>{picnicView=false;player.pos.set(0,HALF,5.8);player.normal.set(0,1,0);player.forward.set(0,0,-1);player.pitch=-.06;snapCamera();showMode('playing');requestCapture();toast('Stay as long as you like. There’s no last hello. ♡',4)};
  $('capture').onclick=()=>{requestCapture();$('capture').hidden=true};
  document.addEventListener('keydown',e=>{
    if(e.code==='Escape'){if(mode==='playing')showMode('paused');else if(mode==='paused'){showMode('playing');requestCapture()}return}
    if(mode!=='playing'||e.target instanceof HTMLInputElement)return;
    if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();keys.add(e.code);
    if(e.code==='KeyE'||e.code==='Space')sendHeart();
  });document.addEventListener('keyup',e=>keys.delete(e.code));
  window.addEventListener('blur',()=>{if(mode==='playing')showMode('paused');else clearInput()});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')showMode('paused')});
  document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&mode==='playing')showMode('paused')});
  document.addEventListener('mousemove',e=>{if(mode==='playing'&&document.pointerLockElement===renderer.domElement){look.x+=e.movementX;look.y+=e.movementY}});
  const canvas=renderer.domElement;let drag=null;
  canvas.addEventListener('pointerdown',e=>{
    if(mode!=='playing')return;initAudio();
    if(touch){if(e.clientX>window.innerWidth*.35){drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId)}}
    else if(document.pointerLockElement===canvas)sendHeart();
    else {drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);requestCapture()}
  });
  canvas.addEventListener('pointermove',e=>{if(mode==='playing'&&drag?.id===e.pointerId&&document.pointerLockElement!==canvas){look.x+=(e.clientX-drag.x)*1.5;look.y+=(e.clientY-drag.y)*1.5;drag.x=e.clientX;drag.y=e.clientY}});
  canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  let stickId=null;
  function stickMove(e){if(stickId!==e.pointerId)return;const r=$('joystick').getBoundingClientRect();let x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;const l=Math.hypot(x,y);if(l>32){x*=32/l;y*=32/l}joystick.x=x/32;joystick.y=y/32;$('joystick-knob').style.transform=`translate(${x}px,${y}px)`}
  $('joystick').onpointerdown=e=>{stickId=e.pointerId;$('joystick').setPointerCapture(e.pointerId);stickMove(e)};$('joystick').onpointermove=stickMove;
  for(const event of ['pointerup','pointercancel','lostpointercapture'])$('joystick').addEventListener(event,()=>{stickId=null;joystick.x=joystick.y=0;$('joystick-knob').style.transform=''});
  $('touch-heart').onpointerdown=e=>{e.preventDefault();sendHeart()};
  window.addEventListener('resize',()=>{camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,touch?1.5:2))});
}
async function boot(){
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setSize(window.innerWidth,window.innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,touch?1.5:2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  renderer.shadowMap.enabled=!touch;renderer.shadowMap.type=THREE.PCFSoftShadowMap;$('world').appendChild(renderer.domElement);
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(64,window.innerWidth/window.innerHeight,.05,220);camera.position.set(25,22,28);clock=new THREE.Clock();
  scene.add(new THREE.AmbientLight(0xfffae9,2));const sun=new THREE.DirectionalLight(0xfff1d2,2.2);sun.position.set(12,26,16);sun.castShadow=!touch;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-22,right:22,top:22,bottom:-22,near:1,far:80});sun.shadow.bias=-.001;sun.shadow.normalBias=.04;scene.add(sun);
  const fill=new THREE.DirectionalLight(0xe6edf2,1.2);fill.position.set(-15,-20,-10);scene.add(fill);
  worldGroup=new THREE.Group();scene.add(worldGroup);mesh(new THREE.BoxGeometry(17.98,17.98,17.98),0xdfd3b3,worldGroup);buildSky();
  faceDefs.forEach(makeFace);scene.updateMatrixWorld(true);faceDefs.forEach(batchGarden);heartTexture=makeHeartTexture();
  const [plain,wizard]=await Promise.all([loadCharacter('assets/hedgey.png'),loadCharacter('assets/hedgey-wizard.webp')]);
  faceDefs.forEach((d,i)=>createCharacter(d,i,d.kind==='wizard'?wizard:plain));
  scene.updateMatrixWorld(true);bindUI();syncSettings();countUpdate();ready=true;$('play').disabled=false;$('play').textContent=friends.size?'Back to your friends ♡':'Let’s wander ♡';
  renderer.setAnimationLoop(animate);
}
window.addEventListener('unhandledrejection',event=>{if(!ready)fatal(event.reason)});
boot().catch(fatal);
