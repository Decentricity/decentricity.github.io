// Note: Since we can't modify the JS structure to use TypeScript imports directly,
// I'll adapt the placement logic into the existing JavaScript structure

// Utility Functions
const clampDPR = (dpr) => Math.min(dpr, 2);
const DEFAULT_HOME_URL = 'https://agent1c-ai.github.io';

// Desk Placement Utilities (adapted from TypeScript)
const DeskPlacement = {
    async ensureReady(scene, names) {
        const t0 = performance.now();
        while (names.some(n => !this.find(scene, n))) {
            if (performance.now() - t0 > 1000) break;
            await new Promise(r => requestAnimationFrame(r));
        }
        scene.updateMatrixWorld(true);
    },

    find(scene, name) {
        return scene.getObjectByName(name);
    },

    bb(obj) {
        const b = new THREE.Box3().setFromObject(obj);
        if (!isFinite(b.min.x) || b.isEmpty()) {
            obj.updateMatrixWorld(true);
            b.setFromObject(obj);
        }
        return b;
    },

    deskTop(scene) {
        const desk = this.find(scene, 'desk') || this.find(scene, 'table');
        if (!desk) throw new Error('desk not found');
        const b = this.bb(desk);
        return { 
            yTop: b.max.y, 
            rect: { minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z }
        };
    },

    inflate(r, s) {
        return { minX: r.minX - s, maxX: r.maxX + s, minZ: r.minZ - s, maxZ: r.maxZ + s };
    },

    fromBoxXZ(b) {
        return { minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z };
    },

    intersects2D(a, b) {
        return !(a.maxX < b.minX || a.minX > b.maxX || a.maxZ < b.minZ || a.minZ > b.maxZ);
    },

    deskSlots(scene) {
        const { rect } = this.deskTop(scene);
        const m = 0.05; // 5 cm margin
        const rowsZ = [rect.maxZ - m, rect.minZ + m];
        const colsX = [
            rect.minX + m,
            (rect.minX + rect.maxX) / 2,
            rect.maxX - m
        ];
        const slots = [];
        for (const z of rowsZ) {
            for (const x of colsX) {
                slots.push([x, z]);
            }
        }
        return slots;
    },

    async placeSmallFlatDeskItem(scene, obj, opts = {}) {
        await this.ensureReady(scene, ['desk', 'crt', 'monitor', 'keyboard']);
        const { yTop } = this.deskTop(scene);

        // footprints to avoid
        const avoid = [];
        const crt = this.find(scene, 'crt') || this.find(scene, 'monitor') || this.find(scene, 'crt_monitor');
        if (crt) avoid.push(this.bb(crt));
        const kb = this.find(scene, 'keyboard');
        if (kb) avoid.push(this.bb(kb));

        // try fixed slots deterministically
        const angle = THREE.MathUtils.degToRad(opts.yawDeg ?? 0);
        const slots = this.deskSlots(scene);
        const epsY = 0.002; // lift a hair to avoid z-fighting

        const targetRectXZ = (o) => {
            const b = new THREE.Box3().setFromObject(o);
            return this.fromBoxXZ(b);
        };

        let placed = false;
        for (const [x, z] of slots) {
            obj.position.set(x, yTop + epsY, z);
            obj.rotation.set(0, angle, 0);
            obj.updateMatrixWorld(true);

            const r = targetRectXZ(obj);
            const hits = avoid.some(a => this.intersects2D(r, this.inflate(this.fromBoxXZ(a), 0.01)));
            if (!hits) {
                placed = true;
                break;
            }
        }
        
        if (!placed) {
            // last resort: nudge toward front-left corner
            const { rect } = this.deskTop(scene);
            obj.position.set(rect.minX + 0.08, yTop + epsY, rect.maxZ - 0.08);
            obj.rotation.set(0, angle, 0);
            obj.updateMatrixWorld(true);
        }

        if (opts.name) obj.name = opts.name;
        obj.userData = { ...obj.userData, isDeskItem: true };
    }
};

// Geometry Utilities
const GeomUtil = {
    firstHit(scene, origin, dir, options = {}) {
        const {
            exclude = new Set(),
            maxDistance = 10,
            filter = () => true
        } = options;

        const rc = new THREE.Raycaster(origin, dir.clone().normalize(), 0.001, maxDistance);
        const all = [];
        scene.traverse(o => {
            if (!exclude.has(o) && o.isMesh && filter(o)) {
                all.push(o);
            }
        });
        const hits = rc.intersectObjects(all, true);
        return hits.length ? hits[0] : null;
    },

    makeBasisFrom(screen, camera) {
        screen.updateWorldMatrix(true, false);
        const right = new THREE.Vector3();
        const up = new THREE.Vector3();
        const out = new THREE.Vector3();
        screen.matrixWorld.extractBasis(right, up, out);
        right.normalize();
        up.normalize();
        out.normalize();

        const center = new THREE.Vector3();
        screen.getWorldPosition(center);
        const toCam = camera.position.clone().sub(center);
        if (out.dot(toCam) < 0) out.negate();
        
        return { center, right, up, out };
    }
};

// World-space utilities
const WorldUtil = {
  worldAABB(mesh) {
    // returns {min: THREE.Vector3, max: THREE.Vector3} in world space
    const bb = mesh.geometry.boundingBox || (mesh.geometry.computeBoundingBox(), mesh.geometry.boundingBox);
    const corners = [
      new THREE.Vector3(bb.min.x, bb.min.y, bb.min.z),
      new THREE.Vector3(bb.min.x, bb.min.y, bb.max.z),
      new THREE.Vector3(bb.min.x, bb.max.y, bb.min.z),
      new THREE.Vector3(bb.min.x, bb.max.y, bb.max.z),
      new THREE.Vector3(bb.max.x, bb.min.y, bb.min.z),
      new THREE.Vector3(bb.max.x, bb.min.y, bb.max.z),
      new THREE.Vector3(bb.max.x, bb.max.y, bb.min.z),
      new THREE.Vector3(bb.max.x, bb.max.y, bb.max.z),
    ];
    const m = mesh.matrixWorld;
    const wcorners = corners.map(v => v.clone().applyMatrix4(m));
    const min = wcorners.reduce((a,v)=>a.min(v), wcorners[0].clone());
    const max = wcorners.reduce((a,v)=>a.max(v), wcorners[0].clone());
    return {min, max};
  },
  // build a basis aligned to a mesh's face-normal toward the camera
  faceBasisTowardCamera(normal, camera) {
    const n = normal.clone().normalize();
    const camFwd = new THREE.Vector3().subVectors(camera.position, new THREE.Vector3(0,0,0));
    // choose a tangent not parallel to n
    const tmp = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0,1,0) : new THREE.Vector3(1,0,0);
    const tangent = tmp.clone().projectOnPlane(n).normalize();
    const bitangent = new THREE.Vector3().crossVectors(n, tangent).normalize();
    return new THREE.Matrix4().makeBasis(tangent, bitangent, n);
  }
};

// Helper functions for positioning (from user's delta prompt)
function waitForObject(scene, name, maxFrames = 240) {
  return new Promise(resolve => {
    let f = 0;
    function tick() {
      const obj = scene.getObjectByName(name);
      if (obj || f++ >= maxFrames) return resolve(obj || null);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

function box3Of(obj) {
  const b = new THREE.Box3().setFromObject(obj);
  const s = new THREE.Vector3();
  b.getSize(s);
  return { box: b, size: s, center: b.getCenter(new THREE.Vector3()) };
}

// Retro Props Module
const RetroProps = {
    addKeyboard(parent) {
        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin('anonymous');
        const tex = loader.load('https://raw.githubusercontent.com/Decentricity/decentricity.github.io/ffb4e1af2e5d3eb5f2c0aee13f3fdd6c182c98f2/ibmkeyboard.jpg');
        tex.colorSpace = THREE.SRGBColorSpace || undefined;

        const w = 0.48, h = 0.18, d = 0.018;
        const geo = new THREE.BoxGeometry(w, d, h);
        const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, metalness: 0.1 });
        const keyboard = new THREE.Mesh(geo, mat);
        keyboard.rotation.x = -0.02; // small tilt
        keyboard.position.set(0, 0, 0); // Position relative to parent group
        keyboard.name = 'deskKeyboard';
        keyboard.castShadow = true;
        keyboard.receiveShadow = true;
        parent.add(keyboard);
        return keyboard;
    },

    async addFloppy(parent) {
        const FLOPPY_URL =
            'https://raw.githubusercontent.com/Decentricity/decentricity.github.io/2bf5a9f856ff9b3a06d99d92b03e3abc19605914/floppy.jpg';

        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin('anonymous');

        const tex = await new Promise((resolve, reject) => {
            loader.load(
                FLOPPY_URL,
                (t) => {
                    // three r150+: use colorSpace; for older, use encoding = sRGBEncoding
                    t.colorSpace = THREE.SRGBColorSpace || undefined;
                    t.encoding = THREE.sRGBEncoding || t.encoding;
                    t.anisotropy = 8;
                    resolve(t);
                },
                undefined,
                (e) => {
                    console.error('floppy texture load failed', e);
                    reject(e);
                }
            );
        });

        // a thin plane shows the photo clearly
        const size = 0.12;
        const geo = new THREE.PlaneGeometry(size, size);
        const mat = new THREE.MeshStandardMaterial({
            map: tex,
            color: 0xffffff,
            roughness: 0.8,
            metalness: 0.05,
            side: THREE.DoubleSide
        });

        const floppy = new THREE.Mesh(geo, mat);
        floppy.name = 'floppy';

        // lay flat on desk; caller sets position.y to deskTop + epsilon
        floppy.rotation.x = -Math.PI / 2;

        parent.add(floppy);
        return floppy;
    },

    addFloppyChordynaut(scene) {
        const rawURL = 'https://raw.githubusercontent.com/Decentricity/decentricity.github.io/3f45e75880f0bc5237006ba0eaaed61ad1e8b219/chordynautfloppy.jpg';
        const tex = new THREE.TextureLoader().load(rawURL);
        tex.colorSpace = THREE.SRGBColorSpace;
        
        const size = 0.09, t = 0.004; // 4mm thick
        const g = new THREE.BoxGeometry(size, t, size);
        
        const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.0 });
        const floppy = new THREE.Mesh(g, m);
        floppy.name = 'floppy_chordynaut';
        floppy.userData.openURL = 'https://chordynaut.com';
        floppy.userData.isDeskItem = true;

        // place on desk, avoid overlap with keyboard/other floppy by trying safe corners
        const desk = scene.getObjectByName('desk');
        const bb = new THREE.Box3().setFromObject(desk);
        const y = bb.max.y + t * 0.5 + 0.001;
        
        // candidate spots on desk (front/back × left/right + mid-right)
        const mrg = 0.14;
        const spots = [
            [bb.max.x - mrg - size*0.5, bb.max.z - mrg - size*0.5], // front-right
            [bb.min.x + mrg + size*0.5, bb.max.z - mrg - size*0.5], // front-left
            [bb.max.x - mrg - size*0.5, (bb.min.z+bb.max.z)/2],     // mid-right
            [bb.min.x + mrg + size*0.5, (bb.min.z+bb.max.z)/2],     // mid-left
            [(bb.min.x+bb.max.x)/2, bb.max.z - mrg - size*0.5],     // front-center (last resort)
        ];
        
        const blockers = [];
        scene.traverse(o => {
            if (o === floppy) return;
            if (o.name === 'deskKeyboard' || o.name?.startsWith('floppy') || o.userData?.isDeskItem) blockers.push(o);
        });
        
        for (const [x,z] of spots){
            floppy.position.set(x, y, z);
            // lie flat; tiny yaw randomness for realism
            floppy.rotation.set(0, (Math.random()-0.5)*0.2, 0);
            floppy.updateMatrixWorld(true);
            const fbb = new THREE.Box3().setFromObject(floppy);
            const hit = blockers.some(b => fbb.intersectsBox(new THREE.Box3().setFromObject(b).expandByScalar(0.01)));
            if (!hit) break;
        }
        scene.add(floppy);
    },

    addFloppyTetris(scene) {
        const rawURL = 'https://raw.githubusercontent.com/Decentricity/decentricity.github.io/f9f57cd5b8e9e6d2b2bce059cb3139878a06f184/3dtetrisfloppy.jpg';
        const tex = new THREE.TextureLoader().load(rawURL);
        tex.colorSpace = THREE.SRGBColorSpace;
        
        const size = 0.09, t = 0.004; // 3.5" floppy, ~4mm thick
        const g = new THREE.BoxGeometry(size, t, size);
        const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.0 });
        const floppy = new THREE.Mesh(g, m);
        floppy.name = 'floppy_tetris';
        floppy.userData.openURL = 'https://tetris3dfixed.berrry.app/';
        floppy.userData.isDeskItem = true;

        const desk = scene.getObjectByName('desk');
        const bb = new THREE.Box3().setFromObject(desk);
        const y = bb.max.y + t * 0.5 + 0.001;
        const mrg = 0.14;
        const spots = [
            [bb.min.x + mrg + size*0.5, bb.max.z - mrg - size*0.5],
            [bb.max.x - mrg - size*0.5, bb.max.z - mrg - size*0.5],
            [(bb.min.x+bb.max.x)/2,     bb.max.z - mrg - size*0.5],
            [bb.min.x + mrg + size*0.5, (bb.min.z+bb.max.z)/2],
            [bb.max.x - mrg - size*0.5, (bb.min.z+bb.max.z)/2],
        ];
        const blockers = [];
        scene.traverse(o=>{
            if (o.name==='deskKeyboard' || o.name?.startsWith('floppy') || o.userData?.isDeskItem) blockers.push(o);
        });
        for (const [x,z] of spots){
            floppy.position.set(x, y, z);
            floppy.rotation.set(0, (Math.random()-0.5)*0.2, 0); // flat, tiny yaw
            floppy.updateMatrixWorld(true);
            const fbb = new THREE.Box3().setFromObject(floppy);
            const hit = blockers.some(b => fbb.intersectsBox(new THREE.Box3().setFromObject(b).expandByScalar(0.01)));
            if (!hit) break;
        }
        scene.add(floppy);
    },

    addFloppyGamegen(scene){
        const rawURL = 'https://raw.githubusercontent.com/Decentricity/decentricity.github.io/f59193928c06cc13f2a20d3fa81ec9dbe692966d/gamegenfloppy.jpg';
        const tex = new THREE.TextureLoader().load(rawURL);
        tex.colorSpace = THREE.SRGBColorSpace;
        const size = 0.09, t = 0.004;
        const g = new THREE.BoxGeometry(size, t, size);
        const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.0 });
        const floppy = new THREE.Mesh(g, m);
        floppy.name = 'floppy_gamegen';
        floppy.userData.openURL = 'https://vgamode13h.berrry.app';
        floppy.userData.isDeskItem = true;

        const desk = scene.getObjectByName('desk');
        const bb = new THREE.Box3().setFromObject(desk);
        const y = bb.max.y + t*0.5 + 0.001;
        const mrg = 0.14;
        const cx = (bb.min.x+bb.max.x)/2, cz = (bb.min.z+bb.max.z)/2;
        const spots = [
            [bb.max.x - mrg - size*0.5, cz],                  // mid-right
            [bb.min.x + mrg + size*0.5, cz],                  // mid-left
            [cx, bb.max.z - mrg - size*0.5],                  // front-center
            [bb.min.x + mrg + size*0.5, bb.max.z - mrg - size*0.5], // front-left
            [bb.max.x - mrg - size*0.5, bb.max.z - mrg - size*0.5], // front-right
        ];
        const blockers = [];
        scene.traverse(o=>{
            if (o.name==='deskKeyboard' || o.name?.startsWith('floppy') || o.userData?.isDeskItem) blockers.push(o);
        });
        for (const [x,z] of spots){
            floppy.position.set(x, y, z);
            floppy.rotation.set(0, (Math.random()-0.5)*0.2, 0); // flat, tiny yaw
            floppy.updateMatrixWorld(true);
            const fbb = new THREE.Box3().setFromObject(floppy);
            const hit = blockers.some(b => fbb.intersectsBox(new THREE.Box3().setFromObject(b).expandByScalar(0.01)));
            if (!hit) break;
        }
        scene.add(floppy);
    },

    addFloppyDecentricity(scene){
        const rawURL = 'https://raw.githubusercontent.com/Decentricity/decentricity.github.io/348e56fa40796b9940c585c3a8acba09fca7a869/decentricityfloppy.jpg';
        const tex = new THREE.TextureLoader().load(rawURL);
        tex.colorSpace = THREE.SRGBColorSpace;
        const size = 0.09, t = 0.004;
        const g = new THREE.BoxGeometry(size, t, size);
        const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.0 });
        const floppy = new THREE.Mesh(g, m);
        floppy.name = 'floppy_decentricity';
        floppy.userData.openURL = 'https://decentricity.berrry.app/';
        floppy.userData.isDeskItem = true;

        const desk = scene.getObjectByName('desk');
        const bb = new THREE.Box3().setFromObject(desk);
        const y = bb.max.y + t*0.5 + 0.001;
        const mrg = 0.14, cx = (bb.min.x+bb.max.x)/2, cz = (bb.min.z+bb.max.z)/2;
        const spots = [
            [bb.min.x + mrg + size*0.5, bb.max.z - mrg - size*0.5],
            [bb.max.x - mrg - size*0.5, bb.max.z - mrg - size*0.5],
            [cx, cz],
            [bb.min.x + mrg + size*0.5, cz],
            [bb.max.x - mrg - size*0.5, cz],
        ];
        const blockers = [];
        scene.traverse(o=>{
            if (o.name==='deskKeyboard' || o.name?.startsWith('floppy') || o.userData?.isDeskItem) blockers.push(o);
        });
        for (const [x,z] of spots){
            floppy.position.set(x, y, z);
            floppy.rotation.set(0, (Math.random()-0.5)*0.2, 0); // flat with tiny yaw
            floppy.updateMatrixWorld(true);
            const fbb = new THREE.Box3().setFromObject(floppy);
            const hit = blockers.some(b => fbb.intersectsBox(new THREE.Box3().setFromObject(b).expandByScalar(0.01)));
            if (!hit) break;
        }
        scene.add(floppy);
    },

    addFloppyCrtception(scene){
        const rawURL = 'https://raw.githubusercontent.com/Decentricity/decentricity.github.io/f5f23e27dfb568917caf2df25955d9a5f7e13c02/crtception.jpg';
        const loader = new THREE.TextureLoader(); 
        loader.setCrossOrigin('anonymous');
        const tex = loader.load(rawURL); 
        tex.colorSpace = THREE.SRGBColorSpace || tex.colorSpace;

        const size = 0.09, t = 0.004; // ~3.5" floppy, 4mm thick
        const geom = new THREE.BoxGeometry(size, t, size);
        const mat  = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.0 });
        const floppy = new THREE.Mesh(geom, mat);
        floppy.name = 'floppy_crtception';
        floppy.userData.openURL = 'https://crtbrowser.berrry.app/';
        floppy.userData.isDeskItem = true; // include in overlap checks

        const desk = scene.getObjectByName('desk');
        if (!desk) { console.warn('no desk mesh'); scene.add(floppy); return; }
        const dbb = new THREE.Box3().setFromObject(desk);
        const topY = dbb.max.y;
        const y = topY + t*0.5 + 0.001; // sit on desk

        // build candidate spots across desk area (corners + midlines + grid)
        const mrg = 0.14;
        const minX = dbb.min.x + mrg + size*0.5, maxX = dbb.max.x - mrg - size*0.5;
        const minZ = dbb.min.z + mrg + size*0.5, maxZ = dbb.max.z - mrg - size*0.5;
        const cx = (minX+maxX)/2, cz = (minZ+maxZ)/2;
        const xs = [minX, (minX*2+cx)/3, cx, (cx*2+maxX)/3, maxX];
        const zs = [maxZ, (cz+maxZ)/2, cz, (cz+minZ)/2, minZ];
        const spots = [
            // corners + edges first
            [minX, maxZ],[maxX, maxZ],[minX, cz],[maxX, cz],[minX, minZ],[maxX, minZ],[cx, maxZ],[cx, cz],[cx, minZ],
            // then grid sweep
            ...xs.flatMap(x => zs.map(z => [x, z]))
        ];

        // collect blockers (keyboard, other floppies, photos, etc.)
        const blockers = [];
        scene.traverse(o => {
            if (o === floppy) return;
            if (o.name === 'deskKeyboard' || (o.name && o.name.startsWith('floppy')) || o.userData?.isDeskItem) {
                blockers.push(new THREE.Box3().setFromObject(o));
            }
        });

        // try candidates with a small random yaw; pick the first non-overlapping
        let placed = false;
        const yaw = THREE.MathUtils.degToRad((Math.random()*60) - 30); // flat but angled
        for (const [x,z] of spots){
            floppy.position.set(x, y, z);
            floppy.rotation.set(0, yaw, 0); // flat on table
            floppy.updateMatrixWorld(true);
            const fbb = new THREE.Box3().setFromObject(floppy);
            const hit = blockers.some(b => fbb.intersectsBox(b.clone().expandByScalar(0.01)));
            if (!hit){ placed = true; break; }
        }

        // fallback: front-left with a tiny nudge so it always shows
        if (!placed){
            floppy.position.set(minX + 0.02, y, maxZ - 0.02);
            floppy.rotation.set(0, yaw, 0);
        }

        scene.add(floppy);
    },

    async addFloppyPythonCity(scene) {
        const rawURL = 'https://raw.githubusercontent.com/Decentricity/decentricity.github.io/e17a204e6b76deb4aee9f299c1a9d25abaf0cd61/pythoncityfloppy.jpg';
        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin('anonymous');
        
        return new Promise((resolve) => {
            loader.load(rawURL, async (tex) => {
                tex.colorSpace = THREE.SRGBColorSpace;
                const w = 0.09, t = 0.006;
                const geom = new THREE.BoxGeometry(w, t, w);
                const side = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9, metalness: 0.05 });
                const top = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.05 });
                const mats = [side, side, top, side, side, side]; // py(+Y) gets texture
                const floppy = new THREE.Mesh(geom, mats);
                floppy.userData.openURL = 'https://pythoncity.berrry.app/';
                floppy.userData.isDeskItem = true;

                // Use the new safe placement system
                await DeskPlacement.placeSmallFlatDeskItem(scene, floppy, {
                    name: 'floppy_pythoncity',
                    yawDeg: 12 // slight angle for vibes
                });

                scene.add(floppy);
                resolve(floppy);
            });
        });
    },

    addDeskPaperInstructions(scene){
        // 1.5x floppy width, rectangular like the image
        const rawURL = 'https://raw.githubusercontent.com/Decentricity/decentricity.github.io/083da9e2e5f78e6585f202ec9da8eaac498535e0/paperinstructions1.jpg';
        const loader = new THREE.TextureLoader(); 
        loader.setCrossOrigin('anonymous');
        loader.load(rawURL, (tex)=>{
            tex.colorSpace = THREE.SRGBColorSpace;
            const floppyW = 0.09;                  // same base used for floppies
            const width   = floppyW * 1.5;         // spec: 1.5x wider than floppy
            const aspect  = tex.image.height / tex.image.width;
            const depth   = width * aspect;        // front-to-back on desk
            const t       = 0.0012;                // thin paper thickness

            // thin box so bbox collisions work reliably (vs plane)
            const geom = new THREE.BoxGeometry(width, t, depth);
            const mat  = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0.0 });
            const paper = new THREE.Mesh(geom, mat);
            paper.name = 'paper_instructions_1';
            paper.userData.isDeskItem = true;      // but NO openURL -> clicks do nothing

            const desk = scene.getObjectByName('desk');
            if (!desk){ console.warn('desk not found'); scene.add(paper); return; }
            const dbb = new THREE.Box3().setFromObject(desk);
            const yTop = dbb.max.y + t*0.5 + 0.001;

            // candidate positions across desk (corners, edge band, grid)
            const mrg = 0.14;
            const minX = dbb.min.x + mrg + width*0.5, maxX = dbb.max.x - mrg - width*0.5;
            const minZ = dbb.min.z + mrg + depth*0.5, maxZ = dbb.max.z - mrg - depth*0.5;
            const cx = (minX+maxX)/2, cz = (minZ+maxZ)/2;
            const xs = [minX, (minX*2+cx)/3, cx, (cx*2+maxX)/3, maxX];
            const zs = [maxZ, (cz+maxZ)/2, cz, (cz+minZ)/2, minZ];
            const spots = [
                [minX, maxZ],[maxX, maxZ],[minX, cz],[maxX, cz],[minX, minZ],[maxX, minZ],[cx, maxZ],[cx, cz],[cx, minZ],
                ...xs.flatMap(x => zs.map(z => [x, z]))
            ];

            // collect blockers: keyboard, floppies, photos, other desk items
            const blockers = [];
            scene.traverse(o=>{
                if (o === paper) return;
                if (o.name==='deskKeyboard' || (o.name && o.name.startsWith('floppy')) || o.userData?.isDeskItem){
                    blockers.push(new THREE.Box3().setFromObject(o));
                }
            });

            // try to place with a small random yaw (still flat)
            const yaw = THREE.MathUtils.degToRad((Math.random()*40)-20);
            let placed = false;
            for (const [x,z] of spots){
                paper.position.set(x, yTop, z);
                paper.rotation.set(0, yaw, 0);
                paper.updateMatrixWorld(true);
                const pbb = new THREE.Box3().setFromObject(paper);
                const hit = blockers.some(b => pbb.intersectsBox(b.clone().expandByScalar(0.006)));
                if (!hit){ placed = true; break; }
            }
            if (!placed){
                paper.position.set(minX + 0.02, yTop, maxZ - 0.02);
                paper.rotation.set(0, yaw, 0);
            }
            scene.add(paper);
        });
    },

    addPhotoOnDesk(scene) {
        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin('anonymous');
        const tex = loader.load('https://raw.githubusercontent.com/Decentricity/decentricity.github.io/ad98f557d0c7df179f3bd1f126effed57d8b061c/dannyfren.jpg');
        tex.colorSpace = THREE.SRGBColorSpace || undefined;

        const geo = new THREE.PlaneGeometry(0.15, 0.20);
        const mat = new THREE.MeshStandardMaterial({
            map: tex,
            side: THREE.DoubleSide,
            roughness: 0.8,
        });
        const photo = new THREE.Mesh(geo, mat);
        
        // Stable name for the photo
        photo.name = 'photo_danny';
        photo.userData.isDeskItem = true;
        
        // Get desk and CRT screen references for positioning
        const desk = scene.getObjectByName('desk');
        const crtScreen = scene.getObjectByName('crtScreen');
        
        if (desk && crtScreen) {
            desk.updateWorldMatrix(true, false);
            crtScreen.updateWorldMatrix(true, false);
            
            const deskBox = new THREE.Box3().setFromObject(desk);
            const deskTopY = deskBox.max.y;
            
            const crtCenter = new THREE.Vector3();
            crtScreen.getWorldPosition(crtCenter);
            
            // New position: right side, front area of desk
            const x = deskBox.max.x - 0.22;
            const z = crtCenter.z + 0.12;
            
            photo.position.set(x, deskTopY + 0.002, z);
            photo.rotation.x = -Math.PI / 2;
            photo.rotation.z = -0.12; // slight casual tilt
        } else {
            // Fallback position if desk/screen not found
            photo.rotation.x = -Math.PI / 2;
            photo.rotation.z = -0.12;
            photo.position.set(0.35, 0.052, 0.2);
        }
        
        photo.castShadow = false;
        photo.receiveShadow = true;
        scene.add(photo);
        return photo;
    },

    addCassette(parent) {
        const w = 0.102, h = 0.014, d = 0.063;
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, d),
            new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.8, metalness: 0.1 })
        );
        body.castShadow = body.receiveShadow = true;
        parent.add(body);
        return body;
    },

    addWalkman(parent) {
        const w = 0.08, h = 0.02, d = 0.12;
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, d),
            new THREE.MeshStandardMaterial({ color: 0x1b4a8f, roughness: 0.5, metalness: 0.4 })
        );
        body.castShadow = body.receiveShadow = true;
        parent.add(body);
        return body;
    },

    addMiniSynth(parent) {
        const w = 0.22, h = 0.035, d = 0.11;
        const synth = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, d),
            new THREE.MeshStandardMaterial({ color: 0x202020, roughness: 0.7, metalness: 0.2 })
        );
        synth.castShadow = synth.receiveShadow = true;
        parent.add(synth);

        // a simple silver slider strip for vibe
        const strip = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.9, h * 0.01, d * 0.2),
            new THREE.MeshStandardMaterial({ color: 0xb0b0b0, roughness: 0.3 })
        );
        strip.position.set(0, h * 0.55, -d * 0.25);
        parent.add(strip);
        return synth;
    },

    async spawnRetroSet(scene, crtScreenMesh, camera) {
        // get references
        const desk = scene.getObjectByName('desk');
        const floor = scene.getObjectByName('floor');
        if (!desk || !floor) return { group: new THREE.Group() };

        desk.updateWorldMatrix(true, false);
        floor.updateWorldMatrix(true, false);

        // compute top and floor Y positions using bounding box
        const deskBox = new THREE.Box3().setFromObject(desk);
        const floorBox = new THREE.Box3().setFromObject(floor);
        const deskTopY = deskBox.max.y;
        const floorY = floorBox.max.y;

        // screen width for scale
        crtScreenMesh.geometry.computeBoundingBox?.();
        const sc = new THREE.Vector3(); 
        crtScreenMesh.getWorldScale(sc);
        const bb = crtScreenMesh.geometry.boundingBox;
        const screenW = (bb.max.x - bb.min.x) * sc.x;

        // offsets
        const frontOffset = 0.25;
        const spacing = 0.25;
        const baseZ = desk.position.z + frontOffset;

        // floppy on top of desk, left side
        const floppy = await this.addFloppy(scene);
        floppy.position.set(desk.position.x - 0.35, deskTopY + 0.015, baseZ);
        floppy.rotation.y = -0.2;
        scene.add(floppy);

        // Add Danny photo on desk (now properly positioned)
        this.addPhotoOnDesk(scene);

        // Add Chordynaut floppy
        this.addFloppyChordynaut(scene);
        
        // Add Tetris floppy
        this.addFloppyTetris(scene);
        
        // Add Gamegen floppy
        this.addFloppyGamegen(scene);

        // Add Decentricity floppy
        this.addFloppyDecentricity(scene);

        // Add CRTception floppy
        this.addFloppyCrtception(scene);

        // Add Python City floppy (now using safe placement)
        await this.addFloppyPythonCity(scene);

        // Add paper instructions
        this.addDeskPaperInstructions(scene);

        // group for floor props
        const anchor = new THREE.Group();
        anchor.position.set(desk.position.x, floorY + 0.01, baseZ);
        scene.add(anchor);

        // Add IBM keyboard directly on desk surface
        const keyboardGroup = new THREE.Group();
        // Position keyboard so it rests on desk with small offset to avoid z-fighting
        keyboardGroup.position.set(0, deskTopY + 0.005, 0.25);
        keyboardGroup.rotation.y = Math.PI * 0.028; // ~5° rotation for realism
        scene.add(keyboardGroup);
        
        const keyboard = this.addKeyboard(keyboardGroup);

        // spread other props horizontally under desk
        const props = [
            this.addMiniSynth(anchor),
            this.addCassette(anchor),
            this.addWalkman(anchor)
        ];

        props.forEach((obj, i) => {
            obj.position.set((i - 1) * spacing, 0, 0);
            obj.rotation.y = (i - 1) * 0.1;
        });

        const group = new THREE.Group();
        group.name = 'retro_group';
        group.add(anchor);
        group.add(floppy);
        group.add(keyboardGroup);
        scene.add(group);
        return { group };
    }
};

