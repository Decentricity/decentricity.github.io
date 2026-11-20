import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createRetargeter } from './retarget.js?v=2';

const el = id => document.getElementById(id);
const stage = el('stage');
const status = el('status');
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const format = time => {
  const seconds = Math.max(0, Math.floor(time));
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
};
let clips = [];
let clip;
let buttons = [];
let selected;
let request = 0;
let mixer, action, retarget, avatar, hips;
let renderer, scene, camera, orbitCamera, controls;
let faceAnchor;
const facePosition = new THREE.Vector3();
const faceRotation = new THREE.Quaternion();
const shadowCenter = new THREE.Vector3();

function resize() {
  renderer.setSize(stage.clientWidth, stage.clientHeight, false);
  camera.aspect = stage.clientWidth / stage.clientHeight;
  camera.updateProjectionMatrix();
  orbitCamera.aspect = camera.aspect;
  orbitCamera.updateProjectionMatrix();
}

function resetView() {
  orbitCamera.position.set(0, 0, 1.7);
  controls.update();
}

function attachFaceAnchor(avatar) {
  const head = avatar.getObjectByName('Head');
  const skin = avatar.getObjectByProperty('isSkinnedMesh', true).skeleton;
  const meshToHead = skin.boneInverses[skin.bones.indexOf(head)];
  // The avatar mesh is Z-up and faces +X in bind space.
  const faceFrame = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)
  );
  const anchor = new THREE.Object3D();
  anchor.position.set(0.003, 0, 0.0482).applyMatrix4(meshToHead);
  anchor.quaternion.setFromRotationMatrix(new THREE.Matrix4().extractRotation(meshToHead).multiply(faceFrame));
  head.add(anchor);
  return anchor;
}

function updateCamera() {
  // OrbitControls works in face space. Apply the head pose only to the
  // rendering camera, so even a head tilt leaves the chosen view intact.
  controls.update();
  if (faceAnchor) {
    faceAnchor.getWorldPosition(facePosition);
    faceAnchor.getWorldQuaternion(faceRotation);
  }
  camera.position.copy(orbitCamera.position).applyQuaternion(faceRotation).add(facePosition);
  camera.quaternion.copy(faceRotation).multiply(orbitCamera.quaternion);
}

