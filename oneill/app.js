(function () {
    const canvas = document.getElementById('webgl');
    const hint = document.getElementById('hint');

    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.98;
    renderer.shadowMap.enabled = false;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf2fbff);
    scene.fog = new THREE.Fog(0xf2fbff, 1200, 4200);

    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 6000);

    const clamp = THREE.MathUtils.clamp;
    const TAU = Math.PI * 2;
    const UNIT_Y = new THREE.Vector3(0, 1, 0);

    class OneillWorld {
        constructor(scene) {
            this.scene = scene;
            this.radius = 260;
            this.length = 280;
            this.maxWalkX = this.length * 0.5 - 12;
            this.roadCount = 10;
            this.lotsPerSide = 5;
            this.housesPerRoad = this.lotsPerSide * 2;
            this.totalHouses = this.roadCount * this.housesPerRoad;
            this.roadWidth = 8.4;
            this.sidewalkWidth = 1.3;
            this.rowArcOffset = 14.2;
            this.housePitchArc = 44;
            this.numberTextureCache = new Map();
            this.tempQuaternion = new THREE.Quaternion();

            this.materials = {
                grass: this.makeMaterial(0xb8d9ab, 0.98, 0.0),
                road: this.makeMaterial(0x59606a, 0.98, 0.01),
                sidewalk: this.makeMaterial(0xebe4db, 0.96, 0.01),
                structure: this.makeMaterial(0xdfe7ea, 0.94, 0.01),
                lightBand: new THREE.MeshBasicMaterial({
                    color: 0xf8fdff,
                    transparent: true,
                    opacity: 0.18
                })
            };

            this.buildHabitat();
            this.buildNeighborhood();

            this.spawn = {
                x: 0,
                theta: 0,
                yaw: 0.18,
                pitch: -0.06
            };
        }

        makeMaterial(color, roughness = 0.9, metalness = 0.02, extra = {}) {
            return new THREE.MeshStandardMaterial({
                color,
                roughness,
                metalness,
                ...extra
            });
        }

        setTextureEncoding(texture) {
            if ('colorSpace' in texture && THREE.SRGBColorSpace) {
                texture.colorSpace = THREE.SRGBColorSpace;
            } else {
                texture.encoding = THREE.sRGBEncoding;
            }
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
            const localQuat = new THREE.Quaternion().setFromAxisAngle(UNIT_Y, yaw);
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

        addCylinderStrip(name, radius, length, thetaCenter, thetaLength, material, xCenter = 0, radialSegments = 96) {
            const geom = new THREE.CylinderGeometry(
                radius,
                radius,
                length,
                radialSegments,
                1,
                true,
                thetaCenter - thetaLength * 0.5 - Math.PI * 0.5,
                thetaLength
            );
            const mesh = new THREE.Mesh(geom, material);
            mesh.name = name;
            mesh.rotation.z = Math.PI * 0.5;
            mesh.position.x = xCenter;
            mesh.receiveShadow = true;
            this.scene.add(mesh);
            return mesh;
        }

        addCylinderDisc(name, x, radius, material, opacity = 0.22) {
            const disc = new THREE.Mesh(
                new THREE.CircleGeometry(radius, 96),
                material || new THREE.MeshBasicMaterial({
                    color: 0xf5fbff,
                    transparent: true,
                    opacity,
                    side: THREE.DoubleSide
                })
            );
            disc.name = name;
            disc.rotation.y = Math.PI * 0.5;
            disc.position.x = x;
            this.scene.add(disc);
            return disc;
        }

        createGableRoof(width, depth, rise, material) {
            const w = width * 0.5;
            const d = depth * 0.5;
            const h = rise;
            const positions = [
                -w, 0, -d,  w, 0, -d,  -w, h, 0,
                 w, 0, -d,  w, h, 0,  -w, h, 0,

                -w, 0,  d, -w, h, 0,   w, 0,  d,
                 w, 0,  d, -w, h, 0,   w, h, 0,

                -w, 0, -d, -w, h, 0,  -w, 0,  d,
                 w, 0, -d,  w, 0,  d,  w, h, 0,

                -w, 0, -d, -w, 0,  d,  w, 0, -d,
                 w, 0, -d, -w, 0,  d,  w, 0,  d
            ];
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geometry.computeVertexNormals();
            return new THREE.Mesh(geometry, material);
        }

        createShedRoof(width, depth, rise, material) {
            const w = width * 0.5;
            const d = depth * 0.5;
            const low = 0;
            const high = rise;
            const positions = [
                -w, low, -d,  w, low, -d, -w, high,  d,
                 w, low, -d,  w, high, d,  -w, high, d,

                -w, low, -d, -w, high, d,  -w, low,  d,
                 w, low, -d,  w, low,  d,  w, high, d,

                -w, low, -d, -w, low,  d,  w, low, -d,
                 w, low, -d, -w, low,  d,  w, low,  d,

                -w, high, d,  w, high, d, -w, low,  d,
                 w, high, d,  w, low,  d, -w, low,  d
            ];
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geometry.computeVertexNormals();
            return new THREE.Mesh(geometry, material);
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
            ctx.font = 'bold 52px Georgia, serif';
            ctx.fillText(label, canvas.width * 0.5, canvas.height * 0.56);

            const texture = new THREE.CanvasTexture(canvas);
            this.setTextureEncoding(texture);
            this.numberTextureCache.set(key, texture);
            return texture;
        }

        addNumberPlaque(group, label, x, y, z, rotY = 0) {
            const plaque = this.addLocalPlane(
                group,
                `houseNumber${label}`,
                0.78,
                0.36,
                x,
                y,
                z,
                new THREE.MeshBasicMaterial({
                    map: this.getNumberTexture(label),
                    transparent: true
                }),
                rotY
            );
            return plaque;
        }

        addWindow(group, x, y, z, w, h, rotY = 0, lit = true) {
            const frameMat = this.makeMaterial(0xf4f0ea, 0.55, 0.03);
            const glassMat = new THREE.MeshBasicMaterial({
                color: lit ? 0xfff4d2 : 0xbfd7ee,
                transparent: true,
                opacity: lit ? 0.86 : 0.58
            });

            if (Math.abs(rotY) < 0.001 || Math.abs(rotY - Math.PI) < 0.001) {
                this.addLocalBox(group, 'windowFrame', w + 0.1, h + 0.1, 0.08, x, y, z, frameMat);
            } else {
                this.addLocalBox(group, 'windowFrame', 0.08, h + 0.1, w + 0.1, x, y, z, frameMat);
            }

            this.addLocalPlane(group, 'windowGlass', w, h, x, y, z + (Math.abs(rotY) < 0.001 ? 0.041 : 0), glassMat, rotY);
        }

        addDeadCRTStation(group, seed, x, z) {
            const deskColor = this.pick([0xb48d6b, 0x9f795a, 0xc3a17c], seed, 1);
            this.addLocalBox(group, 'deskTop', 1.35, 0.08, 0.68, x, 0.46, z, this.makeMaterial(deskColor, 0.74, 0.03));
            [-0.52, 0.52].forEach((dx) => {
                [-0.22, 0.22].forEach((dz) => {
                    this.addLocalBox(group, 'deskLeg', 0.08, 0.7, 0.08, x + dx, 0.11, z + dz, this.makeMaterial(deskColor, 0.78, 0.02));
                });
            });
            this.addLocalBox(group, 'crtBody', 0.62, 0.52, 0.56, x - 0.08, 0.76, z - 0.06, this.makeMaterial(0xd8cfbf, 0.65, 0.03));
            this.addLocalBox(group, 'crtNeck', 0.16, 0.1, 0.16, x - 0.08, 0.52, z - 0.1, this.makeMaterial(0xd0c6b6, 0.65, 0.03));
            this.addLocalBox(group, 'crtScreen', 0.38, 0.28, 0.02, x - 0.08, 0.78, z + 0.19, this.makeMaterial(0x06080d, 0.98, 0.01));
            this.addLocalBox(group, 'keyboard', 0.48, 0.05, 0.18, x + 0.08, 0.51, z + 0.12, this.makeMaterial(0xe8e2d8, 0.82, 0.02));
            this.addLocalBox(group, 'disketteA', 0.16, 0.02, 0.16, x + 0.35, 0.51, z - 0.06, this.makeMaterial(this.pick([0x3a526d, 0x6d3a4c, 0x4a6c58], seed, 2), 0.84, 0.01));
            this.addLocalBox(group, 'disketteB', 0.16, 0.02, 0.16, x + 0.18, 0.51, z - 0.16, this.makeMaterial(this.pick([0x7b4d8a, 0x355d7d, 0x915e52], seed, 3), 0.84, 0.01));
        }

        addTree(x, theta, seed, scale = 1) {
            const tree = new THREE.Group();
            this.placeOnCylinder(tree, x, theta);
            const trunkHeight = (1.45 + this.rand01(seed, 1) * 0.55) * scale;
            this.addLocalBox(tree, 'treeTrunk', 0.22 * scale, trunkHeight, 0.22 * scale, 0, trunkHeight * 0.5, 0, this.makeMaterial(0x70553d, 0.92, 0.01));
            const canopyColor = this.pick([0x76b46d, 0x8bc37a, 0x6ca363, 0x99c98b], seed, 2);
            const canopy = new THREE.Mesh(
                new THREE.SphereGeometry((0.95 + this.rand01(seed, 3) * 0.22) * scale, 16, 12),
                this.makeMaterial(canopyColor, 0.95, 0.0)
            );
            canopy.position.set(0, trunkHeight + 0.5 * scale, 0);
            tree.add(canopy);
            const canopy2 = new THREE.Mesh(
                new THREE.SphereGeometry((0.62 + this.rand01(seed, 4) * 0.18) * scale, 14, 10),
                this.makeMaterial(canopyColor, 0.95, 0.0)
            );
            canopy2.position.set(0.38 * scale, trunkHeight + 0.28 * scale, -0.16 * scale);
            tree.add(canopy2);
            this.scene.add(tree);
        }

        addShrub(x, theta, seed, radius = 0.34) {
            const shrub = new THREE.Group();
            this.placeOnCylinder(shrub, x, theta);
            const mesh = new THREE.Mesh(
                new THREE.SphereGeometry(radius, 14, 12),
                this.makeMaterial(this.pick([0x76a965, 0x6e9f5b, 0x88b874], seed, 1), 0.98, 0.0)
            );
            mesh.position.y = radius * 0.75;
            shrub.add(mesh);
            this.scene.add(shrub);
        }

        addStreetLamp(x, theta) {
            const lamp = new THREE.Group();
            this.placeOnCylinder(lamp, x, theta);
            this.addLocalBox(lamp, 'lampPole', 0.09, 3.2, 0.09, 0, 1.6, 0, this.makeMaterial(0x73808d, 0.76, 0.06));
            this.addLocalBox(lamp, 'lampArm', 0.52, 0.08, 0.08, 0.18, 3.04, 0, this.makeMaterial(0x73808d, 0.76, 0.06));
            const globe = new THREE.Mesh(
                new THREE.SphereGeometry(0.16, 12, 10),
                new THREE.MeshBasicMaterial({ color: 0xfff8df })
            );
            globe.position.set(0.42, 3.02, 0);
            lamp.add(globe);
            this.scene.add(lamp);
        }

        buildHabitat() {
            const terrain = new THREE.Mesh(
                new THREE.CylinderGeometry(this.radius, this.radius, this.length, 256, 1, true),
                new THREE.MeshStandardMaterial({
                    color: 0xb7dbaa,
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
                    this.makeMaterial(index % 2 === 0 ? 0xe9eff1 : 0xdde5e8, 0.88, 0.01)
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
                        opacity: index === 1 ? 0.24 : 0.15
                    })
                );
                band.rotation.z = Math.PI * 0.5;
                band.position.set(0, y, index === 1 ? 0 : (index === 0 ? 24 : -24));
                this.scene.add(band);
            });

            const ambient = new THREE.AmbientLight(0xffffff, 1.08);
            this.scene.add(ambient);

            const fillA = new THREE.PointLight(0xf7fbff, 1.2, 1200, 2);
            fillA.position.set(0, 0, 0);
            this.scene.add(fillA);

            const fillB = new THREE.PointLight(0xfff3e2, 0.55, 1100, 2);
            fillB.position.set(-70, 20, 40);
            this.scene.add(fillB);

            const fillC = new THREE.PointLight(0xe6f6ff, 0.5, 1100, 2);
            fillC.position.set(80, -20, -40);
            this.scene.add(fillC);

            this.addCylinderDisc('endCapWest', -this.length * 0.5 - 0.2, this.radius + 8);
            this.addCylinderDisc('endCapEast', this.length * 0.5 + 0.2, this.radius + 8);
        }

        buildNeighborhood() {
            const roadAngles = [];
            const boulevardSpacing = TAU / this.roadCount;
            const startRoadTheta = this.rowArcOffset / this.radius;
            for (let i = 0; i < this.roadCount; i++) {
                roadAngles.push(startRoadTheta + i * boulevardSpacing);
            }

            const laneMarkerXs = [-112, -84, -56, -28, 0, 28, 56, 84, 112];
            const lotXs = [-96, -48, 0, 48, 96];
            let houseNumber = 1;

            roadAngles.forEach((roadTheta, roadIndex) => {
                const roadThetaWidth = this.roadWidth / this.radius;
                const sidewalkThetaWidth = this.sidewalkWidth / this.radius;
                const sidewalkOffset = (this.roadWidth * 0.5 + this.sidewalkWidth * 0.5) / this.radius;
                const rowOffsetTheta = this.rowArcOffset / this.radius;

                this.addCylinderStrip(`road_${roadIndex}`, this.radius - 0.02, this.length - 8, roadTheta, roadThetaWidth, new THREE.MeshStandardMaterial({
                    color: 0x59606a,
                    roughness: 0.98,
                    metalness: 0.01,
                    side: THREE.BackSide
                }));
                this.addCylinderStrip(`sidewalkA_${roadIndex}`, this.radius - 0.015, this.length - 8, roadTheta - sidewalkOffset, sidewalkThetaWidth, new THREE.MeshStandardMaterial({
                    color: 0xebe4db,
                    roughness: 0.96,
                    metalness: 0.01,
                    side: THREE.BackSide
                }));
                this.addCylinderStrip(`sidewalkB_${roadIndex}`, this.radius - 0.015, this.length - 8, roadTheta + sidewalkOffset, sidewalkThetaWidth, new THREE.MeshStandardMaterial({
                    color: 0xebe4db,
                    roughness: 0.96,
                    metalness: 0.01,
                    side: THREE.BackSide
                }));

                laneMarkerXs.forEach((x) => {
                    const marker = new THREE.Group();
                    this.placeOnCylinder(marker, x, roadTheta);
                    this.addLocalBox(marker, 'laneMarker', 3.5, 0.03, 0.18, 0, 0.015, 0, this.makeMaterial(0xf5e39d, 0.92, 0.0));
                    this.scene.add(marker);
                });

                [-98, -42, 14, 70, 126].forEach((x, lampIndex) => {
                    this.addStreetLamp(x, roadTheta + (lampIndex % 2 === 0 ? sidewalkOffset + 0.012 : -(sidewalkOffset + 0.012)));
                });

                lotXs.forEach((x, lotIndex) => {
                    const lowerTheta = roadTheta - rowOffsetTheta;
                    const upperTheta = roadTheta + rowOffsetTheta;

                    if (roadIndex === 0 && lotIndex === 2) {
                        this.buildSpecialHouse({
                            number: String(houseNumber).padStart(2, '0'),
                            seed: houseNumber,
                            x,
                            theta: lowerTheta,
                            yaw: 0
                        });
                    } else {
                        this.buildGeneratedHouse({
                            number: String(houseNumber).padStart(2, '0'),
                            seed: houseNumber,
                            x,
                            theta: lowerTheta,
                            yaw: 0,
                            enterable: houseNumber % 2 === 0
                        });
                    }
                    houseNumber += 1;

                    this.buildGeneratedHouse({
                        number: String(houseNumber).padStart(2, '0'),
                        seed: houseNumber,
                        x,
                        theta: upperTheta,
                        yaw: Math.PI,
                        enterable: houseNumber % 2 === 0
                    });
                    houseNumber += 1;
                });

                lotXs.forEach((x, lotIndex) => {
                    const treeBase = roadIndex * 20 + lotIndex * 3;
                    this.addTree(x - 11, roadTheta - rowOffsetTheta - 0.022, 3000 + treeBase, 0.92);
                    this.addTree(x + 10.5, roadTheta + rowOffsetTheta + 0.022, 4000 + treeBase, 0.9);
                    this.addShrub(x - 4.4, roadTheta - rowOffsetTheta + 0.012, 5000 + treeBase, 0.28);
                    this.addShrub(x + 4.2, roadTheta + rowOffsetTheta - 0.012, 6000 + treeBase, 0.3);
                });
            });
        }

        buildSpecialHouse(cfg) {
            const house = new THREE.Group();
            this.placeOnCylinder(house, cfg.x, cfg.theta, cfg.yaw);
            this.scene.add(house);

            const wallMat = this.makeMaterial(0xf0ebe2, 0.88, 0.02);
            const trimMat = this.makeMaterial(0xd9cdbd, 0.9, 0.02);
            const floorMat = this.makeMaterial(0xf5f0ea, 0.96, 0.01);
            const porchMat = this.makeMaterial(0xe6dccb, 0.94, 0.01);
            const roofMat = new THREE.MeshStandardMaterial({
                color: 0x815e50,
                roughness: 0.86,
                metalness: 0.02,
                side: THREE.DoubleSide
            });

            this.addLocalBox(house, 'lotPad', 17.5, 0.08, 14.8, 0, 0.04, 0, this.makeMaterial(0x9ec883, 0.99, 0.0));
            this.addLocalBox(house, 'walkway', 1.35, 0.06, 5.1, 0, 0.03, 5.45, this.makeMaterial(0xe6e0d8, 0.96, 0.01));
            this.addLocalBox(house, 'porch', 2.1, 0.08, 1.45, 0, 0.04, 3.62, porchMat);

            this.addLocalBox(house, 'studyFloor', 4, 0.06, 4, 0, 0.03, 0, floorMat);
            this.addLocalBox(house, 'hallFloor', 4.2, 0.06, 2.4, 0, 0.03, 3.1, floorMat);
            this.addLocalBox(house, 'livingFloor', 4.2, 0.06, 4.2, 4.15, 0.03, 0.4, floorMat);
            this.addLocalBox(house, 'kitchenFloor', 3.3, 0.06, 2.3, 4.15, 0.03, -2.9, floorMat);
            this.addLocalBox(house, 'bedroomFloor', 3.5, 0.06, 4.1, -3.5, 0.03, 1.0, floorMat);

            this.addLocalBox(house, 'outerLeft', 0.08, 3.2, 8.9, -5.88, 1.6, 0.12, wallMat);
            this.addLocalBox(house, 'outerRight', 0.08, 3.2, 8.9, 6.62, 1.6, 0.12, wallMat);
            this.addLocalBox(house, 'outerBack', 12.5, 3.2, 0.08, 0.37, 1.6, -4.12, wallMat);
            this.addLocalBox(house, 'frontLeft', 5.3, 3.2, 0.08, -3.6, 1.6, 4.28, wallMat);
            this.addLocalBox(house, 'frontRight', 5.3, 3.2, 0.08, 3.96, 1.6, 4.28, wallMat);
            this.addLocalBox(house, 'frontDoorHeader', 1.1, 0.95, 0.08, 0.15, 2.73, 4.28, wallMat);

            this.addLocalBox(house, 'studyBackWall', 4.0, 2.8, 0.08, 0, 1.4, -1.98, trimMat);
            this.addLocalBox(house, 'studyLeftWallRear', 0.08, 2.8, 1.54, -2.0, 1.4, -0.22, trimMat);
            this.addLocalBox(house, 'studyLeftWallFront', 0.08, 2.8, 1.34, -2.0, 1.4, 2.36, trimMat);
            this.addLocalBox(house, 'studyRightPassage', 0.08, 2.8, 1.5, 2.08, 1.4, 2.25, trimMat);
            this.addLocalBox(house, 'studyRightRear', 0.08, 2.8, 2.14, 2.08, 1.4, -0.9, trimMat);
            this.addLocalBox(house, 'bedroomDivider', 0.08, 2.8, 4.1, -1.75, 1.4, 1.0, trimMat);
            this.addLocalBox(house, 'kitchenDivider', 2.55, 2.8, 0.08, 4.15, 1.4, -1.55, trimMat);

            this.addWindow(house, -1.32, 1.48, 4.32, 0.92, 0.74, 0, true);
            this.addWindow(house, 1.86, 1.48, 4.32, 0.92, 0.74, 0, true);
            this.addWindow(house, -5.9, 1.4, 0.3, 0.92, 0.72, Math.PI / 2, false);
            this.addWindow(house, 6.64, 1.4, -0.5, 0.92, 0.72, Math.PI / 2, true);
            this.addNumberPlaque(house, cfg.number, 0.18, 2.46, 4.34);

            const roof = this.createGableRoof(12.95, 9.2, 1.72, roofMat);
            roof.position.set(0.37, 3.22, 0.12);
            house.add(roof);
            this.addLocalBox(house, 'chimney', 0.42, 1.55, 0.42, 3.28, 4.0, -1.6, this.makeMaterial(0xcbb6a4, 0.9, 0.01));

            this.addTree(-7.9 + cfg.x, cfg.theta - 0.024, 7001, 0.98);
            this.addTree(8.1 + cfg.x, cfg.theta + 0.024, 7002, 0.98);

            const deskWood = this.makeMaterial(0xcaa983, 0.76, 0.03);
            this.addLocalBox(house, 'deskTop', 2.55, 0.08, 1.26, 0.55, 0.76, 0.82, deskWood);
            [-0.58, 0.58].forEach((dx) => {
                [-0.52, 0.52].forEach((dz) => {
                    this.addLocalBox(house, 'deskLeg', 0.08, 0.72, 0.08, 0.55 + dx, 0.36, 0.82 + dz, deskWood);
                });
            });
            this.addLocalBox(house, 'crtBody', 0.92, 0.84, 0.82, 0.4, 1.22, 0.4, this.makeMaterial(0xe2d8c8, 0.62, 0.03));
            this.addLocalBox(house, 'crtNeck', 0.24, 0.14, 0.24, 0.4, 0.78, 0.28, this.makeMaterial(0xd8ceb8, 0.62, 0.03));
            this.addLocalBox(house, 'crtScreen', 0.56, 0.44, 0.02, 0.4, 1.25, 0.8, this.makeMaterial(0xdad5c6, 0.35, 0.03, {
                emissive: 0xfff4d5,
                emissiveIntensity: 0.15
            }));
            this.addLocalBox(house, 'keyboard', 1.0, 0.07, 0.34, 0.38, 0.82, 1.66, this.makeMaterial(0xf0ece4, 0.86, 0.01));
            this.addLocalBox(house, 'diskettePink', 0.18, 0.02, 0.18, -0.82, 0.82, 1.56, this.makeMaterial(0xbf4e8c, 0.84, 0.01));
            this.addLocalBox(house, 'disketteBlue', 0.18, 0.02, 0.18, -1.22, 0.82, 1.26, this.makeMaterial(0x4b5d7c, 0.84, 0.01));
            this.addLocalBox(house, 'deskNote', 0.34, 0.02, 0.24, -0.26, 0.82, 1.1, this.makeMaterial(0xf7f3e8, 0.96, 0.0));

            this.addLocalBox(house, 'lampBase', 0.16, 0.03, 0.16, -0.58, 0.83, 0.62, this.makeMaterial(0xd8d0d7, 0.55, 0.08));
            this.addLocalBox(house, 'lampStem', 0.03, 0.26, 0.03, -0.58, 0.97, 0.62, this.makeMaterial(0xf4e7f5, 0.42, 0.05));
            const lampShade = new THREE.Mesh(
                new THREE.SphereGeometry(0.22, 18, 12, 0, TAU, 0, Math.PI * 0.55),
                this.makeMaterial(0xe8bfe3, 0.45, 0.04)
            );
            lampShade.rotation.z = Math.PI;
            lampShade.position.set(-0.68, 1.14, 0.62);
            house.add(lampShade);

            this.addLocalBox(house, 'livingSofaSeat', 1.52, 0.32, 0.82, 4.65, 0.26, 2.18, this.makeMaterial(0xd0b2aa, 0.92, 0.01));
            this.addLocalBox(house, 'livingSofaBack', 1.52, 0.6, 0.18, 4.65, 0.56, 1.86, this.makeMaterial(0xd0b2aa, 0.92, 0.01));
            this.addLocalBox(house, 'livingTable', 1.0, 0.1, 0.55, 4.4, 0.27, 1.1, this.makeMaterial(0xa37e62, 0.72, 0.05));
            this.addLocalBox(house, 'bookshelf', 0.46, 1.58, 1.1, 5.78, 0.79, -0.24, this.makeMaterial(0x8c6f53, 0.78, 0.05));

            this.addLocalBox(house, 'kitchenCounterBack', 3.1, 0.92, 0.72, 4.0, 0.46, -3.02, this.makeMaterial(0xe2ddd5, 0.84, 0.02));
            this.addLocalBox(house, 'fridge', 0.74, 1.7, 0.74, 2.4, 0.85, -3.08, this.makeMaterial(0xf2f6f7, 0.45, 0.03));
            this.addLocalBox(house, 'kitchenTable', 0.94, 0.08, 0.94, 3.6, 0.44, -2.15, this.makeMaterial(0xa88464, 0.7, 0.04));
            this.addLocalBox(house, 'stoolA', 0.32, 0.44, 0.32, 3.05, 0.22, -2.08, this.makeMaterial(0xdcbfe0, 0.92, 0.01));
            this.addLocalBox(house, 'stoolB', 0.32, 0.44, 0.32, 4.2, 0.22, -2.72, this.makeMaterial(0xc1d6e6, 0.92, 0.01));

            this.addLocalBox(house, 'bedFrame', 1.56, 0.28, 2.25, -3.64, 0.14, 1.14, this.makeMaterial(0xd0a8b0, 0.88, 0.01));
            this.addLocalBox(house, 'bedMattress', 1.42, 0.22, 2.05, -3.64, 0.38, 1.14, this.makeMaterial(0xf8f6fb, 0.92, 0.01));
            this.addLocalBox(house, 'dresser', 0.85, 0.84, 0.42, -4.48, 0.42, 2.22, this.makeMaterial(0x906d55, 0.76, 0.05));
            this.addLocalBox(house, 'bedroomRug', 1.45, 0.02, 1.0, -3.1, 0.01, 2.1, this.makeMaterial(0xe8ccef, 0.95, 0.01));
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

            const wallMat = this.makeMaterial(wallColor, 0.88, 0.02);
            const trimMat = this.makeMaterial(trimColor, 0.86, 0.02);
            const floorMat = this.makeMaterial(floorColor, 0.96, 0.01);
            const roofMat = new THREE.MeshStandardMaterial({
                color: roofColor,
                roughness: 0.84,
                metalness: 0.02,
                side: THREE.DoubleSide
            });

            this.addLocalBox(house, 'lotPad', width + 4.5, 0.08, depth + 6.6, 0, 0.04, 0, this.makeMaterial(0xa8cd8f, 0.99, 0.0));
            this.addLocalBox(house, 'foundation', width + 0.18, 0.18, depth + 0.18, 0, 0.09, 0, this.makeMaterial(0xd4c5b4, 0.92, 0.01));
            this.addLocalBox(house, 'houseFloor', width - 0.18, 0.06, depth - 0.18, 0, 0.03, 0, floorMat);

            this.addLocalBox(house, 'wallLeft', 0.08, wallHeight, depth, -width * 0.5, wallHeight * 0.5, 0, wallMat);
            this.addLocalBox(house, 'wallRight', 0.08, wallHeight, depth, width * 0.5, wallHeight * 0.5, 0, wallMat);
            this.addLocalBox(house, 'wallBack', width, wallHeight, 0.08, 0, wallHeight * 0.5, -depth * 0.5, wallMat);
            this.addLocalBox(house, 'frontLeft', leftWidth, wallHeight, 0.08, leftCenter, wallHeight * 0.5, frontZ, wallMat);
            this.addLocalBox(house, 'frontRight', rightWidth, wallHeight, 0.08, rightCenter, wallHeight * 0.5, frontZ, wallMat);
            this.addLocalBox(house, 'doorHeader', doorWidth, wallHeight - doorHeight, 0.08, doorOffset, doorHeight + (wallHeight - doorHeight) * 0.5, frontZ, wallMat);

            if (cfg.enterable) {
                const hingeLeft = this.rand01(cfg.seed, 12) > 0.5;
                const pivot = new THREE.Group();
                pivot.position.set(doorOffset + (hingeLeft ? -doorWidth * 0.5 : doorWidth * 0.5), 0, frontZ - 0.03);
                pivot.rotation.y = hingeLeft ? -1.14 : 1.14;
                house.add(pivot);
                this.addLocalBox(pivot, 'frontDoor', doorWidth, doorHeight, 0.06, hingeLeft ? doorWidth * 0.5 : -doorWidth * 0.5, doorHeight * 0.5, 0, this.makeMaterial(doorColor, 0.7, 0.03));
            } else {
                this.addLocalBox(house, 'frontDoorClosed', doorWidth, doorHeight, 0.06, doorOffset, doorHeight * 0.5, frontZ - 0.03, this.makeMaterial(doorColor, 0.7, 0.03));
            }

            this.addLocalBox(house, 'porch', Math.max(1.45, doorWidth + 0.5), 0.08, porchDepth, doorOffset, 0.04, frontZ + porchDepth * 0.5 + 0.02, this.makeMaterial(0xe2d6c5, 0.92, 0.01));
            this.addLocalBox(house, 'walkway', 1.18, 0.05, 3.2, doorOffset, 0.025, frontZ + porchDepth + 1.58, this.makeMaterial(0xe5dfd8, 0.96, 0.01));
            this.addNumberPlaque(house, cfg.number, doorOffset, 2.4, frontZ + 0.08);
            this.addLocalBox(house, 'porchPostA', 0.12, 1.7, 0.12, doorOffset - 0.58, 0.85, frontZ + porchDepth * 0.9, trimMat);
            this.addLocalBox(house, 'porchPostB', 0.12, 1.7, 0.12, doorOffset + 0.58, 0.85, frontZ + porchDepth * 0.9, trimMat);

            this.addWindow(house, -width * 0.27, 1.5, frontZ + 0.04, 0.94, 0.74, 0, this.rand01(cfg.seed, 13) > 0.2);
            this.addWindow(house, width * 0.28, 1.5, frontZ + 0.04, 0.94, 0.74, 0, this.rand01(cfg.seed, 14) > 0.18);
            this.addWindow(house, -width * 0.5 - 0.04, 1.4, -depth * 0.18, 0.9, 0.72, Math.PI / 2, this.rand01(cfg.seed, 15) > 0.2);
            this.addWindow(house, width * 0.5 + 0.04, 1.4, depth * 0.15, 0.9, 0.72, Math.PI / 2, this.rand01(cfg.seed, 16) > 0.2);
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

            if (stories === 2 || this.rand01(cfg.seed, 17) > 0.65) {
                this.addLocalBox(house, 'chimney', 0.36, 1.5, 0.36, width * 0.22, wallHeight + 0.75, -depth * 0.18, this.makeMaterial(0xd1bcab, 0.9, 0.01));
            }

            if (this.rand01(cfg.seed, 18) > 0.55) {
                const wingSide = this.rand01(cfg.seed, 19) > 0.5 ? 1 : -1;
                this.addLocalBox(house, 'garageWing', 2.5, 2.34, 3.4, wingSide * (width * 0.5 + 1.22), 1.17, depth * 0.12, wallMat);
                this.addLocalBox(house, 'garageRoof', 2.82, 0.16, 3.74, wingSide * (width * 0.5 + 1.22), 2.43, depth * 0.12, roofMat);
                this.addLocalBox(house, 'garageDoor', 1.88, 1.72, 0.06, wingSide * (width * 0.5 + 1.22), 0.86, depth * 0.12 + 1.68, this.makeMaterial(0xf0ece8, 0.86, 0.01));
            }

            const layout = Math.floor(this.rand01(cfg.seed, 20) * 6);
            const sofaColor = this.pick([0xd0aa9f, 0xb2c2d3, 0xa2c08c, 0xcda8c0], cfg.seed, 21);
            const rugColor = this.pick([0xe6d4ef, 0xd5e3ef, 0xeedfcf, 0xd7e7d2], cfg.seed, 22);
            const woodColor = this.pick([0xa07c5e, 0x927055, 0xb48e69], cfg.seed, 23);
            const bedColor = this.pick([0xd0a7b1, 0xc3abd6, 0xa9bdd4, 0xe0c0a5], cfg.seed, 24);
            const storageColor = this.pick([0x8f6f54, 0x92765b, 0xa27d61], cfg.seed, 25);

            const rug = this.addLocalBox(house, 'rug', width * 0.32, 0.02, depth * 0.24, 0, 0.01, 0, this.makeMaterial(rugColor, 0.98, 0.0));
            rug.rotation.y = layout % 2 === 0 ? 0 : Math.PI * 0.5;

            switch (layout) {
                case 0:
                    this.addLocalBox(house, 'innerWall', width * 0.42, 2.2, 0.08, -0.08, 1.1, 0.2, trimMat);
                    this.addLocalBox(house, 'sofaSeat', 1.48, 0.3, 0.76, -0.2, 0.18, 0.36, this.makeMaterial(sofaColor, 0.92, 0.01));
                    this.addLocalBox(house, 'sofaBack', 1.48, 0.56, 0.18, -0.2, 0.46, 0.06, this.makeMaterial(sofaColor, 0.92, 0.01));
                    this.addLocalBox(house, 'bedBase', 1.5, 0.24, 2.0, 0.24, 0.12, -0.42, this.makeMaterial(bedColor, 0.9, 0.01));
                    break;
                case 1:
                    this.addLocalBox(house, 'innerWall', 0.08, 2.2, depth * 0.42, -0.02, 1.1, -0.04, trimMat);
                    this.addLocalBox(house, 'sofaSeat', 1.48, 0.3, 0.76, 0.28, 0.18, 0.12, this.makeMaterial(sofaColor, 0.92, 0.01)).rotation.y = Math.PI * 0.5;
                    this.addLocalBox(house, 'bedBase', 1.5, 0.24, 2.0, -0.24, 0.12, -0.18, this.makeMaterial(bedColor, 0.9, 0.01)).rotation.y = Math.PI * 0.5;
                    break;
                case 2:
                    this.addLocalBox(house, 'innerWallA', width * 0.32, 2.2, 0.08, 0.12, 1.1, -0.18, trimMat);
                    this.addLocalBox(house, 'innerWallB', 0.08, 2.2, depth * 0.24, -0.28, 1.1, 0.14, trimMat);
                    this.addLocalBox(house, 'sofaSeat', 1.48, 0.3, 0.76, 0.22, 0.18, -0.34, this.makeMaterial(sofaColor, 0.92, 0.01)).rotation.y = Math.PI;
                    this.addLocalBox(house, 'bedBase', 1.5, 0.24, 2.0, -0.26, 0.12, 0.2, this.makeMaterial(bedColor, 0.9, 0.01));
                    break;
                case 3:
                    this.addLocalBox(house, 'innerWall', width * 0.34, 2.2, 0.08, 0.18, 1.1, 0.18, trimMat);
                    this.addLocalBox(house, 'sofaSeat', 1.48, 0.3, 0.76, -0.2, 0.18, 0.06, this.makeMaterial(sofaColor, 0.92, 0.01)).rotation.y = -Math.PI * 0.5;
                    this.addLocalBox(house, 'bedBase', 1.5, 0.24, 2.0, 0.26, 0.12, -0.28, this.makeMaterial(bedColor, 0.9, 0.01));
                    break;
                case 4:
                    this.addLocalBox(house, 'innerWall', 0.08, 2.2, depth * 0.34, 0.2, 1.1, 0.02, trimMat);
                    this.addLocalBox(house, 'sofaSeat', 1.48, 0.3, 0.76, -0.26, 0.18, -0.22, this.makeMaterial(sofaColor, 0.92, 0.01)).rotation.y = Math.PI;
                    this.addLocalBox(house, 'bedBase', 1.5, 0.24, 2.0, 0.22, 0.12, 0.18, this.makeMaterial(bedColor, 0.9, 0.01)).rotation.y = Math.PI * 0.5;
                    break;
                default:
                    this.addLocalBox(house, 'innerWall', width * 0.24, 2.2, 0.08, -0.2, 1.1, 0.08, trimMat);
                    this.addLocalBox(house, 'sofaSeat', 1.48, 0.3, 0.76, 0.22, 0.18, 0.22, this.makeMaterial(sofaColor, 0.92, 0.01));
                    this.addLocalBox(house, 'bedBase', 1.5, 0.24, 2.0, -0.22, 0.12, -0.28, this.makeMaterial(bedColor, 0.9, 0.01)).rotation.y = Math.PI * 0.5;
                    break;
            }

            this.addLocalBox(house, 'mattress', 1.36, 0.18, 1.84, layout % 2 === 0 ? 0.24 : -0.24, 0.34, layout % 2 === 0 ? -0.42 : -0.18, this.makeMaterial(0xf8f5fb, 0.95, 0.01));
            this.addLocalBox(house, 'diningTable', 0.94, 0.08, 0.94, 0.02, 0.42, depth * 0.26, this.makeMaterial(woodColor, 0.72, 0.03));
            this.addLocalBox(house, 'diningSeatA', 0.28, 0.42, 0.28, -0.48, 0.21, depth * 0.26, this.makeMaterial(0xe1c3dc, 0.92, 0.01));
            this.addLocalBox(house, 'diningSeatB', 0.28, 0.42, 0.28, 0.48, 0.21, depth * 0.26, this.makeMaterial(0xc7d8e7, 0.92, 0.01));
            this.addLocalBox(house, 'storage', 0.72, 0.92, 0.34, width * 0.34, 0.46, -depth * 0.28, this.makeMaterial(storageColor, 0.76, 0.03));
            this.addLocalBox(house, 'books', 0.54, 0.14, 0.2, width * 0.34, 0.78, -depth * 0.33, this.makeMaterial(0xbecce0, 0.84, 0.01));
            this.addLocalBox(house, 'accentTable', 0.42, 0.08, 0.42, -width * 0.36, 0.24, depth * 0.28, this.makeMaterial(woodColor, 0.75, 0.03));
            this.addLocalBox(house, 'accentLampBase', 0.1, 0.02, 0.1, -width * 0.3, 0.29, depth * 0.26, this.makeMaterial(0xdfd7d0, 0.62, 0.03));
            this.addLocalBox(house, 'accentLampShade', 0.18, 0.16, 0.18, -width * 0.3, 0.4, depth * 0.26, this.makeMaterial(0xf0d8d1, 0.82, 0.02));
            this.addDeadCRTStation(house, cfg.seed, width * 0.22, -depth * 0.04);

            this.addLocalBox(house, 'mailboxPost', 0.07, 0.58, 0.07, doorOffset - 0.95, 0.29, frontZ + porchDepth + 0.95, this.makeMaterial(0x6f5a46, 0.75, 0.02));
            this.addLocalBox(house, 'mailboxBody', 0.24, 0.18, 0.28, doorOffset - 0.95, 0.57, frontZ + porchDepth + 0.95, this.makeMaterial(trimColor, 0.7, 0.03));

            this.addShrub(cfg.x - width * 0.24, cfg.theta + (cfg.yaw === 0 ? 1 : -1) * 0.012, cfg.seed + 50, 0.32);
            this.addShrub(cfg.x + width * 0.28, cfg.theta + (cfg.yaw === 0 ? 1 : -1) * 0.02, cfg.seed + 60, 0.28);
        }
    }

    class CylinderFPSControls {
        constructor(camera, domElement, world) {
            this.camera = camera;
            this.domElement = domElement;
            this.world = world;
            this.radius = world.radius;
            this.maxX = world.maxWalkX;
            this.eyeHeight = 1.08;
            this.speed = 6.4;
            this.lookSpeed = 0.0021;
            this.pitchMin = -Math.PI * 0.5 + 0.05;
            this.pitchMax = Math.PI * 0.5 - 0.05;
            this.yaw = world.spawn.yaw;
            this.pitch = world.spawn.pitch;
            this.surfaceX = world.spawn.x;
            this.surfaceArc = world.spawn.theta * this.radius;
            this.isLocked = false;
            this.move = {
                forward: false,
                backward: false,
                left: false,
                right: false
            };

            this.forward = new THREE.Vector3();
            this.right = new THREE.Vector3();
            this.up = new THREE.Vector3();
            this.thetaDir = new THREE.Vector3();

            this.syncCamera();
            this.setupEvents();
        }

        setupEvents() {
            document.addEventListener('pointerlockchange', () => {
                this.isLocked = document.pointerLockElement === this.domElement;
                document.body.classList.toggle('locked', this.isLocked);
                hint.textContent = this.isLocked
                    ? 'Walking the cylinder. WASD move, mouse look, Esc releases the cursor.'
                    : 'Click to enter. WASD move, mouse look, Esc releases the cursor.';
            });

            this.domElement.addEventListener('click', () => {
                if (!this.isLocked) {
                    this.domElement.requestPointerLock();
                }
            });

            document.addEventListener('mousemove', (event) => {
                if (!this.isLocked) return;
                this.yaw -= event.movementX * this.lookSpeed;
                this.pitch = clamp(this.pitch - event.movementY * this.lookSpeed, this.pitchMin, this.pitchMax);
                this.applyRotation();
            });

            document.addEventListener('keydown', (event) => this.onKey(event, true));
            document.addEventListener('keyup', (event) => this.onKey(event, false));
        }

        onKey(event, pressed) {
            switch (event.code) {
                case 'KeyW':
                case 'ArrowUp':
                    this.move.forward = pressed;
                    break;
                case 'KeyS':
                case 'ArrowDown':
                    this.move.backward = pressed;
                    break;
                case 'KeyA':
                case 'ArrowLeft':
                    this.move.left = pressed;
                    break;
                case 'KeyD':
                case 'ArrowRight':
                    this.move.right = pressed;
                    break;
                default:
                    return;
            }
            event.preventDefault();
        }

        theta() {
            return this.surfaceArc / this.radius;
        }

        applyRotation() {
            const theta = this.theta();
            const rightBase = new THREE.Vector3(1, 0, 0);
            const upBase = new THREE.Vector3(0, Math.cos(theta), -Math.sin(theta)).normalize();
            const forwardBase = new THREE.Vector3(0, Math.sin(theta), Math.cos(theta)).normalize();
            const basis = new THREE.Matrix4().makeBasis(rightBase, upBase, forwardBase);
            const baseQuat = new THREE.Quaternion().setFromRotationMatrix(basis);
            const localQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
            this.camera.quaternion.copy(baseQuat).multiply(localQuat);
            this.camera.up.copy(upBase);
        }

        syncCamera() {
            const theta = this.theta();
            const radius = this.radius - this.eyeHeight;
            this.camera.position.set(
                this.surfaceX,
                -Math.cos(theta) * radius,
                Math.sin(theta) * radius
            );
            this.applyRotation();
        }

        wrapArc() {
            const circumference = TAU * this.radius;
            this.surfaceArc = THREE.MathUtils.euclideanModulo(this.surfaceArc, circumference);
        }

        update(delta) {
            this.syncCamera();

            if (!this.isLocked) return;

            const inputX = (this.move.right ? 1 : 0) - (this.move.left ? 1 : 0);
            const inputZ = (this.move.forward ? 1 : 0) - (this.move.backward ? 1 : 0);
            if (!inputX && !inputZ) return;

            const theta = this.theta();
            this.up.set(0, Math.cos(theta), -Math.sin(theta)).normalize();
            this.thetaDir.set(0, Math.sin(theta), Math.cos(theta)).normalize();

            this.camera.getWorldDirection(this.forward);
            this.forward.projectOnPlane(this.up).normalize();
            if (this.forward.lengthSq() < 1e-6) {
                this.forward.copy(this.thetaDir);
            }

            this.right.crossVectors(this.up, this.forward).normalize();

            const moveVec = new THREE.Vector3()
                .addScaledVector(this.right, inputX)
                .addScaledVector(this.forward, inputZ)
                .normalize()
                .multiplyScalar(this.speed * delta);

            this.surfaceX = clamp(this.surfaceX + moveVec.x, -this.maxX, this.maxX);
            this.surfaceArc += moveVec.dot(this.thetaDir);
            this.wrapArc();
        }
    }

    const world = new OneillWorld(scene);
    const controls = new CylinderFPSControls(camera, renderer.domElement, world);

    const clock = new THREE.Clock();

    function onResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    window.addEventListener('resize', onResize);

    function animate() {
        requestAnimationFrame(animate);
        const delta = Math.min(clock.getDelta(), 0.05);
        controls.update(delta);
        renderer.render(scene, camera);
    }

    animate();
}());