// Picture Frames Module
const PictureFrames = {
    toRawGitHub(u) {
        // accept blob urls or raw urls
        if (u.includes('raw.githubusercontent.com')) return u;
        if (u.includes('github.com') && u.includes('/blob/')) {
            return u.replace('https://github.com/', 'https://raw.githubusercontent.com/').replace('/blob/', '/');
        }
        // fallback: append ?raw=1 for github-style hosts
        if (u.includes('github.com')) return u + (u.includes('?') ? '&' : '?') + 'raw=1';
        return u;
    },

    async loadTexture(url) {
        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin('anonymous');
        const tex = await new Promise((res, rej) => {
            loader.load(this.toRawGitHub(url), (t) => res(t), undefined, rej);
        });
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    },

    makeFrame(w, h, tex, title) {
        const g = new THREE.Group();
        g.name = 'picture_frame';

        // wooden frame
        const depth = 0.02;
        const border = Math.min(w, h) * 0.07;
        const outer = new THREE.Mesh(
            new THREE.BoxGeometry(w + border * 2, h + border * 2, depth),
            new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.7, metalness: 0.05 })
        );
        outer.castShadow = outer.receiveShadow = true;
        g.add(outer);

        // image plane slightly inset
        const img = new THREE.Mesh(
            new THREE.PlaneGeometry(w, h),
            new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
        );
        img.position.z = depth * 0.51;
        g.add(img);

        // subtle glass sheen
        const glass = new THREE.Mesh(
            new THREE.PlaneGeometry(w, h),
            new THREE.MeshPhysicalMaterial({ 
                transmission: 0.02, 
                roughness: 0.25, 
                transparent: true, 
                opacity: 0.35, 
                ior: 1.45, 
                clearcoat: 0.2 
            })
        );
        glass.position.z = depth * 0.515;
        g.add(glass);

        if (title) g.userData.title = title;
        return g;
    },

    async spawnFrames(scene, crtScreenMesh, frames, camera) {
        if (!frames.length) return;

        // load textures
        const texs = await Promise.all(frames.map(f => this.loadTexture(f.url)));

        // find named wall; hard failover if missing
        const wall = scene.getObjectByName('backWall') || scene.getObjectByName('wall');
        if (!wall || !wall.isMesh) {
            console.warn('frames: wall mesh not found; aborting frame placement');
            return;
        }

        // screen dimensions for scale
        crtScreenMesh.geometry.computeBoundingBox?.();
        const sc = new THREE.Vector3(); crtScreenMesh.getWorldScale(sc);
        const bb = crtScreenMesh.geometry.boundingBox;
        const screenW = (bb.max.x - bb.min.x) * sc.x;
        const screenH = (bb.max.y - bb.min.y) * sc.y;

        // wall world data
        wall.updateWorldMatrix(true, false);
        const wallAABB = WorldUtil.worldAABB(wall);
        const wallNormalLocal = new THREE.Vector3(0,0,1);
        const wallNormalWorld = wallNormalLocal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(wall.matrixWorld)).normalize();

        // anchor row: a little above CRT top, flush to wall, centered on CRT x
        const screenCenter = new THREE.Vector3(); crtScreenMesh.getWorldPosition(screenCenter);
        const wallEpsilon = 0.012;
        const rowY = Math.min(Math.max(screenCenter.y + screenH * 0.35, wallAABB.min.y + 0.1), wallAABB.max.y - 0.1);
        const baseOnWall = new THREE.Vector3(screenCenter.x, rowY, wallAABB.max.z)
                            .add(wallNormalWorld.clone().multiplyScalar(wallEpsilon));

        // extract basis vectors from wall
        const right = new THREE.Vector3();
        const up = new THREE.Vector3();
        const out = new THREE.Vector3();
        wall.matrixWorld.extractBasis(right, up, out);
        right.normalize();
        up.normalize();
        out.normalize();

        // horizontal layout instead of vertical
        const frameW = screenW * 0.36;
        const spacing = screenW * 0.12;
        const totalWidth = frameW * frames.length + spacing * (frames.length - 1);
        const startOffset = -totalWidth / 2 + frameW / 2;
        const xOffsets = frames.map((_, i) => startOffset + i * (frameW + spacing));

        // correct orientation
        const faceMat = new THREE.Matrix4().makeBasis(right, up, out);

        // parent group (clear if exists)
        let group = scene.getObjectByName('wallFrames');
        if (!group) { 
            group = new THREE.Group(); 
            group.name = 'wallFrames'; 
            scene.add(group); 
        }
        while (group.children.length) group.remove(group.children[0]);

        // apply positions horizontally
        frames.slice(0, 3).forEach((f, i) => {
            const tex = texs[i];
            const aspect = tex.image ? tex.image.width / tex.image.height : 1.2;
            const w = frameW, h = frameW / aspect;
            const frame = this.makeFrame(w, h, tex, f.title);

            const pos = baseOnWall.clone().add(right.clone().multiplyScalar(xOffsets[i]));
            frame.position.copy(pos);
            frame.setRotationFromMatrix(faceMat); // face same way as wall, no tilt
            frame.rotation.z = 0; // ensure upright
            
            // Detect by source filename and set userData.openURL
            const src = String(f.url);
            if (src.includes('inversebrah.jpg')) {
                frame.userData.openURL = 'https://wassieverse.io';
            } else if (src.includes('hedgey.jpg')) {
                frame.userData.openURL = 'https://decentricity.github.io/decentricity.html';
            } else {
                // the third/rightmost photo -> go back to homepage
                frame.userData.openURL = 'https://decentricity.github.io';
            }
            
            group.add(frame);
        });
    }
};

