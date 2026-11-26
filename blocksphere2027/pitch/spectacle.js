const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x)},mix=(a,b,t)=>a+(b-a)*t;
const rand=i=>{const n=Math.sin(i*127.1+19.7)*43758.5453;return n-Math.floor(n)};
export function makeDetonationScene(chapter){return {
 id:'detonation',title:chapter.title,enterWith:'portal-in',hud:{alpha:0},notes:chapter.notes,
 beats:[{dur:7,hold:2},{dur:8,hold:2},{dur:8,hold:2},{dur:7,hold:2}],
 create(ctx){
  const T=ctx.THREE,gfx=ctx.gfx,scene=new T.Scene(),cam=new T.PerspectiveCamera(53,gfx.aspect,.05,1500);
  scene.background=new T.Color('#050713');scene.fog=new T.FogExp2('#050713',.003);
  const target=gfx.target({depth:true,samples:2}),root=new T.Group();scene.add(root);
  scene.add(new T.HemisphereLight(0xb2d9ff,0x15071e,2));
  const sun=new T.DirectionalLight(0xffe0a0,4);sun.position.set(-5,20,15);scene.add(sun);
  const fill=new T.PointLight(0x54bfff,250,130,1.2);fill.position.set(0,15,12);scene.add(fill);
  const gold=new T.Color('#ffb349'),blue=new T.Color('#66d8ff'),white=new T.Color('#fff5df');
  const count=1400,dummy=new T.Object3D(),v=new T.Vector3(),color=new T.Color();
  const shards=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({color:0xffffff,metalness:.48,roughness:.28,emissive:0x12344c,emissiveIntensity:.75}),count);shards.frustumCulled=false;root.add(shards);
  const vectors=Array.from({length:count},(_,i)=>{const a=rand(i+4)*Math.PI*2,b=Math.acos(2*rand(i+100)-1),r=18+rand(i+200)*65;return new T.Vector3(Math.sin(b)*Math.cos(a)*r,Math.cos(b)*r,Math.sin(b)*Math.sin(a)*r)});
  for(let i=0;i<count;i++){shards.setColorAt(i,color.copy(i%4===0?gold:i%4===1?blue:white))}
  const starPos=new Float32Array(1800*3);for(let i=0;i<starPos.length;i++)starPos[i]=(rand(i+900)-.5)*800;
  const starsGeo=new T.BufferGeometry();starsGeo.setAttribute('position',new T.BufferAttribute(starPos,3));
  const stars=new T.Points(starsGeo,new T.PointsMaterial({color:0xb2d9ff,size:.35,transparent:true,opacity:.7,depthWrite:false}));scene.add(stars);
  const globe=new T.Group();scene.add(globe);globe.position.set(0,110,-40);
  const shell=new T.Mesh(new T.IcosahedronGeometry(36,3),new T.MeshBasicMaterial({color:0x4acaff,wireframe:true,transparent:true,opacity:.18}));globe.add(shell);
  const core=new T.Mesh(new T.SphereGeometry(35.5,48,32),new T.MeshStandardMaterial({color:0x071728,metalness:.8,roughness:.35,emissive:0x052b40,emissiveIntensity:.5}));globe.add(core);
  const rings=[];for(let i=0;i<5;i++){const m=new T.Mesh(new T.TorusGeometry(1,.006,6,180),new T.MeshBasicMaterial({color:i%2?0x54d3ff:0xffc77a,transparent:true,opacity:.8,blending:T.AdditiveBlending,depthWrite:false}));root.add(m);rings.push(m)}
  const beams=[];for(let i=0;i<40;i++){const a=i/40*Math.PI*2,r=32+rand(i)*25;const m=new T.Mesh(new T.BoxGeometry(.05,180,.05),new T.MeshBasicMaterial({color:i%3===0?0xffb951:0x207ca7,transparent:true,opacity:.24,blending:T.AdditiveBlending,depthWrite:false}));m.position.set(Math.cos(a)*r,40,Math.sin(a)*r);scene.add(m);beams.push(m)}
  const overlay=ctx.overlay();
  const headlines=['The work breaks out.','A universe of experience.','Built to go further.','Your next connection.'];
  const labels=headlines.map((x,i)=>ctx.text(x,{x:110,y:i===2?880:110,size:i===1?92:100,font:'display',color:'#fff8eb'}));
  const eyebrow=ctx.text('BLOCKSPHERE  /  37 PROJECT RECORDS  /  2017—2026',{x:116,y:70,size:21,font:'monoMed',color:'#a8cbd7'});
  overlay.add(eyebrow,...labels);
  const cards=[],maps=[];let last,shot=-1;
  function makeCard(p,i,img){const c=document.createElement('canvas');c.width=768;c.height=480;const g=c.getContext('2d');g.fillStyle='#f9f7ef';g.fillRect(0,0,768,480);g.fillStyle='#ea632e';g.fillRect(0,0,768,8);g.fillStyle='#7e817f';g.font='17px monospace';g.fillText('BLOCKSPHERE  /  PROJECT RECORD',34,43);g.fillText(String(p.year),660,43);
   if(img){g.drawImage(img,34,68,700,245);g.fillStyle='#0a1320';g.fillRect(34,313,700,1)}else{g.fillStyle='#0d2536';g.fillRect(34,68,700,245);g.strokeStyle='#54727f';for(let n=0;n<12;n++){g.beginPath();g.arc(384,190,20+n*20,0,Math.PI*2);g.stroke()}g.fillStyle='#ffc06b';g.font='96px Georgia';g.fillText(String(i+1).padStart(2,'0'),325,220)}
   g.fillStyle='#171b22';g.font='bold 25px Arial';const title=p.name||p.client;let row='',y=351;for(const w of title.split(' ')){if(g.measureText(row+w).width>690){g.fillText(row,34,y);row='';y+=31}row+=w+' '}g.fillText(row,34,y);g.fillStyle='#727879';g.font='18px Arial';g.fillText((p.client||'Blocksphere').slice(0,70),34,450);
   const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;maps.push(map);const m=new T.Mesh(new T.PlaneGeometry(10,6.25),new T.MeshBasicMaterial({map,side:T.DoubleSide}));root.add(m);cards.push(m)
  }
  return {
   async init(){const p=await fetch('../source/portfolio-snapshot.json').then(r=>r.json());const imgs=await Promise.all(['pegadaian','debio','myriad','realitychain','ecoberingin','garuda'].map(n=>new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>resolve(null);im.src='../assets/projects/'+n+'.webp'})));p.archive.slice(0,37).forEach((p,i)=>{const n=(p.name+' '+p.client).toLowerCase(),j=n.includes('pegadaian')?0:n.includes('debio')?1:n.includes('myriad')?2:n.includes('realitychain')?3:n.includes('ecoberingin')?4:n.includes('garuda')?5:-1;makeCard(p,i,j<0?null:imgs[j])})},
   update(s){last=s;const explode=ease((s.at(0)-1.2)/3),rise=s.k(1,0,8),assemble=s.k(2,0,8),release=s.k(3,0,7);
    if(shot!==s.beat){shot=s.beat;if(s.dt>0)ctx.sfx('impact',{gain:.3})}
    const travel=rise*75+assemble*35;root.position.y=0;
    for(let i=0;i<count;i++){
     const end=vectors[i],a=i*2.399963,yy=1-2*(i+.5)/count,rr=Math.sqrt(1-yy*yy);
     v.set(((i%40)-19.5)*.25,((Math.floor(i/40)%35)-17)*.16,rand(i)*.15);
     v.lerp(end,explode);v.y+=rise*(30+rand(i+1)*95);
     const gx=rr*Math.cos(a)*38,gy=110+yy*38,gz=-40+rr*Math.sin(a)*38;
     v.set(mix(v.x,gx,assemble),mix(v.y,gy,assemble),mix(v.z,gz,assemble));v.addScaledVector(end,release*4);
     dummy.position.copy(v);dummy.rotation.set(explode*(i*.14+s.t*.08),explode*(i*.23+s.t*.1),i*.1*explode);
     const size=mix(.17,.18+rand(i+20)*.55,explode);dummy.scale.set(size,size*(1+rise*rand(i)*5)*(1-assemble*.8),size*.55);dummy.updateMatrix();shards.setMatrixAt(i,dummy.matrix)
    }shards.instanceMatrix.needsUpdate=true;
    cards.forEach((m,i)=>{const a=i*2.399963+s.t*.025,r=20+(i%4)*10;const y=(i/36)*150-25;const z=Math.sin(a)*r;const spread=explode;const gather=assemble*.4; m.position.set(Math.cos(a)*r*spread*(1-gather),y*spread+rise*12,z*spread-12);m.rotation.set(Math.sin(i)*.15*spread,-a*.15*spread,Math.sin(i*3)*.08);m.lookAt(cam.position);m.scale.setScalar((.08+spread*.92)*(1-release*.85));m.visible=explode>.04&&release<.98});
    rings.forEach((m,i)=>{const k=clamp((s.at(0)-1.3-i*.18)/4);const r=1+k*(85+i*12);m.scale.setScalar(mix(r,40+i*5,assemble)*(1+release*5));m.position.y=travel; m.position.z=-assemble*40;m.rotation.set(Math.PI*.5+i*.18+assemble*.4,i*.36+assemble*.7,s.t*.03);m.material.opacity=(1-k*.78)*(1-release)*.9});
    globe.scale.setScalar(.01+assemble*.99);globe.rotation.y=s.t*.04;globe.visible=assemble>.01;globe.children.forEach(m=>m.visible=release<.9);shell.material.opacity=.18*(1-release);
    beams.forEach((m,i)=>{m.scale.y=rise*(1-release);m.material.opacity=.15*rise*(1-assemble)});
    let cx=Math.sin(rise*Math.PI*1.6)*18*(1-assemble)+Math.sin(s.t*.08)*assemble*10,cy=mix(1,travel,rise>.001?1:0),cz=mix(26,38,explode)-rise*20+assemble*92+release*95;
    cam.position.set(cx,cy,cz);cam.lookAt(0,mix(0,110,Math.max(rise*.8,assemble)),-assemble*40);cam.fov=53+explode*15-rise*9+release*15;cam.aspect=gfx.aspect;cam.updateProjectionMatrix();stars.rotation.y=s.t*.006;
    labels.forEach((b,i)=>{b.show(s.beat===i?ease((s.at(i)-.3)/1.3):0,{style:'rise'});b.x=gfx.aspect<1?ctx.view.x0+35:110;b.size=gfx.aspect<1?52:(i===1?92:100)});eyebrow.show(1-release,{style:'fade'});eyebrow.alpha=.6;eyebrow.x=gfx.aspect<1?ctx.view.x0+35:116;
   },
   render(out){gfx.draw(scene,cam,target);gfx.post(target,out,{tone:'aces',exposure:1.1,bloom:.65,vignette:.22,grain:.015,time:last?.t||0});overlay.render(out)},
   resize(){cam.aspect=gfx.aspect;cam.updateProjectionMatrix()}
  }
 }
}}
