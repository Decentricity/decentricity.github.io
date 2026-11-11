import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';

const $ = id => document.getElementById(id);
const host = $('canvas-host');
const state = { view: 'landscape', ready: false };
const figures = {
  radar: ['09 / GROUND-PENETRATING RADAR','Subsurface reflectors','radar-fig9.webp','Figure 9 combines processed radargrams and the authors’ facies correlations. Read the original depth and distance axes. The paper discusses airwave contamination and uncertainty from assuming a single electromagnetic velocity. Reflectors do not identify construction material by themselves.'],
  resistivity: ['10 / ELECTRICAL RESISTIVITY TOMOGRAPHY','Contrasts below the hill','resistivity-fig10.webp','Figure 10 shows inverted electrical-resistivity models. The authors interpret some high-resistivity anomalies as possible cavities or chambers. This is an interpretation of an inverse model, not a photograph of a void; alternative materials, water content, fractures, and inversion choices require testing.'],
  seismic: ['12 / SEISMIC TOMOGRAPHY','An independent contrast?','seismic-fig12.webp','Figure 12 shows published seismic velocity models and survey-line locations. The authors correlate low-velocity anomalies with their chamber hypothesis. Anomalies and their correlations should be evaluated against raw data, model resolution, and alternative geological explanations.'],
  reconstruction: ['14 / AUTHORS’ CONCEPTUAL RECONSTRUCTION','The proposed four units','reconstruction-fig14.webp','Figure 14 is the authors’ simplified reconstruction, not a measured subsurface volume. The interactive model translates its layer order into original schematic envelopes. Mesh shapes and horizontal extents are illustrative; no date or man-made origin is established by the rendering.'],
  map: ['01 / PUBLISHED SITE OVERVIEW','Terraces and survey context','site-map-fig1.webp','Figure 1 provides the paper’s site context, including the five terraces and drilling locations. This cropped composite is retained as a reference, not registered as a precise overlay on the public surface model.']
};
function openFigure(key) {
  const [kicker,title,file,description]=figures[key];
  $('figure-kicker').textContent=kicker;
  $('figure-title').textContent=title;
  $('figure-image').src=`figures/${file}`;
  $('figure-image').alt=`${title}: cropped published figure from Natawidjaja et al. (2023)`;
  $('figure-description').textContent=description;
  $('figure-dialog').showModal();
}
document.querySelectorAll('[data-figure]').forEach(b=>b.addEventListener('click',()=>openFigure(b.dataset.figure)));
$('figure14-open').addEventListener('click',()=>openFigure('reconstruction'));
for(const id of ['sources-open','method-footer']) $(id).addEventListener('click',()=>$('method-dialog').showModal());
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d && (e.clientX<d.getBoundingClientRect().left || e.clientX>d.getBoundingClientRect().right || e.clientY<d.getBoundingClientRect().top || e.clientY>d.getBoundingClientRect().bottom))d.close();}));
$('inspector-close').addEventListener('click',()=>$('shot-inspector').hidden=true);

async function loadJSON(file) {
  const r=await fetch(file);
  if(!r.ok) throw new Error(`Could not load ${file} (${r.status})`);
  return r.json();
}
function fail(error) {
  console.error(error);
  $('loading').hidden=true;
  $('viewer-error').hidden=false;
  $('viewer-error').textContent='The 3D view could not start. This browser needs WebGL 2. Try another browser or enable graphics acceleration. The original figures, evidence notes, and downloadable data below remain available.';
  $('status').textContent='3D unavailable · source material available below';
}