// Scene Setup
class CRTScene {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a1a);
        this.oneillRadius = 1800;
        this.oneillCenterY = -0.2 + this.oneillRadius;
        
        this.camera = new THREE.PerspectiveCamera(
            50,
            window.innerWidth / window.innerHeight,
            0.1,
            8000
        );
        this.camera.position.set(0.8, 0.5, 1.2);
        
        this.setupLighting();
        this.createRoom();
        this.createCRT();
        this.addRetroProps();
        this.add90sRoomDecor();
    }
    
    setupLighting() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambient);
        
        const key = new THREE.DirectionalLight(0xfff4e6, 0.8);
        key.position.set(2, 3, 2);
        key.castShadow = true;
        this.scene.add(key);
        
        const fill = new THREE.DirectionalLight(0xe6f4ff, 0.3);
        fill.position.set(-2, 1, -1);
        this.scene.add(fill);
        
        const deskLight = new THREE.PointLight(0xfff9e6, 0.6, 3);
        deskLight.position.set(-0.3, 0.4, 0.3);
        this.scene.add(deskLight);
    }
    
    createRoom() {
        const floorY = -0.2;
        const floorThickness = 0.06;
        const wallHeight = 2.8;
        const wallThickness = 0.08;
        const wallY = floorY + wallHeight * 0.5;
        const ceilingY = floorY + wallHeight + floorThickness * 0.5;

        const makeMaterial = (color, roughness = 0.88, metalness = 0.03) => (
            new THREE.MeshStandardMaterial({ color, roughness, metalness })
        );

        const addBox = (name, w, h, d, x, y, z, material) => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
            mesh.name = name;
            mesh.position.set(x, y, z);
            mesh.castShadow = h <= 0.12;
            mesh.receiveShadow = true;
            this.scene.add(mesh);
            return mesh;
        };

        const addFloorPanel = (name, w, d, x, z, color) => (
            addBox(name, w, floorThickness, d, x, floorY - floorThickness * 0.5, z, makeMaterial(color, 0.96, 0.01))
        );

        const addCeilingPanel = (name, w, d, x, z, color) => (
            addBox(name, w, floorThickness, d, x, ceilingY, z, makeMaterial(color, 0.95, 0.01))
        );

        const addWallX = (name, width, x, z, color, height = wallHeight) => (
            addBox(name, width, height, wallThickness, x, floorY + height * 0.5, z, makeMaterial(color, 0.9, 0.02))
        );

        const addWallZ = (name, depth, x, z, color, height = wallHeight) => (
            addBox(name, wallThickness, height, depth, x, floorY + height * 0.5, z, makeMaterial(color, 0.9, 0.02))
        );

        const addTableLamp = (x, z, color) => {
            const base = addBox('houseLampBase', 0.12, 0.02, 0.12, x, floorY + 0.16, z, makeMaterial(0xdccfd8, 0.55, 0.08));
            const stem = addBox('houseLampStem', 0.02, 0.22, 0.02, x, floorY + 0.27, z, makeMaterial(0xf4e7f5, 0.4, 0.05));
            const shade = new THREE.Mesh(
                new THREE.SphereGeometry(0.18, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
                makeMaterial(color, 0.45, 0.04)
            );
            shade.position.set(x - 0.08, floorY + 0.4, z);
            shade.rotation.z = Math.PI;
            shade.castShadow = true;
            shade.receiveShadow = true;
            this.scene.add(shade);

            const bulb = new THREE.PointLight(0xfff3dd, 0.8, 4.5);
            bulb.position.set(x - 0.08, floorY + 0.28, z);
            this.scene.add(bulb);
            return { base, stem, shade, bulb };
        };

        const addGroupBox = (group, name, w, h, d, x, y, z, material) => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
            mesh.name = name;
            mesh.position.set(x, y, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            group.add(mesh);
            return mesh;
        };

        const addGroupPlane = (group, name, w, h, x, y, z, material, rotY = 0) => {
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
            mesh.name = name;
            mesh.position.set(x, y, z);
            mesh.rotation.y = rotY;
            mesh.receiveShadow = true;
            group.add(mesh);
            return mesh;
        };

        const addHingedDoor = (
            group,
            name,
            width,
            height,
            thickness,
            x,
            y,
            z,
            material,
            { closedRotY = 0, openAngle = 0, hinge = 'left' } = {}
        ) => {
            const pivot = new THREE.Group();
            pivot.name = `${name}Pivot`;

            const hingeSign = hinge === 'right' ? 1 : -1;
            const localX = new THREE.Vector3(Math.cos(closedRotY), 0, -Math.sin(closedRotY));
            const hingePoint = new THREE.Vector3(x, y, z).addScaledVector(localX, hingeSign * width * 0.5);

            pivot.position.copy(hingePoint);
            pivot.rotation.y = closedRotY + (hinge === 'right' ? openAngle : -openAngle);
            group.add(pivot);

            const door = new THREE.Mesh(new THREE.BoxGeometry(width, height, thickness), material);
            door.name = name;
            door.position.set(hinge === 'right' ? -width * 0.5 : width * 0.5, 0, 0);
            door.castShadow = true;
            door.receiveShadow = true;
            pivot.add(door);

            return { pivot, door };
        };

        const fract = (n) => n - Math.floor(n);
        const rand01 = (seed, salt = 0) => fract(Math.sin(seed * 127.1 + salt * 311.7) * 43758.5453123);
        const pick = (items, seed, salt = 0) => items[Math.floor(rand01(seed, salt) * items.length) % items.length];

        const numberTextureCache = new Map();
        const getNumberTexture = (label, bg = '#f8eed6', fg = '#4d3927') => {
            const key = `${label}:${bg}:${fg}`;
            if (numberTextureCache.has(key)) return numberTextureCache.get(key);

            const canvas = document.createElement('canvas');
            canvas.width = 192;
            canvas.height = 96;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = '#d3b785';
            ctx.lineWidth = 6;
            ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
            ctx.fillStyle = fg;
            ctx.font = 'bold 54px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, canvas.width / 2, canvas.height / 2 + 3);

            const texture = new THREE.CanvasTexture(canvas);
            texture.colorSpace = THREE.SRGBColorSpace || texture.colorSpace;
            numberTextureCache.set(key, texture);
            return texture;
        };

        const addNumberPlaque = (group, label, x, y, z, rotY = 0) => {
            const mat = new THREE.MeshBasicMaterial({
                map: getNumberTexture(label),
                transparent: true
            });
            const plaque = addGroupPlane(group, `house_number_${label}`, 0.68, 0.34, x, y, z, mat, rotY);
            plaque.userData.ignoreScreenOcclusion = true;
            return plaque;
        };

        const addWindowUnit = (group, x, y, z, w, h, rotY = 0, lit = true) => {
            const frameDepth = 0.07;
            if (Math.abs(rotY) < 0.001 || Math.abs(rotY - Math.PI) < 0.001) {
                addGroupBox(group, 'windowFrame', w + 0.1, h + 0.1, frameDepth, x, y, z, makeMaterial(0xf3f1ea, 0.55, 0.04));
            } else {
                addGroupBox(group, 'windowFrame', frameDepth, h + 0.1, w + 0.1, x, y, z, makeMaterial(0xf3f1ea, 0.55, 0.04));
            }
            const glass = addGroupPlane(
                group,
                'windowGlass',
                w,
                h,
                x,
                y,
                z + (Math.abs(rotY) < 0.001 ? 0.041 : 0),
                new THREE.MeshBasicMaterial({
                    color: lit ? 0xfff4d6 : 0x9cc6e6,
                    transparent: true,
                    opacity: lit ? 0.82 : 0.55
                }),
                rotY
            );
            glass.userData.ignoreScreenOcclusion = true;
        };

        const addMailbox = (group, x, z, bodyColor) => {
            addGroupBox(group, 'mailboxPost', 0.07, 0.58, 0.07, x, floorY + 0.15, z, makeMaterial(0x6f5a46, 0.75, 0.02));
            addGroupBox(group, 'mailboxBody', 0.24, 0.18, 0.28, x, floorY + 0.47, z, makeMaterial(bodyColor, 0.7, 0.03));
        };

        const addTree = (x, z, seed = 0) => {
            const tree = new THREE.Group();
            tree.position.set(x, 0, z);
            addGroupBox(tree, 'treeTrunk', 0.22, 1.45 + rand01(seed, 1) * 0.55, 0.22, 0, floorY + 0.48, 0, makeMaterial(0x70553d, 0.92, 0.01));
            const canopyColor = pick([0x4d8a45, 0x5c9a50, 0x44793f, 0x6ea85f], seed, 2);
            const canopy = new THREE.Mesh(
                new THREE.SphereGeometry(0.95 + rand01(seed, 3) * 0.22, 18, 14),
                makeMaterial(canopyColor, 0.9, 0.01)
            );
            canopy.position.set(0, floorY + 1.75, 0);
            canopy.castShadow = true;
            canopy.receiveShadow = true;
            tree.add(canopy);
            const canopy2 = new THREE.Mesh(
                new THREE.SphereGeometry(0.62 + rand01(seed, 4) * 0.18, 16, 12),
                makeMaterial(canopyColor, 0.92, 0.01)
            );
            canopy2.position.set(0.42, floorY + 1.55, -0.18);
            canopy2.castShadow = true;
            canopy2.receiveShadow = true;
            tree.add(canopy2);
            this.scene.add(tree);
        };

        const addShrub = (x, z, radius = 0.34, color = 0x4f7d43) => {
            const shrub = new THREE.Mesh(
                new THREE.SphereGeometry(radius, 14, 12),
                makeMaterial(color, 0.95, 0.0)
            );
            shrub.position.set(x, floorY + radius * 0.7, z);
            shrub.castShadow = true;
            shrub.receiveShadow = true;
            this.scene.add(shrub);
        };

        const addStreet = (name, z, length = 190, roadWidth = 7.4) => {
            addBox(name, length, 0.04, roadWidth, 0, floorY - 0.06, z, makeMaterial(0x3f434a, 0.97, 0.01));
            addBox(`${name}_sidewalk_n`, length, 0.05, 1.25, 0, floorY - 0.035, z - roadWidth * 0.5 - 0.82, makeMaterial(0xd7d1ca, 0.95, 0.01));
            addBox(`${name}_sidewalk_s`, length, 0.05, 1.25, 0, floorY - 0.035, z + roadWidth * 0.5 + 0.82, makeMaterial(0xd7d1ca, 0.95, 0.01));
            for (let x = -length * 0.5 + 6; x < length * 0.5 - 2; x += 8) {
                addBox(`${name}_line_${x}`, 3.2, 0.01, 0.18, x, floorY - 0.015, z, makeMaterial(0xf6e394, 0.85, 0.01));
            }
        };

        const addNorthSouthStreet = (name, x, z, length = 82, roadWidth = 7.2) => {
            addBox(name, roadWidth, 0.04, length, x, floorY - 0.06, z, makeMaterial(0x3f434a, 0.97, 0.01));
            addBox(`${name}_sidewalk_w`, 1.25, 0.05, length, x - roadWidth * 0.5 - 0.82, floorY - 0.035, z, makeMaterial(0xd7d1ca, 0.95, 0.01));
            addBox(`${name}_sidewalk_e`, 1.25, 0.05, length, x + roadWidth * 0.5 + 0.82, floorY - 0.035, z, makeMaterial(0xd7d1ca, 0.95, 0.01));
            for (let zz = z - length * 0.5 + 6; zz < z + length * 0.5 - 2; zz += 8) {
                addBox(`${name}_line_${zz}`, 0.18, 0.01, 3.2, x, floorY - 0.015, zz, makeMaterial(0xf6e394, 0.85, 0.01));
            }
        };

        const addStreetLamp = (x, z, height = 3.2) => {
            addBox('streetLampPole', 0.09, height, 0.09, x, floorY + height * 0.5, z, makeMaterial(0x5f6472, 0.74, 0.08));
            addBox('streetLampArm', 0.54, 0.08, 0.08, x + 0.18, floorY + height - 0.15, z, makeMaterial(0x5f6472, 0.74, 0.08));
            const globe = new THREE.Mesh(
                new THREE.SphereGeometry(0.14, 14, 12),
                new THREE.MeshBasicMaterial({ color: 0xfff6d9 })
            );
            globe.position.set(x + 0.42, floorY + height - 0.16, z);
            globe.userData.ignoreScreenOcclusion = true;
            this.scene.add(globe);

            const lampLight = new THREE.PointLight(0xfff0cf, 0.16, 14);
            lampLight.position.copy(globe.position);
            this.scene.add(lampLight);
        };

        const addBench = (x, z, rotY = 0) => {
            const bench = new THREE.Group();
            bench.position.set(x, 0, z);
            bench.rotation.y = rotY;
            addGroupBox(bench, 'benchSeat', 1.1, 0.07, 0.34, 0, floorY + 0.32, 0, makeMaterial(0x9c7958, 0.74, 0.03));
            addGroupBox(bench, 'benchBack', 1.1, 0.36, 0.08, 0, floorY + 0.56, -0.13, makeMaterial(0x9c7958, 0.74, 0.03));
            [-0.42, 0.42].forEach((dx) => {
                addGroupBox(bench, 'benchLeg', 0.08, 0.32, 0.08, dx, floorY + 0.12, 0.08, makeMaterial(0x5f6472, 0.74, 0.08));
            });
            this.scene.add(bench);
        };

        const buildOneillCylinderBackdrop = () => {
            const habitatRadius = this.oneillRadius || 1800;
            const habitatCenterY = this.oneillCenterY || (floorY + habitatRadius);

            this.scene.background = new THREE.Color(0xdbeeff);
            this.scene.fog = new THREE.Fog(0xdbeeff, 2200, 18000);

            const shellCanvas = document.createElement('canvas');
            shellCanvas.width = 4096;
            shellCanvas.height = 1536;
            const ctx = shellCanvas.getContext('2d');
            ctx.fillStyle = '#d6efd8';
            ctx.fillRect(0, 0, shellCanvas.width, shellCanvas.height);

            const paintBand = (y0, h, color) => {
                ctx.fillStyle = color;
                ctx.fillRect(0, y0 * shellCanvas.height, shellCanvas.width, h * shellCanvas.height);
            };

            paintBand(0.00, 0.17, '#cce9d0');
            paintBand(0.17, 0.06, '#d8d2c8');
            paintBand(0.23, 0.10, '#7d828a');
            paintBand(0.33, 0.06, '#d8d2c8');
            paintBand(0.39, 0.22, '#c9e6cf');
            paintBand(0.61, 0.06, '#d8d2c8');
            paintBand(0.67, 0.10, '#7d828a');
            paintBand(0.77, 0.06, '#d8d2c8');
            paintBand(0.83, 0.17, '#cce9d0');

            [0.26, 0.70].forEach((yy) => {
                ctx.fillStyle = '#f5e8a3';
                for (let x = 0; x < shellCanvas.width; x += 170) {
                    ctx.fillRect(x + 30, (yy + 0.022) * shellCanvas.height, 90, 6);
                }
            });

            const lotCount = 100;
            const lotW = shellCanvas.width / lotCount;
            for (let i = 0; i < lotCount; i++) {
                const rowTop = i % 2 === 0;
                const baseY = (rowTop ? 0.03 : 0.44) * shellCanvas.height;
                const bodyH = 58 + (i % 4) * 12;
                const left = i * lotW + 8;
                ctx.fillStyle = ['#f2ece5', '#ece6de', '#e9e3db'][i % 3];
                ctx.fillRect(left, baseY, lotW - 16, bodyH);
                ctx.beginPath();
                ctx.moveTo(left - 4, baseY);
                ctx.lineTo(left + lotW * 0.5, baseY - 24 - (i % 3) * 6);
                ctx.lineTo(left + lotW - 12, baseY);
                ctx.closePath();
                ctx.fillStyle = ['#8b6c63', '#7a6157', '#9a7868'][i % 3];
                ctx.fill();
                ctx.fillStyle = '#f8f0c7';
                ctx.fillRect(left + 14, baseY + 16, 18, 22);
                ctx.fillRect(left + lotW - 38, baseY + 14, 16, 16);
            }

            for (let i = 0; i < 500; i++) {
                const x = (i * 97) % shellCanvas.width;
                const y = (i * 61) % shellCanvas.height;
                ctx.fillStyle = i % 3 === 0 ? '#6fa266' : '#8fb482';
                ctx.fillRect(x, y, 6 + (i % 5), 6 + (i % 4));
            }

            const shellTexture = new THREE.CanvasTexture(shellCanvas);
            shellTexture.wrapS = THREE.RepeatWrapping;
            shellTexture.wrapT = THREE.ClampToEdgeWrapping;
            shellTexture.colorSpace = THREE.SRGBColorSpace || shellTexture.colorSpace;

            const shell = new THREE.Mesh(
                new THREE.CylinderGeometry(habitatRadius, habitatRadius, 900, 192, 1, true),
                new THREE.MeshStandardMaterial({
                    map: shellTexture,
                    side: THREE.BackSide,
                    roughness: 0.98,
                    metalness: 0.0
                })
            );
            shell.name = 'oneillShell';
            shell.rotation.z = Math.PI * 0.5;
            shell.position.set(0, habitatCenterY, 0);
            shell.userData.ignoreScreenOcclusion = true;
            this.scene.add(shell);

            const lightAngles = [-1.1, 0, 1.1];
            lightAngles.forEach((theta, index) => {
                const bandRadius = habitatRadius - 18;
                const band = new THREE.Mesh(
                    new THREE.CylinderGeometry(4.2, 4.2, 900, 18, 1, true),
                    new THREE.MeshBasicMaterial({
                        color: 0xf2f8ff,
                        transparent: true,
                        opacity: index === 1 ? 0.12 : 0.07
                    })
                );
                band.rotation.z = Math.PI * 0.5;
                band.position.set(
                    0,
                    habitatCenterY - Math.cos(theta) * bandRadius,
                    Math.sin(theta) * bandRadius
                );
                band.userData.ignoreScreenOcclusion = true;
                this.scene.add(band);
            });

            const habitatAmbient = new THREE.HemisphereLight(0xf1fbff, 0xb8d7b7, 0.72);
            habitatAmbient.name = 'oneillHemisphere';
            this.scene.add(habitatAmbient);
        };

        const addDeadCRTStation = (group, seed, x, z) => {
            const deskColor = pick([0xb48d6b, 0x9f795a, 0xc3a17c], seed, 21);
            addGroupBox(group, 'deadDeskTop', 1.35, 0.08, 0.68, x, floorY + 0.42, z, makeMaterial(deskColor, 0.74, 0.03));
            [-0.52, 0.52].forEach((dx) => {
                [-0.22, 0.22].forEach((dz) => {
                    addGroupBox(group, 'deadDeskLeg', 0.08, 0.7, 0.08, x + dx, floorY + 0.07, z + dz, makeMaterial(deskColor, 0.78, 0.02));
                });
            });

            addGroupBox(group, 'deadCRTBody', 0.62, 0.52, 0.56, x - 0.08, floorY + 0.72, z - 0.06, makeMaterial(0xd8cfbf, 0.65, 0.03));
            addGroupBox(group, 'deadCRTNeck', 0.16, 0.1, 0.16, x - 0.08, floorY + 0.48, z - 0.1, makeMaterial(0xd0c6b6, 0.65, 0.03));
            addGroupBox(group, 'deadCRTScreen', 0.38, 0.28, 0.02, x - 0.08, floorY + 0.74, z + 0.19, makeMaterial(0x06080d, 0.98, 0.01));
            addGroupBox(group, 'deadKeyboard', 0.48, 0.05, 0.18, x + 0.08, floorY + 0.47, z + 0.12, makeMaterial(0xe8e2d8, 0.82, 0.02));
            addGroupBox(group, 'disketteA', 0.16, 0.02, 0.16, x + 0.35, floorY + 0.47, z - 0.06, makeMaterial(pick([0x3a526d, 0x6d3a4c, 0x4a6c58], seed, 22), 0.84, 0.01));
            addGroupBox(group, 'disketteB', 0.16, 0.02, 0.16, x + 0.18, floorY + 0.47, z - 0.16, makeMaterial(pick([0x7b4d8a, 0x355d7d, 0x915e52], seed, 23), 0.84, 0.01));
        };

        const addGeneratedHouse = (cfg) => {
            const house = new THREE.Group();
            house.position.set(cfg.x, 0, cfg.z);
            house.rotation.y = cfg.facingSouth ? Math.PI : 0;
            this.scene.add(house);

            const bodyHeight = cfg.stories === 2 ? 4.8 : 3.05;
            const porchDepth = 0.8 + rand01(cfg.seed, 12) * 0.5;
            const doorWidth = 1.02;
            const doorHeight = 2.1;
            const doorOffset = (rand01(cfg.seed, 13) - 0.5) * Math.min(1.6, cfg.width * 0.22);
            const leftWidth = Math.max(1.0, cfg.width * 0.5 + doorOffset - doorWidth * 0.5);
            const rightWidth = Math.max(0.9, cfg.width - leftWidth - doorWidth);
            const leftCenter = -cfg.width * 0.5 + leftWidth * 0.5;
            const rightCenter = cfg.width * 0.5 - rightWidth * 0.5;
            const frontZ = cfg.depth * 0.5;
            const roofBaseY = floorY + bodyHeight + 0.15;
            const facadeType = Math.floor(rand01(cfg.seed, 14) * 5);

            const makeFurnitureGroup = (name, x, z, rotY = 0) => {
                const furniture = new THREE.Group();
                furniture.name = name;
                furniture.position.set(x, 0, z);
                furniture.rotation.y = rotY;
                house.add(furniture);
                return furniture;
            };

            const addSofaCluster = (x, z, rotY, color) => {
                const sofa = makeFurnitureGroup('houseSofaCluster', x, z, rotY);
                addGroupBox(sofa, 'houseSofaSeat', 1.45, 0.28, 0.74, 0, floorY + 0.16, 0, makeMaterial(color, 0.93, 0.01));
                addGroupBox(sofa, 'houseSofaBack', 1.45, 0.55, 0.16, 0, floorY + 0.42, -0.29, makeMaterial(color, 0.93, 0.01));
                addGroupBox(sofa, 'houseSofaArmA', 0.18, 0.46, 0.8, -0.64, floorY + 0.25, 0, makeMaterial(color, 0.93, 0.01));
                addGroupBox(sofa, 'houseSofaArmB', 0.18, 0.46, 0.8, 0.64, floorY + 0.25, 0, makeMaterial(color, 0.93, 0.01));
            };

            const addBedCluster = (x, z, rotY, frameColor) => {
                const bed = makeFurnitureGroup('houseBedCluster', x, z, rotY);
                addGroupBox(bed, 'houseBedBase', 1.5, 0.24, 2.0, 0, floorY + 0.12, 0, makeMaterial(frameColor, 0.9, 0.01));
                addGroupBox(bed, 'houseMattress', 1.36, 0.18, 1.84, 0, floorY + 0.34, 0, makeMaterial(0xf7f4f8, 0.95, 0.01));
                addGroupBox(bed, 'housePillowA', 0.42, 0.12, 0.32, -0.32, floorY + 0.47, -0.68, makeMaterial(0xf8f5fb, 0.95, 0.01));
                addGroupBox(bed, 'housePillowB', 0.42, 0.12, 0.32, 0.32, floorY + 0.47, -0.68, makeMaterial(0xf8f5fb, 0.95, 0.01));
            };

            const addDiningCluster = (x, z, rotY, woodColor, stoolColor) => {
                const dining = makeFurnitureGroup('houseDiningCluster', x, z, rotY);
                addGroupBox(dining, 'houseDiningTable', 0.96, 0.08, 0.96, 0, floorY + 0.42, 0, makeMaterial(woodColor, 0.72, 0.03));
                [-0.46, 0.46].forEach((offset, i) => {
                    addGroupBox(dining, `houseDiningStool${i}`, 0.28, 0.42, 0.28, offset, floorY + 0.21, 0, makeMaterial(stoolColor, 0.93, 0.01));
                });
            };

            const addStorageCluster = (x, z, rotY, woodColor) => {
                const storage = makeFurnitureGroup('houseStorageCluster', x, z, rotY);
                addGroupBox(storage, 'houseCabinet', 0.72, 0.92, 0.34, 0, floorY + 0.44, 0, makeMaterial(woodColor, 0.76, 0.03));
                addGroupBox(storage, 'houseBooks', 0.52, 0.14, 0.2, 0, floorY + 0.78, -0.05, makeMaterial(0xb8c7db, 0.84, 0.01));
            };

            const addAccentTable = (x, z, woodColor) => {
                addGroupBox(house, 'houseAccentTable', 0.42, 0.08, 0.42, x, floorY + 0.24, z, makeMaterial(woodColor, 0.75, 0.03));
                addGroupBox(house, 'houseAccentLampBase', 0.1, 0.02, 0.1, x + 0.08, floorY + 0.3, z - 0.02, makeMaterial(0xddd7d0, 0.62, 0.03));
                addGroupBox(house, 'houseAccentLampShade', 0.18, 0.16, 0.18, x + 0.08, floorY + 0.41, z - 0.02, makeMaterial(0xf0d8d1, 0.82, 0.02));
            };

            const addPottedPlant = (x, z, foliageColor) => {
                addGroupBox(house, 'housePlantPot', 0.22, 0.18, 0.22, x, floorY + 0.09, z, makeMaterial(0xc9a688, 0.82, 0.02));
                const foliage = new THREE.Mesh(
                    new THREE.SphereGeometry(0.24, 12, 10),
                    makeMaterial(foliageColor, 0.95, 0.0)
                );
                foliage.position.set(x, floorY + 0.34, z);
                foliage.castShadow = true;
                foliage.receiveShadow = true;
                house.add(foliage);
            };

            const layoutPresets = [
                {
                    walls: [{ axis: 'x', span: 0.45, x: -0.08, z: 0.12 }],
                    rug: { w: 0.38, d: 0.22, x: -0.18, z: 0.08, rot: 0 },
                    sofa: { x: -0.22, z: 0.14, rot: 0 },
                    bed: { x: 0.22, z: -0.22, rot: 0 },
                    dining: { x: 0.18, z: 0.22, rot: 0 },
                    storage: { x: -0.34, z: -0.28, rot: 0 },
                    crt: { x: 0.24, z: -0.02 },
                    plant: { x: -0.36, z: 0.3 },
                    accent: { x: 0.04, z: -0.34 }
                },
                {
                    walls: [{ axis: 'z', span: 0.42, x: -0.02, z: -0.08 }],
                    rug: { w: 0.26, d: 0.36, x: 0.1, z: 0.12, rot: Math.PI / 2 },
                    sofa: { x: 0.26, z: 0.12, rot: Math.PI / 2 },
                    bed: { x: -0.22, z: -0.16, rot: Math.PI / 2 },
                    dining: { x: -0.06, z: 0.28, rot: Math.PI / 2 },
                    storage: { x: 0.34, z: -0.22, rot: Math.PI / 2 },
                    crt: { x: -0.3, z: 0.02 },
                    plant: { x: 0.34, z: 0.3 },
                    accent: { x: -0.26, z: -0.32 }
                },
                {
                    walls: [
                        { axis: 'x', span: 0.36, x: 0.06, z: -0.18 },
                        { axis: 'z', span: 0.26, x: -0.24, z: 0.12 }
                    ],
                    rug: { w: 0.34, d: 0.22, x: 0.2, z: -0.02, rot: 0 },
                    sofa: { x: 0.2, z: -0.26, rot: Math.PI },
                    bed: { x: -0.22, z: 0.16, rot: 0 },
                    dining: { x: -0.1, z: -0.28, rot: 0 },
                    storage: { x: 0.34, z: 0.24, rot: Math.PI },
                    crt: { x: -0.28, z: -0.1 },
                    plant: { x: 0.38, z: -0.3 },
                    accent: { x: -0.34, z: 0.28 }
                },
                {
                    walls: [{ axis: 'x', span: 0.32, x: 0.18, z: 0.18 }],
                    rug: { w: 0.22, d: 0.34, x: -0.12, z: -0.02, rot: Math.PI / 2 },
                    sofa: { x: -0.18, z: 0.02, rot: -Math.PI / 2 },
                    bed: { x: 0.24, z: -0.22, rot: 0 },
                    dining: { x: 0.28, z: 0.2, rot: Math.PI / 2 },
                    storage: { x: -0.34, z: -0.28, rot: 0 },
                    crt: { x: 0.02, z: 0.28 },
                    plant: { x: -0.34, z: 0.3 },
                    accent: { x: 0.36, z: -0.3 }
                },
                {
                    walls: [{ axis: 'z', span: 0.34, x: 0.2, z: 0.04 }],
                    rug: { w: 0.38, d: 0.2, x: -0.2, z: -0.1, rot: 0 },
                    sofa: { x: -0.24, z: -0.18, rot: Math.PI },
                    bed: { x: 0.2, z: 0.18, rot: Math.PI / 2 },
                    dining: { x: -0.02, z: 0.26, rot: 0 },
                    storage: { x: 0.34, z: -0.28, rot: Math.PI / 2 },
                    crt: { x: -0.3, z: 0.14 },
                    plant: { x: 0.34, z: 0.28 },
                    accent: { x: -0.04, z: -0.32 }
                },
                {
                    walls: [{ axis: 'x', span: 0.34, x: -0.16, z: -0.04 }],
                    rug: { w: 0.26, d: 0.36, x: 0.18, z: 0.14, rot: Math.PI / 2 },
                    sofa: { x: 0.24, z: 0.18, rot: 0 },
                    bed: { x: -0.2, z: -0.24, rot: Math.PI / 2 },
                    dining: { x: -0.2, z: 0.24, rot: Math.PI / 2 },
                    storage: { x: 0.34, z: -0.22, rot: 0 },
                    crt: { x: 0.04, z: -0.04 },
                    plant: { x: -0.38, z: 0.18 },
                    accent: { x: 0.36, z: 0.32 }
                },
                {
                    walls: [
                        { axis: 'z', span: 0.26, x: -0.2, z: -0.16 },
                        { axis: 'x', span: 0.24, x: 0.18, z: 0.12 }
                    ],
                    rug: { w: 0.3, d: 0.22, x: 0.02, z: -0.1, rot: 0 },
                    sofa: { x: 0.02, z: -0.24, rot: Math.PI },
                    bed: { x: -0.24, z: 0.16, rot: 0 },
                    dining: { x: 0.24, z: 0.22, rot: 0 },
                    storage: { x: -0.34, z: -0.28, rot: Math.PI / 2 },
                    crt: { x: 0.32, z: -0.02 },
                    plant: { x: 0.38, z: 0.18 },
                    accent: { x: -0.36, z: 0.32 }
                },
                {
                    walls: [{ axis: 'x', span: 0.4, x: 0.02, z: 0.2 }],
                    rug: { w: 0.22, d: 0.34, x: -0.24, z: 0.02, rot: Math.PI / 2 },
                    sofa: { x: -0.3, z: 0.04, rot: -Math.PI / 2 },
                    bed: { x: 0.18, z: -0.18, rot: Math.PI / 2 },
                    dining: { x: 0.18, z: 0.28, rot: 0 },
                    storage: { x: 0.34, z: -0.3, rot: 0 },
                    crt: { x: -0.02, z: -0.24 },
                    plant: { x: -0.38, z: -0.28 },
                    accent: { x: 0.34, z: 0.22 }
                },
                {
                    walls: [{ axis: 'z', span: 0.4, x: 0.06, z: 0.02 }],
                    rug: { w: 0.32, d: 0.22, x: -0.18, z: 0.16, rot: 0 },
                    sofa: { x: -0.18, z: 0.28, rot: 0 },
                    bed: { x: 0.26, z: -0.12, rot: 0 },
                    dining: { x: -0.22, z: -0.24, rot: Math.PI / 2 },
                    storage: { x: 0.32, z: 0.26, rot: Math.PI },
                    crt: { x: -0.28, z: -0.02 },
                    plant: { x: 0.36, z: -0.28 },
                    accent: { x: 0.02, z: 0.34 }
                },
                {
                    walls: [
                        { axis: 'x', span: 0.22, x: -0.22, z: 0.1 },
                        { axis: 'z', span: 0.28, x: 0.22, z: -0.1 }
                    ],
                    rug: { w: 0.22, d: 0.32, x: 0.12, z: 0.02, rot: Math.PI / 2 },
                    sofa: { x: 0.18, z: 0.04, rot: Math.PI / 2 },
                    bed: { x: -0.22, z: -0.22, rot: 0 },
                    dining: { x: -0.22, z: 0.24, rot: 0 },
                    storage: { x: 0.34, z: -0.28, rot: Math.PI / 2 },
                    crt: { x: 0.24, z: 0.26 },
                    plant: { x: -0.36, z: 0.3 },
                    accent: { x: 0.34, z: -0.04 }
                }
            ];
            const layout = layoutPresets[cfg.planType % layoutPresets.length];

            addGroupBox(house, 'lotPad', cfg.width + 4.4, 0.06, cfg.depth + 6.8, 0, floorY - 0.03, 0, makeMaterial(0x78ad63, 0.98, 0.0));
            addGroupBox(house, 'houseFoundation', cfg.width + 0.18, 0.18, cfg.depth + 0.2, 0, floorY - 0.01, 0, makeMaterial(0xcab9a6, 0.9, 0.01));
            addGroupBox(house, 'houseFloor', cfg.width - 0.2, 0.06, cfg.depth - 0.2, 0, floorY - 0.03, 0, makeMaterial(cfg.floorColor, 0.96, 0.01));

            addGroupBox(house, 'houseWallLeft', wallThickness, bodyHeight, cfg.depth, -cfg.width * 0.5, floorY + bodyHeight * 0.5, 0, makeMaterial(cfg.wallColor, 0.88, 0.02));
            addGroupBox(house, 'houseWallRight', wallThickness, bodyHeight, cfg.depth, cfg.width * 0.5, floorY + bodyHeight * 0.5, 0, makeMaterial(cfg.wallColor, 0.88, 0.02));
            addGroupBox(house, 'houseWallBack', cfg.width, bodyHeight, wallThickness, 0, floorY + bodyHeight * 0.5, -cfg.depth * 0.5, makeMaterial(cfg.wallColor, 0.88, 0.02));
            addGroupBox(house, 'houseWallFrontLeft', leftWidth, bodyHeight, wallThickness, leftCenter, floorY + bodyHeight * 0.5, frontZ, makeMaterial(cfg.wallColor, 0.88, 0.02));
            addGroupBox(house, 'houseWallFrontRight', rightWidth, bodyHeight, wallThickness, rightCenter, floorY + bodyHeight * 0.5, frontZ, makeMaterial(cfg.wallColor, 0.88, 0.02));
            addGroupBox(house, 'houseDoorHeader', doorWidth, bodyHeight - doorHeight, wallThickness, doorOffset, floorY + doorHeight + (bodyHeight - doorHeight) * 0.5, frontZ, makeMaterial(cfg.wallColor, 0.9, 0.02));
            addHingedDoor(
                house,
                'houseFrontDoor',
                0.95,
                doorHeight,
                0.06,
                doorOffset,
                floorY + doorHeight * 0.5,
                frontZ - 0.03,
                makeMaterial(cfg.doorColor, 0.7, 0.03),
                { closedRotY: 0, openAngle: cfg.enterable ? 1.15 : 0, hinge: rand01(cfg.seed, 15) > 0.5 ? 'right' : 'left' }
            );

            addGroupBox(house, 'housePorch', Math.max(1.45, doorWidth + 0.45), 0.08, porchDepth, doorOffset, floorY + 0.01, frontZ + porchDepth * 0.5 + 0.04, makeMaterial(0xd8cdb8, 0.92, 0.01));
            addGroupBox(house, 'houseWalkway', 1.2, 0.05, 3.3, doorOffset, floorY - 0.005, frontZ + porchDepth + 1.62, makeMaterial(0xd9d4cf, 0.95, 0.01));
            addNumberPlaque(house, cfg.number, doorOffset, floorY + 2.42, frontZ + 0.09);
            addGroupBox(house, 'housePorchPostA', 0.12, 1.7, 0.12, doorOffset - 0.58, floorY + 0.85, frontZ + porchDepth * 0.9, makeMaterial(cfg.trimColor, 0.84, 0.02));
            addGroupBox(house, 'housePorchPostB', 0.12, 1.7, 0.12, doorOffset + 0.58, floorY + 0.85, frontZ + porchDepth * 0.9, makeMaterial(cfg.trimColor, 0.84, 0.02));

            addWindowUnit(house, -cfg.width * 0.27, floorY + 1.5, frontZ + 0.05, 0.95, 0.75, 0, cfg.windowLit);
            addWindowUnit(house, cfg.width * 0.28, floorY + 1.5, frontZ + 0.05, 0.95, 0.75, 0, cfg.windowLit);
            addWindowUnit(house, -cfg.width * 0.5 - 0.04, floorY + 1.4, -cfg.depth * 0.18, 0.9, 0.72, Math.PI / 2, cfg.windowLit);
            addWindowUnit(house, cfg.width * 0.5 + 0.04, floorY + 1.4, cfg.depth * 0.15, 0.9, 0.72, Math.PI / 2, cfg.windowLit);
            if (cfg.stories === 2) {
                addWindowUnit(house, -cfg.width * 0.18, floorY + 3.25, frontZ + 0.05, 0.8, 0.62, 0, true);
                addWindowUnit(house, cfg.width * 0.2, floorY + 3.25, frontZ + 0.05, 0.8, 0.62, 0, true);
            }

            switch (cfg.roofType) {
                case 'flat': {
                    addGroupBox(house, 'flatRoof', cfg.width + 0.55, 0.16, cfg.depth + 0.55, 0, roofBaseY, 0, makeMaterial(cfg.roofColor, 0.8, 0.03));
                    addGroupBox(house, 'flatParapetFront', cfg.width + 0.7, 0.28, 0.16, 0, roofBaseY + 0.12, frontZ + 0.22, makeMaterial(cfg.trimColor, 0.8, 0.02));
                    addGroupBox(house, 'flatParapetBack', cfg.width + 0.7, 0.28, 0.16, 0, roofBaseY + 0.12, -frontZ - 0.22, makeMaterial(cfg.trimColor, 0.8, 0.02));
                    break;
                }
                case 'shed': {
                    const shedAngle = 0.28;
                    const shedRun = cfg.depth / Math.cos(shedAngle);
                    const shedRise = cfg.depth * Math.tan(shedAngle);
                    const panel = addGroupBox(
                        house,
                        'shedRoof',
                        cfg.width + 0.7,
                        0.18,
                        shedRun,
                        0,
                        floorY + bodyHeight + shedRise * 0.5,
                        0,
                        makeMaterial(cfg.roofColor, 0.82, 0.03)
                    );
                    panel.rotation.x = -0.28;
                    break;
                }
                default: {
                    const gableAngle = 0.33;
                    const halfDepth = cfg.depth * 0.5;
                    const roofRun = halfDepth / Math.cos(gableAngle);
                    const roofRise = halfDepth * Math.tan(gableAngle);
                    const roofCenterY = floorY + bodyHeight + roofRise * 0.5;
                    const roofA = addGroupBox(house, 'gableRoofA', cfg.width + 0.6, 0.16, roofRun, 0, roofCenterY, halfDepth * 0.5, makeMaterial(cfg.roofColor, 0.82, 0.03));
                    const roofB = addGroupBox(house, 'gableRoofB', cfg.width + 0.6, 0.16, roofRun, 0, roofCenterY, -halfDepth * 0.5, makeMaterial(cfg.roofColor, 0.82, 0.03));
                    roofA.rotation.x = gableAngle;
                    roofB.rotation.x = -gableAngle;
                    break;
                }
            }

            if (facadeType === 1 || facadeType === 4) {
                const wingSide = rand01(cfg.seed, 16) > 0.5 ? 1 : -1;
                addGroupBox(house, 'houseGarageWing', 2.6, 2.34, 3.5, wingSide * (cfg.width * 0.5 + 1.26), floorY + 1.17, cfg.depth * 0.12, makeMaterial(cfg.wallColor, 0.88, 0.02));
                addGroupBox(house, 'houseGarageRoof', 2.86, 0.16, 3.82, wingSide * (cfg.width * 0.5 + 1.26), floorY + 2.43, cfg.depth * 0.12, makeMaterial(cfg.roofColor, 0.82, 0.03));
                addGroupBox(house, 'houseGarageDoor', 1.9, 1.72, 0.06, wingSide * (cfg.width * 0.5 + 1.26), floorY + 0.86, cfg.depth * 0.12 + 1.72, makeMaterial(0xe6e1db, 0.86, 0.01));
            }
            if (facadeType === 2) {
                addGroupBox(house, 'houseBayFrame', 1.42, 0.88, 0.46, -cfg.width * 0.14, floorY + 1.42, frontZ + 0.22, makeMaterial(cfg.trimColor, 0.84, 0.02));
                addWindowUnit(house, -cfg.width * 0.14, floorY + 1.44, frontZ + 0.28, 1.12, 0.56, 0, true);
            }
            if (facadeType === 3 || cfg.stories === 2) {
                addGroupBox(house, 'houseChimney', 0.38, 1.55, 0.38, cfg.width * 0.24, floorY + bodyHeight + 0.72, -cfg.depth * 0.18, makeMaterial(0xc7b19a, 0.9, 0.01));
            }
            if (cfg.stories === 2 && cfg.roofType === 'gable') {
                addGroupBox(house, 'houseDormer', 1.22, 0.9, 0.9, -cfg.width * 0.12, floorY + bodyHeight + 0.28, frontZ * 0.22, makeMaterial(cfg.wallColor, 0.88, 0.02));
                addWindowUnit(house, -cfg.width * 0.12, floorY + bodyHeight + 0.28, frontZ * 0.5, 0.6, 0.5, 0, true);
            }

            layout.walls.forEach((wallCfg, index) => {
                if (wallCfg.axis === 'x') {
                    addGroupBox(house, `innerWallA_${index}`, cfg.width * wallCfg.span, 2.25, 0.08, cfg.width * wallCfg.x, floorY + 1.12, cfg.depth * wallCfg.z, makeMaterial(cfg.trimColor, 0.93, 0.01));
                } else {
                    addGroupBox(house, `innerWallB_${index}`, 0.08, 2.2, cfg.depth * wallCfg.span, cfg.width * wallCfg.x, floorY + 1.1, cfg.depth * wallCfg.z, makeMaterial(cfg.trimColor, 0.93, 0.01));
                }
            });

            const sofaColor = pick([0xb78e83, 0x8aa5b8, 0x97b783, 0xc9a1ba], cfg.seed, 31);
            const rugColor = pick([0xdcc8ed, 0xc9d9ea, 0xe9d4c8, 0xcfe2cc], cfg.seed, 32);
            const woodColor = pick([0x9b765a, 0x8c684b, 0xb18a65], cfg.seed, 33);
            const stoolColor = pick([0xe2bfd8, 0xbfd4e2, 0xded0bc, 0xc8ddb8], cfg.seed, 35);
            const bedFrameColor = pick([0xc6a0a9, 0xb8a0c8, 0xa0b7c8, 0xd2b596], cfg.seed, 34);
            const rug = addGroupBox(house, 'houseRug', cfg.width * layout.rug.w, 0.01, cfg.depth * layout.rug.d, cfg.width * layout.rug.x, floorY + 0.005, cfg.depth * layout.rug.z, makeMaterial(rugColor, 0.97, 0.01));
            rug.rotation.y = layout.rug.rot;
            addSofaCluster(cfg.width * layout.sofa.x, cfg.depth * layout.sofa.z, layout.sofa.rot, sofaColor);
            addGroupBox(house, 'houseCoffeeTable', 0.9, 0.09, 0.5, cfg.width * (layout.sofa.x * 0.48 + layout.crt.x * 0.18), floorY + 0.22, cfg.depth * (layout.sofa.z * 0.45 + layout.rug.z * 0.3), makeMaterial(woodColor, 0.76, 0.03));
            addBedCluster(cfg.width * layout.bed.x, cfg.depth * layout.bed.z, layout.bed.rot, bedFrameColor);
            addDiningCluster(cfg.width * layout.dining.x, cfg.depth * layout.dining.z, layout.dining.rot, woodColor, stoolColor);
            addStorageCluster(cfg.width * layout.storage.x, cfg.depth * layout.storage.z, layout.storage.rot, woodColor);
            addAccentTable(cfg.width * layout.accent.x, cfg.depth * layout.accent.z, woodColor);
            addPottedPlant(cfg.width * layout.plant.x, cfg.depth * layout.plant.z, pick([0x62884d, 0x4f7d43, 0x7ca15f], cfg.seed, 36));
            addDeadCRTStation(house, cfg.seed, cfg.width * layout.crt.x, cfg.depth * layout.crt.z);

            addMailbox(house, doorOffset - 0.95, frontZ + porchDepth + 0.95, cfg.trimColor);
            addShrub(cfg.x - cfg.width * 0.24, cfg.z + (cfg.facingSouth ? -1 : 1) * (frontZ + porchDepth + 1.4), 0.34, pick([0x62884d, 0x4f7d43, 0x7ca15f], cfg.seed, 40));
            addShrub(cfg.x + cfg.width * 0.3, cfg.z + (cfg.facingSouth ? -1 : 1) * (frontZ + porchDepth + 1.1), 0.28, pick([0x62884d, 0x4f7d43, 0x7ca15f], cfg.seed, 41));
            if (rand01(cfg.seed, 42) > 0.35) {
                addTree(
                    cfg.x + (rand01(cfg.seed, 43) > 0.5 ? 1 : -1) * (cfg.width * 0.5 + 1.9),
                    cfg.z + (cfg.facingSouth ? -1 : 1) * (cfg.depth * 0.5 + 2.6),
                    cfg.seed
                );
            }
        };

        const addCurrentHouseExterior = () => {
            buildOneillCylinderBackdrop();

            addBox('complexGrass', 210, 0.04, 150, 0, floorY - 0.07, 40, makeMaterial(0x7cac67, 0.99, 0.0));
            addStreet('mainAvenue', 8.8, 190, 7.8);
            [18, 33, 48, 63, 78].forEach((z, i) => addStreet(`lane_${i}`, z, 190, 7.2));
            addNorthSouthStreet('collector_west', -20, 48, 92, 7.2);
            addNorthSouthStreet('collector_east', 44, 48, 92, 7.2);

            [
                [-14, 5.1], [18, 5.1], [-14, 21.9], [18, 21.9],
                [-14, 36.9], [18, 36.9], [-14, 51.9], [18, 51.9],
                [-14, 66.9], [18, 66.9], [-14, 81.9], [18, 81.9]
            ].forEach(([x, z]) => addStreetLamp(x, z));

            addBox('pocketParkPath', 10.5, 0.05, 2.2, 86, floorY - 0.005, 48, makeMaterial(0xd7d1ca, 0.95, 0.01));
            addBox('pocketParkPad', 8.8, 0.04, 8.8, 86, floorY - 0.04, 48, makeMaterial(0x89b46f, 0.98, 0.0));
            addBench(83.4, 45.9, Math.PI / 2);
            addBench(88.6, 50.1, -Math.PI / 2);
            addTree(82.8, 52.4, 1601);
            addTree(89.4, 43.4, 1602);
            addShrub(84.2, 48.2, 0.38, 0x62884d);
            addShrub(87.9, 47.2, 0.32, 0x5a7f46);

            addBox('mainHouseFrontWalkway', 1.25, 0.05, 4.1, 0.22, floorY - 0.005, 6.7, makeMaterial(0xd8d4ce, 0.96, 0.01));
            addBox('mainHouseFrontPorch', 1.9, 0.08, 1.25, 0.22, floorY + 0.01, 4.92, makeMaterial(0xd9cfbf, 0.93, 0.01));
            addNumberPlaque(this.scene, '01', 0.22, floorY + 2.42, 4.42);
            addWindowUnit(this.scene, -1.25, floorY + 1.5, 4.38, 0.92, 0.74, 0, true);
            addWindowUnit(this.scene, 1.9, floorY + 1.5, 4.38, 0.92, 0.74, 0, true);

            addBox('mainHouseOuterLeft', wallThickness, 3.3, 8.9, -5.88, floorY + 1.65, 0.15, makeMaterial(0xe2ddcf, 0.86, 0.02));
            addBox('mainHouseOuterRight', wallThickness, 3.3, 8.9, 6.62, floorY + 1.65, 0.15, makeMaterial(0xe2ddcf, 0.86, 0.02));
            addBox('mainHouseOuterBack', 12.5, 3.3, wallThickness, 0.37, floorY + 1.65, -4.12, makeMaterial(0xe2ddcf, 0.86, 0.02));

            const mainRoofAngle = 0.34;
            const mainHouseHalfDepth = 8.9 * 0.5;
            const mainRoofRun = mainHouseHalfDepth / Math.cos(mainRoofAngle);
            const mainRoofRise = mainHouseHalfDepth * Math.tan(mainRoofAngle);
            const mainRoofCenterY = floorY + 3.3 + mainRoofRise * 0.5;
            const mainRoofCenterZ = 0.15;
            const roofA = addBox('mainHouseRoofA', 12.9, 0.18, mainRoofRun, 0.37, mainRoofCenterY, mainRoofCenterZ + mainHouseHalfDepth * 0.5, makeMaterial(0x7c5648, 0.82, 0.03));
            const roofB = addBox('mainHouseRoofB', 12.9, 0.18, mainRoofRun, 0.37, mainRoofCenterY, mainRoofCenterZ - mainHouseHalfDepth * 0.5, makeMaterial(0x7c5648, 0.82, 0.03));
            roofA.rotation.x = mainRoofAngle;
            roofB.rotation.x = -mainRoofAngle;

            addTree(-8.2, 6.8, 1001);
            addTree(8.4, 7.2, 1002);
            addShrub(-2.1, 5.7, 0.4, 0x62884d);
            addShrub(3.1, 5.6, 0.34, 0x5a7f46);

            const lotXs = [-72, -36, -4, 28, 60];
            let houseNumber = 2;
            [18, 33, 48, 63, 78].forEach((roadZ, laneIndex) => {
                for (let slot = 0; slot < lotXs.length; slot++) {
                    const southSeed = houseNumber;
                    addGeneratedHouse({
                        seed: southSeed,
                        number: String(houseNumber).padStart(2, '0'),
                        x: lotXs[slot],
                        z: roadZ - 8.8,
                        facingSouth: false,
                        enterable: houseNumber % 2 === 0,
                        width: 7.0 + rand01(southSeed, 1) * 2.8,
                        depth: 8.0 + rand01(southSeed, 2) * 2.8,
                        roofType: pick(['gable', 'flat', 'shed', 'gable', 'shed'], southSeed, 3),
                        wallColor: pick([0xe7dccf, 0xd7e0e7, 0xe7d9d2, 0xdad5e3, 0xe4e1d0], southSeed, 4),
                        trimColor: pick([0xb3826d, 0x7a6f83, 0x5e7c8f, 0x826558, 0x63835f], southSeed, 5),
                        doorColor: pick([0xa87454, 0x5f6f84, 0x7c594b, 0x6a4a3d], southSeed, 6),
                        roofColor: pick([0x7c5648, 0x5f6573, 0x845f53, 0x58675d], southSeed, 7),
                        floorColor: pick([0xf0ece6, 0xf1ece7, 0xece7f0, 0xe9efe5], southSeed, 8),
                        windowLit: rand01(southSeed, 9) > 0.2,
                        stories: rand01(southSeed, 10) > 0.78 ? 2 : 1,
                        planType: Math.floor(rand01(southSeed, 11) * 10)
                    });
                    houseNumber += 1;

                    const northSeed = houseNumber;
                    addGeneratedHouse({
                        seed: northSeed,
                        number: String(houseNumber).padStart(2, '0'),
                        x: lotXs[slot],
                        z: roadZ + 8.8,
                        facingSouth: true,
                        enterable: houseNumber % 2 === 0,
                        width: 7.0 + rand01(northSeed, 1) * 2.8,
                        depth: 8.0 + rand01(northSeed, 2) * 2.8,
                        roofType: pick(['gable', 'flat', 'shed', 'gable', 'shed'], northSeed, 3),
                        wallColor: pick([0xe7dccf, 0xd7e0e7, 0xe7d9d2, 0xdad5e3, 0xe4e1d0], northSeed, 4),
                        trimColor: pick([0xb3826d, 0x7a6f83, 0x5e7c8f, 0x826558, 0x63835f], northSeed, 5),
                        doorColor: pick([0xa87454, 0x5f6f84, 0x7c594b, 0x6a4a3d], northSeed, 6),
                        roofColor: pick([0x7c5648, 0x5f6573, 0x845f53, 0x58675d], northSeed, 7),
                        floorColor: pick([0xf0ece6, 0xf1ece7, 0xece7f0, 0xe9efe5], northSeed, 8),
                        windowLit: rand01(northSeed, 9) > 0.2,
                        stories: rand01(northSeed, 10) > 0.78 ? 2 : 1,
                        planType: Math.floor(rand01(northSeed, 11) * 10)
                    });
                    houseNumber += 1;
                }
            });

            for (let i = 0; i < 24; i++) {
                const tx = -90 + i * 8;
                addTree(tx, 11.9, 1200 + i);
                if (i % 2 === 0) addTree(tx + 3.4, 85.5, 1400 + i);
            }
        };

        // 1) The existing CRT nook stays the anchor room.
        const floor = addFloorPanel('floor', 4, 4, 0, 0, 0xf3eee7);
        addCeilingPanel('studyCeiling', 4, 4, 0, 0, 0xf7f1fb);
        const backWall = addWallX('backWall', 4, 0, -1.02, 0xd7d3db);
        const sideWall = addWallZ('sideWall', 1.55, -2.02, -0.225, 0xbdc0c9);
        addWallZ('sideWallFront', 1.35, -2.02, 2.325, 0xbdc0c9);
        addBox('sideWallHeader', wallThickness, 0.7, 1.1, -2.02, floorY + 2.45, 1.1, makeMaterial(0xbdc0c9, 0.9, 0.02));

        // 2) A front hall/gallery turns the open front edge into part of a house.
        addFloorPanel('hallFloor', 4.2, 2.4, 0, 3.1, 0xf1ece8);
        addCeilingPanel('hallCeiling', 4.2, 2.4, 0, 3.1, 0xfbf7f3);
        const hallDoorCenterX = 0.22;
        const hallDoorWidth = 1.04;
        const hallDoorHeight = 2.14;
        const hallFrontHalf = 2.1;
        const hallFrontLeftWidth = hallDoorCenterX - hallDoorWidth * 0.5 + hallFrontHalf;
        const hallFrontRightWidth = hallFrontHalf - (hallDoorCenterX + hallDoorWidth * 0.5);
        addWallX('frontHallWallLeft', hallFrontLeftWidth, -hallFrontHalf + hallFrontLeftWidth * 0.5, 4.28, 0xe3d4c4);
        addWallX('frontHallWallRight', hallFrontRightWidth, hallDoorCenterX + hallDoorWidth * 0.5 + hallFrontRightWidth * 0.5, 4.28, 0xe3d4c4);
        addBox('frontHallDoorHeader', hallDoorWidth, wallHeight - hallDoorHeight, wallThickness, hallDoorCenterX, floorY + hallDoorHeight + (wallHeight - hallDoorHeight) * 0.5, 4.28, makeMaterial(0xe3d4c4, 0.9, 0.02));
        addHingedDoor(
            this.scene,
            'mainFrontDoor',
            0.98,
            hallDoorHeight,
            0.06,
            hallDoorCenterX,
            floorY + hallDoorHeight * 0.5,
            4.24,
            makeMaterial(0x946d55, 0.72, 0.03),
            { closedRotY: 0, openAngle: 1.1, hinge: 'left' }
        );
        addWallZ('hallLeftWall', 2.45, -2.02, 3.06, 0xd7d0cb);
        addWallZ('hallRightReturn', 1.0, 2.02, 3.78, 0xd7d0cb);

        const hallConsole = addBox('hallConsole', 0.9, 0.12, 0.28, -0.35, floorY + 0.28, 4.0, makeMaterial(0x8f6f53, 0.72, 0.05));
        addBox('hallConsoleLegA', 0.06, 0.34, 0.06, -0.72, floorY + 0.11, 4.0, makeMaterial(0x8f6f53, 0.72, 0.05));
        addBox('hallConsoleLegB', 0.06, 0.34, 0.06, 0.02, floorY + 0.11, 4.0, makeMaterial(0x8f6f53, 0.72, 0.05));
        addBox('hallMirror', 0.9, 0.7, 0.04, -0.35, floorY + 1.32, 4.0, makeMaterial(0xc8d3dc, 0.2, 0.15));
        addBox('hallRunner', 0.9, 0.01, 1.8, 0.25, floorY + 0.005, 3.1, makeMaterial(0xc8b4da, 0.95, 0.01));

        // 3) A living room extends through the open right side.
        addFloorPanel('livingFloor', 4.2, 4.4, 4.1, 1.1, 0xf2ebe1);
        addCeilingPanel('livingCeiling', 4.2, 4.4, 4.1, 1.1, 0xfbf7f2);
        addWallZ('livingRightWall', 4.4, 6.18, 1.1, 0xd8d2cf);
        addWallX('livingFrontWall', 4.2, 4.1, 3.28, 0xd4c8b8);
        addWallX('livingBackWallLeft', 1.1, 2.55, -1.08, 0xd4c8b8);
        addWallX('livingBackWallRight', 1.45, 5.47, -1.08, 0xd4c8b8);
        addBox('livingBackHeader', 1.65, 0.7, wallThickness, 4.1, floorY + 2.45, -1.08, makeMaterial(0xd4c8b8, 0.9, 0.02));

        addBox('livingSofaSeat', 1.5, 0.32, 0.8, 4.85, floorY + 0.16, 2.45, makeMaterial(0xb9988d, 0.92, 0.01));
        addBox('livingSofaBack', 1.5, 0.58, 0.18, 4.85, floorY + 0.45, 2.14, makeMaterial(0xb9988d, 0.92, 0.01));
        addBox('livingSofaArmA', 0.18, 0.46, 0.8, 4.08, floorY + 0.25, 2.45, makeMaterial(0xb9988d, 0.92, 0.01));
        addBox('livingSofaArmB', 0.18, 0.46, 0.8, 5.62, floorY + 0.25, 2.45, makeMaterial(0xb9988d, 0.92, 0.01));
        addBox('livingCoffeeTable', 1.0, 0.1, 0.55, 4.55, floorY + 0.24, 1.45, makeMaterial(0x9a7657, 0.72, 0.05));
        addBox('livingBookshelf', 0.46, 1.6, 1.2, 5.76, floorY + 0.8, -0.18, makeMaterial(0x8b6b4d, 0.78, 0.05));
        addBox('livingBooks', 0.34, 0.2, 0.9, 5.74, floorY + 1.02, -0.2, makeMaterial(0xc4b0de, 0.8, 0.02));
        addTableLamp(5.4, 0.95, 0xf2cfe7);
        const livingGlow = new THREE.PointLight(0xffead7, 0.55, 5.5);
        livingGlow.position.set(4.6, floorY + 1.6, 1.2);
        this.scene.add(livingGlow);

        // 4) A kitchenette sits behind the living room, reached through a wide doorway.
        addFloorPanel('kitchenFloor', 4.2, 2.5, 4.1, -2.45, 0xe9e5df);
        addCeilingPanel('kitchenCeiling', 4.2, 2.5, 4.1, -2.45, 0xf8f5f0);
        addWallX('kitchenBackWall', 4.2, 4.1, -3.68, 0xd4d7dc);
        addWallZ('kitchenRightWall', 2.5, 6.18, -2.45, 0xd4d7dc);
        addWallZ('kitchenLeftWall', 2.5, 2.02, -2.45, 0xd4d7dc);

        addBox('kitchenCounterBack', 3.2, 0.92, 0.7, 4.1, floorY + 0.46, -3.05, makeMaterial(0xd9d0c8, 0.84, 0.02));
        addBox('kitchenCounterRight', 0.7, 0.92, 1.5, 5.65, floorY + 0.46, -2.2, makeMaterial(0xd9d0c8, 0.84, 0.02));
        addBox('kitchenFridge', 0.72, 1.7, 0.72, 2.55, floorY + 0.85, -3.08, makeMaterial(0xf0f5f6, 0.45, 0.03));
        addBox('kitchenTable', 0.9, 0.08, 0.9, 3.65, floorY + 0.42, -2.15, makeMaterial(0xa47d61, 0.7, 0.04));
        addBox('kitchenLegA', 0.06, 0.7, 0.06, 3.3, floorY + 0.07, -2.5, makeMaterial(0xa47d61, 0.7, 0.04));
        addBox('kitchenLegB', 0.06, 0.7, 0.06, 4.0, floorY + 0.07, -2.5, makeMaterial(0xa47d61, 0.7, 0.04));
        addBox('kitchenLegC', 0.06, 0.7, 0.06, 3.3, floorY + 0.07, -1.8, makeMaterial(0xa47d61, 0.7, 0.04));
        addBox('kitchenLegD', 0.06, 0.7, 0.06, 4.0, floorY + 0.07, -1.8, makeMaterial(0xa47d61, 0.7, 0.04));
        addBox('kitchenStoolA', 0.32, 0.44, 0.32, 3.1, floorY + 0.22, -2.1, makeMaterial(0xcdb8d4, 0.92, 0.01));
        addBox('kitchenStoolB', 0.32, 0.44, 0.32, 4.25, floorY + 0.22, -2.8, makeMaterial(0xb6c6d7, 0.92, 0.01));
        const kitchenLight = new THREE.PointLight(0xfff2e0, 0.65, 4.8);
        kitchenLight.position.set(4.1, floorY + 2.25, -2.5);
        this.scene.add(kitchenLight);

        // 5) A bedroom nook sits through the new doorway in the left wall.
        addFloorPanel('bedroomFloor', 2.9, 3.8, -3.43, 1.1, 0xefe8f5);
        addCeilingPanel('bedroomCeiling', 2.9, 3.8, -3.43, 1.1, 0xfaf6fe);
        addWallZ('bedroomLeftWall', 3.8, -4.84, 1.1, 0xd7d3de);
        addWallX('bedroomFrontWall', 2.9, -3.43, 2.98, 0xe7d9e5);
        addWallX('bedroomBackWall', 2.9, -3.43, -0.78, 0xe7d9e5);

        addBox('bedFrame', 1.55, 0.28, 2.25, -3.63, floorY + 0.14, 1.2, makeMaterial(0xc7a2aa, 0.88, 0.01));
        addBox('bedMattress', 1.42, 0.22, 2.05, -3.63, floorY + 0.39, 1.2, makeMaterial(0xf4f1f6, 0.92, 0.01));
        addBox('bedPillowA', 0.42, 0.12, 0.32, -3.96, floorY + 0.56, 0.45, makeMaterial(0xf7f2ff, 0.95, 0.01));
        addBox('bedPillowB', 0.42, 0.12, 0.32, -3.30, floorY + 0.56, 0.45, makeMaterial(0xf7f2ff, 0.95, 0.01));
        addBox('dresser', 0.85, 0.82, 0.42, -4.48, floorY + 0.41, 2.25, makeMaterial(0x8e6b54, 0.76, 0.05));
        addBox('bedroomRug', 1.45, 0.01, 1.0, -3.13, floorY + 0.005, 2.1, makeMaterial(0xe6c7ef, 0.95, 0.01));
        const bedroomGlow = new THREE.PointLight(0xffecf2, 0.45, 4);
        bedroomGlow.position.set(-3.68, floorY + 1.9, 1.75);
        this.scene.add(bedroomGlow);

        addCurrentHouseExterior();

        // Desk
        const deskGeo = new THREE.BoxGeometry(1.2, 0.05, 0.6);
        const deskMat = new THREE.MeshStandardMaterial({ 
            color: 0x8b6f47,
            roughness: 0.7
        });
        const desk = new THREE.Mesh(deskGeo, deskMat);
        desk.position.set(0, 0.025, 0);
        desk.castShadow = true;
        desk.receiveShadow = true;
        desk.name = 'desk';
        this.scene.add(desk);
        
        // Desk legs
        const legGeo = new THREE.BoxGeometry(0.04, 0.2, 0.04);
        const positions = [
            [-0.5, -0.1, -0.25],
            [0.5, -0.1, -0.25],
            [-0.5, -0.1, 0.25],
            [0.5, -0.1, 0.25]
        ];
        positions.forEach(pos => {
            const leg = new THREE.Mesh(legGeo, deskMat);
            leg.position.set(...pos);
            leg.castShadow = true;
            leg.name = 'desk_leg';
            this.scene.add(leg);
        });
    }
    
    createCRT() {
        const crtGroup = new THREE.Group();
        crtGroup.name = 'crt';
        crtGroup.position.set(0, 0.32, -0.1);
        
        // Monitor body
        const bodyGeo = new THREE.BoxGeometry(0.42, 0.36, 0.38);
        const bodyMat = new THREE.MeshStandardMaterial({ 
            color: 0xd4c5a9,
            roughness: 0.6,
            metalness: 0.1
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.z = -0.15;
        body.castShadow = true;
        body.receiveShadow = true;
        crtGroup.add(body);
        
        // Front bezel
        const bezelGeo = new THREE.BoxGeometry(0.44, 0.38, 0.04);
        const bezel = new THREE.Mesh(bezelGeo, bodyMat);
        bezel.position.z = 0.02;
        bezel.castShadow = true;
        bezel.receiveShadow = true;
        crtGroup.add(bezel);
        
        // Screen opening (THE CRITICAL MESH)
        const screenGeo = new THREE.PlaneGeometry(0.36, 0.27);
        const screenMat = new THREE.MeshBasicMaterial({ 
            color: 0x000000,
            side: THREE.DoubleSide
        });
        this.screenMesh = new THREE.Mesh(screenGeo, screenMat);
        this.screenMesh.name = 'crtScreen';
        this.screenMesh.position.z = 0.041;
        crtGroup.add(this.screenMesh);
        
        // Glass layer with fresnel effect
        const glassMat = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            metalness: 0.1,
            roughness: 0.2,
            transmission: 0.03,
            ior: 1.5,
            clearcoat: 0.3,
            clearcoatRoughness: 0.1,
            transparent: true,
            opacity: 0.95,
            side: THREE.DoubleSide
        });
        
        const glass = new THREE.Mesh(screenGeo, glassMat);
        glass.name = 'crtGlass';
        glass.userData.ignoreScreenOcclusion = true;
        glass.position.z = 0.042;
        crtGroup.add(glass);
        
        // Add subtle CRT curve
        this.screenMesh.geometry = new THREE.PlaneGeometry(0.36, 0.27, 10, 10);
        const positions = this.screenMesh.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const curve = -0.02 * (x * x + y * y);
            positions.setZ(i, curve);
        }
        positions.needsUpdate = true;
        
        // Base stand
        const standGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.06, 16);
        const stand = new THREE.Mesh(standGeo, bodyMat);
        stand.position.set(0, -0.21, -0.05);
        stand.castShadow = true;
        stand.receiveShadow = true;
        crtGroup.add(stand);
        
        this.scene.add(crtGroup);
        this.crtGroup = crtGroup;
        
        // Snap CRT to desk top after creation
        requestAnimationFrame(() => {
            const desk = this.scene.getObjectByName('desk');
            if (desk) {
                this.snapToDeskTop(crtGroup, desk);
            }
        });
    }

    snapToDeskTop(obj, desk) {
        const deskBox = new THREE.Box3().setFromObject(desk);
        const yTop = deskBox.max.y;
        const mBox = new THREE.Box3().setFromObject(obj);
        const dy = (yTop + 0.002) - mBox.min.y; // tiny lift to avoid z-fighting
        obj.position.y += dy;
        obj.updateMatrixWorld(true);
    }

    addRetroProps() {
        // Wait for next frame to ensure screen mesh is fully initialized
        requestAnimationFrame(async () => {
            const crtScreenMesh = this.scene.getObjectByName('crtScreen');
            if (crtScreenMesh) {
                // Add retro props (now passing camera)
                await RetroProps.spawnRetroSet(this.scene, crtScreenMesh, this.camera);

                // Add picture frames with new middle image URL
                const frames = [
                    { url: 'https://raw.githubusercontent.com/Decentricity/decentricity.github.io/060928a3d159b4459a076dacb7afad27d2ccd6b0/inversebrah.jpg' },
                    { url: 'https://raw.githubusercontent.com/Decentricity/decentricity.github.io/bd22c196aa18ae5805a9ee970ba9c9955846595a/hedgey.jpg' },
                    { url: 'https://raw.githubusercontent.com/Decentricity/Decentricity/main/IMG_20210124_233405_109-01.png' },
                ];
                PictureFrames.spawnFrames(this.scene, crtScreenMesh, frames, this.camera);
            }
        });
    }

    add90sRoomDecor() {
        // Wait for objects to be ready, then add all the 90s room features
        requestAnimationFrame(() => {
            // ---------- helpers ----------
            const updaters = window.updaters || (window.updaters = []);
            function findOne(matchFn) {
                let found = null; 
                this.scene.traverse(o => { if(!found && matchFn(o)) found = o; });
                return found;
            }
            const findOneB = findOne.bind(this);
            
            const desk = findOneB(o => (o.isMesh || o.isGroup) && /desk/i.test(o.name || ''));
            const floor = findOneB(o => (o.isMesh || o.isGroup) && /floor/i.test(o.name || ''));
            const crtGroup = findOneB(o => (o.isGroup || o.isMesh) && /crt/i.test(o.name || ''));
            
            function bboxY(o) { 
                const b = new THREE.Box3().setFromObject(o); 
                return { min: b.min.y, max: b.max.y, box: b }; 
            }
            
            function setOnTopOf(child, surfaceObj, pad=0) {
                const s = bboxY(surfaceObj); 
                const c = bboxY(child);
                const delta = (s.max + pad) - c.min;
                child.position.y += delta;
            }
            
            // ---------- 1) crt resting on desk ----------
            if (crtGroup && desk) setOnTopOf(crtGroup, desk, 0.001);

            // ---------- 2) palette ----------
            const wall = findOneB(o => (o.isMesh||o.isGroup) && /wall/i.test(o.name || '')) || 
                         findOneB(o => (o.isMesh && o.geometry && o.geometry.boundingBox && Math.abs(o.rotation.y) < 1.0));
            if (wall) {
                wall.traverse(m => { 
                    if (m.isMesh) { 
                        m.material = m.material.clone(); 
                        m.material.color.set('#b88aa6'); 
                        m.material.roughness = 0.9; 
                    }
                });
            }
            if (floor) {
                floor.traverse(m => { 
                    if (m.isMesh) { 
                        m.material = m.material.clone(); 
                        m.material.color.set('#d9d0f0'); 
                        m.material.roughness = 1.0; 
                    }
                });
            }
            // subtle warm ambient
            let hemi = findOneB(o => o.isHemisphereLight);
            if (!hemi) { 
                hemi = new THREE.HemisphereLight(0xfff3e0, 0x555577, 0.5); 
                this.scene.add(hemi); 
            }
            let keyLight = findOneB(o => o.isDirectionalLight);
            if (!keyLight) { 
                keyLight = new THREE.DirectionalLight(0xffffff, 0.4); 
                keyLight.position.set(1,1,1); 
                this.scene.add(keyLight); 
            }

            // ---------- 3) fairy lights ----------
            const addFairyLights = () => {
                if (!wall) return;
                const y = bboxY(wall).max - 0.05;
                const z = bboxY(wall).box.getCenter(new THREE.Vector3()).z + 0.01;
                const pts = [
                    new THREE.Vector3(-0.9, y, z), 
                    new THREE.Vector3(-0.3, y+0.02, z),
                    new THREE.Vector3( 0.3, y-0.01, z), 
                    new THREE.Vector3( 0.9, y+0.015, z),
                ];
                const curve = new THREE.CatmullRomCurve3(pts);
                const tube = new THREE.TubeGeometry(curve, 40, 0.004, 8, false);
                const cable = new THREE.Mesh(tube, new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 }));
                cable.name = 'fairyCable';

                const bulbGeo = new THREE.SphereGeometry(0.015, 12, 12);
                const bulbs = [];
                for (let t=0; t<=1.0001; t+=0.1) {
                    const p = curve.getPoint(t);
                    const mat = new THREE.MeshStandardMaterial({ 
                        color: 0x111111, 
                        emissive: new THREE.Color().setHSL(0.85 - 0.6*Math.random(), 0.7, 0.5), 
                        emissiveIntensity: 1.6 
                    });
                    const b = new THREE.Mesh(bulbGeo, mat);
                    b.position.copy(p);
                    bulbs.push(b);
                }
                
                // Create a parent group for all fairy light components
                const fairyGroup = new THREE.Group();
                fairyGroup.name = 'fairyLights';
                fairyGroup.add(cable);
                bulbs.forEach(b => fairyGroup.add(b));
                this.scene.add(fairyGroup);
                
                updaters.push((time)=> bulbs.forEach((b,i)=> b.material.emissiveIntensity = 1.3 + 0.4*Math.sin(time*2.0 + i*0.7)));
            };
            addFairyLights();

            // ---------- 4) lava lamp ----------
            if (!desk) return;
            const { box } = bboxY(desk);
            
            // === lava lamp (replace block) ===
            {
              const lamp = new THREE.Group();
              lamp.name = "lavaLamp";

              // base
              const base = new THREE.Mesh(
                new THREE.CylinderGeometry(0.045, 0.055, 0.03, 24),
                new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.45, metalness: 0.3 })
              );
              base.castShadow = base.receiveShadow = true;
              lamp.add(base);

              // glass bottle -- use Standard + transparency (works on mobile)
              const glass = new THREE.Mesh(
                new THREE.CylinderGeometry(0.035, 0.025, 0.22, 32, 1, true),
                new THREE.MeshStandardMaterial({
                  color: 0xffffff,
                  roughness: 0.1,
                  metalness: 0.0,
                  transparent: true,
                  opacity: 0.32,
                  side: THREE.DoubleSide
                })
              );
              glass.position.y = 0.13;
              lamp.add(glass);

              // caps
              const capMat = new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: 0.6, metalness: 0.2 });
              const topCap = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.008, 24), capMat);
              topCap.position.y = glass.position.y + 0.11;
              const botCap = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.010, 24), capMat);
              botCap.position.y = glass.position.y - 0.11;
              [topCap, botCap].forEach(m => { m.castShadow = m.receiveShadow = true; lamp.add(m); });

              // blobs
              const blobMat = new THREE.MeshStandardMaterial({
                color: 0xff4aa3,
                emissive: 0xff4aa3,
                emissiveIntensity: 0.25,
                roughness: 0.5,
                metalness: 0.0
              });
              const blobs = [];
              for (let i = 0; i < 3; i++) {
                const b = new THREE.Mesh(new THREE.SphereGeometry(0.012 + 0.004 * i, 24, 16), blobMat);
                b.position.set((Math.random()-0.5)*0.02, glass.position.y, (Math.random()-0.5)*0.015);
                blobs.push({ m: b, spd: 0.4 + Math.random() * 0.45, phase: Math.random() * Math.PI * 2 });
                lamp.add(b);
              }
              // animate
              (this.onTickFns || (this.onTickFns = [])).push((dt, t) => {
                blobs.forEach(o => {
                  const y = Math.sin(t * o.spd + o.phase) * 0.08;
                  o.m.position.y = glass.position.y + y;
                  const s = 1.0 + 0.15 * Math.sin(t * o.spd * 1.3 + o.phase);
                  o.m.scale.setScalar(s);
                });
              });

              // place on desk near monitor
              lamp.position.set(box.min.x + 0.22, box.max.y + 0.01, box.max.z - 0.18);
              this.scene.add(lamp);

              // if you maintain a clickables array, keep it consistent
              if (this.clickables) this.clickables.push(lamp);
            }

            // ---------- 5) starry rug (canvas texture) ----------
            const makeStarRugTexture = (size=512) => {
                const c = document.createElement('canvas'); 
                c.width = c.height = size;
                const g = c.getContext('2d');
                g.fillStyle = '#f3e9ff'; 
                g.fillRect(0,0,size,size);
                for (let i=0;i<80;i++){
                    const x = Math.random()*size, y = Math.random()*size, r = 1 + Math.random()*2;
                    g.fillStyle = `hsla(${260+Math.random()*40},70%,75%,0.9)`;
                    g.beginPath(); 
                    g.arc(x,y,r,0,Math.PI*2); 
                    g.fill();
                }
                return new THREE.CanvasTexture(c);
            };
            const addRug = () => {
                if (!floor) return;
                const tex = makeStarRugTexture();
                tex.anisotropy = this.renderer ? this.renderer.capabilities.getMaxAnisotropy() : 8;
                const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1.0, metalness: 0.0 });
                const geo = new THREE.CircleGeometry(0.5, 48);
                const rug = new THREE.Mesh(geo, mat);
                const { box } = bboxY(floor);
                rug.rotation.x = -Math.PI/2;
                rug.position.set(box.min.x + 0.9, box.max.y + 0.0005, box.min.z + 0.9);
                rug.name = 'starRug';
                this.scene.add(rug);
            };
            addRug();

            // ---------- 6) beanbag (DO NOT MODIFY) ----------
            const addBeanbag = () => {
                if (!floor) return;
                const geom = new THREE.SphereGeometry(0.22, 24, 24);
                geom.scale(1.2, 0.6, 1.0);
                const bag = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ color: 0xaf79c8, roughness: 0.95, metalness: 0.0 }));
                const { box } = bboxY(floor);
                bag.position.set(box.min.x + 0.55, box.max.y + 0.001, box.min.z + 1.45);
                bag.castShadow = true; 
                bag.receiveShadow = true;
                this.scene.add(bag);
            };
            addBeanbag();

            // ---------- 7) desk lamp with spotlight ----------
            const addDeskLamp = () => {
                if (!desk) return;
                const { box } = bboxY(desk);
                const base = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.04, 0.05, 0.02, 16),
                    new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.2, roughness: 0.6 })
                );
                base.position.set(box.min.x + 0.22, box.max.y + 0.01, box.min.z + 0.22);
                this.scene.add(base);

                // === desk lamp head + light ===
                const shade = new THREE.Mesh(
                  new THREE.CylinderGeometry(0.018, 0.045, 0.055, 24, 1, true), // frustum shade, open bottom
                  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.1 })
                );
                shade.position.copy(base.position).add(new THREE.Vector3(0.02, 0.07, 0.02));
                shade.rotation.x = -Math.PI / 3;

                const rim = new THREE.Mesh(
                  new THREE.TorusGeometry(0.045, 0.002, 12, 48),
                  new THREE.MeshStandardMaterial({ color: 0xb0b0b0, roughness: 0.6, metalness: 0.2 })
                );
                rim.position.copy(shade.position);
                rim.rotation.copy(shade.rotation);

                const bulb = new THREE.Mesh(
                  new THREE.SphereGeometry(0.010, 16, 12),
                  new THREE.MeshStandardMaterial({ color: 0xfffff2, emissive: 0xfff2cc, emissiveIntensity: 1.2 })
                );
                bulb.position.copy(shade.position).add(new THREE.Vector3(0, -0.01, 0));
                bulb.rotation.copy(shade.rotation);

                const spot = new THREE.SpotLight(0xfff2cc, 1.2, 2.0, Math.PI / 5, 0.25, 1.0);
                spot.position.copy(shade.position);
                spot.target.position.set(shade.position.x + 0.05, box.max.y + 0.01, shade.position.z + 0.25);

                this.scene.add(shade, rim, bulb, spot, spot.target);

                let on = true;
                function setLamp(v){ 
                    on = v; 
                    bulb.material.emissiveIntensity = v? 1.2: 0.0; 
                    spot.intensity = v? 1.4: 0.0; 
                }
                setLamp(true);
                base.userData.clickable = shade.userData.clickable = true;
                base.userData.onClick = shade.userData.onClick = ()=> setLamp(!on);
            };
            addDeskLamp();

            // ---------- 8) corkboard + repositioning logic ----------
            const addCorkboard = () => {
                if (!wall) return;
                
                const boardGeo = new THREE.PlaneGeometry(0.7, 0.45);
                const boardMat = new THREE.MeshStandardMaterial({ color: 0x9b6b3f, roughness: 0.9 });
                const board = new THREE.Mesh(boardGeo, boardMat);
                board.name = 'corkBoard';
                
                // Parent group for the cork board
                const corkGroup = new THREE.Group();
                corkGroup.name = 'corkGroup';
                corkGroup.add(board);
                
                const w = bboxY(wall).box;
                const cx = (w.min.x + w.max.x)/2;
                // Initial position (will be adjusted by positionCorkAndLights)
                corkGroup.position.set(cx, w.max.y - 0.35, w.getCenter(new THREE.Vector3()).z + 0.001);
                this.scene.add(corkGroup);
                
                // pushpins
                const pinGeo = new THREE.SphereGeometry(0.01, 12, 12);
                const pins = [[-0.32, 0.20],[0.32, 0.20],[ -0.32, -0.20],[0.32,-0.20]];
                pins.forEach(([x,y],i)=>{
                    const pin = new THREE.Mesh(pinGeo, new THREE.MeshStandardMaterial({ color: [0xff6aa6,0x6aa6ff,0xa6ff6a,0xffd66a][i%4] }));
                    pin.position.set(x, y, 0.01);
                    corkGroup.add(pin);
                });
            };
            addCorkboard();

            // ---------- NEW: Position cork board and fairy lights relative to frames ----------
            const positionCorkAndLights = async () => {
                const frames = await waitForObject(this.scene, 'wallFrames');
                const boardMesh = this.scene.getObjectByName('corkBoard');
                const board = boardMesh ? boardMesh.parent : null; // corkGroup
                const lights = this.scene.getObjectByName('fairyLights');
                if (!frames || !board || !lights) return;

                // measurements
                const { box: fBox } = box3Of(frames);
                const { box: bBox, size: bSize } = box3Of(board);
                const { box: lBox } = box3Of(lights);

                const GAP_ABOVE_FRAMES = 0.06;   // how much space between frames and board bottom
                const GAP_ABOVE_BOARD  = 0.08;   // lights above board top
                const WALL_Z = fBox.max.z + 0.002; // keep flat on wall plane

                // align x center of board with frames center
                const framesCX = (fBox.min.x + fBox.max.x) * 0.5;
                const boardCX  = (bBox.min.x + bBox.max.x) * 0.5;
                board.position.x += (framesCX - boardCX);

                // set board bottom = frames top + gap
                const targetBoardBottomY = fBox.max.y + GAP_ABOVE_FRAMES;
                const currentBoardBottomY = bBox.min.y;
                board.position.y += (targetBoardBottomY - currentBoardBottomY);

                // pin to wall plane
                board.position.z += (WALL_Z - bBox.max.z);

                // recompute after moving board
                const { box: newBBox } = box3Of(board);

                // place fairy lights just above board top
                const targetLightsTopY = newBBox.max.y + GAP_ABOVE_BOARD;
                const currentLightsTopY = lBox.max.y;
                lights.position.y += (targetLightsTopY - currentLightsTopY);

                // horizontally span lights across frames width
                const span = (fBox.max.x - fBox.min.x) * 0.52; // a little wider than frames
                const framesCenterX = framesCX;
                lights.position.x += (framesCenterX - ((lBox.min.x + lBox.max.x) * 0.5));
                lights.scale.x = span / (lBox.max.x - lBox.min.x);

                // tiny natural tilt
                board.rotation.z = THREE.MathUtils.degToRad(1.2);
                lights.rotation.z = THREE.MathUtils.degToRad(-0.6);
            };

            // Call positioning function after objects are created
            positionCorkAndLights();

            // Re-run on resize
            window.addEventListener('resize', () => { positionCorkAndLights(); });

            // Store updaters globally so they can be called from render loop
            window.updaters = updaters;
        });
    }
}

