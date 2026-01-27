import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

export function createViz(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf7fbff);

  const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 200);
  camera.position.set(0, 10, 16);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const light = new THREE.DirectionalLight(0xffffff, 0.9);
  light.position.set(6, 10, 8);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));

  const group = new THREE.Group();
  scene.add(group);

  const nodeGroup = new THREE.Group();
  const chainGroup = new THREE.Group();
  const packetGroup = new THREE.Group();
  group.add(nodeGroup, chainGroup, packetGroup);

  const nodeMeshes = new Map();
  const headMarkers = new Map();
  const packetMeshes = [];
  const chainBlocks = new Map();

  function layoutNodes(count) {
    const positions = [];
    const radius = 5.5;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      positions.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
    }
    return positions;
  }

  function initNodes(nodes) {
    nodeGroup.clear();
    nodeMeshes.clear();
    headMarkers.clear();
    const positions = layoutNodes(nodes.length);
    nodes.forEach((node, i) => {
      const color = node.adversary ? 0xf76c6c : node.producer ? 0x2f8aa0 : 0x8bb7c6;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(node.producer ? 0.32 : 0.24, 16, 16),
        new THREE.MeshStandardMaterial({ color })
      );
      mesh.position.copy(positions[i]);
      nodeGroup.add(mesh);
      nodeMeshes.set(node.id, mesh);

      const marker = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.4, 8),
        new THREE.MeshStandardMaterial({ color: 0xff8a3d })
      );
      marker.position.copy(mesh.position).add(new THREE.Vector3(0, 0.6, 0));
      nodeGroup.add(marker);
      headMarkers.set(node.id, marker);
    });
  }

  function addChainBlock(block) {
    const geometry = new THREE.BoxGeometry(0.4, 0.3, 0.4);
    const material = new THREE.MeshStandardMaterial({ color: 0x88b9c8 });
    const mesh = new THREE.Mesh(geometry, material);
    const offsetY = block.height % 2 === 0 ? 0.5 : -0.5;
    mesh.position.set(-6 + block.height * 0.5, offsetY, -4);
    chainGroup.add(mesh);
    chainBlocks.set(block.id, mesh);
  }

  function updateChainBlock(block) {
    const mesh = chainBlocks.get(block.id);
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

  function spawnPacket(from, to, color = 0xffc857) {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshStandardMaterial({ color })
    );
    sphere.userData = { from, to, progress: 0 };
    packetGroup.add(sphere);
    packetMeshes.push(sphere);
  }

  function updatePackets(delta) {
    for (let i = packetMeshes.length - 1; i >= 0; i--) {
      const mesh = packetMeshes[i];
      const data = mesh.userData;
      data.progress += delta * 0.6;
      const pos = new THREE.Vector3().lerpVectors(data.from, data.to, data.progress);
      mesh.position.copy(pos);
      if (data.progress >= 1) {
        packetGroup.remove(mesh);
        packetMeshes.splice(i, 1);
      }
    }
  }

  function updateNodeMarkers(nodes, headCounts) {
    const headIds = [...headCounts.keys()];
    const colors = [0xff8a3d, 0x6c8ef7, 0x3ddc97];
    nodes.forEach((node) => {
      const marker = headMarkers.get(node.id);
      if (!marker) return;
      const idx = Math.max(0, headIds.indexOf(node.head));
      marker.material.color.set(colors[idx % colors.length]);
    });
  }

  function resize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }

  function render() {
    renderer.render(scene, camera);
  }

  return {
    initNodes,
    addChainBlock,
    updateChainBlock,
    spawnPacket,
    updatePackets,
    updateNodeMarkers,
    render,
    resize,
    scene,
    nodeMeshes,
  };
}
