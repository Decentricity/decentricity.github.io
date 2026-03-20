import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090b10);
scene.fog = new THREE.Fog(0x090b10, 22, 90);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 200);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const clock = new THREE.Clock();
const overlay = document.getElementById("overlay");
const startButton = document.getElementById("startButton");

const keys = {
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false
};

const player = {
  position: new THREE.Vector3(0, 0, 0),
  yaw: 0,
  pitch: -0.16,
  speed: 4.5
};

const cameraOffset = new THREE.Vector3(0.9, 2.2, 4.8);
const cameraTarget = new THREE.Vector3();
const desiredCameraPosition = new THREE.Vector3();
const moveDirection = new THREE.Vector3();
const cameraDirection = new THREE.Vector3();
const strafeDirection = new THREE.Vector3();
const flatForward = new THREE.Vector3();
const yawQuaternion = new THREE.Quaternion();
const pitchQuaternion = new THREE.Quaternion();

let mixer = null;
let avatar = null;
let idleAction = null;
let walkAction = null;
let currentAction = null;

function createWorld() {
  const hemiLight = new THREE.HemisphereLight(0x89b6ff, 0x2f2415, 1.8);
  scene.add(hemiLight);

  const sun = new THREE.DirectionalLight(0xffe0ba, 2.2);
  sun.position.set(10, 18, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 60;
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(180, 180),
    new THREE.MeshStandardMaterial({
      color: 0x141922,
      roughness: 0.92,
      metalness: 0.04
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(180, 90, 0x8fb4ff, 0x243345);
  grid.position.y = 0.01;
  grid.material.opacity = 0.3;
  grid.material.transparent = true;
  scene.add(grid);
}

function setAction(nextAction) {
  if (!nextAction || currentAction === nextAction) {
    return;
  }

  if (currentAction) {
    currentAction.fadeOut(0.18);
  }

  nextAction.reset().fadeIn(0.18).play();
  currentAction = nextAction;
}

function loadAvatar() {
  const loader = new GLTFLoader();

  loader.load(
    "https://threejs.org/examples/models/gltf/Michelle.glb",
    (michelleGltf) => {
      loader.load(
        "https://threejs.org/examples/models/gltf/Xbot.glb",
        (xbotGltf) => {
          avatar = michelleGltf.scene;
          avatar.scale.setScalar(1.35);
          avatar.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          scene.add(avatar);

          const sourceSkeleton = new THREE.SkeletonHelper(xbotGltf.scene);
          const targetSkeleton = new THREE.SkeletonHelper(avatar);
          const targetRoot = avatar.getObjectByName("mixamorigHips") || avatar;

          const idleClip = THREE.AnimationClip.findByName(xbotGltf.animations, "idle");
          const walkClip = THREE.AnimationClip.findByName(xbotGltf.animations, "walk");

          const retargetOptions = {
            hip: "mixamorigHips",
            preservePosition: false,
            preserveHipPosition: true,
            useFirstFramePosition: true
          };

          mixer = new THREE.AnimationMixer(avatar);
          idleAction = mixer.clipAction(
            SkeletonUtils.retargetClip(targetSkeleton, sourceSkeleton, idleClip, retargetOptions),
            targetRoot
          );
          walkAction = mixer.clipAction(
            SkeletonUtils.retargetClip(targetSkeleton, sourceSkeleton, walkClip, retargetOptions),
            targetRoot
          );
          setAction(idleAction);
          updateAvatarTransform();
        },
        undefined,
        (error) => {
          overlay.classList.remove("overlay--hidden");
          overlay.querySelector("p").textContent = "The movement clips failed to load. Reload the page to try again.";
          console.error(error);
        }
      );
    },
    undefined,
    (error) => {
      overlay.classList.remove("overlay--hidden");
      overlay.querySelector("p").textContent = "The avatar failed to load. Reload the page to try again.";
      console.error(error);
    }
  );
}

function updateAvatarTransform() {
  if (!avatar) {
    return;
  }

  avatar.position.copy(player.position);
  avatar.rotation.set(0, player.yaw, 0);
}

function updateMovement(delta) {
  moveDirection.set(0, 0, 0);
  cameraDirection.set(Math.sin(player.yaw), 0, Math.cos(player.yaw)).normalize();
  strafeDirection.set(cameraDirection.z, 0, -cameraDirection.x).normalize();

  if (keys.KeyW) {
    moveDirection.add(cameraDirection);
  }
  if (keys.KeyS) {
    moveDirection.sub(cameraDirection);
  }
  if (keys.KeyA) {
    moveDirection.sub(strafeDirection);
  }
  if (keys.KeyD) {
    moveDirection.add(strafeDirection);
  }

  const isMoving = moveDirection.lengthSq() > 0;

  if (isMoving) {
    moveDirection.normalize();
    player.position.addScaledVector(moveDirection, player.speed * delta);
    player.position.x = THREE.MathUtils.clamp(player.position.x, -70, 70);
    player.position.z = THREE.MathUtils.clamp(player.position.z, -70, 70);
  }

  if (walkAction && idleAction) {
    setAction(isMoving ? walkAction : idleAction);
  }
}

function updateCamera() {
  yawQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw);
  pitchQuaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), player.pitch);

  desiredCameraPosition.copy(cameraOffset).applyQuaternion(pitchQuaternion).applyQuaternion(yawQuaternion);
  desiredCameraPosition.add(player.position);

  camera.position.lerp(desiredCameraPosition, 0.14);

  flatForward.set(0, 1.6, 0).add(player.position);
  cameraTarget.copy(flatForward);
  camera.lookAt(cameraTarget);
}

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.05);

  if (mixer) {
    mixer.update(delta);
  }

  updateMovement(delta);
  updateAvatarTransform();
  updateCamera();
  renderer.render(scene, camera);
}

function lockPointer() {
  renderer.domElement.requestPointerLock();
}

function onPointerLockChange() {
  const locked = document.pointerLockElement === renderer.domElement;
  overlay.classList.toggle("overlay--hidden", locked);
}

function onMouseMove(event) {
  if (document.pointerLockElement !== renderer.domElement) {
    return;
  }

  player.yaw -= event.movementX * 0.0024;
  player.pitch -= event.movementY * 0.0016;
  player.pitch = THREE.MathUtils.clamp(player.pitch, -0.85, 0.45);
}

function onKeyChange(event, pressed) {
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
loadAvatar();
updateCamera();
animate();

startButton.addEventListener("click", lockPointer);
overlay.addEventListener("click", lockPointer);
document.addEventListener("pointerlockchange", onPointerLockChange);
document.addEventListener("mousemove", onMouseMove);
window.addEventListener("keydown", (event) => onKeyChange(event, true));
window.addEventListener("keyup", (event) => onKeyChange(event, false));
window.addEventListener("resize", onResize);
