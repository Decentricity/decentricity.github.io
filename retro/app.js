// Note: Since we can't modify the JS structure to use TypeScript imports directly,
// I'll adapt the placement logic into the existing JavaScript structure

// Utility Functions
const clampDPR = (dpr) => Math.min(dpr, 2);
const DEFAULT_HOME_URL = 'https://hedgeyos.github.io';

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
        
        this.camera = new THREE.PerspectiveCamera(
            50,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
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
        // Floor - warm beige
        const floorGeo = new THREE.PlaneGeometry(4, 4);
        const floorMat = new THREE.MeshStandardMaterial({ 
            color: 0xbcae92,
            roughness: 0.8,
            metalness: 0.1
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.2;
        floor.receiveShadow = true;
        floor.name = 'floor';
        this.scene.add(floor);
        
        // Back Wall - charcoal
        const backWallGeo = new THREE.PlaneGeometry(4, 3);
        const backWallMat = new THREE.MeshStandardMaterial({ 
            color: 0x383b44,
            roughness: 0.9
        });
        const backWall = new THREE.Mesh(backWallGeo, backWallMat);
        backWall.position.set(0, 1.3, -1);
        backWall.receiveShadow = true;
        backWall.name = 'backWall';
        this.scene.add(backWall);
        
        // Side Wall - slate
        const sideWallGeo = new THREE.PlaneGeometry(4, 3);
        const sideWallMat = new THREE.MeshStandardMaterial({ 
            color: 0x50545e,
            roughness: 0.9
        });
        const sideWall = new THREE.Mesh(sideWallGeo, sideWallMat);
        sideWall.position.set(-2, 1.3, 1);
        sideWall.rotation.y = Math.PI / 2;
        sideWall.receiveShadow = true;
        sideWall.name = 'sideWall';
        this.scene.add(sideWall);
        
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
    }
    
    onResize() {
        this.fitElementToScreen();
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
            0.3,  // strength
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
    }
    
    onPointerMove(event) {
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
        if (this.isOverScreen) {
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
    
    enterScreen() {
        this.isOverScreen = true;
        this.css3dScreen.enableInput();
        this.controls.enabled = false;
        this.hint.style.display = 'block';
        document.body.style.cursor = 'pointer';
    }
    
    exitScreen() {
        this.isOverScreen = false;
        this.css3dScreen.disableInput();
        this.controls.enabled = true;
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
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Scene
        this.crtScene = new CRTScene();
        this.scene = this.crtScene.scene;
        this.camera = this.crtScene.camera;
        
        // Store renderer in scene for rug texture
        this.crtScene.renderer = this.renderer;
        
        // Controls
        this.controls = new THREE.OrbitControls(
            this.camera,
            this.canvas
        );
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 0.5;
        this.controls.maxDistance = 3;
        this.controls.target.set(0, 0.3, 0);
        
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
        
        // Then check other clickables
        const clickables = [];
        this.scene.traverse(o => {
            if (o.userData && (o.userData.openURL || o.userData.clickable)) clickables.push(o);
        });
        
        const hits = this.pickRay.intersectObjects(clickables, true);
        if (!hits.length) return;
        
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
        
        this.controls.update();
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
