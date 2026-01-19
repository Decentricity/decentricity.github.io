(function() {
    'use strict';

    // Level sizes aligned with game levels.json (0..12)
    const LEVEL_SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

    // Faces and axes (same coordinate system as the game)
    const FACES = {
        '+X': { normal: new THREE.Vector3(1, 0, 0), uAxis: new THREE.Vector3(0, 0, -1), vAxis: new THREE.Vector3(0, 1, 0) },
        '-X': { normal: new THREE.Vector3(-1, 0, 0), uAxis: new THREE.Vector3(0, 0, 1), vAxis: new THREE.Vector3(0, 1, 0) },
        '+Y': { normal: new THREE.Vector3(0, 1, 0), uAxis: new THREE.Vector3(1, 0, 0), vAxis: new THREE.Vector3(0, 0, -1) },
        '-Y': { normal: new THREE.Vector3(0, -1, 0), uAxis: new THREE.Vector3(1, 0, 0), vAxis: new THREE.Vector3(0, 0, 1) },
        '+Z': { normal: new THREE.Vector3(0, 0, 1), uAxis: new THREE.Vector3(1, 0, 0), vAxis: new THREE.Vector3(0, 1, 0) },
        '-Z': { normal: new THREE.Vector3(0, 0, -1), uAxis: new THREE.Vector3(-1, 0, 0), vAxis: new THREE.Vector3(0, 1, 0) }
    };

    // Spawn tiles from the game levels.json (levels 0-6).
    const SPAWN_TILES = {
        '0': [
            { face: '+Z', u: 0, v: 0, team: 'blue' }
        ],
        '1': [
            { face: '+Z', u: 0, v: 0, team: 'blue' },
            { face: '-Z', u: 0, v: 0, team: 'red' }
        ],
        '2': [
            { face: '+Z', u: 0, v: 0, team: 'blue' },
            { face: '+Z', u: 1, v: 1, team: 'blue' },
            { face: '-Z', u: 0, v: 1, team: 'red' }
        ],
        '3': [
            { face: '+Z', u: 0, v: 0, team: 'blue' },
            { face: '+Z', u: 1, v: 1, team: 'blue' },
            { face: '+Z', u: -1, v: 1, team: 'blue' },
            { face: '-Z', u: 0, v: 0, team: 'red' },
            { face: '-Z', u: 1, v: 1, team: 'red' },
            { face: '-Z', u: -1, v: 1, team: 'red' },
            { face: '-Z', u: 0, v: -1, team: 'red' }
        ],
        '4': [
            { face: '+Z', u: 0, v: 0, team: 'blue' },
            { face: '+Z', u: 1, v: 1, team: 'blue' },
            { face: '+Z', u: -1, v: 1, team: 'blue' },
            { face: '+Z', u: 0, v: 2, team: 'blue' },
            { face: '-Z', u: 0, v: 0, team: 'red' },
            { face: '-Z', u: 1, v: 1, team: 'red' },
            { face: '-Z', u: -1, v: 1, team: 'red' },
            { face: '-Z', u: 0, v: 2, team: 'red' }
        ],
        '5': [
            { face: '+Z', u: 0, v: 0, team: 'blue' },
            { face: '+Z', u: 1, v: 1, team: 'blue' },
            { face: '+Z', u: -1, v: 1, team: 'blue' },
            { face: '+Z', u: 0, v: 2, team: 'blue' },
            { face: '+Z', u: 2, v: 0, team: 'blue' },
            { face: '-Z', u: 0, v: 0, team: 'red' },
            { face: '-Z', u: 1, v: 1, team: 'red' },
            { face: '-Z', u: -1, v: 1, team: 'red' },
            { face: '-Z', u: 0, v: 2, team: 'red' },
            { face: '-Z', u: 2, v: 0, team: 'red' }
        ],
        '6': [
            { face: '+Z', u: 0, v: 0, team: 'blue' },
            { face: '+Z', u: 1, v: 1, team: 'blue' },
            { face: '+Z', u: -1, v: 1, team: 'blue' },
            { face: '+Z', u: 0, v: 2, team: 'blue' },
            { face: '+Z', u: 2, v: 0, team: 'blue' },
            { face: '+Z', u: -2, v: 0, team: 'blue' },
            { face: '-Z', u: 0, v: 0, team: 'red' },
            { face: '-Z', u: 1, v: 1, team: 'red' },
            { face: '-Z', u: -1, v: 1, team: 'red' },
            { face: '-Z', u: 0, v: 2, team: 'red' },
            { face: '-Z', u: 2, v: 0, team: 'red' },
            { face: '-Z', u: -2, v: 0, team: 'red' }
        ]
    };

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 6, 10);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.touchAction = 'none';
    document.getElementById('scene-container').appendChild(renderer.domElement);

    scene.background = new THREE.Color(0xf2efe6);

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.5);
    dir.position.set(5, 10, 7);
    scene.add(dir);

    const cubeGroup = new THREE.Group();
    scene.add(cubeGroup);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    // Editor state
    let currentLevel = 1;
    let cubeSize = LEVEL_SIZES[currentLevel];
    let minCoord = 0;
    let maxCoord = 0;
    let coordCenter = 0;
    let halfSize = cubeSize / 2;
    const tileMeshes = [];
    const itemMeshes = new Map(); // key -> mesh
    const spawnMeshes = [];
    const levelDesigns = {}; // { level: { buildingCubes: [], altCubes: [] } }

    // Camera rotation
    let isDragging = false;
    let pointerDownX = 0;
    let pointerDownY = 0;
    let lastX = 0;
    let lastY = 0;
    let hasDragged = false;
    let activePointerId = null;

    const _rotateRight = new THREE.Vector3();
    const _rotateUp = new THREE.Vector3();
    const _rotateTemp = new THREE.Vector3();
    const _rotateQuatUp = new THREE.Quaternion();
    const _rotateQuatRight = new THREE.Quaternion();

    const contextMenu = document.getElementById('context-menu');
    let contextTarget = null;

    function tileKey(face, u, v) {
        return face + '|' + u + '|' + v;
    }

    function getSpawnTiles(level) {
        return SPAWN_TILES[String(level)] || [];
    }

    function getSpawnKeySet(level) {
        const set = new Set();
        getSpawnTiles(level).forEach(item => {
            set.add(tileKey(item.face, item.u, item.v));
        });
        return set;
    }

    function updateGridBounds(size) {
        cubeSize = size;
        minCoord = -(Math.floor(size / 2));
        maxCoord = minCoord + size - 1;
        coordCenter = (minCoord + maxCoord) / 2;
        halfSize = cubeSize / 2;
    }

    function getWorldPosition(face, u, v) {
        const faceData = FACES[face];
        const pos = faceData.normal.clone().multiplyScalar(cubeSize / 2);
        const worldU = (u - coordCenter) * 1.0;
        const worldV = (v - coordCenter) * 1.0;
        pos.add(faceData.uAxis.clone().multiplyScalar(worldU));
        pos.add(faceData.vAxis.clone().multiplyScalar(worldV));
        return pos;
    }

    function clearScene() {
        cubeGroup.clear();
        tileMeshes.length = 0;
        itemMeshes.clear();
        spawnMeshes.length = 0;
    }

    function buildTiles() {
        clearScene();
        createCubeGeometry();
    }

    function createCubeGeometry() {
        const faceColors = {
            '+X': 0xf0ebe0, '-X': 0xebe6db, '+Y': 0xf5f0e6,
            '-Y': 0xe8e3d8, '+Z': 0xede8dd, '-Z': 0xeae5da
        };

        Object.keys(FACES).forEach(faceName => {
            const face = FACES[faceName];

            for (let tileU = minCoord; tileU <= maxCoord; tileU++) {
                for (let tileV = minCoord; tileV <= maxCoord; tileV++) {
                    const tileGeometry = new THREE.PlaneGeometry(1, 1);
                    const tileMaterial = new THREE.MeshBasicMaterial({
                        color: faceColors[faceName],
                        side: THREE.DoubleSide,
                        transparent: true,
                        opacity: 0.95
                    });

                    const tileMesh = new THREE.Mesh(tileGeometry, tileMaterial);
                    const tilePos = face.normal.clone().multiplyScalar(halfSize);
                    tilePos.add(face.uAxis.clone().multiplyScalar(tileU - coordCenter));
                    tilePos.add(face.vAxis.clone().multiplyScalar(tileV - coordCenter));

                    tileMesh.position.copy(tilePos);
                    tileMesh.lookAt(tilePos.clone().add(face.normal));
                    tileMesh.userData.face = faceName;
                    tileMesh.userData.u = tileU;
                    tileMesh.userData.v = tileV;
                    tileMeshes.push(tileMesh);
                    cubeGroup.add(tileMesh);
                }
            }

            const gridGroup = new THREE.Group();
            const lineMaterial = new THREE.LineBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.4 });

            for (let i = 0; i <= cubeSize; i++) {
                const linePos = -halfSize + i;
                const hPoints = [
                    new THREE.Vector3(-halfSize, linePos, 0),
                    new THREE.Vector3(halfSize, linePos, 0)
                ];
                const vPoints = [
                    new THREE.Vector3(linePos, -halfSize, 0),
                    new THREE.Vector3(linePos, halfSize, 0)
                ];
                gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(hPoints), lineMaterial));
                gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(vPoints), lineMaterial));
            }

            gridGroup.position.copy(face.normal.clone().multiplyScalar(halfSize + 0.01));
            gridGroup.lookAt(face.normal.clone().multiplyScalar(cubeSize));
            cubeGroup.add(gridGroup);
        });

        const edgesGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize));
        const edgesMaterial = new THREE.LineBasicMaterial({ color: 0x1a1a1a, opacity: 0.8, transparent: true });
        cubeGroup.add(new THREE.LineSegments(edgesGeometry, edgesMaterial));

        renderSpawnMarkers();
    }

    function renderSpawnMarkers() {
        const spawns = getSpawnTiles(currentLevel);
        if (!spawns.length) return;

        const markerGeom = new THREE.CircleGeometry(0.18, 24);
        spawns.forEach(item => {
            const faceData = FACES[item.face];
            if (!faceData) return;
            const color = item.team === 'red' ? 0xcc3333 : 0x3399ff;
            const mat = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.65,
                side: THREE.DoubleSide
            });
            const marker = new THREE.Mesh(markerGeom, mat);
            const pos = getWorldPosition(item.face, item.u, item.v);
            pos.add(faceData.normal.clone().multiplyScalar(halfSize > 0 ? 0.52 : 0.02));
            marker.position.copy(pos);
            marker.lookAt(pos.clone().add(faceData.normal));
            spawnMeshes.push(marker);
            cubeGroup.add(marker);
        });
    }

    function createBuildingCube(face, u, v) {
        const geom = new THREE.BoxGeometry(0.9, 0.9, 0.9);
        const mat = new THREE.MeshBasicMaterial({ color: 0x4a4a4a, transparent: true, opacity: 0.9 });
        const cube = new THREE.Mesh(geom, mat);
        const faceData = FACES[face];
        const pos = getWorldPosition(face, u, v);
        pos.add(faceData.normal.clone().multiplyScalar(0.45));
        cube.position.copy(pos);
        const quat = new THREE.Quaternion();
        quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), faceData.normal);
        cube.quaternion.copy(quat);
        return cube;
    }

    function createAltCube(face, u, v, type) {
        const faceData = FACES[face];
        let mesh;
        if (type === 'rock') {
            const geom = new THREE.DodecahedronGeometry(0.4, 0);
            const mat = new THREE.MeshBasicMaterial({ color: 0x6b6b6b, transparent: true, opacity: 0.9 });
            mesh = new THREE.Mesh(geom, mat);
            mesh.scale.set(1, 1.2, 1);
        } else {
            const trunk = new THREE.Mesh(
                new THREE.CylinderGeometry(0.08, 0.1, 0.4, 8),
                new THREE.MeshBasicMaterial({ color: 0x5c4033, transparent: true, opacity: 0.95 })
            );
            const foliage = new THREE.Mesh(
                new THREE.IcosahedronGeometry(0.28, 1),
                new THREE.MeshBasicMaterial({ color: 0x2e8b57, transparent: true, opacity: 0.9 })
            );
            foliage.position.y = 0.35;
            const group = new THREE.Group();
            group.add(trunk);
            group.add(foliage);
            mesh = group;
        }
        const pos = getWorldPosition(face, u, v);
        mesh.position.copy(pos);
        const quat = new THREE.Quaternion();
        quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), faceData.normal);
        mesh.quaternion.copy(quat);
        return mesh;
    }

    function loadLevelDesign(level) {
        const design = levelDesigns[level] || { buildingCubes: [], altCubes: [] };
        const spawnSet = getSpawnKeySet(level);
        design.buildingCubes.forEach(item => {
            const key = tileKey(item.face, item.u, item.v);
            if (spawnSet.has(key)) return;
            const cube = createBuildingCube(item.face, item.u, item.v);
            itemMeshes.set(key, cube);
            cubeGroup.add(cube);
        });
        design.altCubes.forEach(item => {
            const key = tileKey(item.face, item.u, item.v);
            if (spawnSet.has(key)) return;
            const cube = createAltCube(item.face, item.u, item.v, item.type);
            itemMeshes.set(key, cube);
            cubeGroup.add(cube);
        });
    }

    function setLevel(level) {
        currentLevel = level;
        updateGridBounds(LEVEL_SIZES[level]);
        buildTiles();
        loadLevelDesign(level);
        const viewDistance = cubeSize * 2.2;
        camera.position.set(0, viewDistance * 0.45, viewDistance);
        camera.lookAt(0, 0, 0);
    }

    function ensureLevel(level) {
        if (!levelDesigns[level]) {
            levelDesigns[level] = { buildingCubes: [], altCubes: [] };
        }
        return levelDesigns[level];
    }

    function clearLevel(level) {
        levelDesigns[level] = { buildingCubes: [], altCubes: [] };
        setLevel(level);
    }

    function setTileItem(face, u, v, action) {
        const key = tileKey(face, u, v);
        const design = ensureLevel(currentLevel);
        const spawnSet = getSpawnKeySet(currentLevel);
        if (spawnSet.has(key)) return;

        // Remove existing
        if (itemMeshes.has(key)) {
            cubeGroup.remove(itemMeshes.get(key));
            itemMeshes.delete(key);
        }
        design.buildingCubes = design.buildingCubes.filter(item => tileKey(item.face, item.u, item.v) !== key);
        design.altCubes = design.altCubes.filter(item => tileKey(item.face, item.u, item.v) !== key);

        if (action === 'empty') return;

        if (action === 'building') {
            design.buildingCubes.push({ face: face, u: u, v: v });
            const cube = createBuildingCube(face, u, v);
            itemMeshes.set(key, cube);
            cubeGroup.add(cube);
            return;
        }

        if (action.indexOf('alt:') === 0) {
            const type = action.split(':')[1];
            design.altCubes.push({ face: face, u: u, v: v, type: type });
            const cube = createAltCube(face, u, v, type);
            itemMeshes.set(key, cube);
            cubeGroup.add(cube);
        }
    }

    function onPointerDown(event) {
        if (event.button !== 0) return;
        isDragging = true;
        hasDragged = false;
        pointerDownX = event.clientX;
        pointerDownY = event.clientY;
        lastX = event.clientX;
        lastY = event.clientY;
        activePointerId = event.pointerId;
        renderer.domElement.setPointerCapture(activePointerId);
        event.preventDefault();
    }

    function onPointerMove(event) {
        if (!isDragging) return;
        if (activePointerId !== null && event.pointerId !== activePointerId) return;
        const dx = event.movementX !== undefined ? event.movementX : (event.clientX - lastX);
        const dy = event.movementY !== undefined ? event.movementY : (event.clientY - lastY);
        lastX = event.clientX;
        lastY = event.clientY;
        if (Math.abs(event.clientX - pointerDownX) > 4 || Math.abs(event.clientY - pointerDownY) > 4) {
            hasDragged = true;
        }
        rotateCube(dx, dy);
        event.preventDefault();
    }

    function onPointerUp(event) {
        if (activePointerId !== null) {
            renderer.domElement.releasePointerCapture(activePointerId);
        }
        activePointerId = null;
        isDragging = false;
        if (hasDragged) return;
        if (contextMenu.contains(event.target)) return;

        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);

        const intersects = raycaster.intersectObjects(tileMeshes, false);
        if (intersects.length === 0) {
            hideContextMenu();
            return;
        }

        const hit = intersects[0].object;
        contextTarget = { face: hit.userData.face, u: hit.userData.u, v: hit.userData.v };
        showContextMenu(event.clientX, event.clientY);
    }

    function onPointerCancel() {
        activePointerId = null;
        isDragging = false;
        hasDragged = false;
    }

    function rotateCube(deltaX, deltaY) {
        const rotationSpeed = 0.005;
        camera.matrixWorld.extractBasis(_rotateRight, _rotateUp, _rotateTemp);
        _rotateQuatUp.setFromAxisAngle(_rotateUp, deltaX * rotationSpeed);
        _rotateQuatRight.setFromAxisAngle(_rotateRight, deltaY * rotationSpeed);
        cubeGroup.quaternion.premultiply(_rotateQuatUp.multiply(_rotateQuatRight));
    }

    function showContextMenu(x, y) {
        contextMenu.classList.remove('hidden');
        const w = contextMenu.offsetWidth;
        const h = contextMenu.offsetHeight;
        const px = Math.min(window.innerWidth - w - 8, x + 6);
        const py = Math.min(window.innerHeight - h - 8, y + 6);
        contextMenu.style.left = px + 'px';
        contextMenu.style.top = py + 'px';
    }

    function hideContextMenu() {
        contextMenu.classList.add('hidden');
        contextTarget = null;
    }

    function saveJson() {
        const output = {};
        Object.keys(levelDesigns).forEach(level => {
            const design = levelDesigns[level];
            output[level] = {
                buildingCubes: design.buildingCubes || [],
                altCubes: design.altCubes || []
            };
        });
        const json = JSON.stringify(output, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'level_designs.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }

    function setupUI() {
        const levelSelect = document.getElementById('level-select');
        LEVEL_SIZES.forEach((size, index) => {
            const opt = document.createElement('option');
            opt.value = String(index);
            opt.textContent = 'Level ' + index + ' (' + size + 'x' + size + 'x' + size + ')';
            if (index === currentLevel) opt.selected = true;
            levelSelect.appendChild(opt);
        });

        levelSelect.addEventListener('change', () => {
            const level = parseInt(levelSelect.value, 10);
            setLevel(level);
        });

        document.getElementById('save-btn').addEventListener('click', saveJson);
        document.getElementById('clear-level-btn').addEventListener('click', () => clearLevel(currentLevel));

        contextMenu.addEventListener('click', (event) => {
            event.stopPropagation();
            const target = event.target;
            if (!target || !target.dataset.action) return;
            if (!contextTarget) return;
            setTileItem(contextTarget.face, contextTarget.u, contextTarget.v, target.dataset.action);
            hideContextMenu();
        });

        document.addEventListener('click', (event) => {
            if (contextMenu.contains(event.target)) return;
            if (event.target.classList && event.target.classList.contains('menu-title')) return;
            if (event.target.closest && event.target.closest('#context-menu')) return;
            if (event.target.closest && event.target.closest('#scene-container')) return;
            hideContextMenu();
        });
    }

    function onResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    window.addEventListener('resize', onResize);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);

    setupUI();
    updateGridBounds(LEVEL_SIZES[currentLevel]);
    buildTiles();
    const initDistance = cubeSize * 2.2;
    camera.position.set(0, initDistance * 0.45, initDistance);
    camera.lookAt(0, 0, 0);
    animate();
})();
