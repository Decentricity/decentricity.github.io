(() => {
    const clampDPR = (dpr) => Math.min(dpr, 2);
    const DEFAULT_HOME_URL = 'https://agent1c-ai.github.io';
    const TAU = Math.PI * 2;

    const canvas = document.getElementById('webgl');
    const hint = document.getElementById('hint');

    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(clampDPR(window.devicePixelRatio));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.74;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x02030a);
    scene.fog = new THREE.Fog(0xe7f3f7, 3200, 12000);

    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 7000);

    const setTextureEncoding = (texture) => {
        if ('colorSpace' in texture && THREE.SRGBColorSpace) {
            texture.colorSpace = THREE.SRGBColorSpace;
        } else {
            texture.encoding = THREE.sRGBEncoding;
        }
    };

    const makeMaterial = (color, roughness = 0.9, metalness = 0.02, extra = {}) => (
        new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra })
    );

    const RetroProps = {
        texture(url) {
            const loader = new THREE.TextureLoader();
            loader.setCrossOrigin('anonymous');
            const tex = loader.load(url);
            setTextureEncoding(tex);
            return tex;
        },

        addKeyboard(root) {
            const tex = this.texture('https://raw.githubusercontent.com/Decentricity/decentricity.github.io/ffb4e1af2e5d3eb5f2c0aee13f3fdd6c182c98f2/ibmkeyboard.jpg');
            const keyboard = new THREE.Mesh(
                new THREE.BoxGeometry(0.48, 0.018, 0.18),
                new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, metalness: 0.1 })
            );
            keyboard.name = 'deskKeyboard';
            keyboard.position.set(0, 0.005, 0);
            keyboard.rotation.x = -0.02;
            keyboard.castShadow = true;
            keyboard.receiveShadow = true;
            root.add(keyboard);
            return keyboard;
        },

        addDeskFloppy(root, name, imageUrl, x, y, z, yaw = 0, openURL = '') {
            const tex = this.texture(imageUrl);
            const floppy = new THREE.Mesh(
                new THREE.BoxGeometry(0.09, 0.004, 0.09),
                new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.0 })
            );
            floppy.name = name;
            floppy.position.set(x, y, z);
            floppy.rotation.y = yaw;
            floppy.userData.isDeskItem = true;
            if (openURL) floppy.userData.openURL = openURL;
            floppy.castShadow = true;
            floppy.receiveShadow = true;
            root.add(floppy);
            return floppy;
        },

        addDeskPhoto(root) {
            const tex = this.texture('https://raw.githubusercontent.com/Decentricity/decentricity.github.io/ad98f557d0c7df179f3bd1f126effed57d8b061c/dannyfren.jpg');
            const photo = new THREE.Mesh(
                new THREE.PlaneGeometry(0.15, 0.2),
                new THREE.MeshStandardMaterial({
                    map: tex,
                    side: THREE.DoubleSide,
                    roughness: 0.8
                })
            );
            photo.name = 'photo_danny';
            photo.userData.isDeskItem = true;
            photo.position.set(0.35, 0.052, 0.2);
            photo.rotation.x = -Math.PI * 0.5;
            photo.rotation.z = -0.12;
            root.add(photo);
            return photo;
        },

        addDeskPaper(root) {
            const tex = this.texture('https://raw.githubusercontent.com/Decentricity/decentricity.github.io/083da9e2e5f78e6585f202ec9da8eaac498535e0/paperinstructions1.jpg');
            const paper = new THREE.Mesh(
                new THREE.BoxGeometry(0.135, 0.0012, 0.1),
                new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0.0 })
            );
            paper.name = 'paper_instructions_1';
            paper.userData.isDeskItem = true;
            paper.position.set(0.05, 0.051, 0.13);
            paper.rotation.y = THREE.MathUtils.degToRad(-9);
            root.add(paper);
            return paper;
        },

        addLavaLamp(root) {
            const lamp = new THREE.Group();
            lamp.name = 'lavaLamp';

            const base = new THREE.Mesh(
                new THREE.CylinderGeometry(0.045, 0.055, 0.03, 24),
                new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.45, metalness: 0.3 })
            );
            base.castShadow = true;
            base.receiveShadow = true;
            lamp.add(base);

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

            const capMat = new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: 0.6, metalness: 0.2 });
            const topCap = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.008, 24), capMat);
            const botCap = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.01, 24), capMat);
            topCap.position.y = glass.position.y + 0.11;
            botCap.position.y = glass.position.y - 0.11;
            lamp.add(topCap, botCap);

            const blobMat = new THREE.MeshStandardMaterial({
                color: 0xff4aa3,
                emissive: 0xff4aa3,
                emissiveIntensity: 0.25,
                roughness: 0.5,
                metalness: 0.0
            });
            for (let i = 0; i < 3; i++) {
                const blob = new THREE.Mesh(
                    new THREE.SphereGeometry(0.012 + 0.004 * i, 24, 16),
                    blobMat
                );
                blob.position.set((Math.random() - 0.5) * 0.02, glass.position.y + (i - 1) * 0.04, (Math.random() - 0.5) * 0.015);
                lamp.add(blob);
            }

            lamp.position.set(-0.28, 0.06, 0.12);
            root.add(lamp);
            return lamp;
        },

        addDeskLamp(root) {
            const base = new THREE.Mesh(
                new THREE.CylinderGeometry(0.04, 0.05, 0.02, 16),
                new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.2, roughness: 0.6 })
            );
            base.position.set(-0.28, 0.06, -0.08);
            root.add(base);

            const shade = new THREE.Mesh(
                new THREE.CylinderGeometry(0.018, 0.045, 0.055, 24, 1, true),
                new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.1 })
            );
            shade.position.copy(base.position).add(new THREE.Vector3(0.02, 0.07, 0.02));
            shade.rotation.x = -Math.PI / 3;
            root.add(shade);

            const rim = new THREE.Mesh(
                new THREE.TorusGeometry(0.045, 0.002, 12, 48),
                new THREE.MeshStandardMaterial({ color: 0xb0b0b0, roughness: 0.6, metalness: 0.2 })
            );
            rim.position.copy(shade.position);
            rim.rotation.copy(shade.rotation);
            root.add(rim);

            const bulb = new THREE.Mesh(
                new THREE.SphereGeometry(0.01, 16, 12),
                new THREE.MeshStandardMaterial({ color: 0xfffff2, emissive: 0xfff2cc, emissiveIntensity: 1.2 })
            );
            bulb.position.copy(shade.position).add(new THREE.Vector3(0, -0.01, 0));
            root.add(bulb);

            const light = new THREE.SpotLight(0xfff2cc, 1.3, 2.0, Math.PI / 5, 0.25, 1.0);
            light.position.copy(shade.position);
            light.target.position.set(shade.position.x + 0.05, 0.06, shade.position.z + 0.25);
            root.add(light, light.target);
        },

        addBeanbag(root) {
            const geom = new THREE.SphereGeometry(0.22, 24, 24);
            geom.scale(1.2, 0.6, 1.0);
            const bag = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ color: 0xaf79c8, roughness: 0.95, metalness: 0.0 }));
            bag.name = 'starRugBeanbag';
            bag.position.set(-1.45, -0.199, 1.45);
            bag.castShadow = true;
            bag.receiveShadow = true;
            root.add(bag);
            return bag;
        },

        addFairyLights(root) {
            const pts = [
                new THREE.Vector3(-0.9, 2.58, -0.99),
                new THREE.Vector3(-0.3, 2.6, -0.99),
                new THREE.Vector3(0.3, 2.57, -0.99),
                new THREE.Vector3(0.9, 2.595, -0.99)
            ];
            const curve = new THREE.CatmullRomCurve3(pts);
            const cable = new THREE.Mesh(
                new THREE.TubeGeometry(curve, 40, 0.004, 8, false),
                new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 })
            );
            const group = new THREE.Group();
            group.name = 'fairyLights';
            group.add(cable);
            const bulbGeo = new THREE.SphereGeometry(0.015, 12, 12);
            for (let t = 0; t <= 1.0001; t += 0.1) {
                const p = curve.getPoint(t);
                const bulb = new THREE.Mesh(
                    bulbGeo,
                    new THREE.MeshStandardMaterial({
                        color: 0x111111,
                        emissive: new THREE.Color().setHSL(0.85 - 0.6 * Math.random(), 0.7, 0.5),
                        emissiveIntensity: 1.5
                    })
                );
                bulb.position.copy(p);
                group.add(bulb);
            }
            root.add(group);
        },

        addStarterDeskSet(root) {
            const keyboardGroup = new THREE.Group();
            keyboardGroup.position.set(0, 0.055, 0.25);
            keyboardGroup.rotation.y = Math.PI * 0.028;
            root.add(keyboardGroup);
            this.addKeyboard(keyboardGroup);

            this.addDeskFloppy(
                root,
                'floppy',
                'https://raw.githubusercontent.com/Decentricity/decentricity.github.io/2bf5a9f856ff9b3a06d99d92b03e3abc19605914/floppy.jpg',
                -0.35,
                0.052,
                0.25,
                -0.2
            );
            this.addDeskFloppy(
                root,
                'floppy_chordynaut',
                'https://raw.githubusercontent.com/Decentricity/decentricity.github.io/3f45e75880f0bc5237006ba0eaaed61ad1e8b219/chordynautfloppy.jpg',
                -0.07,
                0.052,
                0.18,
                0.16,
                'https://chordynaut.com'
            );
            this.addDeskFloppy(
                root,
                'floppy_tetris',
                'https://raw.githubusercontent.com/Decentricity/decentricity.github.io/f9f57cd5b8e9e6d2b2bce059cb3139878a06f184/3dtetrisfloppy.jpg',
                0.16,
                0.052,
                0.28,
                -0.08,
                'https://tetris3dfixed.berrry.app/'
            );
            this.addDeskFloppy(
                root,
                'floppy_gamegen',
                'https://raw.githubusercontent.com/Decentricity/decentricity.github.io/f59193928c06cc13f2a20d3fa81ec9dbe692966d/gamegenfloppy.jpg',
                -0.01,
                0.052,
                0.02,
                0.11,
                'https://vgamode13h.berrry.app'
            );
            this.addDeskFloppy(
                root,
                'floppy_decentricity',
                'https://raw.githubusercontent.com/Decentricity/decentricity.github.io/348e56fa40796b9940c585c3a8acba09fca7a869/decentricityfloppy.jpg',
                0.34,
                0.052,
                0.03,
                -0.18,
                'https://decentricity.berrry.app/'
            );
            this.addDeskFloppy(
                root,
                'floppy_crtception',
                'https://raw.githubusercontent.com/Decentricity/decentricity.github.io/f5f23e27dfb568917caf2df25955d9a5f7e13c02/crtception.jpg',
                0.33,
                0.052,
                -0.12,
                0.1,
                'https://crtbrowser.berrry.app/'
            );
            this.addDeskFloppy(
                root,
                'floppy_pythoncity',
                'https://raw.githubusercontent.com/Decentricity/decentricity.github.io/e17a204e6b76deb4aee9f299c1a9d25abaf0cd61/pythoncityfloppy.jpg',
                0.12,
                0.052,
                -0.15,
                0.22,
                'https://pythoncity.berrry.app/'
            );
            this.addDeskPhoto(root);
            this.addDeskPaper(root);
            this.addLavaLamp(root);
            this.addDeskLamp(root);
            this.addBeanbag(root);
            this.addFairyLights(root);
        }
    };

    class OneillWorld {
        constructor(scene) {
            this.scene = scene;
            this.radius = 260;
            this.length = 280;
            this.maxWalkX = this.length * 0.5 - 10;
            this.roadCount = 10;
            this.lotsPerSide = 5;
            this.totalHouses = this.roadCount * this.lotsPerSide * 2;
            this.roadWidth = 8.4;
            this.sidewalkWidth = 1.3;
            this.rowArcOffset = 14.2;
            this.numberTextureCache = new Map();
            this.starterScreenMesh = null;

            this.buildHabitat();
            this.buildNeighborhood();

            this.spawn = {
                x: 0,
                theta: this.rowArcOffset / this.radius - 0.045,
                yaw: 0,
                pitch: -0.06
            };
        }

        fract(n) {
            return n - Math.floor(n);
        }

        rand01(seed, salt = 0) {
            return this.fract(Math.sin(seed * 127.1 + salt * 311.7) * 43758.5453123);
        }

        pick(items, seed, salt = 0) {
            return items[Math.floor(this.rand01(seed, salt) * items.length) % items.length];
        }

        surfacePoint(x, theta, lift = 0) {
            const up = new THREE.Vector3(0, Math.cos(theta), -Math.sin(theta));
            return new THREE.Vector3(
                x,
                -Math.cos(theta) * this.radius,
                Math.sin(theta) * this.radius
            ).addScaledVector(up, lift);
        }

        cylinderBasis(theta) {
            const right = new THREE.Vector3(1, 0, 0);
            const up = new THREE.Vector3(0, Math.cos(theta), -Math.sin(theta)).normalize();
            const forward = new THREE.Vector3(0, Math.sin(theta), Math.cos(theta)).normalize();
            return { right, up, forward };
        }

        placeOnCylinder(object, x, theta, yaw = 0, lift = 0) {
            const { right, up, forward } = this.cylinderBasis(theta);
            const basis = new THREE.Matrix4().makeBasis(right, up, forward);
            const baseQuat = new THREE.Quaternion().setFromRotationMatrix(basis);
            const localQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
            object.quaternion.copy(baseQuat).multiply(localQuat);
            object.position.copy(this.surfacePoint(x, theta, lift));
        }

        addLocalBox(group, name, w, h, d, x, y, z, material) {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
            mesh.name = name;
            mesh.position.set(x, y, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            group.add(mesh);
            return mesh;
        }

        addLocalPlane(group, name, w, h, x, y, z, material, rotY = 0) {
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
            mesh.name = name;
            mesh.position.set(x, y, z);
            mesh.rotation.y = rotY;
            group.add(mesh);
            return mesh;
        }

        addLocalFloorPanel(group, name, floorY, thickness, w, d, x, z, color) {
            return this.addLocalBox(group, name, w, thickness, d, x, floorY - thickness * 0.5, z, makeMaterial(color, 0.96, 0.01));
        }

        addLocalCeilingPanel(group, name, ceilingY, thickness, w, d, x, z, color) {
            return this.addLocalBox(group, name, w, thickness, d, x, ceilingY, z, makeMaterial(color, 0.95, 0.01));
        }

        addLocalWallX(group, name, floorY, width, height, thickness, x, z, color) {
            return this.addLocalBox(group, name, width, height, thickness, x, floorY + height * 0.5, z, makeMaterial(color, 0.9, 0.02));
        }

        addLocalWallZ(group, name, floorY, depth, height, thickness, x, z, color) {
            return this.addLocalBox(group, name, thickness, height, depth, x, floorY + height * 0.5, z, makeMaterial(color, 0.9, 0.02));
        }

        addLocalHingedDoor(group, name, width, height, thickness, x, y, z, material, { closedRotY = 0, openAngle = 0, hinge = 'left' } = {}) {
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
        }

        getNumberTexture(label, bg = '#f8eed6', fg = '#4d3927') {
            const key = `${label}:${bg}:${fg}`;
            if (this.numberTextureCache.has(key)) {
                return this.numberTextureCache.get(key);
            }

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
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = 'bold 54px sans-serif';
            ctx.fillText(label, canvas.width / 2, canvas.height / 2 + 3);
            const texture = new THREE.CanvasTexture(canvas);
            setTextureEncoding(texture);
            this.numberTextureCache.set(key, texture);
            return texture;
        }

        addNumberPlaque(group, label, x, y, z, rotY = 0) {
            return this.addLocalPlane(
                group,
                `house_number_${label}`,
                0.68,
                0.34,
                x,
                y,
                z,
                new THREE.MeshBasicMaterial({ map: this.getNumberTexture(label), transparent: true }),
                rotY
            );
        }

        addWindow(group, x, y, z, w, h, rotY = 0, lit = true) {
            const frameMat = makeMaterial(0xf3f1ea, 0.55, 0.04);
            const glassMat = new THREE.MeshBasicMaterial({
                color: lit ? 0xfff4d6 : 0x9cc6e6,
                transparent: true,
                opacity: lit ? 0.82 : 0.55
            });
            if (Math.abs(rotY) < 0.001 || Math.abs(rotY - Math.PI) < 0.001) {
                this.addLocalBox(group, 'windowFrame', w + 0.1, h + 0.1, 0.07, x, y, z, frameMat);
            } else {
                this.addLocalBox(group, 'windowFrame', 0.07, h + 0.1, w + 0.1, x, y, z, frameMat);
            }
            this.addLocalPlane(group, 'windowGlass', w, h, x, y, z + (Math.abs(rotY) < 0.001 ? 0.041 : 0), glassMat, rotY);
        }

        addTree(x, theta, seed, scale = 1) {
            const tree = new THREE.Group();
            this.placeOnCylinder(tree, x, theta);
            const trunkHeight = (1.45 + this.rand01(seed, 1) * 0.55) * scale;
            this.addLocalBox(tree, 'treeTrunk', 0.22 * scale, trunkHeight, 0.22 * scale, 0, trunkHeight * 0.5, 0, makeMaterial(0x70553d, 0.92, 0.01));
            const canopyColor = this.pick([0x76b46d, 0x8bc37a, 0x6ca363, 0x99c98b], seed, 2);
            const canopy = new THREE.Mesh(
                new THREE.SphereGeometry((0.95 + this.rand01(seed, 3) * 0.22) * scale, 16, 12),
                makeMaterial(canopyColor, 0.95, 0.0)
            );
            canopy.position.set(0, trunkHeight + 0.5 * scale, 0);
            canopy.castShadow = true;
            canopy.receiveShadow = true;
            tree.add(canopy);
            const canopy2 = new THREE.Mesh(
                new THREE.SphereGeometry((0.62 + this.rand01(seed, 4) * 0.18) * scale, 14, 10),
                makeMaterial(canopyColor, 0.95, 0.0)
            );
            canopy2.position.set(0.38 * scale, trunkHeight + 0.28 * scale, -0.16 * scale);
            canopy2.castShadow = true;
            canopy2.receiveShadow = true;
            tree.add(canopy2);
            this.scene.add(tree);
        }

        addShrub(x, theta, seed, radius = 0.34) {
            const shrub = new THREE.Group();
            this.placeOnCylinder(shrub, x, theta);
            const mesh = new THREE.Mesh(
                new THREE.SphereGeometry(radius, 14, 12),
                makeMaterial(this.pick([0x76a965, 0x6e9f5b, 0x88b874], seed, 1), 0.98, 0.0)
            );
            mesh.position.y = radius * 0.75;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            shrub.add(mesh);
            this.scene.add(shrub);
        }

        addStreetLamp(x, theta) {
            const lamp = new THREE.Group();
            this.placeOnCylinder(lamp, x, theta);
            this.addLocalBox(lamp, 'streetLampPole', 0.09, 3.2, 0.09, 0, 1.6, 0, makeMaterial(0x5f6472, 0.74, 0.08));
            this.addLocalBox(lamp, 'streetLampArm', 0.54, 0.08, 0.08, 0.18, 3.05, 0, makeMaterial(0x5f6472, 0.74, 0.08));
            const globe = new THREE.Mesh(
                new THREE.SphereGeometry(0.14, 14, 12),
                new THREE.MeshBasicMaterial({ color: 0xfff6d9 })
            );
            globe.position.set(0.42, 3.04, 0);
            lamp.add(globe);
            const pointLight = new THREE.PointLight(0xfff0cf, 0.16, 14);
            pointLight.position.copy(globe.position);
            lamp.add(pointLight);
            this.scene.add(lamp);
        }

        addCylinderStrip(name, radius, length, thetaCenter, thetaLength, material) {
            const geom = new THREE.CylinderGeometry(
                radius,
                radius,
                length,
                128,
                1,
                true,
                thetaCenter - thetaLength * 0.5 - Math.PI * 0.5,
                thetaLength
            );
            const mesh = new THREE.Mesh(geom, material);
            mesh.name = name;
            mesh.rotation.z = Math.PI * 0.5;
            mesh.receiveShadow = true;
            this.scene.add(mesh);
            return mesh;
        }

        createGableRoof(width, depth, rise, material) {
            const w = width * 0.5;
            const d = depth * 0.5;
            const h = rise;
            const positions = [
                -w, 0, -d,  w, 0, -d, -w, h, 0,
                 w, 0, -d,  w, h, 0, -w, h, 0,
                -w, 0,  d, -w, h, 0,  w, 0,  d,
                 w, 0,  d, -w, h, 0,  w, h, 0,
                -w, 0, -d, -w, h, 0, -w, 0,  d,
                 w, 0, -d,  w, 0,  d,  w, h, 0,
                -w, 0, -d, -w, 0,  d,  w, 0, -d,
                 w, 0, -d, -w, 0,  d,  w, 0,  d
            ];
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geometry.computeVertexNormals();
            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            return mesh;
        }

        createShedRoof(width, depth, rise, material) {
            const w = width * 0.5;
            const d = depth * 0.5;
            const positions = [
                -w, 0, -d,  w, 0, -d, -w, rise, d,
                 w, 0, -d,  w, rise, d, -w, rise, d,
                -w, 0, -d, -w, rise, d, -w, 0, d,
                 w, 0, -d,  w, 0, d,  w, rise, d,
                -w, 0, -d, -w, 0, d,  w, 0, -d,
                 w, 0, -d, -w, 0, d,  w, 0, d,
                -w, rise, d,  w, rise, d, -w, 0, d,
                 w, rise, d,  w, 0, d, -w, 0, d
            ];
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geometry.computeVertexNormals();
            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            return mesh;
        }

        buildHabitat() {
            const starPositions = [];
            const starColors = [];
            const starColorChoices = [0xffffff, 0xd9ecff, 0xbfd7ff, 0xfff4dd];
            for (let i = 0; i < 2600; i++) {
                const theta = Math.random() * TAU;
                const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
                const radius = 3000 + Math.random() * 1200;
                const x = radius * Math.sin(phi) * Math.cos(theta);
                const y = radius * Math.cos(phi);
                const z = radius * Math.sin(phi) * Math.sin(theta);
                starPositions.push(x, y, z);
                const c = new THREE.Color(starColorChoices[i % starColorChoices.length]);
                starColors.push(c.r, c.g, c.b);
            }
            const starGeometry = new THREE.BufferGeometry();
            starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
            starGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
            const stars = new THREE.Points(
                starGeometry,
                new THREE.PointsMaterial({
                    size: 7,
                    sizeAttenuation: true,
                    vertexColors: true,
                    transparent: true,
                    opacity: 0.92,
                    depthWrite: false
                })
            );
            stars.name = 'spaceStars';
            this.scene.add(stars);

            const terrain = new THREE.Mesh(
                new THREE.CylinderGeometry(this.radius, this.radius, this.length, 256, 1, true),
                new THREE.MeshStandardMaterial({
                    color: 0xb8d9ab,
                    roughness: 1.0,
                    metalness: 0.0,
                    side: THREE.BackSide
                })
            );
            terrain.rotation.z = Math.PI * 0.5;
            terrain.name = 'oneillTerrainShell';
            this.scene.add(terrain);

            [-90, -30, 30, 90].forEach((x, index) => {
                const ring = new THREE.Mesh(
                    new THREE.TorusGeometry(this.radius + 0.6, 0.55, 10, 128),
                    makeMaterial(index % 2 === 0 ? 0xc7d4db : 0xbdc9d0, 0.9, 0.01)
                );
                ring.rotation.y = Math.PI * 0.5;
                ring.position.x = x;
                this.scene.add(ring);
            });

            [-42, 0, 42].forEach((y, index) => {
                const band = new THREE.Mesh(
                    new THREE.CylinderGeometry(2.8, 2.8, this.length - 12, 14, 1, true),
                    new THREE.MeshBasicMaterial({
                        color: 0xf8fdff,
                        transparent: true,
                        opacity: index === 1 ? 0.12 : 0.07
                    })
                );
                band.rotation.z = Math.PI * 0.5;
                band.position.set(0, y, index === 1 ? 0 : (index === 0 ? 24 : -24));
                this.scene.add(band);
            });

            const ambient = new THREE.AmbientLight(0xffffff, 0.72);
            this.scene.add(ambient);
            const fillA = new THREE.PointLight(0xf7fbff, 0.72, 1200, 2);
            fillA.position.set(0, 0, 0);
            this.scene.add(fillA);
            const fillB = new THREE.PointLight(0xfff3e2, 0.2, 1100, 2);
            fillB.position.set(-70, 20, 40);
            this.scene.add(fillB);
            const fillC = new THREE.PointLight(0xe6f6ff, 0.18, 1100, 2);
            fillC.position.set(80, -20, -40);
            this.scene.add(fillC);
        }

        buildNeighborhood() {
            const roadAngles = [];
            const roadSpacing = TAU / this.roadCount;
            const startTheta = this.rowArcOffset / this.radius;
            for (let i = 0; i < this.roadCount; i++) {
                roadAngles.push(startTheta + i * roadSpacing);
            }

            const lotXs = [-96, -48, 0, 48, 96];
            const laneXs = [-112, -84, -56, -28, 0, 28, 56, 84, 112];
            let houseNumber = 1;

            roadAngles.forEach((roadTheta, roadIndex) => {
                const roadThetaWidth = this.roadWidth / this.radius;
                const sidewalkThetaWidth = this.sidewalkWidth / this.radius;
                const sidewalkOffset = (this.roadWidth * 0.5 + this.sidewalkWidth * 0.5) / this.radius;
                const rowOffsetTheta = this.rowArcOffset / this.radius;

                this.addCylinderStrip(
                    `road_${roadIndex}`,
                    this.radius - 0.02,
                    this.length - 8,
                    roadTheta,
                    roadThetaWidth,
                    new THREE.MeshStandardMaterial({ color: 0x59606a, roughness: 0.98, metalness: 0.01, side: THREE.BackSide })
                );
                this.addCylinderStrip(
                    `sidewalkA_${roadIndex}`,
                    this.radius - 0.015,
                    this.length - 8,
                    roadTheta - sidewalkOffset,
                    sidewalkThetaWidth,
                    new THREE.MeshStandardMaterial({ color: 0xebe4db, roughness: 0.96, metalness: 0.01, side: THREE.BackSide })
                );
                this.addCylinderStrip(
                    `sidewalkB_${roadIndex}`,
                    this.radius - 0.015,
                    this.length - 8,
                    roadTheta + sidewalkOffset,
                    sidewalkThetaWidth,
                    new THREE.MeshStandardMaterial({ color: 0xebe4db, roughness: 0.96, metalness: 0.01, side: THREE.BackSide })
                );

                laneXs.forEach((x) => {
                    const marker = new THREE.Group();
                    this.placeOnCylinder(marker, x, roadTheta);
                    this.addLocalBox(marker, 'laneMarker', 3.4, 0.03, 0.18, 0, 0.015, 0, makeMaterial(0xf5e39d, 0.92, 0.0));
                    this.scene.add(marker);
                });

                [-98, -42, 14, 70, 126].forEach((x, lampIndex) => {
                    this.addStreetLamp(x, roadTheta + (lampIndex % 2 === 0 ? sidewalkOffset + 0.012 : -(sidewalkOffset + 0.012)));
                });

                lotXs.forEach((x, lotIndex) => {
                    const lowerTheta = roadTheta - rowOffsetTheta;
                    const upperTheta = roadTheta + rowOffsetTheta;

                    if (roadIndex === 0 && lotIndex === 2) {
                        this.buildStarterHouse({
                            number: String(houseNumber).padStart(2, '0'),
                            x,
                            theta: lowerTheta,
                            yaw: 0
                        });
                    } else {
                        this.buildGeneratedHouse({
                            seed: houseNumber,
                            number: String(houseNumber).padStart(2, '0'),
                            x,
                            theta: lowerTheta,
                            yaw: 0,
                            enterable: houseNumber % 2 === 0
                        });
                    }
                    houseNumber += 1;

                    this.buildGeneratedHouse({
                        seed: houseNumber,
                        number: String(houseNumber).padStart(2, '0'),
                        x,
                        theta: upperTheta,
                        yaw: Math.PI,
                        enterable: houseNumber % 2 === 0
                    });
                    houseNumber += 1;
                });

                lotXs.forEach((x, lotIndex) => {
                    const seed = roadIndex * 20 + lotIndex * 3;
                    this.addTree(x - 11, roadTheta - rowOffsetTheta - 0.022, 3000 + seed, 0.92);
                    this.addTree(x + 10.5, roadTheta + rowOffsetTheta + 0.022, 4000 + seed, 0.9);
                    this.addShrub(x - 4.4, roadTheta - rowOffsetTheta + 0.012, 5000 + seed, 0.28);
                    this.addShrub(x + 4.2, roadTheta + rowOffsetTheta - 0.012, 6000 + seed, 0.3);
                });
            });
        }

        buildStarterHouse(cfg) {
            const house = new THREE.Group();
            house.name = 'starterHouse';
            this.placeOnCylinder(house, cfg.x, cfg.theta, cfg.yaw);
            this.scene.add(house);

            const floorY = -0.2;
            const floorThickness = 0.06;
            const wallHeight = 2.8;
            const wallThickness = 0.08;
            const ceilingY = floorY + wallHeight + floorThickness * 0.5;

            const addBox = (name, w, h, d, x, y, z, material) => this.addLocalBox(house, name, w, h, d, x, y, z, material);
            const addFloor = (name, w, d, x, z, color) => this.addLocalFloorPanel(house, name, floorY, floorThickness, w, d, x, z, color);
            const addCeiling = (name, w, d, x, z, color) => this.addLocalCeilingPanel(house, name, ceilingY, floorThickness, w, d, x, z, color);
            const addWallX = (name, width, x, z, color, height = wallHeight) => this.addLocalWallX(house, name, floorY, width, height, wallThickness, x, z, color);
            const addWallZ = (name, depth, x, z, color, height = wallHeight) => this.addLocalWallZ(house, name, floorY, depth, height, wallThickness, x, z, color);

            addFloor('floor', 4, 4, 0, 0, 0xf3eee7);
            addCeiling('studyCeiling', 4, 4, 0, 0, 0xf7f1fb);
            addWallX('backWall', 4, 0, -1.02, 0xd7d3db);
            addWallZ('sideWall', 1.55, -2.02, -0.225, 0xbdc0c9);
            addWallZ('sideWallFront', 1.35, -2.02, 2.325, 0xbdc0c9);
            addBox('sideWallHeader', wallThickness, 0.7, 1.1, -2.02, floorY + 2.45, 1.1, makeMaterial(0xbdc0c9, 0.9, 0.02));

            addFloor('hallFloor', 4.2, 2.4, 0, 3.1, 0xf1ece8);
            addCeiling('hallCeiling', 4.2, 2.4, 0, 3.1, 0xfbf7f3);
            const hallDoorCenterX = 0.22;
            const hallDoorWidth = 1.04;
            const hallDoorHeight = 2.14;
            const hallFrontHalf = 2.1;
            const hallFrontLeftWidth = hallDoorCenterX - hallDoorWidth * 0.5 + hallFrontHalf;
            const hallFrontRightWidth = hallFrontHalf - (hallDoorCenterX + hallDoorWidth * 0.5);
            addWallX('frontHallWallLeft', hallFrontLeftWidth, -hallFrontHalf + hallFrontLeftWidth * 0.5, 4.28, 0xe3d4c4);
            addWallX('frontHallWallRight', hallFrontRightWidth, hallDoorCenterX + hallDoorWidth * 0.5 + hallFrontRightWidth * 0.5, 4.28, 0xe3d4c4);
            addBox('frontHallDoorHeader', hallDoorWidth, wallHeight - hallDoorHeight, wallThickness, hallDoorCenterX, floorY + hallDoorHeight + (wallHeight - hallDoorHeight) * 0.5, 4.28, makeMaterial(0xe3d4c4, 0.9, 0.02));
            this.addLocalHingedDoor(
                house,
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
            addBox('hallConsole', 0.9, 0.12, 0.28, -0.35, floorY + 0.28, 4.0, makeMaterial(0x8f6f53, 0.72, 0.05));
            addBox('hallConsoleLegA', 0.06, 0.34, 0.06, -0.72, floorY + 0.11, 4.0, makeMaterial(0x8f6f53, 0.72, 0.05));
            addBox('hallConsoleLegB', 0.06, 0.34, 0.06, 0.02, floorY + 0.11, 4.0, makeMaterial(0x8f6f53, 0.72, 0.05));
            addBox('hallMirror', 0.9, 0.7, 0.04, -0.35, floorY + 1.32, 4.0, makeMaterial(0xc8d3dc, 0.2, 0.15));
            addBox('hallRunner', 0.9, 0.01, 1.8, 0.25, floorY + 0.005, 3.1, makeMaterial(0xc8b4da, 0.95, 0.01));

            addFloor('livingFloor', 4.2, 4.4, 4.1, 1.1, 0xf2ebe1);
            addCeiling('livingCeiling', 4.2, 4.4, 4.1, 1.1, 0xfbf7f2);
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
            const livingGlow = new THREE.PointLight(0xffead7, 0.55, 5.5);
            livingGlow.position.set(4.6, floorY + 1.6, 1.2);
            house.add(livingGlow);

            addFloor('kitchenFloor', 4.2, 2.5, 4.1, -2.45, 0xe9e5df);
            addCeiling('kitchenCeiling', 4.2, 2.5, 4.1, -2.45, 0xf8f5f0);
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
            house.add(kitchenLight);

            addFloor('bedroomFloor', 2.9, 3.8, -3.43, 1.1, 0xefe8f5);
            addCeiling('bedroomCeiling', 2.9, 3.8, -3.43, 1.1, 0xfaf6fe);
            addWallZ('bedroomLeftWall', 3.8, -4.84, 1.1, 0xd7d3de);
            addWallX('bedroomFrontWall', 2.9, -3.43, 2.98, 0xe7d9e5);
            addWallX('bedroomBackWall', 2.9, -3.43, -0.78, 0xe7d9e5);
            addBox('bedFrame', 1.55, 0.28, 2.25, -3.63, floorY + 0.14, 1.2, makeMaterial(0xc7a2aa, 0.88, 0.01));
            addBox('bedMattress', 1.42, 0.22, 2.05, -3.63, floorY + 0.39, 1.2, makeMaterial(0xf4f1f6, 0.92, 0.01));
            addBox('bedPillowA', 0.42, 0.12, 0.32, -3.96, floorY + 0.56, 0.45, makeMaterial(0xf7f2ff, 0.95, 0.01));
            addBox('bedPillowB', 0.42, 0.12, 0.32, -3.3, floorY + 0.56, 0.45, makeMaterial(0xf7f2ff, 0.95, 0.01));
            addBox('dresser', 0.85, 0.82, 0.42, -4.48, floorY + 0.41, 2.25, makeMaterial(0x8e6b54, 0.76, 0.05));
            addBox('bedroomRug', 1.45, 0.01, 1.0, -3.13, floorY + 0.005, 2.1, makeMaterial(0xe6c7ef, 0.95, 0.01));
            const bedroomGlow = new THREE.PointLight(0xffecf2, 0.45, 4);
            bedroomGlow.position.set(-3.68, floorY + 1.9, 1.75);
            house.add(bedroomGlow);

            addBox('mainHouseFrontGreen', 26, 0.04, 6.8, 0, floorY - 0.04, 12.3, makeMaterial(0x88b971, 0.99, 0.0));
            addBox('mainHouseFrontWalkway', 1.25, 0.05, 4.1, 0.22, floorY - 0.005, 6.7, makeMaterial(0xd8d4ce, 0.96, 0.01));
            addBox('mainHouseFrontPorch', 1.9, 0.08, 1.25, 0.22, floorY + 0.01, 4.92, makeMaterial(0xd9cfbf, 0.93, 0.01));
            this.addNumberPlaque(house, cfg.number, 0.22, floorY + 2.42, 4.42);
            this.addWindow(house, -1.25, floorY + 1.5, 4.38, 0.92, 0.74, 0, true);
            this.addWindow(house, 1.9, floorY + 1.5, 4.38, 0.92, 0.74, 0, true);
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

            this.addTree(cfg.x - 8.2, cfg.theta - 0.024, 1001);
            this.addTree(cfg.x + 8.4, cfg.theta + 0.024, 1002);
            this.addShrub(cfg.x - 2.1, cfg.theta - 0.004, 1003, 0.4);
            this.addShrub(cfg.x + 3.1, cfg.theta + 0.004, 1004, 0.34);

            const deskMat = new THREE.MeshStandardMaterial({ color: 0x8b6f47, roughness: 0.7 });
            const desk = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.6), deskMat);
            desk.position.set(0, 0.025, 0);
            desk.castShadow = true;
            desk.receiveShadow = true;
            desk.name = 'desk';
            house.add(desk);

            [
                [-0.5, -0.1, -0.25],
                [0.5, -0.1, -0.25],
                [-0.5, -0.1, 0.25],
                [0.5, -0.1, 0.25]
            ].forEach((pos) => {
                const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.04), deskMat);
                leg.position.set(...pos);
                leg.castShadow = true;
                leg.receiveShadow = true;
                leg.name = 'desk_leg';
                house.add(leg);
            });

            const crtGroup = new THREE.Group();
            crtGroup.name = 'crt';
            crtGroup.position.set(0, 0.32, -0.1);

            const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd4c5a9, roughness: 0.6, metalness: 0.1 });
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.38), bodyMat);
            body.position.z = -0.15;
            body.castShadow = true;
            body.receiveShadow = true;
            crtGroup.add(body);

            const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.38, 0.04), bodyMat);
            bezel.position.z = 0.02;
            bezel.castShadow = true;
            bezel.receiveShadow = true;
            crtGroup.add(bezel);

            const screenGeo = new THREE.PlaneGeometry(0.36, 0.27, 10, 10);
            const positions = screenGeo.attributes.position;
            for (let i = 0; i < positions.count; i++) {
                const x = positions.getX(i);
                const y = positions.getY(i);
                const curve = -0.02 * (x * x + y * y);
                positions.setZ(i, curve);
            }
            positions.needsUpdate = true;
            screenGeo.computeVertexNormals();

            this.starterScreenMesh = new THREE.Mesh(
                screenGeo,
                new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide })
            );
            this.starterScreenMesh.name = 'crtScreen';
            this.starterScreenMesh.position.z = 0.041;
            crtGroup.add(this.starterScreenMesh);

            const glass = new THREE.Mesh(
                new THREE.PlaneGeometry(0.36, 0.27),
                new THREE.MeshPhysicalMaterial({
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
                })
            );
            glass.name = 'crtGlass';
            glass.userData.ignoreScreenOcclusion = true;
            glass.position.z = 0.042;
            crtGroup.add(glass);

            const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.06, 16), bodyMat);
            stand.position.set(0, -0.21, -0.05);
            stand.castShadow = true;
            stand.receiveShadow = true;
            crtGroup.add(stand);
            house.add(crtGroup);

            house.updateMatrixWorld(true);
            const deskBox = new THREE.Box3().setFromObject(desk);
            const crtBox = new THREE.Box3().setFromObject(crtGroup);
            crtGroup.position.y += (deskBox.max.y + 0.002) - crtBox.min.y;
            house.updateMatrixWorld(true);

            RetroProps.addStarterDeskSet(house);

            const deskLight = new THREE.PointLight(0xfff9e6, 0.6, 3);
            deskLight.position.set(-0.3, 0.4, 0.3);
            house.add(deskLight);
        }

        buildGeneratedHouse(cfg) {
            const house = new THREE.Group();
            this.placeOnCylinder(house, cfg.x, cfg.theta, cfg.yaw);
            this.scene.add(house);

            const width = 7.1 + this.rand01(cfg.seed, 1) * 2.8;
            const depth = 7.8 + this.rand01(cfg.seed, 2) * 2.4;
            const stories = this.rand01(cfg.seed, 3) > 0.76 ? 2 : 1;
            const wallHeight = stories === 2 ? 4.8 : 3.06;
            const roofType = this.pick(['gable', 'gable', 'flat', 'shed'], cfg.seed, 4);
            const wallColor = this.pick([0xf0ebe1, 0xe7dfe9, 0xe6ece0, 0xe8e3d9, 0xe3ecf1], cfg.seed, 5);
            const trimColor = this.pick([0xc8a790, 0x7b7f93, 0x638a73, 0x8b6d61, 0x718ca2], cfg.seed, 6);
            const doorColor = this.pick([0xaf7c5c, 0x596c84, 0x74594a, 0x6d4d42], cfg.seed, 7);
            const roofColor = this.pick([0x835f51, 0x5b6371, 0x8a685d, 0x6f7768], cfg.seed, 8);
            const floorColor = this.pick([0xf4f0ea, 0xf4efeb, 0xf1eef5, 0xeff4ea], cfg.seed, 9);
            const porchDepth = 0.8 + this.rand01(cfg.seed, 10) * 0.45;
            const doorWidth = 0.96;
            const doorHeight = 2.08;
            const doorOffset = (this.rand01(cfg.seed, 11) - 0.5) * Math.min(1.6, width * 0.26);
            const frontZ = depth * 0.5;
            const leftWidth = Math.max(1.0, width * 0.5 + doorOffset - doorWidth * 0.5);
            const rightWidth = Math.max(0.95, width - leftWidth - doorWidth);
            const leftCenter = -width * 0.5 + leftWidth * 0.5;
            const rightCenter = width * 0.5 - rightWidth * 0.5;

            const wallMat = makeMaterial(wallColor, 0.88, 0.02);
            const trimMat = makeMaterial(trimColor, 0.86, 0.02);
            const floorMat = makeMaterial(floorColor, 0.96, 0.01);
            const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.84, metalness: 0.02, side: THREE.DoubleSide });

            this.addLocalBox(house, 'lotPad', width + 4.5, 0.08, depth + 6.6, 0, 0.04, 0, makeMaterial(0xa8cd8f, 0.99, 0.0));
            this.addLocalBox(house, 'foundation', width + 0.18, 0.18, depth + 0.18, 0, 0.09, 0, makeMaterial(0xd4c5b4, 0.92, 0.01));
            this.addLocalBox(house, 'houseFloor', width - 0.18, 0.06, depth - 0.18, 0, 0.03, 0, floorMat);
            this.addLocalBox(house, 'wallLeft', 0.08, wallHeight, depth, -width * 0.5, wallHeight * 0.5, 0, wallMat);
            this.addLocalBox(house, 'wallRight', 0.08, wallHeight, depth, width * 0.5, wallHeight * 0.5, 0, wallMat);
            this.addLocalBox(house, 'wallBack', width, wallHeight, 0.08, 0, wallHeight * 0.5, -depth * 0.5, wallMat);
            this.addLocalBox(house, 'frontLeft', leftWidth, wallHeight, 0.08, leftCenter, wallHeight * 0.5, frontZ, wallMat);
            this.addLocalBox(house, 'frontRight', rightWidth, wallHeight, 0.08, rightCenter, wallHeight * 0.5, frontZ, wallMat);
            this.addLocalBox(house, 'doorHeader', doorWidth, wallHeight - doorHeight, 0.08, doorOffset, doorHeight + (wallHeight - doorHeight) * 0.5, frontZ, wallMat);

            if (cfg.enterable) {
                this.addLocalHingedDoor(
                    house,
                    'houseFrontDoor',
                    doorWidth,
                    doorHeight,
                    0.06,
                    doorOffset,
                    doorHeight * 0.5,
                    frontZ - 0.03,
                    makeMaterial(doorColor, 0.7, 0.03),
                    { closedRotY: 0, openAngle: this.rand01(cfg.seed, 12) > 0.5 ? 1.14 : -1.14, hinge: this.rand01(cfg.seed, 13) > 0.5 ? 'right' : 'left' }
                );
            } else {
                this.addLocalBox(house, 'houseFrontDoor', doorWidth, doorHeight, 0.06, doorOffset, doorHeight * 0.5, frontZ - 0.03, makeMaterial(doorColor, 0.7, 0.03));
            }

            this.addLocalBox(house, 'housePorch', Math.max(1.45, doorWidth + 0.5), 0.08, porchDepth, doorOffset, 0.04, frontZ + porchDepth * 0.5 + 0.02, makeMaterial(0xe2d6c5, 0.92, 0.01));
            this.addLocalBox(house, 'houseWalkway', 1.18, 0.05, 3.2, doorOffset, 0.025, frontZ + porchDepth + 1.58, makeMaterial(0xe5dfd8, 0.96, 0.01));
            this.addNumberPlaque(house, cfg.number, doorOffset, 2.4, frontZ + 0.08);
            this.addLocalBox(house, 'housePorchPostA', 0.12, 1.7, 0.12, doorOffset - 0.58, 0.85, frontZ + porchDepth * 0.9, trimMat);
            this.addLocalBox(house, 'housePorchPostB', 0.12, 1.7, 0.12, doorOffset + 0.58, 0.85, frontZ + porchDepth * 0.9, trimMat);

            this.addWindow(house, -width * 0.27, 1.5, frontZ + 0.04, 0.94, 0.74, 0, this.rand01(cfg.seed, 14) > 0.2);
            this.addWindow(house, width * 0.28, 1.5, frontZ + 0.04, 0.94, 0.74, 0, this.rand01(cfg.seed, 15) > 0.18);
            this.addWindow(house, -width * 0.5 - 0.04, 1.4, -depth * 0.18, 0.9, 0.72, Math.PI / 2, this.rand01(cfg.seed, 16) > 0.2);
            this.addWindow(house, width * 0.5 + 0.04, 1.4, depth * 0.15, 0.9, 0.72, Math.PI / 2, this.rand01(cfg.seed, 17) > 0.2);
            if (stories === 2) {
                this.addWindow(house, -width * 0.18, 3.26, frontZ + 0.04, 0.78, 0.6, 0, true);
                this.addWindow(house, width * 0.2, 3.26, frontZ + 0.04, 0.78, 0.6, 0, true);
            }

            if (roofType === 'flat') {
                this.addLocalBox(house, 'flatRoof', width + 0.55, 0.18, depth + 0.55, 0, wallHeight + 0.09, 0, roofMat);
            } else if (roofType === 'shed') {
                const roof = this.createShedRoof(width + 0.6, depth + 0.6, 1.2, roofMat);
                roof.position.set(0, wallHeight + 0.04, 0);
                house.add(roof);
            } else {
                const roof = this.createGableRoof(width + 0.6, depth + 0.6, 1.32, roofMat);
                roof.position.set(0, wallHeight + 0.04, 0);
                house.add(roof);
            }

            if (stories === 2 || this.rand01(cfg.seed, 18) > 0.65) {
                this.addLocalBox(house, 'houseChimney', 0.36, 1.5, 0.36, width * 0.22, wallHeight + 0.75, -depth * 0.18, makeMaterial(0xd1bcab, 0.9, 0.01));
            }

            this.addLocalBox(house, 'houseSofaSeat', 1.48, 0.3, 0.76, -0.2, 0.18, 0.18, makeMaterial(this.pick([0xd0aa9f, 0xb2c2d3, 0xa2c08c, 0xcda8c0], cfg.seed, 19), 0.92, 0.01));
            this.addLocalBox(house, 'houseBedBase', 1.5, 0.24, 2.0, 0.24, 0.12, -0.28, makeMaterial(this.pick([0xd0a7b1, 0xc3abd6, 0xa9bdd4, 0xe0c0a5], cfg.seed, 20), 0.9, 0.01));
            this.addLocalBox(house, 'houseMattress', 1.36, 0.18, 1.84, 0.24, 0.34, -0.28, makeMaterial(0xf8f5fb, 0.95, 0.01));
            this.addLocalBox(house, 'houseDiningTable', 0.94, 0.08, 0.94, 0.02, 0.42, depth * 0.26, makeMaterial(this.pick([0xa07c5e, 0x927055, 0xb48e69], cfg.seed, 21), 0.72, 0.03));
            this.addLocalBox(house, 'houseStorage', 0.72, 0.92, 0.34, width * 0.34, 0.46, -depth * 0.28, makeMaterial(0x8f6f54, 0.76, 0.03));
            this.addLocalBox(house, 'houseStorageBooks', 0.54, 0.14, 0.2, width * 0.34, 0.78, -depth * 0.33, makeMaterial(0xbecce0, 0.84, 0.01));

            const deskColor = this.pick([0xb48d6b, 0x9f795a, 0xc3a17c], cfg.seed, 22);
            this.addLocalBox(house, 'deadDeskTop', 1.35, 0.08, 0.68, width * 0.22, 0.46, -depth * 0.04, makeMaterial(deskColor, 0.74, 0.03));
            [-0.52, 0.52].forEach((dx) => {
                [-0.22, 0.22].forEach((dz) => {
                    this.addLocalBox(house, 'deadDeskLeg', 0.08, 0.7, 0.08, width * 0.22 + dx, 0.07, -depth * 0.04 + dz, makeMaterial(deskColor, 0.78, 0.02));
                });
            });
            this.addLocalBox(house, 'deadCRTBody', 0.62, 0.52, 0.56, width * 0.22 - 0.08, 0.76, -depth * 0.1, makeMaterial(0xd8cfbf, 0.65, 0.03));
            this.addLocalBox(house, 'deadCRTNeck', 0.16, 0.1, 0.16, width * 0.22 - 0.08, 0.52, -depth * 0.14, makeMaterial(0xd0c6b6, 0.65, 0.03));
            this.addLocalBox(house, 'deadCRTScreen', 0.38, 0.28, 0.02, width * 0.22 - 0.08, 0.78, -depth * 0.04 + 0.19, makeMaterial(0x06080d, 0.98, 0.01));
            this.addLocalBox(house, 'deadKeyboard', 0.48, 0.05, 0.18, width * 0.22 + 0.08, 0.51, -depth * 0.04 + 0.12, makeMaterial(0xe8e2d8, 0.82, 0.02));
            this.addLocalBox(house, 'disketteA', 0.16, 0.02, 0.16, width * 0.22 + 0.35, 0.51, -depth * 0.04 - 0.06, makeMaterial(this.pick([0x3a526d, 0x6d3a4c, 0x4a6c58], cfg.seed, 23), 0.84, 0.01));
            this.addLocalBox(house, 'disketteB', 0.16, 0.02, 0.16, width * 0.22 + 0.18, 0.51, -depth * 0.04 - 0.16, makeMaterial(this.pick([0x7b4d8a, 0x355d7d, 0x915e52], cfg.seed, 24), 0.84, 0.01));
        }
    }

    class CSS3DScreen {
        constructor(scene, camera, screenMesh, options = {}) {
            this.scene = scene;
            this.camera = camera;
            this.screenMesh = screenMesh;
            this.raycaster = new THREE.Raycaster();
            this.pointer = new THREE.Vector2();
            this.hovering = false;
            this.screenVisible = true;
            this.embedWarningMode = options.embedWarningMode || 'toast';
            this.toastContainer = document.getElementById('toast-container');
            this.emulateViewportCssWidth = 520;
            this.emulateViewportCssHeight = null;
            this.urlRequested = '';
            this.loadTimer = null;
            this.lastWarningUrl = '';
            this.occlusionBlockers = [];
            this.occlusionRefreshCounter = 0;

            this.renderer = new THREE.CSS3DRenderer();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.domElement.id = 'css3d-renderer';
            this.dom = document.getElementById('css3d-root');
            this.dom.appendChild(this.renderer.domElement);

            const wrapper = document.createElement('div');
            wrapper.style.position = 'absolute';
            wrapper.style.overflow = 'hidden';
            wrapper.style.pointerEvents = 'none';
            wrapper.style.willChange = 'transform';

            const inner = document.createElement('div');
            inner.style.position = 'relative';
            wrapper.appendChild(inner);

            this.iframe = document.createElement('iframe');
            this.iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms allow-popups allow-modals');
            this.iframe.style.position = 'absolute';
            this.iframe.style.top = '0';
            this.iframe.style.left = '0';
            this.iframe.style.border = '0';
            this.iframe.style.width = '100%';
            this.iframe.style.height = '100%';
            this.iframe.style.transformOrigin = 'top left';
            this.iframe.style.transform = 'scale(0.92)';
            inner.appendChild(this.iframe);
            this.iframe.addEventListener('load', () => this.onIframeLoad());

            const scan = document.createElement('div');
            scan.style.pointerEvents = 'none';
            scan.style.position = 'absolute';
            scan.style.inset = '0';
            scan.style.backgroundImage = 'repeating-linear-gradient(to bottom, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 3px)';
            scan.style.mixBlendMode = 'multiply';
            inner.appendChild(scan);

            this.wrapper = wrapper;
            this.inner = inner;
            this.cssObject = new THREE.CSS3DObject(wrapper);
            this.cssScreenAnchor = new THREE.Object3D();
            this.cssScreenAnchor.add(this.cssObject);
            scene.add(this.cssScreenAnchor);

            this.setupEvents();
            this.fitElementToScreen();
            this.syncAnchor();
        }

        computeScreenWorldSize() {
            const geom = this.screenMesh.geometry;
            if (!geom.boundingBox) geom.computeBoundingBox();
            const bb = geom.boundingBox;
            const localSize = new THREE.Vector3().subVectors(bb.max, bb.min);
            const worldScale = new THREE.Vector3();
            this.screenMesh.getWorldScale(worldScale);
            return { w: localSize.x * worldScale.x, h: localSize.y * worldScale.y };
        }

        fitElementToScreen() {
            this.screenMesh.updateWorldMatrix(true, false);
            const { w, h } = this.computeScreenWorldSize();
            const emuW = this.emulateViewportCssWidth;
            const emuH = Math.round(emuW * (h / w));
            this.emulateViewportCssHeight = emuH;
            this.inner.style.width = `${emuW}px`;
            this.inner.style.height = `${emuH}px`;
            const s = w / emuW;
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
                if (!document.body.classList.contains('screen-mode')) {
                    document.body.style.cursor = this.hovering ? 'default' : 'grab';
                }
            }
        }

        onResize() {
            this.fitElementToScreen();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
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
            if (this.loadTimer) {
                window.clearTimeout(this.loadTimer);
                this.loadTimer = null;
            }
            try {
                this.iframe.src = url;
                localStorage.setItem('crt.url', url);
                const urlInput = document.getElementById('url-input');
                if (urlInput) urlInput.value = url;
            } catch (e) {
                console.error('[oneill] Error loading URL:', e);
            }
            this.lastWarningUrl = '';
            this.loadTimer = window.setTimeout(() => {
                this.lastWarningUrl = this.urlRequested;
                if (this.embedWarningMode === 'toast') {
                    this.showToast('This site may block embedding. Try another URL if the screen stays blank.');
                }
                console.warn('[oneill] iframe might be blocked or slow:', this.urlRequested);
            }, 6000);
        }

        enableInput() {
            this.iframe.style.pointerEvents = 'auto';
        }

        disableInput() {
            this.iframe.style.pointerEvents = 'none';
        }

        update() {
            this.syncAnchor();
            this.updateVisibility();
            this.renderer.render(this.scene, this.camera);
        }
    }

    class ThirdPersonCylinderControls {
        constructor(camera, domElement, world) {
            this.camera = camera;
            this.domElement = domElement;
            this.world = world;
            this.enabled = true;
            this.isLocked = false;
            this.isTouchDevice = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
            this.cylinderRadius = world.radius;
            this.maxX = world.maxWalkX;
            this.standEyeHeight = 1.05;
            this.crouchEyeHeight = 0.68;
            this.isCrouching = false;
            this.moveSpeed = 2.2;
            this.lookSpeed = 0.0025;
            this.touchLookSpeed = 0.0032;
            this.pitchMin = -0.75;
            this.pitchMax = 0.35;
            this.yaw = world.spawn.yaw;
            this.pitch = world.spawn.pitch;
            this.facingYaw = Math.PI;
            this.surfaceX = world.spawn.x;
            this.surfaceArc = world.spawn.theta * this.cylinderRadius;
            this.moveState = { forward: false, backward: false, left: false, right: false };
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
            this.cameraOffset = new THREE.Vector3(0, 1.85, 3.6);
            this.cameraTargetLocal = new THREE.Vector3(0, 1.45, 0);
            this.cameraLerp = 0.14;
            this.playerPosition = new THREE.Vector3();
            this.up = new THREE.Vector3();
            this.forwardBase = new THREE.Vector3();
            this.rightBase = new THREE.Vector3(1, 0, 0);
            this.moveVector = new THREE.Vector3();
            this.forward = new THREE.Vector3();
            this.right = new THREE.Vector3();
            this.cameraTarget = new THREE.Vector3();
            this.desiredCameraPosition = new THREE.Vector3();
            this.localCameraOffset = new THREE.Vector3();
            this.yawQuaternion = new THREE.Quaternion();
            this.pitchQuaternion = new THREE.Quaternion();
            this.basisMatrix = new THREE.Matrix4();
            this.playerGroup = new THREE.Group();
            this.playerGroup.name = 'playerAvatarRoot';
            scene.add(this.playerGroup);
            this.model = null;
            this.mixer = null;
            this.idleAction = null;
            this.walkAction = null;
            this.currentAction = null;
            this.loadAvatar();

            document.body.classList.toggle('touch-device', this.isTouchDevice);
            this.syncPlayerBasis();
            this.updateModelTransform();
            this.updateCamera(true);
            this.setupEvents();
        }

        loadAvatar() {
            if (!THREE.GLTFLoader) {
                console.error('[oneill] GLTFLoader unavailable; third-person avatar did not load');
                return;
            }
            const loader = new THREE.GLTFLoader();
            loader.load(
                'https://threejs.org/examples/models/gltf/Xbot.glb',
                (gltf) => {
                    this.model = gltf.scene;
                    this.model.name = 'playerAvatar';
                    this.playerGroup.add(this.model);
                    this.model.traverse((object) => {
                        if (!object.isMesh) return;
                        object.castShadow = true;
                        object.userData.ignoreScreenOcclusion = true;
                    });
                    this.mixer = new THREE.AnimationMixer(this.model);
                    this.idleAction = this.mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, 'idle'));
                    this.walkAction = this.mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, 'walk'));
                    this.setAction(this.idleAction);
                    this.updateModelTransform();
                    this.updateCamera(true);
                },
                undefined,
                (error) => console.error('[oneill] Xbot failed to load', error)
            );
        }

        setAction(nextAction) {
            if (!nextAction || this.currentAction === nextAction) return;
            if (this.currentAction) {
                this.currentAction.fadeOut(0.2);
            }
            nextAction.reset().fadeIn(0.2).play();
            this.currentAction = nextAction;
        }

        setupEvents() {
            document.addEventListener('pointerlockchange', () => {
                this.isLocked = document.pointerLockElement === this.domElement;
                document.body.classList.toggle('locked', this.isLocked);
                if (!this.isLocked) {
                    document.body.style.cursor = 'default';
                }
            });

            document.addEventListener('mousemove', (e) => this.onMouseMove(e));
            document.addEventListener('keydown', (e) => this.onKeyChange(e, true));
            document.addEventListener('keyup', (e) => this.onKeyChange(e, false));
            if (this.isTouchDevice) {
                this.setupTouchControls();
            }
        }

        currentEyeHeight() {
            return this.isCrouching ? this.crouchEyeHeight : this.standEyeHeight;
        }

        setEnabled(enabled) {
            this.enabled = enabled;
            if (!enabled) {
                this.resetMovePad();
                this.touchState.lookPointerId = null;
            }
        }

        lock() {
            if (!this.enabled || this.isTouchDevice) return;
            this.domElement.requestPointerLock();
        }

        unlock() {
            if (this.isLocked) {
                document.exitPointerLock();
            }
        }

        wrapArc() {
            const circumference = TAU * this.cylinderRadius;
            this.surfaceArc = THREE.MathUtils.euclideanModulo(this.surfaceArc, circumference);
        }

        clampX() {
            this.surfaceX = THREE.MathUtils.clamp(this.surfaceX, -this.maxX, this.maxX);
        }

        setupTouchControls() {
            const { moveZone, lookZone } = this.mobileUi;
            if (!moveZone || !lookZone) return;

            const releaseCapture = (target, pointerId) => {
                try {
                    target.releasePointerCapture(pointerId);
                } catch (e) {
                    // ignore
                }
            };

            moveZone.addEventListener('pointerdown', (event) => {
                if (event.pointerType === 'mouse' || !this.enabled) return;
                this.touchState.movePointerId = event.pointerId;
                try { moveZone.setPointerCapture(event.pointerId); } catch (e) {}
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
                if (event.pointerType === 'mouse' || !this.enabled) return;
                this.touchState.lookPointerId = event.pointerId;
                this.touchState.lookLastX = event.clientX;
                this.touchState.lookLastY = event.clientY;
                try { lookZone.setPointerCapture(event.pointerId); } catch (e) {}
                event.preventDefault();
            });
            lookZone.addEventListener('pointermove', (event) => {
                if (event.pointerId !== this.touchState.lookPointerId || !this.enabled) return;
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
            this.pitch = THREE.MathUtils.clamp(this.pitch - dy * speed, this.pitchMin, this.pitchMax);
        }

        onMouseMove(event) {
            if (!this.enabled || !this.isLocked) return;
            this.applyLookDelta(event.movementX, event.movementY, this.lookSpeed);
        }

        onKeyChange(event, pressed) {
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;

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
                        this.updateCamera(true);
                        event.preventDefault();
                    }
                    return;
                default:
                    return;
            }

            if (pressed) event.preventDefault();
        }

        syncPlayerBasis() {
            const theta = this.surfaceArc / this.cylinderRadius;
            this.up.set(0, Math.cos(theta), -Math.sin(theta)).normalize();
            this.forwardBase.set(0, Math.sin(theta), Math.cos(theta)).normalize();
            this.playerPosition.set(
                this.surfaceX,
                -Math.cos(theta) * this.cylinderRadius,
                Math.sin(theta) * this.cylinderRadius
            );
            this.basisMatrix.makeBasis(this.rightBase, this.up, this.forwardBase);
        }

        updateModelTransform() {
            this.syncPlayerBasis();
            if (!this.model) return;
            const basisQuat = new THREE.Quaternion().setFromRotationMatrix(this.basisMatrix);
            const localQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.facingYaw);
            this.playerGroup.position.copy(this.playerPosition);
            this.playerGroup.quaternion.copy(basisQuat).multiply(localQuat);
            this.playerGroup.position.addScaledVector(this.up, 0.01);
        }

        updateCamera(snap = false) {
            this.syncPlayerBasis();
            this.yawQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
            this.pitchQuaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch);

            this.localCameraOffset.copy(this.cameraOffset);
            this.localCameraOffset.y = this.isCrouching ? 1.25 : this.cameraOffset.y;
            this.localCameraOffset.applyQuaternion(this.pitchQuaternion).applyQuaternion(this.yawQuaternion);
            this.desiredCameraPosition.copy(this.localCameraOffset).applyMatrix4(this.basisMatrix).add(this.playerPosition);

            if (snap) {
                this.camera.position.copy(this.desiredCameraPosition);
            } else {
                this.camera.position.lerp(this.desiredCameraPosition, this.cameraLerp);
            }

            this.cameraTarget.copy(this.cameraTargetLocal);
            this.cameraTarget.y = this.isCrouching ? 0.96 : this.cameraTargetLocal.y;
            this.cameraTarget.applyMatrix4(this.basisMatrix).add(this.playerPosition);
            this.camera.up.copy(this.up);
            this.camera.lookAt(this.cameraTarget);
        }

        update(delta) {
            if (!this.enabled) return;

            if (this.mixer) {
                this.mixer.update(delta);
            }

            if (!this.isLocked && !this.isTouchDevice) {
                this.updateModelTransform();
                this.updateCamera();
                return;
            }

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
            this.moveVector.set(0, 0, 0);
            this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
            this.right.set(-this.forward.z, 0, this.forward.x).normalize();

            if (inputZ > 0.001) this.moveVector.add(this.forward);
            if (inputZ < -0.001) this.moveVector.sub(this.forward);
            if (inputX < -0.001) this.moveVector.sub(this.right);
            if (inputX > 0.001) this.moveVector.add(this.right);

            const moving = this.moveVector.lengthSq() > 0;
            if (moving) {
                this.moveVector.normalize();
                this.facingYaw = Math.atan2(this.moveVector.x, this.moveVector.z);
                this.surfaceX += this.moveVector.x * this.moveSpeed * delta;
                this.surfaceArc += this.moveVector.z * this.moveSpeed * delta;
            } else {
                this.facingYaw = this.yaw + Math.PI;
            }

            this.clampX();
            this.wrapArc();
            this.updateModelTransform();
            this.updateCamera();

            if (this.idleAction && this.walkAction) {
                this.setAction(moving ? this.walkAction : this.idleAction);
            }
        }
    }

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
            document.addEventListener('click', () => this.onClick());
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
                if (!this.isOverScreen) this.enterScreen();
            } else if (this.isOverScreen) {
                this.exitScreen();
            }
        }

        onClick() {
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
        }

        exitScreen() {
            this.isOverScreen = false;
            this.css3dScreen.disableInput();
            this.controls.setEnabled(true);
            document.body.classList.remove('screen-mode');
            this.hint.textContent = this.controls.isTouchDevice
                ? 'Use the left pad to move and the right pad to look'
                : 'Click to walk, move the mouse to orbit, WASD to move, ESC to free the cursor.';
        }
    }

    class URLBar {
        constructor(css3dScreen) {
            this.css3dScreen = css3dScreen;
            this.overlay = document.getElementById('url-overlay');
            this.input = document.getElementById('url-input');
            this.setupEvents();
        }

        setupEvents() {
            this.input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    const value = this.input.value.trim();
                    if (!value) return;
                    const url = /^https?:\/\//i.test(value) ? value : `https://${value}`;
                    this.css3dScreen.loadURL(url);
                    this.hide();
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    this.hide();
                }
            });
        }

        show() {
            this.overlay.classList.add('show');
            this.input.focus();
            this.input.select();
        }

        hide() {
            this.overlay.classList.remove('show');
            this.input.blur();
        }
    }

    class OneillApp {
        constructor() {
            this.pickRay = new THREE.Raycaster();
            this.pickMouse = new THREE.Vector2();

            this.world = new OneillWorld(scene);
            this.controls = new ThirdPersonCylinderControls(camera, renderer.domElement, this.world);
            this.css3dScreen = new CSS3DScreen(scene, camera, this.world.starterScreenMesh);
            this.interaction = new InteractionSystem(camera, this.controls, this.world.starterScreenMesh, this.css3dScreen);
            this.urlBar = new URLBar(this.css3dScreen);
            this.clock = new THREE.Clock();

            const startupUrl = localStorage.getItem('crt.url') || DEFAULT_HOME_URL;
            this.css3dScreen.loadURL(startupUrl);
            this.bindEvents();
            this.onResize();
            this.animate();
        }

        bindEvents() {
            window.addEventListener('resize', () => this.onResize());
            renderer.domElement.addEventListener('click', (event) => this.handleWorldClick(event));
        }

        onResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setPixelRatio(clampDPR(window.devicePixelRatio));
            renderer.setSize(window.innerWidth, window.innerHeight);
        }

        setPickMouse(event) {
            this.pickMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.pickMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        }

        handleWorldClick(event) {
            if (this.interaction.isOverScreen) return;
            if (this.controls.isLocked) return;
            if (event.target === document.getElementById('url-input')) return;

            this.setPickMouse(event);
            this.pickRay.setFromCamera(this.pickMouse, camera);
            const hits = this.pickRay.intersectObjects(scene.children, true);
            const hit = hits.find((cur) => cur.object.name === 'deskKeyboard' || cur.object.userData?.openURL);

            if (hit?.object?.name === 'deskKeyboard') {
                this.urlBar.show();
                return;
            }

            if (hit?.object?.userData?.openURL) {
                this.css3dScreen.loadURL(hit.object.userData.openURL);
                return;
            }

            this.controls.lock();
        }

        animate() {
            requestAnimationFrame(() => this.animate());
            const delta = Math.min(this.clock.getDelta(), 0.05);
            this.controls.update(delta);
            renderer.render(scene, camera);
            this.css3dScreen.update();
        }
    }

    new OneillApp();
})();
