import * as THREE from 'three';

const data = window.DECENTRI_DATA || { projects: [], families: [] };
const coarsePointer = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
const $ = (s) => document.querySelector(s);

const ui = {
  gate: $('#gate'), gateCopy: $('#gate-copy'), gateStatus: $('#gate-status'), enter: $('#enter-world'), back: $('#back-to-shell'),
  hud: $('#hud'), crosshair: $('#crosshair'), prompt: $('#prompt'), district: $('#district-panel'), districtName: $('#district-name'), districtDetail: $('#district-detail'),
  dossier: $('#dossier'), dossierClose: $('#dossier-close'), dossierKicker: $('#dossier-kicker'), dossierTitle: $('#dossier-title'), dossierSummary: $('#dossier-summary'), dossierNotes: $('#dossier-notes'), dossierTech: $('#dossier-tech'), dossierLinks: $('#dossier-links'),
  displays: $('#display-button'), mobile: $('#mobile-controls'), moveZone: $('#move-zone'), moveKnob: $('#move-knob'), lookZone: $('#look-zone'), interact: $('#mobile-interact'), canvas: $('#webgl')
};

const familyTheme = {
  'tiny-computers':       { color: 0x76ffd2, label: 'TINY / WEIRD COMPUTERS', angle: 0.10 },
  'xr-hardware':          { color: 0x8ca8ff, label: 'XR / RESURRECTED HARDWARE', angle: 1.15 },
  'machine-minds':        { color: 0xff6db6, label: 'MACHINE MINDS / AGENTS / NEURO', angle: 2.20 },
  'artificial-media':     { color: 0xffb75e, label: 'ARTIFICIAL MEDIA MACHINES', angle: 3.25 },
  'decentralized-systems':{ color: 0x7ee7ff, label: 'DECENTRALIZED SYSTEMS', angle: 4.30 },
  'worlds-art':           { color: 0xd9ff72, label: 'WORLDS / ART / WEIRD WEB', angle: 5.35 }
};

let renderer, scene, camera, clock;
let yaw = Math.PI, pitch = -0.03;
let started = false, pointerLocked = false, dossierOpen = false;
let vy = 0, grounded = true;
let currentInteractable = null;
const keys = new Set();
const interactables = [];
const projectMeshes = new Map();
const projectPositions = new Map();
const familyCenters = new Map();
const raycaster = new THREE.Raycaster();
const screenCenter = new THREE.Vector2(0, 0);
const player = { position: new THREE.Vector3(0, 1.72, 16), radius: 0.55, eye: 1.72, speed: 7.6, sprint: 1.55 };
const moveTouch = { id: null, x: 0, y: 0, cx: 0, cy: 0 };
const lookTouch = { id: null, x: 0, y: 0 };

function switchDisplay(target='selector') {
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'decentricity:switch', target }, '*');
      return;
    }
  } catch (_) {}
  if (target === 'shell') location.href = '../#shell';
  else location.href = '../';
}

ui.back.addEventListener('click', () => switchDisplay('selector'));
ui.displays.addEventListener('click', () => switchDisplay('selector'));
ui.dossierClose.addEventListener('click', closeDossier);
ui.interact.addEventListener('click', () => currentInteractable && openDossier(currentInteractable.userData.project));

if (!navigator.gpu) {
  ui.gateCopy.textContent = 'This display is intentionally gated behind WebGPU capability. This browser does not expose navigator.gpu, so the WORLD process will not start here.';
  ui.gateStatus.textContent = 'WEBGPU: UNAVAILABLE // SHELL + HEDGEYOS REMAIN AVAILABLE';
  ui.enter.disabled = true;
} else {
  ui.gateCopy.textContent = 'WebGPU capability detected. This renderer reuses the NFT Massacre first-person world language, replacing wallet NPCs with the Decentricity project graph.';
  ui.gateStatus.textContent = `WEBGPU: AVAILABLE // ${data.projects.length} PROJECT OBJECTS READY`;
  ui.enter.disabled = false;
}

