/* Flipsalt: game-module adaptation. All rendering is performed by Saltline. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id),key='flipsalt.story.v1';
  let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}')||{}}catch{}
  const names=['Poppy','Mallow','Clover','Peach','Juniper','Pip'];
  const met=new Set((Array.isArray(saved.friends)?saved.friends:[]).filter(n=>names.includes(n)));
  const settings={sound:true,gentle:matchMedia('(prefers-reduced-motion:reduce)').matches,sensitivity:1,quality:'medium',...saved.settings};
  if(!['low','medium','high'].includes(settings.quality))settings.quality='medium';
  settings.sensitivity=Math.max(.3,Math.min(2,Number(settings.sensitivity)||1));
  const palette={paint_blue:0x8eafb6,paint_red:0xc99099,paint_green:0x94a88b,paint_yellow:0xe6c791,paint_orange:0xd4aa8d,paint_white:0xe9dcc5,paint_grey:0xb6acb3,paint_teal:0x8fb8ab,concrete:0xbcb5a2,concrete_dirty:0xb6aa98,concrete_painted:0xd0baac,asphalt:0x8d9187,floor_epoxy:0xb0a49c,steel_dark:0x837f8a,steel_rust:0xc29883,steel_worn:0xb7a8a4,corrugated_roof:0xbb9c9a,plastic_blue:0xa5bfc1,plastic_red:0xd6a5ad,plastic_grey:0xc4b9ad,hull_paint:0x9aada8,hull_red:0xc49093,hazard_stripes:0xe1c79f,wood_pallet:0xc0a583,wood_dark:0xa78d76,cardboard:0xd0b28d,tarp:0x9caf95};
  let G,T,ready=false,from='title',toastTimer=0,target=null,elapsed=0,celebrating=false;
  const friends=[],hearts=[];let heartGeo,held,throwTime=0,cooldown=0;
  const messages=['“You came! I was saving the first hello for you.”','“The best magic is the kind you give away.”','“A little kindness, and look how everything blooms.”','“You’re sweeter than the peaches in my basket.”','“Even a prickly little heart needs a friend.”','“All this way, just to say hello? Come sit with me.”'];
  const positions=[[-25,0,6],[-12.5,0,7.2],[4.2,0,15.7],[-7.6,0,-17.4],[25.3,0,3.9],[20.6,0,21.2]];
  const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
  function save(){try{localStorage.setItem(key,JSON.stringify({friends:[...met],settings}))}catch{}}
  function toast(text,time=4){$('toast').textContent=text;$('toast').classList.add('show');toastTimer=time}
  function updateCount(){$('count').textContent=`${met.size?'♥':'♡'} ${met.size} / 6 friends`;$('gather').hidden=!G||G.game?.state!=='playing'||met.size!==6||celebrating;$('new-game').hidden=!met.size}
  function material(color,extra={}){return new T.MeshStandardMaterial({color,roughness:.82,metalness:.03,...extra})}
  const mats=new Map();function M(color){if(!mats.has(color))mats.set(color,material(color));return mats.get(color)}
  function mesh(geo,color,parent,pos=[0,0,0]){const m=new T.Mesh(geo,typeof color==='number'?M(color):color);m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
  function orb(parent,x,y,z,r,color,scale=[1,1,1]){const m=mesh(new T.SphereGeometry(r,18,12),color,parent,[x,y,z]);m.scale.set(...scale);return m}
  function makeHeart(){const s=new T.Shape();s.moveTo(0,-.46);s.bezierCurveTo(-.6,-.03,-.62,.47,-.27,.47);s.bezierCurveTo(-.12,.47,-.02,.36,0,.25);s.bezierCurveTo(.03,.38,.14,.47,.28,.47);s.bezierCurveTo(.65,.47,.6,-.04,0,-.46);return new T.ExtrudeGeometry(s,{depth:.13,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.035,bevelThickness:.035,curveSegments:16})}
  function heart(parent,pos,scale=.4){const m=mesh(heartGeo,material(0xf4a7b8,{emissive:0xc95d86,emissiveIntensity:.25,roughness:.35}),parent,pos);m.scale.setScalar(scale);m.castShadow=false;return m}
  async function artwork(url){
    const texture=await new T.TextureLoader().loadAsync(url),image=texture.image;
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
    const pixels=context.getImageData(0,0,image.width,image.height).data;
    let left=image.width,top=image.height,right=-1,bottom=-1;
    for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(pixels[(y*image.width+x)*4+3]>25){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}
    if(right<left)throw new Error('Hedgey artwork is empty: '+url);
    // Crop only the UVs: the original illustration file remains untouched.
    texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=Math.min(8,G.renderer.capabilities.getMaxAnisotropy());
    texture.offset.set(left/image.width,1-(bottom+1)/image.height);
    texture.repeat.set((right-left+1)/image.width,(bottom-top+1)/image.height);
    texture.needsUpdate=true;
    return {texture,aspect:(right-left+1)/(bottom-top+1)};
  }
  function hedgehog(index,art){
    const root=new T.Group(),body=new T.Group();root.add(body);
    const height=index===1||index===4?2.3:1.9,width=height*art.aspect;
    const paper=material(0xffffff,{map:art.texture,side:T.DoubleSide,alphaTest:.22,roughness:.96,metalness:0,emissive:0xffffff,emissiveMap:art.texture,emissiveIntensity:.12});
    // Two alpha-cut paper faces give a tiny physical separation without a box.
    const geometry=new T.PlaneGeometry(width,height);
    mesh(geometry,paper,body,[0,height/2,.012]);
    const back=mesh(geometry,paper,body,[0,height/2,-.012]);back.rotation.y=Math.PI;back.castShadow=false;
    const marker=heart(root,[0,height+.4,0],.18);
    return {root,body,marker,height};
  }
  function faceAvatars(dt){
    if(!G||!T)return;
    for(const f of friends){const d=G.camera.position.clone().sub(f.root.position);if(d.x*d.x+d.z*d.z<.0001)continue;const angle=Math.atan2(d.x,d.z),delta=Math.atan2(Math.sin(angle-f.root.rotation.y),Math.cos(angle-f.root.rotation.y));f.root.rotation.y+=delta*(1-Math.exp(-Math.min(dt,.05)*12))}
  }
  function sound(){const ctx=G.audio?.ctx;if(!ctx||!settings.sound||ctx.state!=='running')return;[523,659,784].forEach((freq,i)=>{const o=ctx.createOscillator(),a=ctx.createGain(),at=ctx.currentTime+i*.1;o.type='sine';o.frequency.value=freq;a.gain.setValueAtTime(0,at);a.gain.linearRampToValueAtTime(.055,at+.02);a.gain.exponentialRampToValueAtTime(.001,at+.7);o.connect(a);a.connect(ctx.destination);o.start(at);o.stop(at+.72);o.onended=()=>{o.disconnect();a.disconnect()}})}
  function safePosition(point){const p=v(...point),nav=G.physics.nav;if(nav.isWalkable(p.x,p.z))return p;for(let r=.5;r<5;r+=.5)for(let i=0;i<16;i++){const x=p.x+Math.cos(i*Math.PI/8)*r,z=p.z+Math.sin(i*Math.PI/8)*r;if(nav.isWalkable(x,z))return v(x,0,z)}return G.level.coverPoints.find(p=>p.y===0&&nav.isWalkable(p.x,p.z)).clone()}
  function chooseTarget(){
    const origin=G.camera.position,dir=G.camera.getWorldDirection(v()),ray=new T.Ray(origin,dir);let picked=null,nearest=14;
    for(const f of friends){const center=f.root.position.clone().add(v(0,f.height*.55,0)),hit=ray.intersectSphere(new T.Sphere(center,Math.min(.85,f.height*.43)),v());if(!hit)continue;const dist=origin.distanceTo(hit);if(dist<nearest){const wall=G.physics.raycast(origin,dir,dist);if(!wall||wall.dist>dist-.15){picked=f;nearest=dist}}}
    target=picked;$('target').hidden=!picked;$('reticle').classList.toggle('active',!!picked);if(picked){$('friend-name').textContent=picked.name+(met.has(picked.name)?' · your friend':'');$('portrait').src=picked.index===1||picked.index===4?'assets/wizard.webp':'assets/hedgey.png'}
    return picked;
  }
  function throwHeart(){
    if(G.game.state!=='playing'||cooldown>0)return;cooldown=.55;throwTime=.45;
    const recipient=chooseTarget(),dir=G.camera.getWorldDirection(v()),origin=G.camera.position.clone().addScaledVector(dir,.8).add(v(0,-.25,0));
    const end=recipient?recipient.root.position.clone().add(v(0,1.15,0)):origin.clone().addScaledVector(dir,9).add(v(0,-1.5,0));
    const block=G.physics.raycast(origin,end.clone().sub(origin).normalize(),origin.distanceTo(end));if(!recipient&&block)end.copy(block.point).addScaledVector(block.normal,.12);
    const control=origin.clone().lerp(end,.5).add(v(0,1.25,0)),m=heart(G.scene,origin.toArray(),.36);m.quaternion.copy(G.camera.quaternion);
    hearts.push({mesh:m,start:origin,end,control,age:0,duration:recipient?.65:.95,recipient});
  }
  function receive(f){f.hop=1;sound();
    for(let i=0;i<6;i++){const origin=f.root.position.clone().add(v(0,1.3,0)),m=heart(G.scene,origin.toArray(),.14);m.rotation.y=i;hearts.push({mesh:m,start:origin,velocity:v((Math.random()-.5)*1.5,.6+Math.random(),(Math.random()-.5)*1.5),age:0,duration:1.5,burst:true})}
    if(!met.has(f.name)){met.add(f.name);save();updateCount();toast(`${f.name} ${messages[f.index]}`,5);if(met.size===6)setTimeout(()=>{if(G.game.state==='playing')toast('Six little hearts, all found. Shall we have a picnic by the sea?',6)},4800)}else toast(`${f.name} sends a little love right back. ♡`,2.8);
  }
  function animateHearts(dt){for(let i=hearts.length-1;i>=0;i--){const h=hearts[i];h.age+=dt;const t=Math.min(1,h.age/h.duration);if(h.burst)h.mesh.position.copy(h.start).addScaledVector(h.velocity,h.age);else h.mesh.position.copy(h.start).multiplyScalar((1-t)**2).addScaledVector(h.control,2*(1-t)*t).addScaledVector(h.end,t*t);h.mesh.rotation.y+=dt*1.6;h.mesh.scale.multiplyScalar(1-dt*(h.burst?.4:0));if(t===1){G.scene.remove(h.mesh);h.mesh.material.dispose();hearts.splice(i,1);if(h.recipient)receive(h.recipient)}}}
  function show(state){
    G.game.state=state;G.input.setGameplay(state==='playing');G.input.endFrame?.();G.player.enabled=state==='playing';if(state==='playing'&&!G.input.touch&&!G.input.locked)G.renderer.domElement.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:innerWidth/2,clientY:innerHeight/2,movementX:0,movementY:0}));
    $('title').hidden=state!=='title';$('pause').hidden=state!=='paused'||celebrating;$('complete').hidden=!celebrating;
    for(const id of ['hud','chapter','keys','reticle'])$(id).hidden=state!=='playing';$('target').hidden=true;held.visible=state==='playing';
    if(state!=='playing'){G.input.exitLock();G.audio?.setPaused?.(true)}else G.audio?.setPaused?.(false);updateCount();
  }
  function applySettings(){G.input.sensitivity=settings.sensitivity;G.audio?.setVolume?.(settings.sound?.42:0);const q=window.FLIPSALT.qualities[settings.quality];if(G.quality.name!==q.name)G.render.setQuality({...q});G.quality.rain=.18;G.ground?.setRain?.(.18);const p=G.player.tuning;if(p){p.bobY=settings.gentle?0:.024;p.bobX=settings.gentle?0:.013;p.rollStrafe=settings.gentle?0:.02;p.fovSprint=settings.gentle?0:6}save()}
  function openSettings(){from=G.game.state;show('settings');$('settings').hidden=false;$('sound').checked=settings.sound;$('gentle').checked=settings.gentle;$('sensitivity').value=settings.sensitivity;$('quality').value=settings.quality}
  function bind(){
    $('begin').onclick=()=>G.game.start();$('new-game').onclick=()=>{if(confirm('Begin a brand-new story? This resets only your Flipsalt friendships.')){met.clear();save();G.game.start()}};
    $('pause-button').onclick=()=>show('paused');$('resume').onclick=()=>{show('playing');G.audio.resume?.();G.input.requestLock()};$('return-title').onclick=()=>{celebrating=false;show('title')};
    $('settings-button').onclick=openSettings;$('pause-settings').onclick=openSettings;
    $('close-settings').onclick=()=>{$('settings').hidden=true;applySettings();show(from)};
    $('sound').onchange=e=>{settings.sound=e.target.checked;applySettings();if(settings.sound)G.audio.resume?.()};$('gentle').onchange=e=>{settings.gentle=e.target.checked;applySettings()};$('sensitivity').oninput=e=>{settings.sensitivity=+e.target.value;applySettings()};$('quality').onchange=e=>{settings.quality=e.target.value;applySettings()};
    $('gather').onclick=()=>{if(met.size!==6)return;const center=safePosition([23,0,18]);friends.forEach((f,i)=>{const a=i*Math.PI/3;f.root.position.copy(safePosition([center.x+Math.cos(a)*2.6,0,center.z+Math.sin(a)*2.6]));f.root.lookAt(center.clone().add(v(0,0,4)))});const picnic=new T.Group();picnic.name='The little harbor picnic';picnic.position.copy(center);G.scene.add(picnic);mesh(new T.BoxGeometry(3,.04,2.5),0xe3b6b3,picnic,[0,.05,0]);for(let i=-2;i<=2;i++)mesh(new T.BoxGeometry(.15,.008,2.45),0xffe3c7,picnic,[i*.55,.078,0]);mesh(new T.BoxGeometry(.65,.45,.5),0xbb916d,picnic,[.5,.3,-.2]);for(const x of [-.7,.7]){mesh(new T.CylinderGeometry(.23,.23,.03,16),0xf5dec2,picnic,[x,.1,.5]);orb(picnic,x,.21,.5,.12,0xe0ae87)}G.picnicCenter=center;celebrating=true;show('paused');sound()};$('continue').onclick=()=>{celebrating=false;const p=G.picnicCenter;if(p){G.player.reset({pos:safePosition([p.x,0,p.z+5]),yaw:0});G.player.invulnerable=true}show('playing');G.input.requestLock()};
    addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;if(e.code==='KeyE'&&G.game.state==='playing'){e.preventDefault();throwHeart()}});
    addEventListener('blur',()=>{if(G.game.state==='playing')show('paused')});document.addEventListener('visibilitychange',()=>{if(document.hidden&&G.game.state==='playing')show('paused')});
    G.events.on('input:lock',e=>{if(!e.locked&&G.game.state==='playing'&&G.input.mode==='lock')show('paused')});
    document.querySelectorAll('.t-fire').forEach(b=>{b.setAttribute('aria-label','Throw a heart');b.querySelector('span').textContent='♡'});
    $('begin').disabled=false;$('begin').textContent=met.size?'Back to your little friends ♡':'Once upon a harbor… ♡';
  }
  window.FLIPSALT={
    configure({sun,sky,materials,qualities}){
      this.qualities=qualities;sun.color.set(0xffd7a6);sun.intensity=7.6;
      sky.zenith.set(0x7f8caa);sky.horizon.set(0xf2bb93);sky.horizonAway.set(0xa9a1bc);sky.fog.set(0xc8b7b5);
      for(const [name,color]of Object.entries(palette))if(materials[name])Object.assign(materials[name],{color,tint:1,metal:Math.min(materials[name].metal||0,.25)});
    },
    prepare(n){
      G=n;T=n.THREE;n.params.wet??='.55';n.quality.rain=.18;
      const get=n.mats.get.bind(n.mats);n.mats.get=(name,options={})=>get(name,palette[name]?{...options,color:palette[name]}:options);
      const label=n.mats.label.bind(n.mats);n.mats.label=(text,options)=>label(String(text).replace(/SALTLINE TERMINAL/g,'STORYBOOK HARBOR').replace(/PORT AUTHORITY/g,'A LITTLE LOVE ASHORE').replace(/DANGER/g,'BE KIND').replace(/KEEP CLEAR/g,'STAY AWHILE').replace(/NO ENTRY/g,'HELLO FRIEND').replace(/AUTHORIZED PERSONNEL/g,'EVERYONE WELCOME'),options);
      n.mats.uniforms.wet.value=.55;
    },
    weapon(n){
      heartGeo=makeHeart();held=heart(n.camera,[.29,-.38,-.78],.28);held.rotation.y=-.15;
      return {ads:0,stub:false,reset(){},setVisible(on){held.visible=on},update(dt){cooldown=Math.max(0,cooldown-dt);throwTime=Math.max(0,throwTime-dt);held.position.y=-.38-Math.sin(throwTime/.45*Math.PI)*.18;held.rotation.z=settings.gentle?0:Math.sin(elapsed*1.5)*.04;if(n.input.fire||n.input.pressed('interact'))throwHeart();animateHearts(dt)}};
    },
    async friends(n){
      const [plain,wizard]=await Promise.all([artwork('assets/hedgey.png'),artwork('assets/wizard.webp')]);
      positions.forEach((p,index)=>{const f={...hedgehog(index,index===1||index===4?wizard:plain),index,name:names[index],hop:0};f.root.position.copy(safePosition(p));f.home=f.root.position.clone();f.root.name='Hedgey · '+f.name;n.scene.add(f.root);friends.push(f)});
      return {items:friends,reset(){},raycast(){return null},update(dt){for(const f of friends){f.hop=Math.max(0,f.hop-dt*1.7);f.body.position.y=settings.gentle?0:Math.sin(elapsed*1.5+f.index)*.025+Math.sin(f.hop*Math.PI)*.3;f.body.rotation.z=settings.gentle?0:Math.sin(elapsed+f.index)*.025;f.marker.rotation.y=elapsed*.7;f.marker.scale.setScalar(met.has(f.name)?.2:.14);f.marker.visible=n.camera.position.distanceTo(f.root.position)<25}}};
    },
    hud(){return{update(dt){faceAvatars(dt)},reset(){},message:toast}},
    game(n){
      n.player.damage=()=>{};
      return {state:'title',start(){celebrating=false;n.player.reset();n.player.invulnerable=true;n.player.pitch=-.03;n.audio.resume?.();show('playing');n.input.requestLock();toast(met.size?'Welcome back. There’s always another little hello.':'Six Hedgeys, somewhere in the harbor. Follow the little hearts ♡',6)},update(dt){elapsed+=dt;if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('toast').classList.remove('show')}if(celebrating&&n.picnicCenter){n.camera.position.lerp(n.picnicCenter.clone().add(v(5,4,7)),1-Math.exp(-dt*2));n.camera.lookAt(n.picnicCenter.clone().add(v(0,.8,0)));return false}if(this.state==='title'){const path=n.level.cinematicPath;const a=path[0],b=path[1],t=(Math.sin(elapsed*.07)+1)*.5;n.camera.position.fromArray(a.pos).lerp(v(...b.pos),t*.4);n.camera.lookAt(v(...a.look).lerp(v(...b.look),t*.4));return false}if(this.state!=='playing')return false;if(n.input.pressed('pause')||n.input.uiPressed?.('pause')){show('paused');return false}chooseTarget();const p=n.player.pos;$('location').textContent=p.x<-24?'The welcome gate':p.x>16?'The wishing quay':p.z<-10?'The lantern workshop':'The patchwork lanes';n.audio.setIntensity?.(0);n.render.post.saturation=1.08;n.render.post.damage=0;n.render.post.lowHealth=0;return true}};
    },
    async decorate(n){
      const garden=new T.Group();garden.name='Storybook flowers, bunting & lanterns';n.scene.add(garden);
      function planter(x,z){const g=new T.Group();g.position.set(x,0,z);garden.add(g);mesh(new T.CylinderGeometry(.48,.36,.55,12),0xd0a693,g,[0,.28,0]);mesh(new T.CylinderGeometry(.43,.43,.04,12),0x766a58,g,[0,.57,0]);for(let i=0;i<5;i++){const a=i*2.4,px=Math.cos(a)*.25,pz=Math.sin(a)*.25,h=.8+(i%3)*.15;mesh(new T.CylinderGeometry(.018,.025,h-.5,5),0x859870,g,[px,(h+.5)/2,pz]);for(let j=0;j<5;j++){const b=j*Math.PI*2/5;orb(g,px+Math.cos(b)*.11,h,pz+Math.sin(b)*.11,.09,i%2?0xedb8c0:0xf3d99e,[1,.65,1])}orb(g,px,h+.03,pz,.06,0xe3c67c)}}
      for(const f of friends){planter(f.root.position.x-1.4,f.root.position.z+.7);planter(f.root.position.x+1.4,f.root.position.z+.7)}
      function garland(a,b){const points=[];for(let i=0;i<=24;i++){const t=i/24;points.push(v(...a).lerp(v(...b),t).add(v(0,-Math.sin(t*Math.PI)*.9,0)))}mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),24,.022,5,false),0xc9aa8a,garden);for(let i=1;i<12;i++){const t=i/12,p=v(...a).lerp(v(...b),t).add(v(0,-Math.sin(t*Math.PI)*.9-.22,0));const shape=new T.Shape();shape.moveTo(-.2,.2);shape.lineTo(.2,.2);shape.lineTo(0,-.25);shape.closePath();const flag=mesh(new T.ShapeGeometry(shape),material([0xe2b2b8,0xa8b8a0,0xe8c990][i%3],{side:T.DoubleSide}),garden,p.toArray());flag.rotation.y=Math.atan2(b[0]-a[0],b[2]-a[2])+Math.PI/2}}
      garland([-29,4.4,1],[-23,4.4,10]);garland([-14,5,5],[-4,5,9]);garland([19,4,13],[28,4,18]);
      for(const f of friends){const light=new T.PointLight(0xffcca0,3,7,2);light.position.copy(f.root.position).add(v(0,2.8,0));garden.add(light)}
      // Preserve the harbor and original shadow/post chain; add only warm fill.
      const fill=new T.HemisphereLight(0xffe4c3,0x8c8496,.5);n.scene.add(fill);
      n.render.exposure=1.12;applySettings();bind();show('title');ready=true;
      n.renderer.domElement.dataset.engine='original-saltline';
    }
  };
  addEventListener('error',event=>{if(!ready&&event.message){$('boot-msg').textContent='A little cloud: '+event.message+'. Refresh to try again.'}});
})();
