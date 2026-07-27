import * as THREE from "three";

const canvas = document.querySelector("#scene");
const statusEl = document.querySelector("#status");
const arButton = document.querySelector("#ar-button");
const randomizeButton = document.querySelector("#randomize-button");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101820);

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.01,
  60,
);
camera.position.set(0, 1.45, 3.2);

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType("local");
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const room = new THREE.Group();
scene.add(room);

const hemiLight = new THREE.HemisphereLight(0xeef7ff, 0x384530, 1.8);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
keyLight.position.set(-3, 5, 4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 0.1;
keyLight.shadow.camera.far = 15;
keyLight.shadow.camera.left = -6;
keyLight.shadow.camera.right = 6;
keyLight.shadow.camera.top = 6;
keyLight.shadow.camera.bottom = -6;
scene.add(keyLight);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(5.5, 96),
  new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.22 }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
floor.visible = true;
scene.add(floor);

const reticle = new THREE.Mesh(
  new THREE.RingGeometry(0.08, 0.105, 32).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0x57d6a5, transparent: true, opacity: 0.92 }),
);
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add(reticle);

let xrSession = null;
let hitTestSource = null;
let hitTestSourceRequested = false;
let placedInXR = false;

const random = mulberry32(Date.now());
const materials = {
  walnut: mat(0x7a5136, 0.55, 0.45),
  oak: mat(0xb7895c, 0.48, 0.5),
  blackMetal: mat(0x15181c, 0.75, 0.22),
  brushed: mat(0x9aa5ac, 0.38, 0.32),
  glass: new THREE.MeshPhysicalMaterial({
    color: 0xaed9ff,
    metalness: 0,
    roughness: 0.04,
    transmission: 0.35,
    thickness: 0.03,
    transparent: true,
    opacity: 0.55,
  }),
  ceramic: mat(0xf0eee4, 0.12, 0.64),
  darkCeramic: mat(0x263036, 0.2, 0.55),
  fabricBlue: mat(0x355d7b, 0.04, 0.86),
  fabricGreen: mat(0x476b4f, 0.04, 0.88),
  plant: mat(0x2f7d45, 0.02, 0.72),
  bookRed: mat(0xa64235, 0.08, 0.76),
  bookTeal: mat(0x24756f, 0.08, 0.76),
  bookGold: mat(0xc8a755, 0.1, 0.64),
  screen: new THREE.MeshStandardMaterial({
    color: 0x07111b,
    emissive: 0x19344d,
    emissiveIntensity: 0.55,
    roughness: 0.2,
    metalness: 0.05,
  }),
};

buildRoomScatter(room);
updateSupportStatus();

window.addEventListener("resize", onResize);
randomizeButton.addEventListener("click", () => {
  const preserveTransform = xrSession && placedInXR;
  const position = room.position.clone();
  const quaternion = room.quaternion.clone();
  const scale = room.scale.clone();

  buildRoomScatter(room);

  if (preserveTransform) {
    room.position.copy(position);
    room.quaternion.copy(quaternion);
    room.scale.copy(scale);
  }

  statusEl.textContent = xrSession
    ? "Objects refreshed"
    : "Random set ready";
});
arButton.addEventListener("click", toggleAR);

renderer.setAnimationLoop(render);

function mat(color, metalness, roughness) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}

function buildRoomScatter(target) {
  target.clear();
  const choices = [
    makeDesk,
    makeLaptop,
    makeRoundTable,
    makeCafeChair,
    makeFloorLamp,
    makePlant,
    makeStackedBooks,
    makeMug,
    makeSideTable,
    makeStorageBox,
  ];
  const count = 8 + Math.floor(random() * 5);
  const used = [];

  for (let i = 0; i < count; i += 1) {
    const maker = choices[Math.floor(random() * choices.length)];
    const object = maker();
    const spot = getOpenSpot(used);
    object.position.set(spot.x, 0, spot.z);
    object.rotation.y = spot.rotation;
    object.scale.setScalar(0.86 + random() * 0.34);
    target.add(object);
  }

  target.position.set(0, 0, -1.8);
  target.rotation.y = 0;
}

function getOpenSpot(used) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const radius = 0.35 + random() * 1.85;
    const angle = random() * Math.PI * 2;
    const spot = {
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      rotation: random() * Math.PI * 2,
    };
    const clear = used.every((other) => {
      const dx = spot.x - other.x;
      const dz = spot.z - other.z;
      return Math.hypot(dx, dz) > 0.62;
    });
    if (clear) {
      used.push(spot);
      return spot;
    }
  }

  const fallback = {
    x: (random() - 0.5) * 3,
    z: (random() - 0.5) * 3,
    rotation: random() * Math.PI * 2,
  };
  used.push(fallback);
  return fallback;
}