// CSS3D Screen Management - UPDATED WITH ASPECT-CORRECT SCALING
class CSS3DScreen {
    constructor(scene, camera, screenMesh, options = {}) {
        this.scene = scene;
        this.camera = camera;
        this.screenMesh = screenMesh;
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        this.hovering = false;
        this.screenVisible = true;
        
        // Keep the width; derive height from actual screen aspect at runtime
        const VIRTUAL_W = 520;
        this.emulateViewportCssWidth = VIRTUAL_W;
        this.emulateViewportCssHeight = null; // compute from screen aspect at runtime
        
        this.embedWarningMode = options.embedWarningMode || 'toast';
        this.toastContainer = document.getElementById('toast-container');
        
        // Create CSS3D renderer
        this.renderer = new THREE.CSS3DRenderer();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.domElement.id = 'css3d-renderer';
        this.dom = document.getElementById('css3d-root');
        this.dom.appendChild(this.renderer.domElement);
        
        // Create wrapper element
        const wrapper = document.createElement('div');
        wrapper.style.position = 'absolute';
        wrapper.style.overflow = 'hidden';
        wrapper.style.pointerEvents = 'none';
        wrapper.style.willChange = 'transform';
        
        // Inner container for effects
        const inner = document.createElement('div');
        inner.style.position = 'relative';
        wrapper.appendChild(inner);
        
        // Create iframe
        this.iframe = document.createElement('iframe');
        this.iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms allow-popups allow-modals');
        this.iframe.style.position = 'absolute';
        this.iframe.style.top = '0';
        this.iframe.style.left = '0';
        this.iframe.style.border = '0';
        this.iframe.style.width = '100%';
        this.iframe.style.height = '100%';
        
        // Ensure origin and slight zoom
        this.iframe.style.transformOrigin = 'top left';
        this.iframe.style.transform = 'scale(0.92)';
        
        inner.appendChild(this.iframe);
        this.iframe.addEventListener('load', () => this.onIframeLoad());
        
        // Scanlines overlay
        const scan = document.createElement('div');
        scan.style.pointerEvents = 'none';
        scan.style.position = 'absolute';
        scan.style.inset = '0';
        scan.style.backgroundImage = 'repeating-linear-gradient(to bottom, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 3px)';
        scan.style.mixBlendMode = 'multiply';
        inner.appendChild(scan);
        
        this.wrapper = wrapper;
        this.inner = inner;
        
        // Create CSS3D object
        this.cssObject = new THREE.CSS3DObject(wrapper);
        
        // Create anchor that follows screen mesh
        this.cssScreenAnchor = new THREE.Object3D();
        this.cssScreenAnchor.add(this.cssObject);
        scene.add(this.cssScreenAnchor);
        
        // Setup event listeners
        this.setupEvents();
        
        // Initial setup
        this.fitElementToScreen();
        this.syncAnchor();
        
        // Load tracking for embed detection
        this.urlRequested = '';
        this.loadTimer = null;
        this.lastWarningUrl = '';
        this.occlusionBlockers = [];
        this.occlusionRefreshCounter = 0;
    }
    