function setupStage() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor('#222d37');
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.28;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  stage.prepend(renderer.domElement);
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#222d37', 10, 31);
  camera = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
  orbitCamera = camera.clone();
  controls = new OrbitControls(orbitCamera, renderer.domElement);
  controls.enablePan = false;
  controls.minDistance = 0.55;
  controls.maxDistance = 12;
  resetView();

  scene.add(new THREE.HemisphereLight('#d9edff', '#6a707d', 2.2));
  const key = new THREE.DirectionalLight('#fff0dd', 2.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, far: 24 });
  key.shadow.normalBias = 0.025;
  const fill = new THREE.DirectionalLight('#84c8df', 1.1);
  fill.position.set(-4, 3, -6);
  scene.add(key, key.target, fill);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), new THREE.MeshStandardMaterial({ color: '#26323c', roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.position.y = -0.025;
  scene.add(floor);
  const grid = new THREE.GridHelper(140, 140, '#576c77', '#3b4c58');
  grid.position.y = -0.018;
  scene.add(grid);

  new ResizeObserver(resize).observe(stage);
  resize();
  let previous = performance.now();
  renderer.setAnimationLoop(now => {
    if (action) {
      mixer.update(Math.min((now - previous) / 1000, 0.08));
      retarget.apply();
      hips.getWorldPosition(shadowCenter);
      shadowCenter.y = 0;
      key.position.set(shadowCenter.x + 3, 6, shadowCenter.z + 4);
      key.target.position.copy(shadowCenter);
      updateTimeline();
    }
    previous = now;
    updateCamera();
    renderer.render(scene, camera);
  });
}

function renderLibrary() {
  const query = el('search').value.trim().toLowerCase();
  const category = el('filter').value;
  const matches = clips.filter(item => (!category || category === item.group) &&
    (item.title + ' ' + item.group + ' ' + item.code).toLowerCase().includes(query));
  el('count').textContent = matches.length === clips.length ? clips.length + ' clips' : matches.length + ' of ' + clips.length;
  const fragment = document.createDocumentFragment();
  let group;
  buttons = [];
  for (const item of matches) {
    if (group !== item.group) {
      group = item.group;
      const heading = document.createElement('h3');
      heading.textContent = group;
      fragment.append(heading);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'clip';
    button.innerHTML = '<span aria-hidden="true" class="clip-icon">▶</span><span></span><span class="clip-duration"></span>';
    button.children[1].textContent = item.title;
    button.children[2].textContent = item.seconds.toFixed(1) + ' s';
    button.setAttribute('aria-pressed', String(item === selected));
    button.addEventListener('click', () => select(item));
    buttons.push({ item, button });
    fragment.append(button);
  }
  if (!matches.length) {
    const message = document.createElement('p');
    message.className = 'empty';
    message.textContent = 'No movements match your search.';
    fragment.append(message);
  }
  el('clips').replaceChildren(fragment);
}

function updateTimeline() {
  const end = action.getClip().duration;
  el('seek').value = action.time / end;
  const time = format(action.time) + ' / ' + format(end);
  if (el('time').textContent !== time) el('time').textContent = time;
}

function setPlayback(playing) {
  action.paused = !playing;
  el('play').textContent = playing ? 'Pause' : 'Play';
  status.textContent = playing ? 'Playing' : 'Paused';
}

function setLoop() {
  if (action) action.setLoop(el('loop').checked ? THREE.LoopRepeat : THREE.LoopOnce, el('loop').checked ? Infinity : 1);
}

function styleAvatarMaterial(material) {
  material.metalness = 0;
  material.roughness = 0.88;
  material.onBeforeCompile = shader => {
    shader.uniforms.hairBrown = { value: new THREE.Color('#49291f') };
    shader.uniforms.hairRed = { value: new THREE.Color('#a63038') };
    shader.uniforms.shirtColor = { value: new THREE.Color('#315651') };
    shader.uniforms.trouserColor = { value: new THREE.Color('#344257') };
    shader.uniforms.shoeColor = { value: new THREE.Color('#48332f') };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 hairRestPosition;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nhairRestPosition = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 hairRestPosition;
        uniform vec3 hairBrown;
        uniform vec3 hairRed;
        uniform vec3 shirtColor;
        uniform vec3 trouserColor;
        uniform vec3 shoeColor;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        // The original atlas assigns hair and clothing to separate palette bands.
        if (vMapUv.y >= 11.0 / 32.0 && vMapUv.y < 17.0 / 32.0) {
          // Use the rest position so the streaks follow the skinned hair.
          float angle = atan(hairRestPosition.y, hairRestPosition.x + 0.00045);
          float sweep = angle + (hairRestPosition.z - 0.048) * 65.0;
          float streak = smoothstep(0.89, 0.99, cos(5.0 * sweep - 0.8));
          float strands = 0.94 + 0.06 * cos(107.0 * sweep);
          diffuseColor.rgb = mix(hairBrown, hairRed, streak) * strands;
        } else if (vMapUv.y >= 28.0 / 32.0) {
          diffuseColor.rgb = shoeColor;
        } else if (vMapUv.y >= 23.0 / 32.0) {
          diffuseColor.rgb = trouserColor;
        } else if (vMapUv.y >= 17.0 / 32.0) {
          diffuseColor.rgb = shirtColor;
        }`);
  };
}

function disposeMeshes(root) {
  const resources = new Set();
  root.traverse(node => {
    if (!node.isMesh) return;
    resources.add(node.geometry);
    for (const material of [node.material].flat()) {
      resources.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
    }
  });
  for (const resource of resources) resource.dispose();
}

async function select(item) {
  if (!avatar) return;
  const ticket = ++request;
  selected = item;
  for (const entry of buttons) entry.button.setAttribute('aria-pressed', String(entry.item === selected));
  status.textContent = 'Loading ' + item.title + '…';
  for (const id of ['play', 'restart', 'seek']) el(id).disabled = true;
  try {
    const motion = await loader.loadAsync('./clips/' + item.code + '.glb');
    try {
      if (ticket !== request) return;
      const nextRetarget = createRetargeter(motion.scene, avatar);
      const nextMixer = new THREE.AnimationMixer(motion.scene);
      const nextAction = nextMixer.clipAction(motion.animations[0]);
      mixer?.stopAllAction();
      retarget = nextRetarget;
      mixer = nextMixer;
      action = nextAction;
      action.clampWhenFinished = true;
      setLoop();
      action.timeScale = Number(el('speed').value);
      action.play();
      mixer.update(0);
      retarget.apply();
      mixer.addEventListener('finished', () => {
        if (selected !== item) return;
        setPlayback(false);
        status.textContent = 'Finished';
      });
      clip = item;
      el('clip-group').textContent = item.group;
      el('clip-title').textContent = item.title;
      setPlayback(true);
      updateTimeline();
    } finally {
      disposeMeshes(motion.scene);
    }
  } catch (error) {
    if (ticket !== request) return;
    console.error(error);
    selected = clip;
    for (const entry of buttons) entry.button.setAttribute('aria-pressed', String(entry.item === selected));
    status.textContent = 'Could not load ' + item.title + '. Click to retry.';
  } finally {
    if (ticket === request && action) {
      for (const id of ['play', 'restart', 'seek']) el(id).disabled = false;
    }
  }
}

el('search').addEventListener('input', renderLibrary);
el('filter').addEventListener('change', renderLibrary);
el('camera').addEventListener('click', () => { if (camera) resetView(); });
el('play').addEventListener('click', () => {
  if (!action) return;
  if (action.paused && action.time >= action.getClip().duration) action.reset().play();
  setPlayback(action.paused);
});
el('restart').addEventListener('click', () => {
  action.reset().play();
  setPlayback(true);
});
el('speed').addEventListener('change', () => { if (action) action.timeScale = Number(el('speed').value); });
el('loop').addEventListener('change', setLoop);
el('seek').addEventListener('input', () => {
  action.time = Math.min(Number(el('seek').value) * action.getClip().duration, action.getClip().duration - 0.00001);
  mixer.update(0);
  updateTimeline();
});

try {
  setupStage();
  const [manifest, model] = await Promise.all([
    fetch('./clips.json?v=250').then(response => {
      if (!response.ok) throw new Error('Clip list unavailable');
      return response.json();
    }),
    loader.loadAsync('./avatar.glb?v=7')
  ]);
  clips = manifest;
  avatar = model.scene;
  hips = avatar.getObjectByName('Hips');
  avatar.scale.setScalar(0.36);
  avatar.traverse(node => {
    if (node.isMesh) {
      if (node.material.name === 'Material') styleAvatarMaterial(node.material);
      node.castShadow = true;
      node.frustumCulled = false;
    }
  });
  faceAnchor = attachFaceAnchor(avatar);
  scene.add(avatar);
  for (const group of new Set(clips.map(item => item.group))) el('filter').add(new Option(group, group));
  renderLibrary();
  await select(clips[0]);
} catch (error) {
  console.error(error);
  status.textContent = 'Could not start the 3D player. Reload to try again.';
}