function makeDesk() {
  const group = new THREE.Group();
  box(group, [0, 0.74, 0], [1.12, 0.08, 0.66], materials.walnut, true);
  const legPositions = [
    [-0.48, 0.36, -0.26],
    [0.48, 0.36, -0.26],
    [-0.48, 0.36, 0.26],
    [0.48, 0.36, 0.26],
  ];
  legPositions.forEach((position) => {
    box(group, position, [0.075, 0.72, 0.075], materials.blackMetal, true);
  });
  box(group, [0.28, 0.82, -0.11], [0.42, 0.018, 0.28], materials.brushed, true);
  box(group, [0.28, 0.98, -0.24], [0.42, 0.25, 0.025], materials.screen, true);
  return group;
}

function makeLaptop() {
  const group = new THREE.Group();
  box(group, [0, 0.035, 0], [0.58, 0.035, 0.38], materials.brushed, true);
  const screen = box(group, [0, 0.245, -0.185], [0.58, 0.36, 0.025], materials.screen, true);
  screen.rotation.x = -0.12;
  box(group, [0, 0.057, 0.02], [0.42, 0.006, 0.22], materials.blackMetal, false);
  return group;
}

function makeRoundTable() {
  const group = new THREE.Group();
  cylinder(group, [0, 0.72, 0], 0.44, 0.06, materials.oak, true);
  cylinder(group, [0, 0.36, 0], 0.08, 0.72, materials.blackMetal, true);
  cylinder(group, [0, 0.035, 0], 0.3, 0.07, materials.blackMetal, true);
  return group;
}

function makeSideTable() {
  const group = new THREE.Group();
  box(group, [0, 0.48, 0], [0.52, 0.06, 0.52], materials.oak, true);
  box(group, [0, 0.35, 0], [0.38, 0.22, 0.42], materials.walnut, true);
  box(group, [0, 0.62, 0], [0.34, 0.22, 0.34], materials.glass, true);
  return group;
}

function makeCafeChair() {
  const group = new THREE.Group();
  box(group, [0, 0.46, 0], [0.48, 0.08, 0.45], materials.fabricBlue, true);
  box(group, [0, 0.78, 0.19], [0.5, 0.55, 0.07], materials.fabricBlue, true);
  [
    [-0.19, 0.23, -0.16],
    [0.19, 0.23, -0.16],
    [-0.19, 0.23, 0.16],
    [0.19, 0.23, 0.16],
  ].forEach((position) => box(group, position, [0.055, 0.46, 0.055], materials.blackMetal, true));
  return group;
}

function makeFloorLamp() {
  const group = new THREE.Group();
  cylinder(group, [0, 0.03, 0], 0.22, 0.06, materials.blackMetal, true);
  cylinder(group, [0, 0.72, 0], 0.025, 1.35, materials.blackMetal, true);
  const shade = cone(group, [0, 1.38, 0], 0.26, 0.33, materials.ceramic, true);
  shade.rotation.x = Math.PI;
  const bulb = sphere(group, [0, 1.26, 0], 0.08, new THREE.MeshStandardMaterial({
    color: 0xfff4cc,
    emissive: 0xffcc77,
    emissiveIntensity: 1.3,
    roughness: 0.34,
  }), false);
  const glow = new THREE.PointLight(0xffd89a, 0.9, 2.2);
  glow.position.copy(bulb.position);
  group.add(glow);
  return group;
}

function makePlant() {
  const group = new THREE.Group();
  cylinder(group, [0, 0.2, 0], 0.2, 0.4, materials.darkCeramic, true);
  sphere(group, [0, 0.5, 0], 0.28, materials.plant, true).scale.y = 0.75;
  for (let i = 0; i < 12; i += 1) {
    const leaf = sphere(group, [0, 0.58, 0], 0.12 + random() * 0.05, materials.plant, true);
    leaf.scale.set(0.55, 0.16, 1.45);
    leaf.position.x = Math.cos(i * 0.9) * (0.08 + random() * 0.16);
    leaf.position.z = Math.sin(i * 0.9) * (0.08 + random() * 0.16);
    leaf.position.y += random() * 0.25;
    leaf.rotation.set(random() * 0.8, i * 0.9, random() * 0.6);
  }
  return group;
}

function makeStackedBooks() {
  const group = new THREE.Group();
  const colors = [materials.bookRed, materials.bookTeal, materials.bookGold, materials.ceramic];
  const layers = 3 + Math.floor(random() * 3);
  let y = 0.025;
  for (let i = 0; i < layers; i += 1) {
    const height = 0.04 + random() * 0.025;
    const book = box(
      group,
      [(random() - 0.5) * 0.035, y, (random() - 0.5) * 0.035],
      [0.42 + random() * 0.1, height, 0.28 + random() * 0.08],
      colors[i % colors.length],
      true,
    );
    book.rotation.y = (random() - 0.5) * 0.18;
    y += height;
  }
  return group;
}

function makeMug() {
  const group = new THREE.Group();
  cylinder(group, [0, 0.14, 0], 0.15, 0.28, materials.ceramic, true);
  cylinder(group, [0, 0.29, 0], 0.135, 0.012, materials.darkCeramic, false);
  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.11, 0.018, 10, 24, Math.PI * 1.35),
    materials.ceramic,
  );
  handle.position.set(0.14, 0.16, 0);
  handle.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  handle.castShadow = true;
  group.add(handle);
  return group;
}