    computeScreenWorldSize() {
        const geom = this.screenMesh.geometry;
        if (!geom.boundingBox) geom.computeBoundingBox();
        const bb = geom.boundingBox;
        const localSize = new THREE.Vector3().subVectors(bb.max, bb.min);
        const worldScale = new THREE.Vector3();
        this.screenMesh.getWorldScale(worldScale);
        return {
            w: localSize.x * worldScale.x,
            h: localSize.y * worldScale.y
        };
    }
    
    fitElementToScreen() {
        // measure physical screen on the mesh
        this.screenMesh.updateWorldMatrix(true, false);
        const { w, h } = this.computeScreenWorldSize();   // w,h in world units

        // keep the same emulated CSS width; derive height from actual crt aspect
        const emuW = this.emulateViewportCssWidth;
        const emuH = Math.round(emuW * (h / w));          // match plane aspect
        this.emulateViewportCssHeight = emuH;

        // size the DOM surface to that virtual viewport
        this.inner.style.width  = `${emuW}px`;
        this.inner.style.height = `${emuH}px`;

        // scale UNIFORMLY so pixels stay square (no vertical squish)
        const s = w / emuW;                                // width is the anchor
        this.cssObject.scale.set(s, s, 1);
    }
    
    syncAnchor() {
        this.screenMesh.updateWorldMatrix(true, false);
        const tmpPos = new THREE.Vector3();
        const tmpQuat = new THREE.Quaternion();
        const tmpScale = new THREE.Vector3();
        
        this.screenMesh.matrixWorld.decompose(tmpPos, tmpQuat, tmpScale);
        this.cssScreenAnchor.position.copy(tmpPos);
        this.cssScreenAnchor.quaternion.copy(tmpQuat);
        this.cssScreenAnchor.scale.set(1, 1, 1);
        
        this.cssObject.position.set(0, 0, 0);
        this.cssObject.quaternion.set(0, 0, 0, 1);
        this.cssObject.scale.z = 1;
    }
    