ui.enter.addEventListener('click', async () => {
  if (started || !navigator.gpu) return;
  started = true;
  ui.enter.disabled = true;
  ui.gateStatus.textContent = 'STARTING THREE.JS WORLD PROCESS…';
  try {
    initWorld();
    ui.gate.classList.add('hidden');
    ui.hud.classList.remove('hidden');
    ui.crosshair.classList.remove('hidden');
    ui.district.classList.remove('hidden');
    if (coarsePointer) {
      ui.mobile.classList.remove('hidden');
      ui.mobile.setAttribute('aria-hidden', 'false');
    } else {
      ui.canvas.requestPointerLock?.();
    }
    animate();
  } catch (err) {
    started = false;
    ui.gate.classList.remove('hidden');
    ui.enter.disabled = false;
    ui.gateCopy.textContent = 'WORLD process failed to start. The other displays are still safe.';
    ui.gateStatus.textContent = `ERROR: ${err?.message || err}`;
    console.error(err);
  }
});

function initWorld() {
  renderer = new THREE.WebGLRenderer({ canvas: ui.canvas, antialias: !coarsePointer, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarsePointer ? 1.25 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02030a);
  scene.fog = new THREE.FogExp2(0x050b12, coarsePointer ? 0.014 : 0.0105);

  camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.08, 600);
  camera.position.copy(player.position);
  clock = new THREE.Clock();

  const hemi = new THREE.HemisphereLight(0x9ac7ff, 0x0d1112, 1.3);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xa6d4ff, 1.7);
  moon.position.set(-25, 42, 18);
  scene.add(moon);

  buildSky();
  buildGround();
  buildRoads();
  buildHouse();
  buildDistricts();
  buildStreetFurniture();
  bindInput();
  updateCamera();
}

function material(color, roughness=.82, metalness=.06, extra={}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}

function buildSky() {
  const stars = new THREE.BufferGeometry();
  const count = coarsePointer ? 650 : 1400;
  const pos = new Float32Array(count * 3);
  for (let i=0;i<count;i++) {
    const r = 120 + Math.random()*260;
    const a = Math.random()*Math.PI*2;
    const y = 18 + Math.random()*150;
    pos[i*3] = Math.cos(a)*r; pos[i*3+1] = y; pos[i*3+2] = Math.sin(a)*r;
  }
  stars.setAttribute('position', new THREE.BufferAttribute(pos,3));
  const pts = new THREE.Points(stars, new THREE.PointsMaterial({ color:0xb8d4ff, size:.32, transparent:true, opacity:.72, sizeAttenuation:true }));
  scene.add(pts);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(5,24,16), new THREE.MeshBasicMaterial({ color:0xdbe7ff }));
  moon.position.set(-68,68,-120); scene.add(moon);
}

function buildGround() {
  const ground = new THREE.Mesh(new THREE.CircleGeometry(180, 96), material(0x10171c, .98, .01));
  ground.rotation.x = -Math.PI/2; ground.receiveShadow = true; scene.add(ground);
  const grid = new THREE.GridHelper(260, 130, 0x214f49, 0x17302e);
  grid.position.y = .012;
  const mats = Array.isArray(grid.material) ? grid.material : [grid.material];
  mats.forEach(m => { m.opacity = .24; m.transparent = true; });
  scene.add(grid);
  const inner = new THREE.Mesh(new THREE.RingGeometry(24,25,96), new THREE.MeshBasicMaterial({ color:0x50c7aa, transparent:true, opacity:.16, side:THREE.DoubleSide }));
  inner.rotation.x = -Math.PI/2; inner.position.y=.018; scene.add(inner);
}

