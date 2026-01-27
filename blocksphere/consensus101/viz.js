import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

export function createViz(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf7fbff);

  const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 200);
  camera.position.set(0, 6, 14);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const light = new THREE.DirectionalLight(0xffffff, 0.9);
  light.position.set(5, 10, 8);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));

  const group = new THREE.Group();
  scene.add(group);

  const headMarker = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.5, 8),
    new THREE.MeshStandardMaterial({ color: 0xff8a3d })
  );
  scene.add(headMarker);

  const txMarker = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.06, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0x2f8aa0 })
  );
  scene.add(txMarker);

  const blocks = new Map();

  function addBlock(block) {
    const geometry = new THREE.BoxGeometry(0.4, 0.3, 0.4);
    const material = new THREE.MeshStandardMaterial({ color: 0x88b9c8 });
    const mesh = new THREE.Mesh(geometry, material);
    const yOffset = block.fork ? (block.height % 2 === 0 ? 0.6 : -0.6) : 0;
    mesh.position.set(block.height * 0.6, yOffset, 0);
    group.add(mesh);
    blocks.set(block.id, mesh);
  }

  function updateBlock(block) {
    const mesh = blocks.get(block.id);
    if (!mesh) return;
    if (block.finalized) {
      mesh.material.color.set(0x2f8aa0);
      mesh.material.emissive.set(0x1f6f86);
      mesh.material.emissiveIntensity = 0.6;
    } else if (block.includesTx) {
      mesh.material.color.set(0x3ddc97);
    } else {
      mesh.material.color.set(0x88b9c8);
      mesh.material.emissive.set(0x000000);
      mesh.material.emissiveIntensity = 0;
    }
  }

  function updateMarkers(state) {
    if (state.head) {
      const mesh = blocks.get(state.head.id);
      if (mesh) {
        headMarker.position.set(mesh.position.x, mesh.position.y + 0.6, mesh.position.z);
      }
    }
    if (state.txBlockId) {
      const txMesh = blocks.get(state.txBlockId);
      if (txMesh) {
        txMarker.visible = true;
        txMarker.position.set(txMesh.position.x, txMesh.position.y - 0.5, txMesh.position.z);
      }
    } else {
      txMarker.visible = false;
    }
  }

  function resize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }

  function render() {
    renderer.render(scene, camera);
  }

  return { scene, addBlock, updateBlock, updateMarkers, render, resize, blocks, group, camera };
}