    setupEvents() {
        window.addEventListener('resize', () => this.onResize());
        this.dom.addEventListener('pointermove', (e) => this.updateHover(e));
        this.dom.addEventListener('pointerleave', () => {
            this.hovering = false;
            this.wrapper.style.pointerEvents = 'none';
        });
    }
    
    setPointerFromEvent(e) {
        const rect = this.dom.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.pointer.x = (x / rect.width) * 2 - 1;
        this.pointer.y = -(y / rect.height) * 2 + 1;
    }
    
    updateHover(e) {
        if (!this.screenVisible) {
            this.hovering = false;
            this.wrapper.style.pointerEvents = 'none';
            return;
        }
        if (e) this.setPointerFromEvent(e);
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const hit = this.raycaster.intersectObject(this.screenMesh, false);
        const nowHover = hit.length > 0;
        
        if (nowHover !== this.hovering) {
            this.hovering = nowHover;
            this.wrapper.style.pointerEvents = this.hovering ? 'auto' : 'none';
            document.body.style.cursor = this.hovering ? 'default' : 'grab';
        }
    }
    
    update() {
        this.syncAnchor();
        this.updateVisibility();
    }
    
    onResize() {
        this.fitElementToScreen();
    }

    isViewable() {
        return this.screenVisible;
    }

