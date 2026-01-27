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
  const labelGroup = new THREE.Group();
  const tokenGroup = new THREE.Group();
  group.add(nodeGroup, chainGroup, packetGroup, labelGroup, tokenGroup);

  const nodeMeshes = new Map();
  const nodeBase = new Map();
  const headMarkers = new Map();
  const packetMeshes = [];
  const chainBlocks = new Map();
  const eventLabels = [];
  const withheldGlow = new Map();
  const tokenStacks = new Map();

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
    tokenGroup.clear();
    nodeMeshes.clear();
    headMarkers.clear();
    tokenStacks.clear();
    const positions = layoutNodes(nodes.length);
    nodes.forEach((node, i) => {
      const color = node.adversary ? 0xf76c6c : node.producer ? 0x2f8aa0 : 0x8bb7c6;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(node.producer ? 0.34 : 0.24, 16, 16),
        new THREE.MeshStandardMaterial({ color })
      );
      mesh.position.copy(positions[i]);
      nodeGroup.add(mesh);
      nodeMeshes.set(node.id, mesh);
      nodeBase.set(node.id, { color, emissive: 0x000000 });

      const marker = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.4, 8),
        new THREE.MeshStandardMaterial({ color: 0xff8a3d })
      );
      marker.position.copy(mesh.position).add(new THREE.Vector3(0, 0.6, 0));
      nodeGroup.add(marker);
      headMarkers.set(node.id, marker);

      const stack = new THREE.Group();
      stack.position.copy(mesh.position).add(new THREE.Vector3(0, -0.7, 0));
      tokenGroup.add(stack);
      tokenStacks.set(node.id, stack);
    });
  }

  function updateTokenStacks(nodes) {
    nodes.forEach((node) => {
      const stack = tokenStacks.get(node.id);
      if (!stack) return;
      stack.clear();
      const coins = Math.max(0, Math.round(node.stake * 4));
      for (let i = 0; i < coins; i++) {
        const coin = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.16, 0.05, 16),
          new THREE.MeshStandardMaterial({ color: 0xffc857, emissive: 0x7a5a00, emissiveIntensity: 0.2 })
        );
        coin.position.set(0, i * 0.06, 0);
        stack.add(coin);
      }
    });
  }

  function fadeNode(nodeId) {
    const mesh = nodeMeshes.get(nodeId);
    if (!mesh) return;
    mesh.material.transparent = true;
    mesh.material.opacity = 0.25;
    const stack = tokenStacks.get(nodeId);
    if (stack) stack.visible = false;
  }

  function addChainBlock(block, mode) {
    const geometry = new THREE.BoxGeometry(0.4, 0.3, 0.4);
    const material = new THREE.MeshStandardMaterial({ color: 0x88b9c8 });
    const mesh = new THREE.Mesh(geometry, material);
    const offsetY = block.height % 2 === 0 ? 0.6 : -0.6;
    mesh.position.set(-6 + block.height * 0.5, offsetY, -4);
    if (mode === "pow" && block.fork) {
      mesh.position.y *= 1.5;
    }
    chainGroup.add(mesh);
    chainBlocks.set(block.id, mesh);
  }

  function updateChainBlock(block, mode) {
    const mesh = chainBlocks.get(block.id);
    if (!mesh) return;
    if (block.finalized) {
      mesh.material.color.set(0x2f8aa0);
      mesh.material.emissive.set(0x1f6f86);
      mesh.material.emissiveIntensity = 0.7;
    } else if (block.includesTx) {
      mesh.material.color.set(0x3ddc97);
    } else {
      mesh.material.color.set(mode === "pow" ? 0x93b9c7 : 0x88b9c8);
      mesh.material.emissive.set(0x000000);
      mesh.material.emissiveIntensity = 0;
    }
  }

  function markWithheld(blockId) {
    const mesh = chainBlocks.get(blockId);
    if (!mesh) return;
    mesh.material.color.set(0xff4d4d);
    mesh.material.emissive.set(0xff4d4d);
    mesh.material.emissiveIntensity = 0.9;
    withheldGlow.set(blockId, 2.8);
  }

  function updateWithheld(delta) {
    withheldGlow.forEach((ttl, id) => {
      const mesh = chainBlocks.get(id);
      if (!mesh) return;
      const next = ttl - delta;
      if (next <= 0) {
        withheldGlow.delete(id);
        mesh.material.emissiveIntensity = 0;
      } else {
        mesh.material.emissiveIntensity = 0.5 + Math.sin((2.8 - next) * 4) * 0.4;
        withheldGlow.set(id, next);
      }
    });
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

  function updateNodeMarkers(nodes, headCounts, mode) {
    const headIds = [...headCounts.keys()];
    const colors = mode === "pow" ? [0xff8a3d, 0xf76c6c, 0x6c8ef7] : [0x2f8aa0, 0x6c8ef7, 0x3ddc97];
    nodes.forEach((node) => {
      const marker = headMarkers.get(node.id);
      if (!marker) return;
      const idx = Math.max(0, headIds.indexOf(node.head));
      marker.material.color.set(colors[idx % colors.length]);
    });
  }

  function makeLabelSprite(text) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#1f6f86";
    ctx.font = "bold 24px Poppins";
    ctx.fillText(text, 12, 40);
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2.8, 0.7, 1);
    return sprite;
  }

  function addEventLabel(text, position) {
    const sprite = makeLabelSprite(text);
    const pos = new THREE.Vector3(position.x, position.y, position.z);
    sprite.position.copy(pos);
    labelGroup.add(sprite);
    eventLabels.push({ sprite, ttl: 2.4 });
  }

  function updateLabels(delta) {
    for (let i = eventLabels.length - 1; i >= 0; i--) {
      const label = eventLabels[i];
      label.ttl -= delta;
      label.sprite.position.y += delta * 0.4;
      if (label.ttl <= 0) {
        labelGroup.remove(label.sprite);
        eventLabels.splice(i, 1);
      }
    }
  }

  function setAttackPulse(adversaryIds, activeType) {
    if (!activeType) {
      nodeMeshes.forEach((mesh, id) => {
        const base = nodeBase.get(id);
        if (!base) return;
        mesh.material.color.set(base.color);
        mesh.material.emissive.set(0x000000);
        mesh.material.emissiveIntensity = 0;
      });
      return;
    }

    const pulse = 0.5 + Math.sin(Date.now() * 0.008) * 0.5;
    nodeMeshes.forEach((mesh, id) => {
      const base = nodeBase.get(id);
      if (!base) return;
      if (adversaryIds.includes(id)) {
        mesh.material.color.set(0xff4d4d);
        mesh.material.emissive.set(0xff1f1f);
        mesh.material.emissiveIntensity = 0.6 + pulse * 0.6;
      } else {
        mesh.material.color.set(base.color);
        mesh.material.emissive.set(0x000000);
        mesh.material.emissiveIntensity = 0;
      }
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
    updateTokenStacks,
    fadeNode,
    addChainBlock,
    updateChainBlock,
    markWithheld,
    updateWithheld,
    setAttackPulse,
    spawnPacket,
    updatePackets,
    updateNodeMarkers,
    addEventLabel,
    updateLabels,
    render,
    resize,
    scene,
    nodeMeshes,
  };
}