function buildRoads() {
  const roadMat = material(0x151b20,.96,.02);
  for (let i=0;i<6;i++) {
    const a = i*Math.PI/3 + .1;
    const road = new THREE.Mesh(new THREE.BoxGeometry(7,.04,76), roadMat);
    road.position.set(Math.sin(a)*38,.022,Math.cos(a)*38);
    road.rotation.y = a;
    scene.add(road);
    const lineMat = new THREE.MeshBasicMaterial({ color:0x4c8b7d, transparent:true, opacity:.2 });
    const line = new THREE.Mesh(new THREE.BoxGeometry(.12,.012,70), lineMat);
    line.position.copy(road.position); line.position.y=.05; line.rotation.y=a; scene.add(line);
  }
}

function makeTextTexture(lines, accent='#79ffd1', width=1024, height=320) {
  const c=document.createElement('canvas'); c.width=width; c.height=height;
  const ctx=c.getContext('2d');
  ctx.fillStyle='rgba(3,8,13,.92)'; ctx.fillRect(0,0,width,height);
  ctx.strokeStyle=accent; ctx.lineWidth=5; ctx.strokeRect(10,10,width-20,height-20);
  ctx.fillStyle=accent; ctx.font='700 64px monospace';
  lines.slice(0,3).forEach((line,i)=>ctx.fillText(String(line).slice(0,24),54,100+i*78));
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}

function signPlane(lines, colorHex, w=5.6, h=1.9) {
  const color = `#${colorHex.toString(16).padStart(6,'0')}`;
  const tex=makeTextTexture(lines,color);
  const mat=new THREE.MeshBasicMaterial({map:tex,transparent:false,toneMapped:false,side:THREE.DoubleSide});
  return new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);
}

function buildHouse() {
  const g = new THREE.Group(); g.name='starterHouse';
  const slab = new THREE.Mesh(new THREE.BoxGeometry(15,.6,12), material(0x20282d,.93,.03)); slab.position.y=.3; g.add(slab);
  const wallMat = material(0xb9b6a8,.9,.02);
  const darkMat = material(0x242a2d,.92,.04);
  const accentMat = material(0x4d8f83,.5,.15,{emissive:0x143d35,emissiveIntensity:.55});
  const back = new THREE.Mesh(new THREE.BoxGeometry(15,5.7,.45),wallMat); back.position.set(0,3.15,-5.78); g.add(back);
  const left = new THREE.Mesh(new THREE.BoxGeometry(.45,5.7,11.4),wallMat); left.position.set(-7.28,3.15,0); g.add(left);
  const right = left.clone(); right.position.x=7.28; g.add(right);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(15.8,.5,12.6),darkMat); roof.position.set(0,6.2,0); g.add(roof);
  const frontL = new THREE.Mesh(new THREE.BoxGeometry(5.3,5.7,.4),wallMat); frontL.position.set(-4.85,3.15,5.75); g.add(frontL);
  const frontR = frontL.clone(); frontR.position.x=4.85; g.add(frontR);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.5,1.25,.4),wallMat); lintel.position.set(0,5.35,5.75); g.add(lintel);
  const door = new THREE.Mesh(new THREE.BoxGeometry(3.0,4.2,.18),darkMat); door.position.set(0,2.45,5.54); g.add(door);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(2.65,.12,.12),accentMat); glow.position.set(0,4.42,5.38); g.add(glow);
  const desk = new THREE.Mesh(new THREE.BoxGeometry(4.6,.25,2.0),darkMat); desk.position.set(0,1.25,-2.1); g.add(desk);
  for (const x of [-1.85,1.85]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(.22,1.1,.22),darkMat); leg.position.set(x,.68,-2.1); g.add(leg); }
  const screen = signPlane(['DECENTRICITY','PERSONAL MACHINE','HOME'],0x79ffd1,4.4,1.38); screen.position.set(0,2.5,-3.08); g.add(screen);
  g.position.set(0,0,0); scene.add(g);

  const porch = new THREE.Mesh(new THREE.BoxGeometry(9,.2,4.5), material(0x1a2428,.9,.05)); porch.position.set(0,.1,8); scene.add(porch);
  const homeSign = signPlane(['HOME //','DECENTRICITY'],0x79ffd1,5.6,1.65); homeSign.position.set(0,3.6,6.05); scene.add(homeSign);
  const homeLight = new THREE.PointLight(0x79ffd1,7,18,2); homeLight.position.set(0,3.5,7.5); scene.add(homeLight);
}