    setScreenVisible(visible) {
        this.screenVisible = visible;
        this.wrapper.style.visibility = visible ? 'visible' : 'hidden';
        this.wrapper.style.opacity = visible ? '1' : '0';
        if (!visible) {
            this.hovering = false;
            this.wrapper.style.pointerEvents = 'none';
        }
    }

    refreshOcclusionBlockers() {
        const blockers = [];
        this.scene.traverse((o) => {
            if (!o.isMesh) return;
            if (o === this.screenMesh) return;
            if (o.userData?.ignoreScreenOcclusion) return;
            blockers.push(o);
        });
        this.occlusionBlockers = blockers;
        this.occlusionRefreshCounter = 60;
    }

    updateVisibility() {
        const center = new THREE.Vector3();
        this.screenMesh.getWorldPosition(center);

        const screenNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(this.screenMesh.getWorldQuaternion(new THREE.Quaternion())).normalize();
        const screenToEye = this.camera.position.clone().sub(center).normalize();
        const facingScore = screenNormal.dot(screenToEye);
        if (facingScore <= 0.05) {
            this.setScreenVisible(false);
            return;
        }

        const toCenter = center.clone().sub(this.camera.position);
        const distance = toCenter.length();
        if (distance <= 0.001) {
            this.setScreenVisible(true);
            return;
        }

        const dir = toCenter.clone().normalize();
        const rc = new THREE.Raycaster(this.camera.position, dir, 0.05, Math.max(0.05, distance - 0.03));
        if (!this.occlusionBlockers.length || this.occlusionRefreshCounter <= 0) {
            this.refreshOcclusionBlockers();
        } else {
            this.occlusionRefreshCounter -= 1;
        }

        const hits = rc.intersectObjects(this.occlusionBlockers, true);
        this.setScreenVisible(hits.length === 0);
    }

    showToast(message) {
        if (!this.toastContainer) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        this.toastContainer.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        window.setTimeout(() => toast.classList.remove('show'), 3600);
        window.setTimeout(() => toast.remove(), 4200);
    }

    onIframeLoad() {
        if (this.loadTimer) {
            window.clearTimeout(this.loadTimer);
            this.loadTimer = null;
        }
        this.lastWarningUrl = '';
    }
    
    loadURL(url) {
        this.urlRequested = url;
        
        // Clear any existing timer
        if (this.loadTimer) {
            window.clearTimeout(this.loadTimer);
            this.loadTimer = null;
        }
        
        try {
            this.iframe.src = url;
            localStorage.setItem('crt.url', url);
            const urlInput = document.getElementById('url-input');
            if (urlInput) {
                urlInput.value = url;
            }
        } catch (e) {
            console.error('[crt] Error loading URL:', e);
        }
        
        this.lastWarningUrl = '';

        // Set up warning timer for likely blocked or stalled embeds
        this.loadTimer = window.setTimeout(() => {
            this.lastWarningUrl = this.urlRequested;
            if (this.embedWarningMode === 'toast') {
                this.showToast('This site may block embedding. Try another URL if the screen stays blank.');
            }
            console.warn('[crt] iframe might be blocked or slow:', this.urlRequested);
        }, 6000);
    }
    
    enableInput() {
        this.iframe.style.pointerEvents = 'auto';
    }
    
    disableInput() {
        this.iframe.style.pointerEvents = 'none';
    }
}

// Post-processing Effects
class PostProcessing {
    constructor(renderer, scene, camera) {
        this.composer = new THREE.EffectComposer(renderer);
        
        // Base render pass
        const renderPass = new THREE.RenderPass(scene, camera);
        this.composer.addPass(renderPass);
        
        // Bloom for CRT glow
        const bloomPass = new THREE.UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.08,  // strength
            0.4,  // radius
            0.85  // threshold
        );
        this.composer.addPass(bloomPass);
        
