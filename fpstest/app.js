import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa0a0a0);
scene.fog = new THREE.Fog(0xa0a0a0, 10, 50);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 2, 4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const overlay = document.getElementById("overlay");
const startButton = document.getElementById("startButton");
const clock = new THREE.Clock();
const loader = new GLTFLoader();

const keys = {
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false
};

const player = {
  yaw: 0,
  pitch: -0.12,
  position: new THREE.Vector3(0, 0, 0),
  speed: 2.2
};

const cameraOffset = new THREE.Vector3(0, 1.85, 3.6);
const cameraTarget = new THREE.Vector3();
const desiredCameraPosition = new THREE.Vector3();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const move = new THREE.Vector3();
const yawQuaternion = new THREE.Quaternion();
const pitchQuaternion = new THREE.Quaternion();

let model = null;
let mixer = null;
let idleAction = null;
let walkAction = null;
let currentAction = null;

function createWorld() {
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x8d8d8d, 3);
  hemiLight.position.set(0, 20, 0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 3);
  dirLight.position.set(3, 10, 10);
  dirLight.castShadow = true;
  dirLight.shadow.camera.top = 2;
  dirLight.shadow.camera.bottom = -2;
  dirLight.shadow.camera.left = -2;
  dirLight.shadow.camera.right = 2;
  dirLight.shadow.camera.near = 0.1;
  dirLight.shadow.camera.far = 40;
  scene.add(dirLight);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshPhongMaterial({ color: 0xcbcbcb, depthWrite: false })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(100, 50, 0x777777, 0x999999);
  grid.position.y = 0.01;
  grid.material.opacity = 0.2;
  grid.material.transparent = true;
  scene.add(grid);
}

function setAction(nextAction) {
  if (!nextAction || currentAction === nextAction) {
    return;
  }

  if (currentAction) {
    currentAction.fadeOut(0.2);
  }

  nextAction.reset().fadeIn(0.2).play();
  currentAction = nextAction;
}

function loadPlayer() {
  loader.load(
    "https://threejs.org/examples/models/gltf/Xbot.glb",
    (gltf) => {
      model = gltf.scene;
      scene.add(model);

      model.traverse((object) => {
        if (object.isMesh) {
          object.castShadow = true;
        }
      });

      mixer = new THREE.AnimationMixer(model);
      idleAction = mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, "idle"));
      walkAction = mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, "walk"));
      setAction(idleAction);
      updateModelTransform();
      updateCamera(true);
    },
    undefined,
    (error) => {
      overlay.classList.remove("overlay--hidden");
      overlay.querySelector("p").textContent = "The mannequin failed to load. Reload the page to try again.";
      console.error(error);
    }
  );
}

function updateModelTransform() {
  if (!model) {
    return;
  }

  model.position.copy(player.position);
  model.rotation.set(0, player.yaw + Math.PI, 0);
}

function updateMovement(delta) {
  move.set(0, 0, 0);
  forward.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw)).normalize();
  right.set(forward.z, 0, -forward.x).normalize();

  if (keys.KeyW) {
    move.add(forward);
  }
  if (keys.KeyS) {
    move.sub(forward);
  }
  if (keys.KeyA) {
    move.sub(right);
  }
  if (keys.KeyD) {
    move.add(right);
  }

  const moving = move.lengthSq() > 0;

  if (moving) {
    move.normalize();
    player.position.addScaledVector(move, player.speed * delta);
    player.position.x = THREE.MathUtils.clamp(player.position.x, -20, 20);
    player.position.z = THREE.MathUtils.clamp(player.position.z, -20, 20);
  }

  if (idleAction && walkAction) {
    setAction(moving ? walkAction : idleAction);
  }
}

function updateCamera(snap = false) {
  yawQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw);
  pitchQuaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), player.pitch);

  desiredCameraPosition.copy(cameraOffset).applyQuaternion(pitchQuaternion).applyQuaternion(yawQuaternion);
  desiredCameraPosition.add(player.position);

  if (snap) {
    camera.position.copy(desiredCameraPosition);
  } else {
    camera.position.lerp(desiredCameraPosition, 0.14);
  }

  cameraTarget.set(player.position.x, player.position.y + 1.45, player.position.z);
  camera.lookAt(cameraTarget);
}

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.05);

  if (mixer) {
    mixer.update(delta);
  }

  updateMovement(delta);
  updateModelTransform();
  updateCamera();
  renderer.render(scene, camera);
}

function onMouseMove(event) {
  if (document.pointerLockElement !== renderer.domElement) {
    return;
  }

  player.yaw -= event.movementX * 0.0025;
  player.pitch -= event.movementY * 0.0015;
  player.pitch = THREE.MathUtils.clamp(player.pitch, -0.75, 0.35);
}

function onPointerLockChange() {
  const locked = document.pointerLockElement === renderer.domElement;
  overlay.classList.toggle("overlay--hidden", locked);
}

function setKey(event, pressed) {
  if (event.code in keys) {
    keys[event.code] = pressed;
  }
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

createWorld();
loadPlayer();
animate();

startButton.addEventListener("click", () => renderer.domElement.requestPointerLock());
overlay.addEventListener("click", () => renderer.domElement.requestPointerLock());
document.addEventListener("pointerlockchange", onPointerLockChange);
document.addEventListener("mousemove", onMouseMove);
window.addEventListener("keydown", (event) => setKey(event, true));
window.addEventListener("keyup", (event) => setKey(event, false));
window.addEventListener("resize", onResize);