function buildDistricts() {
  data.families.forEach((fam, fi) => {
    const theme = familyTheme[fam.id] || {color:0x79ffd1,label:fam.title.toUpperCase(),angle:(fi/Math.max(1,data.families.length))*Math.PI*2};
    const projects = data.projects.filter(p=>p.family===fam.id);
    const radius = 48;
    const center = new THREE.Vector3(Math.cos(theme.angle)*radius,0,Math.sin(theme.angle)*radius);
    familyCenters.set(fam.id, center.clone());
    createDistrictBeacon(fam, theme, center);
    const spread = Math.max(12, projects.length*4.3);
    projects.forEach((p,i)=>{
      const t = projects.length===1 ? .5 : i/(projects.length-1);
      const tangent = new THREE.Vector3(-Math.sin(theme.angle),0,Math.cos(theme.angle));
      const radial = new THREE.Vector3(Math.cos(theme.angle),0,Math.sin(theme.angle));
      const pos = center.clone().addScaledVector(tangent,(t-.5)*spread).addScaledVector(radial, 5 + (i%2)*4);
      createProjectMonument(p, theme, pos, i);
    });
  });
}

function createDistrictBeacon(fam, theme, pos) {
  const tower = new THREE.Group(); tower.position.copy(pos);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(3.8,4.6,.7,8), material(0x1a2226,.9,.1)); base.position.y=.35; tower.add(base);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(.16,.23,8,8), material(theme.color,.5,.25,{emissive:theme.color,emissiveIntensity:.45})); mast.position.y=4.4; tower.add(mast);
  const sign = signPlane([theme.label,`${data.projects.filter(p=>p.family===fam.id).length} PROJECTS`],theme.color,7,1.7); sign.position.set(0,5.7,0); sign.lookAt(new THREE.Vector3(0,5.7,0)); tower.add(sign);
  const lamp = new THREE.PointLight(theme.color,8,16,2); lamp.position.set(0,5.2,0); tower.add(lamp);
  scene.add(tower);
}

function createProjectMonument(project, theme, pos, index) {
  const g = new THREE.Group(); g.position.copy(pos); g.userData.project = project;
  const h = 3.1 + ((index*1.37)%2.7);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(3.4,.45,3.4), material(0x182025,.9,.08)); plinth.position.y=.225; g.add(plinth);
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.55,h,2.55), material(0x273138,.74,.2,{emissive:0x08100f,emissiveIntensity:.4})); body.position.y=.45+h/2; g.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.7,.13,2.7), material(theme.color,.35,.32,{emissive:theme.color,emissiveIntensity:.75})); stripe.position.y=h*.68+.45; g.add(stripe);
  const sign = signPlane([project.title.toUpperCase(),String(project.year),String(project.status).toUpperCase()],theme.color,4.8,1.55); sign.position.set(0,h+1.45,1.47); g.add(sign);
  const beacon = new THREE.PointLight(theme.color,4.2,11,2); beacon.position.set(0,h+1.2,0); g.add(beacon);
  const collider = new THREE.Mesh(new THREE.BoxGeometry(4.5,h+3,4.5), new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false})); collider.position.y=(h+3)/2; collider.userData.project=project; collider.userData.interactable=true; g.add(collider);
  interactables.push(collider); projectMeshes.set(project.id,g); projectPositions.set(project.id,pos.clone()); scene.add(g);
}