async function init() {
  const [terrain,shots]=await Promise.all([loadJSON('data/terrain.json'),loadJSON('data/shots.json')]);
  const renderer = new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.setClearColor(0x12272c);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.localClippingEnabled=true;
  host.append(renderer.domElement);
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(40,1,1,20000);
  const orbit=new OrbitControls(camera,renderer.domElement);
  orbit.enableDamping=true;
  orbit.dampingFactor=.08;
  orbit.maxPolarAngle=Math.PI*.93;
  orbit.minDistance=60;
  orbit.maxDistance=7000;
  scene.add(new THREE.HemisphereLight(0xf1f0d8,0x345057,2.1));
  const sun=new THREE.DirectionalLight(0xffedc7,2.3);sun.position.set(-500,1100,300);scene.add(sun);
  const fill=new THREE.DirectionalLight(0x9abbd4,.7);fill.position.set(600,200,-800);scene.add(fill);
  const landscape=new THREE.Group();scene.add(landscape);
  const terrainGroup=new THREE.Group();landscape.add(terrainGroup);
  const shotsGroup=new THREE.Group();landscape.add(shotsGroup);
  const guides=new THREE.Group();landscape.add(guides);
  const hypothesis=new THREE.Group();scene.add(hypothesis);hypothesis.visible=false;
  const base=700;
  const xs=terrain.east_m, ns=terrain.north_m, heights=terrain.elevations_m;
  const rows=terrain.rows,cols=terrain.columns;
  const min=terrain.minimum_m,max=terrain.maximum_m;
  const vertices=[],colors=[],indices=[];
  const color=new THREE.Color();
  const palette=[new THREE.Color('#325c4b'),new THREE.Color('#73906b'),new THREE.Color('#bbba85'),new THREE.Color('#ddd0a4')];
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    vertices.push(xs[c],heights[r][c]-base,-ns[r]);
    const t=(heights[r][c]-min)/(max-min)*2.999;
    color.copy(palette[Math.floor(t)]).lerp(palette[Math.min(3,Math.floor(t)+1)],t%1);
    colors.push(color.r,color.g,color.b);
    if(r<rows-1&&c<cols-1){const i=r*cols+c;indices.push(i,i+cols,i+1,i+1,i+cols,i+cols+1);}
  }
  const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geom.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geom.setIndex(indices);geom.computeVertexNormals();
  const terrainMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide});
  const terrainMesh=new THREE.Mesh(geom,terrainMat);terrainGroup.add(terrainMesh);
  const wire=new THREE.Mesh(geom,new THREE.MeshBasicMaterial({color:0x20382c,wireframe:true,transparent:true,opacity:.085,depthWrite:false}));wire.position.y=.08;terrainGroup.add(wire);
  // Plain display plinth, not a geological section.
  const edge=[];
  for(let c=0;c<cols;c++)edge.push([0,c]);
  for(let r=1;r<rows;r++)edge.push([r,cols-1]);
  for(let c=cols-2;c>=0;c--)edge.push([rows-1,c]);
  for(let r=rows-2;r>0;r--)edge.push([r,0]);
  const wallPos=[],wallIndices=[];
  edge.forEach(([r,c],i)=>{wallPos.push(xs[c],heights[r][c]-base,-ns[r],xs[c],0,-ns[r]);const j=i*2,n=((i+1)%edge.length)*2;wallIndices.push(j,n,j+1,n,n+1,j+1);});
  const wallGeom=new THREE.BufferGeometry();wallGeom.setAttribute('position',new THREE.Float32BufferAttribute(wallPos,3));wallGeom.setIndex(wallIndices);wallGeom.computeVertexNormals();
  const wallMat=new THREE.MeshStandardMaterial({color:0x263d38,roughness:1,side:THREE.DoubleSide});terrainGroup.add(new THREE.Mesh(wallGeom,wallMat));
  const baseMesh=new THREE.Mesh(new THREE.BoxGeometry(xs[cols-1]-xs[0],10,ns[0]-ns[rows-1]),new THREE.MeshStandardMaterial({color:0x253d38,roughness:1}));
  baseMesh.position.set((xs[0]+xs[cols-1])/2,-5,-(ns[0]+ns[rows-1])/2);terrainGroup.add(baseMesh);
  function heightAt(e,n){
    const cf=THREE.MathUtils.clamp((e-xs[0])/(xs[1]-xs[0]),0,cols-1.001);
    const rf=THREE.MathUtils.clamp((n-ns[0])/(ns[1]-ns[0]),0,rows-1.001);
    const c=Math.floor(cf),r=Math.floor(rf),tx=cf-c,ty=rf-r;
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(heights[r][c],heights[r][c+1],tx),THREE.MathUtils.lerp(heights[r+1][c],heights[r+1][c+1],tx),ty)-base;
  }
  function line(points,mat,parent){const g=new THREE.BufferGeometry().setFromPoints(points);const o=new THREE.Line(g,mat);parent.add(o);return o;}
  function label(text,position,parent,size=50,fg='#d7e3c8'){
    const cv=document.createElement('canvas');cv.width=Math.max(256,text.length*24);cv.height=64;
    const ctx=cv.getContext('2d');ctx.font='40px Arial';ctx.textAlign='center';ctx.fillStyle=fg;ctx.fillText(text,cv.width/2,46);
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),transparent:true,depthTest:false}));
    sp.scale.set(size*cv.width/cv.height,size,1);sp.position.copy(position);parent.add(sp);return sp;
  }
  const grid=new THREE.GridHelper(2400,12,0x698576,0x3d5b52);grid.position.y=-12;grid.material.transparent=true;grid.material.opacity=.38;guides.add(grid);
  const h0=heightAt(0,0);
  line([new THREE.Vector3(0,h0+4,0),new THREE.Vector3(0,h0+90,0)],new THREE.LineBasicMaterial({color:0xe5dfb4}),guides);
  const ref=new THREE.Mesh(new THREE.OctahedronGeometry(10),new THREE.MeshBasicMaterial({color:0xf6e7b3}));ref.position.set(0,h0+93,0);guides.add(ref);
  label('HERITAGE REGISTRY POINT',new THREE.Vector3(0,h0+140,0),guides,28);
  label('N',new THREE.Vector3(0,-8,-1250),guides,45);
  label('E',new THREE.Vector3(1250,-8,0),guides,45);
  const shotObjects=[];
  const ringMat=new THREE.LineBasicMaterial({color:0x57f2ee,transparent:true,opacity:.96});
  for(const shot of shots){
    const points=[];
    for(let i=0;i<=32;i++){const t=i/32*Math.PI*2,e=shot.east_m+12.5*Math.cos(t),n=shot.north_m+12.5*Math.sin(t);points.push(new THREE.Vector3(e,heightAt(e,n)+3,-n));}
    const ring=line(points,ringMat,shotsGroup);ring.userData.shot=shot;shotObjects.push(ring);
  }
  const tracks=new Map();
  shots.forEach(s=>{const key=s.date+s.beam;if(!tracks.has(key))tracks.set(key,[]);tracks.get(key).push(s);});
  const trackObjects=[];
  for(const arr of tracks.values()){
    arr.sort((a,b)=>a.shot.localeCompare(b.shot));
    for(let i=1;i<arr.length;i++){
      const a=arr[i-1],b=arr[i];
      if(Math.hypot(a.east_m-b.east_m,a.north_m-b.north_m)>90)continue;
      const tr=line([new THREE.Vector3(a.east_m,heightAt(a.east_m,a.north_m)+3,-a.north_m),new THREE.Vector3(b.east_m,heightAt(b.east_m,b.north_m)+3,-b.north_m)],new THREE.LineDashedMaterial({color:0x7bded8,transparent:true,opacity:.25,dashSize:8,gapSize:9}),shotsGroup);tr.computeLineDistances();tr.userData.date=a.date;trackObjects.push(tr);
    }
  }
  const selected=new THREE.Mesh(new THREE.SphereGeometry(9,12,8),new THREE.MeshBasicMaterial({color:0xffffff}));selected.visible=false;shotsGroup.add(selected);

  // Independent conceptual scene; not geographically registered to the landscape.
  const clipPlane=new THREE.Plane(new THREE.Vector3(0,0,-1),0);
  const unitDefs=[{name:'UNIT 1',color:0xcaac78,top:0,bottom:2},{name:'UNIT 2',color:0xf3cf45,top:2,bottom:6},{name:'UNIT 3',color:0x6fbd83,top:6,bottom:23},{name:'UNIT 4',color:0xe16d57,top:23,bottom:80}];
  const unitGroups=[],unitMats=[],caps=[],unitLabels=[];
  const hill=(x,z)=>Math.max(0,Math.min(56,56*(1-Math.max(Math.abs(x)/100,Math.abs(z)/130))/.81));
  function surfaceGeometry(offset){
    const v=[],idx=[],NX=40,NZ=52;
    for(let j=0;j<=NZ;j++)for(let i=0;i<=NX;i++){const x=-100+i*5,z=-130+j*5;v.push(x,Math.max(0,hill(x,z)-offset),z);if(i<NX&&j<NZ){const a=j*(NX+1)+i;idx.push(a,a+1,a+NX+1,a+1,a+NX+2,a+NX+1);}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(idx);g.computeVertexNormals();return g;
  }
  unitDefs.forEach((def,i)=>{
    const group=new THREE.Group();hypothesis.add(group);unitGroups.push(group);
    const mat=new THREE.MeshStandardMaterial({color:def.color,roughness:.9,side:THREE.DoubleSide,clippingPlanes:[clipPlane]});unitMats.push(mat);
    group.add(new THREE.Mesh(surfaceGeometry(def.top),mat));
    const capMat=new THREE.MeshStandardMaterial({color:def.color,side:THREE.DoubleSide,roughness:1});
    const cap=new THREE.Mesh(new THREE.BufferGeometry(),capMat);group.add(cap);caps.push(cap);
    const edges=new THREE.LineSegments(new THREE.EdgesGeometry(surfaceGeometry(def.top),18),new THREE.LineBasicMaterial({color:0x243b35,transparent:true,opacity:.18,clippingPlanes:[clipPlane]}));group.add(edges);
    const lab=label(def.name,new THREE.Vector3(121,56-(def.top+Math.min(56,def.bottom))/2,0),hypothesis,8,'#dfebd7');unitLabels.push(lab);
  });
  function updateCaps(){
    const z=+$('cut').value;
    clipPlane.constant=z;
    caps.forEach((cap,i)=>{
      const v=[],idx=[],def=unitDefs[i];
      for(let k=0;k<80;k++){
        const x1=-100+k*2.5,x2=x1+2.5;
        const t1=Math.max(0,hill(x1,z)-def.top),t2=Math.max(0,hill(x2,z)-def.top);
        const b1=Math.max(0,hill(x1,z)-def.bottom),b2=Math.max(0,hill(x2,z)-def.bottom);
        const j=v.length/3;v.push(x1,b1,z-.015,x2,b2,z-.015,x1,t1,z-.015,x2,t2,z-.015);idx.push(j,j+1,j+2,j+1,j+3,j+2);
      }
      cap.geometry.dispose();cap.geometry=new THREE.BufferGeometry();cap.geometry.setAttribute('position',new THREE.Float32BufferAttribute(v,3));cap.geometry.setIndex(idx);cap.geometry.computeVertexNormals();cap.visible=$('cut-toggle').checked;
      unitLabels[i].position.z=z;
    });
  }
  const anomalyGroup=new THREE.Group();hypothesis.add(anomalyGroup);anomalyGroup.visible=false;
  const anomaly=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(10,10,15)),new THREE.LineBasicMaterial({color:0xff87c2,linewidth:2}));anomaly.position.set(0,36,0);anomalyGroup.add(anomaly);
  label('SUGGESTED CHAMBER · UNCONFIRMED',new THREE.Vector3(-8,44,30),anomalyGroup,7,'#ff9dcd');
  const modelGrid=new THREE.GridHelper(340,17,0x648173,0x405e55);modelGrid.position.y=-1;modelGrid.material.transparent=true;modelGrid.material.opacity=.3;hypothesis.add(modelGrid);
  label('ILLUSTRATIVE EXTENT · NOT SURVEYED',new THREE.Vector3(0,0,155),hypothesis,7,'#91ac98');

  function updateLandscape(){
    terrainGroup.visible=$('terrain-toggle').checked;
    shotsGroup.visible=$('shots-toggle').checked;
    guides.visible=$('grid-toggle').checked;
    const opacity=+$('opacity').value/100;
    for(const mat of [terrainMat,wallMat,baseMesh.material]){mat.opacity=opacity;mat.transparent=opacity<1;mat.depthWrite=opacity>=1;}
    wire.material.opacity=.085*opacity;
    const exaggeration=+$('exaggeration').value;landscape.scale.y=exaggeration;
    $('opacity-value').textContent=`${$('opacity').value}%`;
    $('exaggeration-value').textContent=`${exaggeration}×`;
    const date=$('date-filter').value;
    let shown=0;
    shotObjects.forEach(o=>{o.visible=date==='all'||o.userData.shot.date===date;if(o.visible)shown++;});
    trackObjects.forEach(o=>o.visible=date==='all'||o.userData.date===date);
    $('shot-count').textContent=$('shots-toggle').checked?shown:0;
    if(state.view==='landscape'){
      $('scale-badge').textContent=exaggeration===1?'TRUE VERTICAL SCALE':`${exaggeration}× VERTICAL EXAGGERATION`;
      $('status').textContent=`${rows} × ${cols} native posts / ${$('shots-toggle').checked?shown:0} shots shown`;
    }
    selected.visible=false;$('shot-inspector').hidden=true;
  }
  function updateModel(){
    unitGroups.forEach((g,i)=>{g.visible=$(`unit${i+1}-toggle`).checked;unitLabels[i].visible=g.visible;g.position.y=(3-i)*+$('explode').value*.18;unitLabels[i].position.y=56-(unitDefs[i].top+Math.min(56,unitDefs[i].bottom))/2+g.position.y;});
    const op=+$('model-opacity').value/100;
    unitMats.forEach(mat=>{mat.clippingPlanes=$('cut-toggle').checked?[clipPlane]:[];mat.opacity=op;mat.transparent=op<1;mat.depthWrite=op>=1;});
    unitGroups.forEach(g=>g.children.forEach(obj=>{if(obj.isLineSegments)obj.material.clippingPlanes=$('cut-toggle').checked?[clipPlane]:[];}));
    caps.forEach(cap=>{cap.material.opacity=op;cap.material.transparent=op<1;cap.material.depthWrite=op>=1;});
    anomalyGroup.visible=$('anomaly-toggle').checked;
    $('cut-value').textContent=+$('cut').value===0?'Center':`${$('cut').value}%`;
    $('explode-value').textContent=`${$('explode').value}%`;
    $('model-opacity-value').textContent=`${$('model-opacity').value}%`;
    updateCaps();
    if(state.view==='underground')$('status').textContent=`${unitGroups.filter(g=>g.visible).length} proposed units visible / no survey registration`;
  }
  function setCamera(kind){
    const model=state.view==='underground';
    orbit.minDistance=model?80:100;orbit.maxDistance=model?1400:7000;
    const target=model?new THREE.Vector3(0,30,-25):new THREE.Vector3(0,200,0);
    let pos;
    if(kind==='top')pos=model?new THREE.Vector3(0,480,.1):new THREE.Vector3(0,3100,.1);
    else if(kind==='side')pos=model?new THREE.Vector3(30,55,460):new THREE.Vector3(0,400,3000);
    else if(kind==='site'){
      if(model)pos=new THREE.Vector3(220,160,310);
      else{target.set(0,h0*landscape.scale.y,0);pos=new THREE.Vector3(300,h0*landscape.scale.y+330,470);}
    }else pos=model?new THREE.Vector3(275,190,360):new THREE.Vector3(1850,1550,2050);
    const fit=Math.max(1,1.25/camera.aspect);
    camera.position.copy(pos).sub(target).multiplyScalar(fit).add(target);orbit.target.copy(target);orbit.update();
  }
  function setView(view,reset=true){
    state.view=view;
    const model=view==='underground';landscape.visible=!model;hypothesis.visible=model;
    $('landscape-controls').hidden=model;$('underground-controls').hidden=!model;
    document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.view===view)));
    $('viewer').setAttribute('aria-labelledby',`tab-${view}`);
    $('scene-tag').textContent=model?'SCHEMATIC':'GEOREFERENCED';$('scene-tag').className=`tag ${model?'interpreted':'measured'}`;
    $('stage-label').textContent=model?'PAPER HYPOTHESIS · NOT A MEASURED VOLUME':'COPERNICUS SURFACE + GEDI';
    $('stage-dot').style.background=model?'#eccb63':'#a8c49c';
    $('scene-caption').replaceChildren(document.createTextNode(model?'Proposed underground layers':'Measured landscape'));
    const subtitle=document.createElement('span');subtitle.textContent=model?'Figure 14 interpretation · geometry & extent illustrative':'≈ 2 × 2 km · native ~30 m surface posts';$('scene-caption').append(subtitle);
    $('scale-badge').textContent=model?'NOT GEOREFERENCED':'TRUE VERTICAL SCALE';
    $('scale-bar').hidden=model;document.querySelector('.north-label').hidden=model;
    $('interaction-hint').textContent=model?'Drag to orbit · hide layers or move the section':'Drag to orbit · scroll to zoom · click a cyan footprint';
    $('mode-note').textContent=model?'Schematic envelopes show the hypothesis; they do not establish a buried structure.':'Surface measurements · cyan rings show laser footprint locations';
    $('shot-inspector').hidden=true;
    if(model)updateModel();else updateLandscape();
    if(reset)setCamera('reset');
  }
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
  const tabs=[...document.querySelectorAll('[data-view]')];
  tabs.forEach((b,i)=>b.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const ix=e.key==='Home'?0:e.key==='End'?1:1-i;tabs[ix].focus();setView(tabs[ix].dataset.view);}}));
  for(const id of ['terrain-toggle','shots-toggle','grid-toggle','opacity','exaggeration','date-filter'])$(id).addEventListener('input',updateLandscape);
  for(const id of ['unit1-toggle','unit2-toggle','unit3-toggle','unit4-toggle','anomaly-toggle','cut-toggle','cut','explode','model-opacity'])$(id).addEventListener('input',updateModel);
  $('reset-view').addEventListener('click',()=>setCamera('reset'));
  $('top-view').addEventListener('click',()=>setCamera('top'));
  $('section-view').addEventListener('click',()=>setCamera('side'));
  $('site-view').addEventListener('click',()=>setCamera('site'));
  host.addEventListener('keydown',e=>{
    if(e.key==='Home'){e.preventDefault();setCamera('reset');}
    if(e.key==='+'||e.key==='='){camera.position.lerp(orbit.target,.15);orbit.update();}
    if(e.key==='-'){camera.position.sub(orbit.target).multiplyScalar(1.15).add(orbit.target);orbit.update();}
  });
  // Reject drags so orbit gestures never accidentally select a shot.
  let down=null;
  host.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
  host.addEventListener('pointerup',e=>{
    if(!down||Math.hypot(down.x-e.clientX,down.y-e.clientY)>6||state.view!=='landscape'||!shotsGroup.visible)return;
    const rect=host.getBoundingClientRect(),mouse=new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
    const raycaster=new THREE.Raycaster();raycaster.params.Line.threshold=15;raycaster.setFromCamera(mouse,camera);
    const hit=raycaster.intersectObjects(shotObjects.filter(o=>o.visible),false)[0];
    if(!hit)return;
    const s=hit.object.userData.shot;
    selected.position.set(s.east_m,heightAt(s.east_m,s.north_m)+8,-s.north_m);selected.visible=true;
    $('inspector-date').textContent=s.date;
    const fields=[['Shot ID',s.shot],['Beam',s.beam.replace('/','')],['Latitude',s.latitude.toFixed(6)],['Longitude',s.longitude.toFixed(6)],['Raw height',`${s.elev_lowestmode_ellipsoid_m.toFixed(2)} m (ellipsoid)`],['Sensitivity',s.sensitivity.toFixed(3)],['Quality / degraded',`${s.quality_flag} / ${s.degrade_flag}`]];
    $('inspector-data').replaceChildren(...fields.flatMap(([a,b])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=a;dd.textContent=b;return[dt,dd];}));
    $('shot-inspector').hidden=false;
  });
  const controlIds=['terrain-toggle','shots-toggle','grid-toggle','opacity','exaggeration','date-filter','unit1-toggle','unit2-toggle','unit3-toggle','unit4-toggle','anomaly-toggle','cut-toggle','cut','explode','model-opacity'];
  $('share-view').addEventListener('click',async()=>{
    const data={v:state.view,c:camera.position.toArray().map(n=>Math.round(n*100)/100),t:orbit.target.toArray().map(n=>Math.round(n*100)/100),p:{}};
    controlIds.forEach(id=>{const el=$(id);data.p[id]=el.type==='checkbox'?el.checked:el.value;});
    const url=new URL(location.href);url.hash='view='+encodeURIComponent(JSON.stringify(data));history.replaceState(null,'',url);
    try{await navigator.clipboard.writeText(url.href);$('share-view').textContent='View link copied ✓';}catch{$('share-view').textContent='View saved in address bar ✓';}
    setTimeout(()=>$('share-view').textContent='Copy view link ↗',2500);
  });
  updateLandscape();updateModel();setView('landscape');
  if(location.hash.startsWith('#view=')){
    try{
      const saved=JSON.parse(decodeURIComponent(location.hash.slice(6)));
      if(saved.p)for(const id of controlIds){const el=$(id),value=saved.p[id];if(value===undefined)continue;if(el.type==='checkbox'){if(typeof value==='boolean')el.checked=value;}else if(el.type==='range'){if(Number.isFinite(+value))el.value=THREE.MathUtils.clamp(+value,+el.min,+el.max);}else if([...el.options].some(o=>o.value===value))el.value=value;}
      updateLandscape();updateModel();setView(saved.v==='underground'?'underground':'landscape');
      if(['c','t'].every(k=>Array.isArray(saved[k])&&saved[k].length===3&&saved[k].every(v=>Number.isFinite(v)&&Math.abs(v)<20000))){camera.position.fromArray(saved.c);orbit.target.fromArray(saved.t);orbit.update();}
    }catch(e){console.warn('Ignored invalid saved view',e);}
  }
  function resize(){const w=host.clientWidth,h=host.clientHeight;const oldFit=Math.max(1,1.25/camera.aspect);renderer.setSize(w,h);camera.aspect=w/h;const fit=Math.max(1,1.25/camera.aspect);camera.position.sub(orbit.target).multiplyScalar(fit/oldFit).add(orbit.target);camera.updateProjectionMatrix();}
  new ResizeObserver(resize).observe(host);resize();
  const origin=new THREE.Vector3(),north=new THREE.Vector3();
  function frame(){
    requestAnimationFrame(frame);orbit.update();renderer.render(scene,camera);
    if(state.view==='landscape'){
      origin.set(0,0,0).project(camera);north.set(0,0,-100).project(camera);
      const angle=Math.atan2((north.x-origin.x)*host.clientWidth,(north.y-origin.y)*host.clientHeight)*180/Math.PI;
      document.querySelector('.north-label span').style.transform=`rotate(${angle}deg)`;
    }
  }
  state.ready=true;$('loading').hidden=true;
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();fail(new Error('WebGL context lost'));});
  // Read-only diagnostic handle for reproducible interaction checks.
  window.gunungPadang={state,scene,camera,orbit,landscape,hypothesis,unitGroups,shotObjects,terrain,shots,renderer,setView,heightAt};
  frame();
}
init().catch(fail);