        // Vignette shader
        const vignetteShader = {
            uniforms: {
                tDiffuse: { value: null },
                offset: { value: 0.5 },
                darkness: { value: 0.8 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform float offset;
                uniform float darkness;
                varying vec2 vUv;
                
                void main() {
                    vec4 color = texture2D(tDiffuse, vUv);
                    vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
                    float vignette = clamp(1.0 - dot(uv, uv), 0.0, 1.0);
                    color.rgb *= mix(darkness, 1.0, vignette);
                    gl_FragColor = color;
                }
            `
        };
        
        const vignettePass = new THREE.ShaderPass(vignetteShader);
        this.composer.addPass(vignettePass);
        
        // Film grain
        const grainShader = {
            uniforms: {
                tDiffuse: { value: null },
                time: { value: 0.0 },
                amount: { value: 0.04 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform float time;
                uniform float amount;
                varying vec2 vUv;
                
                float random(vec2 co) {
                    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
                }
                
                void main() {
                    vec4 color = texture2D(tDiffuse, vUv);
                    float noise = random(vUv + time) * amount;
                    color.rgb += noise - amount * 0.5;
                    gl_FragColor = color;
                }
            `
        };
        
        this.grainPass = new THREE.ShaderPass(grainShader);
        this.composer.addPass(this.grainPass);
        
        // Chromatic aberration
        const chromaShader = {
            uniforms: {
                tDiffuse: { value: null },
                amount: { value: 0.002 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform float amount;
                varying vec2 vUv;
                
                void main() {
                    vec2 offset = amount * (vUv - 0.5);
                    float r = texture2D(tDiffuse, vUv + offset).r;
                    float g = texture2D(tDiffuse, vUv).g;
                    float b = texture2D(tDiffuse, vUv - offset).b;
                    gl_FragColor = vec4(r, g, b, 1.0);
                }
            `
        };
        
        const chromaPass = new THREE.ShaderPass(chromaShader);
        this.composer.addPass(chromaPass);
        
        // Final copy
        const copyPass = new THREE.ShaderPass(THREE.CopyShader);
        copyPass.renderToScreen = true;
        this.composer.addPass(copyPass);
    }
    
    render(delta) {
        this.grainPass.uniforms.time.value += delta;
        this.composer.render();
    }
    
    resize(width, height) {
        this.composer.setSize(width, height);
    }
}

// First-person walking controls
class FPSControls {
    constructor(camera, domElement) {
        this.camera = camera;
        this.domElement = domElement;
        this.enabled = true;
        this.isLocked = false;
        this.isTouchDevice = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
        this.floorY = -0.2;
        this.standEyeHeight = 1.05;
        this.crouchEyeHeight = 0.68;
        this.isCrouching = false;
        this.moveSpeed = 2.6;
        this.lookSpeed = 0.0022;
        this.touchLookSpeed = 0.0032;
        this.pitchMin = -Math.PI / 2 + 0.08;
        this.pitchMax = Math.PI / 2 - 0.08;
        this.cylinderRadius = 1800;
        this.cylinderCenterY = this.floorY + this.cylinderRadius;
        this.yaw = 0;
        this.pitch = 0;
        this.moveState = {
            forward: false,
            backward: false,
            left: false,
            right: false
        };
        this.bounds = {
            minX: -98,
            maxX: 98,
            minZ: -8,
            maxZ: 96
        };
        this.touchState = {
            movePointerId: null,
            lookPointerId: null,
            moveVector: new THREE.Vector2(),
            lookLastX: 0,
            lookLastY: 0
        };
        this.mobileUi = {
            root: document.getElementById('mobile-controls'),
            moveZone: document.getElementById('mobile-move-zone'),
            moveKnob: document.getElementById('mobile-move-knob'),
            lookZone: document.getElementById('mobile-look-zone')
        };

        this.surfaceX = 1.15;
        this.surfaceArc = 2.25;
        this.syncCameraToCylinder();
        document.body.classList.toggle('touch-device', this.isTouchDevice);
        this.syncAnglesFromCamera();
        this.setupEvents();
    }

    setupEvents() {
        document.addEventListener('pointerlockchange', () => {
            this.isLocked = document.pointerLockElement === this.domElement;
            document.body.style.cursor = this.isLocked ? 'none' : 'default';
        });

        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('keydown', (e) => this.onKeyChange(e, true));
        document.addEventListener('keyup', (e) => this.onKeyChange(e, false));
        if (this.isTouchDevice) {
            this.setupTouchControls();
        }
    }

    isTyping() {
        const active = document.activeElement;
        return !!active && (
            active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.isContentEditable
        );
    }

    syncAnglesFromCamera() {
        const dir = new THREE.Vector3();
        this.camera.getWorldDirection(dir);
        this.yaw = Math.atan2(dir.x, dir.z);
        this.pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
    }

    lock() {
        if (!this.enabled || this.isTyping()) return;
        if (this.isTouchDevice) return;
        this.domElement.requestPointerLock();
    }

    currentEyeHeight() {
        return this.isCrouching ? this.crouchEyeHeight : this.standEyeHeight;
    }

    unlock() {
        if (this.isLocked) {
            document.exitPointerLock();
        }
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            this.resetMovePad();
            this.touchState.lookPointerId = null;
        }
    }

    setupTouchControls() {
        const { moveZone, lookZone } = this.mobileUi;
        if (!moveZone || !lookZone) return;

        const releaseCapture = (target, pointerId) => {
            try {
                target.releasePointerCapture(pointerId);
            } catch (e) {
                // Ignore unsupported capture release
            }
        };

        moveZone.addEventListener('pointerdown', (event) => {
            if (event.pointerType === 'mouse') return;
            if (!this.enabled) return;
            this.touchState.movePointerId = event.pointerId;
            try {
                moveZone.setPointerCapture(event.pointerId);
            } catch (e) {
                // Ignore unsupported capture
            }
            this.updateMovePad(event);
            event.preventDefault();
        });
        moveZone.addEventListener('pointermove', (event) => {
            if (event.pointerId !== this.touchState.movePointerId) return;
            this.updateMovePad(event);
            event.preventDefault();
        });
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => {
            moveZone.addEventListener(type, (event) => {
                if (event.pointerId !== this.touchState.movePointerId) return;
                releaseCapture(moveZone, event.pointerId);
                this.touchState.movePointerId = null;
                this.resetMovePad();
            });
        });

        lookZone.addEventListener('pointerdown', (event) => {
            if (event.pointerType === 'mouse') return;
            if (!this.enabled) return;
            this.touchState.lookPointerId = event.pointerId;
            this.touchState.lookLastX = event.clientX;
            this.touchState.lookLastY = event.clientY;
            try {
                lookZone.setPointerCapture(event.pointerId);
            } catch (e) {
                // Ignore unsupported capture
            }
            event.preventDefault();
        });
        lookZone.addEventListener('pointermove', (event) => {
            if (event.pointerId !== this.touchState.lookPointerId) return;
            if (!this.enabled) return;
            const dx = event.clientX - this.touchState.lookLastX;
            const dy = event.clientY - this.touchState.lookLastY;
            this.touchState.lookLastX = event.clientX;
            this.touchState.lookLastY = event.clientY;
            this.applyLookDelta(dx, dy, this.touchLookSpeed);
            event.preventDefault();
        });
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => {
            lookZone.addEventListener(type, (event) => {
                if (event.pointerId !== this.touchState.lookPointerId) return;
                releaseCapture(lookZone, event.pointerId);
                this.touchState.lookPointerId = null;
            });
        });
    }

    updateMovePad(event) {
        const { moveZone, moveKnob } = this.mobileUi;
        if (!moveZone || !moveKnob) return;

        const rect = moveZone.getBoundingClientRect();
        const centerX = rect.left + rect.width * 0.5;
        const centerY = rect.top + rect.height * 0.5;
        const radius = rect.width * 0.34;

        let dx = event.clientX - centerX;
        let dy = event.clientY - centerY;
        const length = Math.hypot(dx, dy);
        if (length > radius) {
            const scale = radius / length;
            dx *= scale;
            dy *= scale;
        }

        this.touchState.moveVector.set(dx / radius, -dy / radius);
        moveKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }

    resetMovePad() {
        this.touchState.moveVector.set(0, 0);
        if (this.mobileUi.moveKnob) {
            this.mobileUi.moveKnob.style.transform = 'translate(-50%, -50%)';
        }
    }

    applyLookDelta(dx, dy, speed) {
        this.yaw -= dx * speed;
        this.pitch -= dy * speed;
        this.pitch = THREE.MathUtils.clamp(this.pitch, this.pitchMin, this.pitchMax);
        this.applyRotation();
    }

    onMouseMove(event) {
        if (!this.enabled || !this.isLocked) return;
        this.applyLookDelta(event.movementX, event.movementY, this.lookSpeed);
    }

    onKeyChange(event, pressed) {
        if (this.isTyping()) return;

        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                this.moveState.forward = pressed;
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.moveState.backward = pressed;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                this.moveState.left = pressed;
                break;
            case 'KeyD':
            case 'ArrowRight':
                this.moveState.right = pressed;
                break;
            case 'KeyC':
                if (pressed) {
                    this.isCrouching = !this.isCrouching;
                    this.clampPosition();
                    event.preventDefault();
                }
                return;
            default:
                return;
        }

        if (pressed) {
            event.preventDefault();
        }
    }

    applyRotation() {
        const theta = this.surfaceArc / this.cylinderRadius;
        const up = new THREE.Vector3(0, Math.cos(theta), -Math.sin(theta)).normalize();
        const forwardBase = new THREE.Vector3(0, Math.sin(theta), Math.cos(theta)).normalize();
        const rightBase = new THREE.Vector3().crossVectors(up, forwardBase).normalize();
        const basis = new THREE.Matrix4().makeBasis(rightBase, up, forwardBase);
        const basisQuat = new THREE.Quaternion().setFromRotationMatrix(basis);
        const localQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
        this.camera.quaternion.copy(basisQuat.multiply(localQuat));
        this.camera.up.copy(up);
    }

    syncCameraToCylinder() {
        const theta = this.surfaceArc / this.cylinderRadius;
        const radius = this.cylinderRadius - this.currentEyeHeight();
        this.camera.position.set(
            this.surfaceX,
            this.cylinderCenterY - Math.cos(theta) * radius,
            Math.sin(theta) * radius
        );
        this.applyRotation();
    }

    clampPosition() {
        this.surfaceX = THREE.MathUtils.clamp(this.surfaceX, this.bounds.minX, this.bounds.maxX);
        this.surfaceArc = THREE.MathUtils.clamp(this.surfaceArc, this.bounds.minZ, this.bounds.maxZ);
        this.syncCameraToCylinder();
    }

    update(delta) {
        if (!this.enabled) return;

        this.applyRotation();
        this.clampPosition();

        if (!this.isLocked && !this.isTouchDevice) return;

        const inputX = THREE.MathUtils.clamp(
            ((this.moveState.right ? 1 : 0) - (this.moveState.left ? 1 : 0)) + this.touchState.moveVector.x,
            -1,
            1
        );
        const inputZ = THREE.MathUtils.clamp(
            ((this.moveState.forward ? 1 : 0) - (this.moveState.backward ? 1 : 0)) + this.touchState.moveVector.y,
            -1,
            1
        );
        if (Math.abs(inputX) < 0.001 && Math.abs(inputZ) < 0.001) return;

        const move = new THREE.Vector3(inputX, 0, inputZ).normalize().multiplyScalar(this.moveSpeed * delta);
        const theta = this.surfaceArc / this.cylinderRadius;
        const up = new THREE.Vector3(0, Math.cos(theta), -Math.sin(theta)).normalize();
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.projectOnPlane(up).normalize();
        const right = new THREE.Vector3().crossVectors(forward, up).normalize();

        this.surfaceX += right.x * move.x + forward.x * move.z;
        this.surfaceArc += (right.z * move.x + forward.z * move.z);
        this.clampPosition();
    }
}

// Interaction System
class InteractionSystem {
    constructor(camera, controls, screenMesh, css3dScreen) {
        this.camera = camera;
        this.controls = controls;
        this.screenMesh = screenMesh;
        this.css3dScreen = css3dScreen;
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.isOverScreen = false;
        
        this.hint = document.getElementById('hint');
        
        this.setupEvents();
    }
    
    setupEvents() {
        document.addEventListener('pointermove', (e) => this.onPointerMove(e));
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('click', (e) => this.onClick(e));
        document.addEventListener('pointerlockchange', () => this.onPointerLockChange());
    }
    
    onPointerMove(event) {
        if (this.controls.isLocked) {
            if (this.isOverScreen) this.exitScreen();
            return;
        }
        if (!this.css3dScreen.isViewable()) {
            if (this.isOverScreen) this.exitScreen();
            return;
        }
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.screenMesh);
        
        if (intersects.length > 0) {
            if (!this.isOverScreen) {
                this.enterScreen();
            }
        } else {
            if (this.isOverScreen) {
                this.exitScreen();
            }
        }
    }
    
    onClick(event) {
        if (this.isOverScreen && this.css3dScreen.isViewable()) {
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObject(this.screenMesh);
            if (intersects.length === 0) {
                this.exitScreen();
            }
        }
    }
    
    onKeyDown(event) {
        if (event.key === 'Escape' && this.isOverScreen) {
            this.exitScreen();
        }
    }

    onPointerLockChange() {
        if (this.controls.isLocked && this.isOverScreen) {
            this.exitScreen();
        }
    }
    
    enterScreen() {
        this.isOverScreen = true;
        this.css3dScreen.enableInput();
        this.controls.setEnabled(false);
        document.body.classList.add('screen-mode');
        this.hint.textContent = this.controls.isTouchDevice ? 'Tap outside the screen to leave it' : 'Press ESC to leave the screen';
        this.hint.style.display = 'block';
        document.body.style.cursor = 'pointer';
    }
    
    exitScreen() {
        this.isOverScreen = false;
        this.css3dScreen.disableInput();
        this.controls.setEnabled(true);
        document.body.classList.remove('screen-mode');
        this.hint.style.display = 'none';
        document.body.style.cursor = 'default';
    }
}

// CRT Hum Audio System
class CRTHum {
    constructor(options = {}) {
        this.enabled = options.enabled !== undefined ? options.enabled : false;
        this.context = null;
        this.oscillator = null;
        this.noise = null;
        this.gainNode = null;
        this.filter = null;
        this.isPlaying = false;
        
        if (this.enabled) {
            this.start();
        }
    }
    
    ensureStarted() {
        try {
            this.context?.resume?.();
        } catch (e) {
            // Silent fail
        }
    }
    
    start() {
        if (this.isPlaying) return;
        
        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
            
            // 60Hz oscillator (AC hum)
            this.oscillator = this.context.createOscillator();
            this.oscillator.type = 'sine';
            this.oscillator.frequency.setValueAtTime(60, this.context.currentTime);
            
            // Slight detune for realism
            const oscillator2 = this.context.createOscillator();
            oscillator2.type = 'sine';
            oscillator2.frequency.setValueAtTime(61, this.context.currentTime);
            
            // Noise generator
            const bufferSize = this.context.sampleRate * 2;
            const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            this.noise = this.context.createBufferSource();
            this.noise.buffer = buffer;
            this.noise.loop = true;
            
            // Low-pass filter for noise
            this.filter = this.context.createBiquadFilter();
            this.filter.type = 'lowpass';
            this.filter.frequency.setValueAtTime(200, this.context.currentTime);
            
            // Gain nodes
            const noiseGain = this.context.createGain();
            noiseGain.gain.setValueAtTime(0.02, this.context.currentTime);
            
            this.gainNode = this.context.createGain();
            this.gainNode.gain.setValueAtTime(0.05, this.context.currentTime);
            
            // Connect everything
            this.oscillator.connect(this.gainNode);
            oscillator2.connect(this.gainNode);
            this.noise.connect(this.filter);
            this.filter.connect(noiseGain);
            noiseGain.connect(this.gainNode);
            this.gainNode.connect(this.context.destination);
            
            // Start
            this.oscillator.start();
            oscillator2.start();
            this.noise.start();
            
            this.isPlaying = true;
        } catch (e) {
            console.warn('[CRTHum] Could not start audio:', e);
        }
    }
    
    stop() {
        if (!this.isPlaying) return;
        
        try {
            this.oscillator.stop();
            this.noise.stop();
            this.context.close();
        } catch (e) {
            // Silent fail
        }
        
        this.isPlaying = false;
    }
}

// URL Bar Management - RESTORED WITH MOBILE FOCUS
class URLBar {
    constructor(css3dScreen) {
        this.css3dScreen = css3dScreen;
        this.overlay = document.getElementById('url-overlay');
        this.input = document.getElementById('url-input');
        this.justOpenedOverlay = false;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Enter to navigate
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const url = this.normalizeUrl(this.input.value);
                this.css3dScreen.loadURL(url);
                this.hide();
            }
        });
        
        // Select all on click
        this.input.addEventListener('pointerdown', () => {
            this.input.select();
        });
        
        // Hide when clicking outside
        const outsideHandler = (e) => {
            if (this.justOpenedOverlay) return;
            if (!this.overlay.contains(e.target)) {
                this.hide();
            }
        };
        document.addEventListener('pointerdown', outsideHandler, { passive: true });
    }
    
    normalizeUrl(v) {
        const s = v.trim();
        if (!s) return DEFAULT_HOME_URL;
        if (/^(\/|\.\/|\.\.\/)/.test(s)) return s;
        if (/^[a-z]+:\/\//i.test(s)) return s;
        if (/^(localhost|127(?:\.\d{1,3}){3})(:\d+)?(\/.*)?$/i.test(s)) return `http://${s}`;
        return 'https://' + s.replace(/^\/+/, '');
    }
    
    show() {
        this.overlay.classList.add('show');
        this.justOpenedOverlay = true;
        setTimeout(() => { this.justOpenedOverlay = false; }, 150);
        // Focus and select within same user gesture for mobile keyboard
        this.input.focus({ preventScroll: true });
        this.input.select();
    }
    
    hide() {
        this.overlay.classList.remove('show');
        this.input.blur();
    }
}

// Main Application
class CRTApp {
    constructor() {
        this.canvas = document.getElementById('webgl');
        const dpr = clampDPR(window.devicePixelRatio);
        
        // WebGL Renderer
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: this.canvas,
            antialias: true,
            alpha: true
        });
        this.renderer.setPixelRatio(dpr);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.68;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Scene
        this.crtScene = new CRTScene();
        this.scene = this.crtScene.scene;
        this.camera = this.crtScene.camera;
        
        // Store renderer in scene for rug texture
        this.crtScene.renderer = this.renderer;
        
        // Controls
        this.controls = new FPSControls(this.camera, this.canvas);
        
        // CSS3D Screen
        this.css3dScreen = new CSS3DScreen(
            this.scene,
            this.camera,
            this.crtScene.screenMesh,
            { embedWarningMode: 'toast' }
        );
        
        // Post-processing
        this.post = new PostProcessing(
            this.renderer,
            this.scene,
            this.camera
        );
        
        // Interaction
        this.interaction = new InteractionSystem(
            this.camera,
            this.controls,
            this.crtScene.screenMesh,
            this.css3dScreen
        );
        
        // CRT Hum - enabled by default
        this.hum = new CRTHum({ enabled: true });
        // Best-effort autoplay; guaranteed start on first user gesture
        document.addEventListener('pointerdown', () => this.hum.ensureStarted(), { once: true });
        
        // URL Bar with restored mobile functionality
        this.urlBar = new URLBar(this.css3dScreen);
        
        // Scene picking setup - RESTORED WITH KEYBOARD CLICK
        this.pickRay = new THREE.Raycaster();
        this.pickNdc = new THREE.Vector2();
        this.canvas.addEventListener('pointerdown', (e) => this.onScenePointerDown(e), { passive: false });
        
        // Load saved URL when available, otherwise fall back to the Agent1c homepage
        const startupUrl = localStorage.getItem('crt.url') || DEFAULT_HOME_URL;
        this.css3dScreen.loadURL(startupUrl);
        
        // Resize handler
        window.addEventListener('resize', () => this.onResize());
        
        // Apply subtle film look
        this.renderer.domElement.style.filter = 'contrast(1.04) saturate(1.06)';
        this.showMovementHint();
        
        // Animation
        this.clock = new THREE.Clock();
        window.__clock = this.clock; // Store globally for updaters
        this.animate();
    }
    
    updatePickNdc(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.pickNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.pickNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }
    
    onScenePointerDown(e) {
        // Ignore when clicking the CSS URL bar itself
        if (e.target && e.target.id === 'url-input') return;
        if (this.controls.isLocked) return;
        
        this.updatePickNdc(e);
        this.pickRay.setFromCamera(this.pickNdc, this.camera);
        
        // Check for keyboard click first (priority)
        const KB_NAME = 'deskKeyboard';
        const kbHits = this.pickRay.intersectObjects(this.scene.children, true);
        const kbHit = kbHits.find(h => h.object.name === KB_NAME || h.object.parent?.name === KB_NAME);
        
        if (kbHit) {
            e.preventDefault();
            e.stopPropagation();
            this.urlBar.show(); // Opens within same gesture = mobile keyboard shows
            return;
        }

        const screenHits = this.pickRay.intersectObject(this.crtScene.screenMesh, false);
        if (screenHits.length && this.css3dScreen.isViewable()) {
            this.interaction.enterScreen();
            return;
        }
        
        // Then check other clickables
        const clickables = [];
        this.scene.traverse(o => {
            if (o.userData && (o.userData.openURL || o.userData.clickable)) clickables.push(o);
        });
        
        const hits = this.pickRay.intersectObjects(clickables, true);
        if (!hits.length) {
            if (!this.controls.isTouchDevice) {
                this.controls.lock();
            }
            return;
        }
        
        const obj = hits[0].object;
        let cur = obj;
        while (cur && !cur.userData?.openURL && !cur.userData?.onClick) cur = cur.parent;
        
        if (cur?.userData?.onClick) {
            cur.userData.onClick();
        } else if (cur?.userData?.openURL) {
            this.css3dScreen.loadURL(cur.userData.openURL);
        }
    }
    
    onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const dpr = clampDPR(window.devicePixelRatio);
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setPixelRatio(dpr);
        this.renderer.setSize(width, height);
        
        this.css3dScreen.renderer.setSize(width, height);
        this.post.resize(width, height);
    }

    showMovementHint() {
        const hint = document.getElementById('hint');
        if (!hint) return;
        hint.textContent = this.controls.isTouchDevice
            ? 'Use the left stick to walk and drag the right pad to look around'
            : 'Click to walk, move the mouse to look, WASD to move, ESC to free the cursor';
        hint.style.display = 'block';
        window.setTimeout(() => {
            if (!this.interaction.isOverScreen) {
                hint.style.display = 'none';
            }
        }, 4200);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const delta = this.clock.getDelta();
        const time = this.clock.getElapsedTime();
        
        // Call all updaters
        if (window.updaters) {
            window.updaters.forEach(fn => fn(time));
        }
        
        // Call onTickFns for lava lamp animation
        if (this.crtScene.onTickFns) {
            this.crtScene.onTickFns.forEach(fn => fn(delta, time));
        }
        
        this.controls.update(delta);
        this.css3dScreen.update();
        
        // Render both layers
        this.post.render(delta);
        this.css3dScreen.renderer.render(
            this.scene,
            this.camera
        );
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new CRTApp());
} else {
    new CRTApp();
}