function buildStreetFurniture() {
  const poleMat=material(0x151d20,.7,.35);
  for(let i=0;i<24;i++) {
    const a=(i/24)*Math.PI*2; const r=31+(i%3)*14;
    const x=Math.cos(a)*r,z=Math.sin(a)*r;
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.08,.11,3.6,6),poleMat); pole.position.set(x,1.8,z); scene.add(pole);
    const lamp=new THREE.PointLight(i%2?0x7ee7ff:0x79ffd1,1.6,9,2); lamp.position.set(x,3.7,z); scene.add(lamp);
  }
  for(let i=0;i<18;i++) {
    const a=(i/18)*Math.PI*2+.18; const r=80+(i%2)*9;
    const h=2+((i*1.7)%8);
    const b=new THREE.Mesh(new THREE.BoxGeometry(7,h,7),material(0x0b1116,.96,.03)); b.position.set(Math.cos(a)*r,h/2,Math.sin(a)*r); scene.add(b);
  }
}

function bindInput() {
  addEventListener('resize', onResize);
  document.addEventListener('pointerlockchange',()=>{pointerLocked=document.pointerLockElement===ui.canvas;});
  document.addEventListener('mousemove',(e)=>{
    if(!pointerLocked || dossierOpen) return;
    yaw -= e.movementX*.00215; pitch -= e.movementY*.00195; pitch=Math.max(-1.48,Math.min(1.48,pitch));
  });
  ui.canvas.addEventListener('click',()=>{ if(!coarsePointer && !dossierOpen && document.pointerLockElement!==ui.canvas) ui.canvas.requestPointerLock?.(); });
  addEventListener('keydown',(e)=>{
    if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight'].includes(e.code)) keys.add(e.code);
    if(e.code==='Space' && !dossierOpen){ e.preventDefault(); if(grounded){vy=6.2;grounded=false;} }
    if(e.code==='KeyE' && currentInteractable && !dossierOpen) openDossier(currentInteractable.userData.project);
    if(e.code==='Escape' && dossierOpen){ e.preventDefault(); closeDossier(); }
  });
  addEventListener('keyup',(e)=>keys.delete(e.code));
  bindMobile();
}

function bindMobile() {
  if(!coarsePointer) return;
  ui.moveZone.addEventListener('pointerdown',(e)=>{moveTouch.id=e.pointerId;moveTouch.cx=e.clientX;moveTouch.cy=e.clientY;moveTouch.x=0;moveTouch.y=0;ui.moveZone.setPointerCapture(e.pointerId);});
  ui.moveZone.addEventListener('pointermove',(e)=>{if(e.pointerId!==moveTouch.id)return;const dx=e.clientX-moveTouch.cx,dy=e.clientY-moveTouch.cy;const len=Math.hypot(dx,dy)||1,max=42,s=Math.min(1,max/len);moveTouch.x=(dx*s)/max;moveTouch.y=(dy*s)/max;ui.moveKnob.style.transform=`translate(calc(-50% + ${dx*s}px),calc(-50% + ${dy*s}px))`;});
  const endMove=(e)=>{if(e.pointerId!==moveTouch.id)return;moveTouch.id=null;moveTouch.x=moveTouch.y=0;ui.moveKnob.style.transform='translate(-50%,-50%)';};
  ui.moveZone.addEventListener('pointerup',endMove);ui.moveZone.addEventListener('pointercancel',endMove);
  ui.lookZone.addEventListener('pointerdown',(e)=>{lookTouch.id=e.pointerId;lookTouch.x=e.clientX;lookTouch.y=e.clientY;ui.lookZone.setPointerCapture(e.pointerId);});
  ui.lookZone.addEventListener('pointermove',(e)=>{if(e.pointerId!==lookTouch.id||dossierOpen)return;const dx=e.clientX-lookTouch.x,dy=e.clientY-lookTouch.y;lookTouch.x=e.clientX;lookTouch.y=e.clientY;yaw-=dx*.006;pitch-=dy*.005;pitch=Math.max(-1.45,Math.min(1.45,pitch));});
  const endLook=(e)=>{if(e.pointerId===lookTouch.id)lookTouch.id=null;};ui.lookZone.addEventListener('pointerup',endLook);ui.lookZone.addEventListener('pointercancel',endLook);
}