function makeStorageBox() {
  const group = new THREE.Group();
  box(group, [0, 0.23, 0], [0.54, 0.42, 0.46], materials.fabricGreen, true);
  box(group, [0, 0.47, 0], [0.58, 0.06, 0.5], materials.oak, true);
  box(group, [0, 0.25, -0.235], [0.2, 0.045, 0.018], materials.brushed, true);
  return group;
}

function box(group, position, scale, material, shadows) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...scale), material);
  mesh.position.set(...position);
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  group.add(mesh);
  return mesh;
}

function cylinder(group, position, radius, height, material, shadows) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 40), material);
  mesh.position.set(...position);
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  group.add(mesh);
  return mesh;
}

function cone(group, position, radius, height, material, shadows) {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 40, 1, true), material);
  mesh.position.set(...position);
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  group.add(mesh);
  return mesh;
}

function sphere(group, position, radius, material, shadows) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), material);
  mesh.position.set(...position);
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  group.add(mesh);
  return mesh;
}

async function updateSupportStatus() {
  if (!("xr" in navigator)) {
    statusEl.textContent = "WebXR unavailable in this browser";
    arButton.disabled = true;
    return;
  }

  const arSupported = await navigator.xr.isSessionSupported("immersive-ar");
  if (!arSupported) {
    statusEl.textContent = "Use Quest Browser with WebXR AR enabled";
    arButton.disabled = true;
    return;
  }

  statusEl.textContent = "Ready for passthrough";
}

async function toggleAR() {
  if (xrSession) {
    await xrSession.end();
    return;
  }

  try {
    const session = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: ["local"],
      optionalFeatures: ["hit-test", "dom-overlay"],
      domOverlay: { root: document.body },
    });
    await renderer.xr.setSession(session);
    onSessionStarted(session);
  } catch (error) {
    statusEl.textContent = "MR session was not started";
  }
}

function onSessionStarted(session) {
  xrSession = session;
  document.body.classList.add("xr-active");
  scene.background = null;
  floor.visible = false;
  room.visible = false;
  room.position.set(0, 0, -1.8);
  placedInXR = false;
  arButton.textContent = "Exit MR";
  statusEl.textContent = "Aim and pinch";

  session.addEventListener("end", onSessionEnded);
  session.addEventListener("select", placeRoomAtReticle);
}

function onSessionEnded() {
  xrSession = null;
  hitTestSource = null;
  hitTestSourceRequested = false;
  document.body.classList.remove("xr-active");
  scene.background = new THREE.Color(0x101820);
  floor.visible = true;
  room.visible = true;
  reticle.visible = false;
  arButton.textContent = "Enter MR";
  statusEl.textContent = "Ready for passthrough";
}

function placeRoomAtReticle() {
  if (!reticle.visible) {
    const cameraDirection = new THREE.Vector3(0, -0.28, -1).applyQuaternion(camera.quaternion).normalize();
    room.position.copy(camera.position).add(cameraDirection.multiplyScalar(1.4));
    room.position.y = Math.max(0, room.position.y - 0.25);
  } else {
    reticle.matrix.decompose(room.position, room.quaternion, room.scale);
    room.scale.setScalar(1);
  }

  const lookAt = new THREE.Vector3(camera.position.x, room.position.y, camera.position.z);
  room.lookAt(lookAt);
  room.rotateY(Math.PI);
  room.visible = true;
  placedInXR = true;
  statusEl.textContent = "Scene placed";
}

function render(timestamp, frame) {
  if (frame && xrSession) {
    updateReticle(frame);
    if (!placedInXR && !hitTestSourceRequested) {
      statusEl.textContent = "Looking for floor";
    }
  }

  room.children.forEach((child, index) => {
    child.rotation.y += Math.sin(timestamp * 0.0002 + index) * 0.00035;
  });

  renderer.render(scene, camera);
}

function updateReticle(frame) {
  const referenceSpace = renderer.xr.getReferenceSpace();
  const session = renderer.xr.getSession();

  if (!hitTestSourceRequested) {
    if (!session.requestHitTestSource) {
      hitTestSourceRequested = true;
      statusEl.textContent = "Pinch to place";
      return;
    }

    session.requestReferenceSpace("viewer")
      .then((viewerSpace) => session.requestHitTestSource({ space: viewerSpace }))
      .then((source) => {
        hitTestSource = source;
      })
      .catch(() => {
        hitTestSource = null;
        statusEl.textContent = "Pinch to place";
      });

    session.addEventListener("end", () => {
      hitTestSourceRequested = false;
      hitTestSource = null;
    });

    hitTestSourceRequested = true;
  }

  if (!hitTestSource) {
    return;
  }

  const hitTestResults = frame.getHitTestResults(hitTestSource);
  if (hitTestResults.length > 0) {
    const hit = hitTestResults[0];
    const pose = hit.getPose(referenceSpace);
    reticle.visible = true;
    reticle.matrix.fromArray(pose.transform.matrix);
    if (!placedInXR) {
      statusEl.textContent = "Pinch to place";
    }
  } else {
    reticle.visible = false;
  }
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return function rand() {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