function onResize(){ if(!renderer||!camera)return; camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); }

function updateCamera(){
  camera.position.copy(player.position);
  const dir=new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
  camera.lookAt(camera.position.clone().add(dir));
}

function updateMovement(dt){
  if(dossierOpen) return;
  let forward=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0);
  let strafe=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0);
  if(coarsePointer){strafe+=moveTouch.x;forward+=-moveTouch.y;}
  const mag=Math.hypot(forward,strafe);if(mag>1){forward/=mag;strafe/=mag;}
  const sprint=(keys.has('ShiftLeft')||keys.has('ShiftRight'))?player.sprint:1;
  const sy=Math.sin(yaw),cy=Math.cos(yaw);
  const dx=(sy*forward+cy*strafe)*player.speed*sprint*dt;
  const dz=(cy*forward-sy*strafe)*player.speed*sprint*dt;
  const nextX=player.position.x+dx,nextZ=player.position.z+dz;
  const r=Math.hypot(nextX,nextZ);
  if(r<145){player.position.x=nextX;player.position.z=nextZ;}
  vy-=15.5*dt; player.position.y+=vy*dt;
  if(player.position.y<=player.eye){player.position.y=player.eye;vy=0;grounded=true;}
}

function updateInteraction(){
  raycaster.setFromCamera(screenCenter,camera);
  const hits=raycaster.intersectObjects(interactables,false);
  currentInteractable=null;
  for(const hit of hits){if(hit.distance<=7.2){currentInteractable=hit.object;break;}}
  if(currentInteractable && !dossierOpen){const p=currentInteractable.userData.project;ui.prompt.textContent=`[ E ] INSPECT ${p.title.toUpperCase()}`;ui.prompt.classList.remove('hidden');}
  else ui.prompt.classList.add('hidden');
}

function updateDistrict(){
  let bestId=null,best=Infinity;
  for(const [id,c] of familyCenters){const d=player.position.distanceTo(c);if(d<best){best=d;bestId=id;}}
  if(Math.hypot(player.position.x,player.position.z)<25){ui.districtName.textContent='HOME';ui.districtDetail.textContent='DECENTRICITY PERSONAL MACHINE';return;}
  const fam=data.families.find(f=>f.id===bestId);ui.districtName.textContent=fam?.title?.toUpperCase()||'OUTER RING';ui.districtDetail.textContent=best<28?`${data.projects.filter(p=>p.family===bestId).length} PROJECT OBJECTS`:'BETWEEN DISTRICTS';
}

function openDossier(project){
  if(!project)return;dossierOpen=true;document.exitPointerLock?.();
  const fam=data.families.find(f=>f.id===project.family);const theme=familyTheme[project.family];
  ui.dossierKicker.textContent=`${fam?.title||project.family} // ${project.status} // ${project.year}`;
  ui.dossierTitle.textContent=project.title;ui.dossierSummary.textContent=project.summary||'';ui.dossierNotes.textContent=project.notes||'';
  ui.dossierTech.innerHTML=(project.tech||[]).map(t=>`<span class="chip">${escapeHtml(t)}</span>`).join('');
  ui.dossierLinks.innerHTML=(project.links||[]).length?(project.links||[]).map(l=>`<a href="${escapeAttr(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.label)} ↗</a>`).join(''):'<span class="chip">NO PUBLIC LINK EXPOSED</span>';
  ui.dossier.style.borderColor = theme ? `#${theme.color.toString(16).padStart(6,'0')}` : '';
  ui.dossier.classList.remove('hidden');
}
function closeDossier(){dossierOpen=false;ui.dossier.classList.add('hidden');if(!coarsePointer)ui.canvas.requestPointerLock?.();}
function escapeHtml(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function escapeAttr(v=''){return escapeHtml(v);}

function animate(){
  if(!started)return;requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);updateMovement(dt);updateCamera();updateInteraction();updateDistrict();renderer.render(scene,camera);
}
