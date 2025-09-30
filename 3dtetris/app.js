// 3D Tetris Game - Fixed Game Over Logic
class Game3D {
    constructor() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }
    
    init() {
        // Check if Three.js is available
        if (typeof THREE === 'undefined') {
            console.error('Three.js not loaded');
            return;
        }
        
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        
        // Game state
        this.gameRunning = false;
        this.gamePaused = false;
        this.gameBoard = [];
        this.currentPiece = null;
        this.nextPiece = null;
        this.ghostPiece = null;
        
        // Game settings
        this.BOARD_WIDTH = 10;
        this.BOARD_HEIGHT = 20;
        this.BOARD_DEPTH = 10;
        this.BLOCK_SIZE = 0.8;
        this.FALL_SPEED = 1000; // milliseconds
        this.SPAWN_Y = this.BOARD_HEIGHT - 4; // Spawn area at top
        this.DANGER_HEIGHT = this.BOARD_HEIGHT - 6; // Warning zone
        
        // Game stats
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.startTime = Date.now();
        this.lastFall = Date.now();
        this.maxStackHeight = 0;
        
        // Tetromino definitions (3D coordinates)
        this.tetrominoes = [
            { // I-piece
                blocks: [[0,0,0], [1,0,0], [2,0,0], [3,0,0]],
                color: 0x00ffff
            },
            { // O-piece
                blocks: [[0,0,0], [1,0,0], [0,1,0], [1,1,0]],
                color: 0xffff00
            },
            { // T-piece
                blocks: [[1,0,0], [0,1,0], [1,1,0], [2,1,0]],
                color: 0x800080
            },
            { // S-piece
                blocks: [[1,0,0], [2,0,0], [0,1,0], [1,1,0]],
                color: 0x00ff00
            },
            { // Z-piece
                blocks: [[0,0,0], [1,0,0], [1,1,0], [2,1,0]],
                color: 0xff0000
            },
            { // J-piece
                blocks: [[0,0,0], [0,1,0], [1,1,0], [2,1,0]],
                color: 0x0000ff
            },
            { // L-piece
                blocks: [[2,0,0], [0,1,0], [1,1,0], [2,1,0]],
                color: 0xffa500
            }
        ];
        
        this.setupGame();
    }
    
    setupGame() {
        try {
            this.initThreeJS();
            this.initGameBoard();
            this.initControls();
            this.initNextPieceCanvas();
            this.spawnNewPiece();
            this.startGame();
            this.animate();
        } catch (error) {
            console.error('Game setup failed:', error);
            this.showError('Failed to initialize 3D Tetris. Please refresh the page.');
        }
    }
    
    showError(message) {
        // Create error overlay
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(40, 0, 0, 0.95);
            border: 2px solid #ff4444;
            border-radius: 10px;
            padding: 20px;
            color: #ff4444;
            font-family: 'Courier New', monospace;
            text-align: center;
            z-index: 300;
        `;
        errorDiv.innerHTML = `
            <h3>ERROR</h3>
            <p>${message}</p>
            <button onclick="location.reload()" style="margin-top: 10px; padding: 8px 16px; background: #ff4444; color: white; border: none; border-radius: 5px; cursor: pointer;">REFRESH</button>
        `;
        document.body.appendChild(errorDiv);
    }
    
    initThreeJS() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x000011, 10, 50);
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(15, 25, 15);
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000011, 0.8);
        
        const container = document.getElementById('scene-container');
        if (!container) {
            throw new Error('Scene container not found');
        }
        container.appendChild(this.renderer.domElement);
        
        // Try to enable shadows
        try {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        } catch (e) {
            console.warn('Shadows not supported');
        }
        
        // Controls - Use fallback if OrbitControls not available
        try {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.target.set(this.BOARD_WIDTH/2, this.BOARD_HEIGHT/2, this.BOARD_DEPTH/2);
        } catch (e) {
            console.warn('OrbitControls not available, using basic camera');
            // Simple fallback camera positioning
            this.camera.lookAt(this.BOARD_WIDTH/2, this.BOARD_HEIGHT/2, this.BOARD_DEPTH/2);
        }
        
        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(20, 30, 20);
        try {
            directionalLight.castShadow = true;
            directionalLight.shadow.mapSize.width = 2048;
            directionalLight.shadow.mapSize.height = 2048;
        } catch (e) {
            console.warn('Shadow casting not supported');
        }
        this.scene.add(directionalLight);
        
        // Add some atmospheric lights
        const coloredLights = [
            { color: 0x00ffff, position: [-10, 10, 10] },
            { color: 0xff00ff, position: [25, 15, -5] },
            { color: 0xffff00, position: [15, 5, 25] }
        ];
        
        coloredLights.forEach(light => {
            const pointLight = new THREE.PointLight(light.color, 0.3, 30);
            pointLight.position.set(...light.position);
            this.scene.add(pointLight);
        });
        
        // Create game board wireframe
        this.createBoardWireframe();
        
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    createBoardWireframe() {
        const geometry = new THREE.BoxGeometry(this.BOARD_WIDTH, this.BOARD_HEIGHT, this.BOARD_DEPTH);
        const edges = new THREE.EdgesGeometry(geometry);
        const material = new THREE.LineBasicMaterial({ 
            color: 0x00ff88, 
            transparent: true, 
            opacity: 0.3 
        });
        const wireframe = new THREE.LineSegments(edges, material);
        wireframe.position.set(this.BOARD_WIDTH/2, this.BOARD_HEIGHT/2, this.BOARD_DEPTH/2);
        this.scene.add(wireframe);
        
        // Add danger zone indicator at top
        this.createDangerZone();
        
        // Add grid lines
        this.createGridLines();
    }
    
    createDangerZone() {
        // Create danger zone wireframe at top of board
        const dangerGeometry = new THREE.BoxGeometry(this.BOARD_WIDTH, 4, this.BOARD_DEPTH);
        const dangerEdges = new THREE.EdgesGeometry(dangerGeometry);
        const dangerMaterial = new THREE.LineBasicMaterial({ 
            color: 0xff4444, 
            transparent: true, 
            opacity: 0.5 
        });
        const dangerWireframe = new THREE.LineSegments(dangerEdges, dangerMaterial);
        dangerWireframe.position.set(this.BOARD_WIDTH/2, this.BOARD_HEIGHT - 2, this.BOARD_DEPTH/2);
        this.scene.add(dangerWireframe);
    }
    
    createGridLines() {
        const gridMaterial = new THREE.LineBasicMaterial({ 
            color: 0x004444, 
            transparent: true, 
            opacity: 0.2 
        });
        
        // Horizontal grid lines
        for (let y = 0; y <= this.BOARD_HEIGHT; y++) {
            const geometry = new THREE.BufferGeometry();
            const vertices = new Float32Array([
                0, y, 0,
                this.BOARD_WIDTH, y, 0,
                this.BOARD_WIDTH, y, this.BOARD_DEPTH,
                0, y, this.BOARD_DEPTH,
                0, y, 0
            ]);
            geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            const line = new THREE.Line(geometry, gridMaterial);
            this.scene.add(line);
        }
    }
    
    initGameBoard() {
        // Initialize 3D array for game board
        this.gameBoard = [];
        for (let x = 0; x < this.BOARD_WIDTH; x++) {
            this.gameBoard[x] = [];
            for (let y = 0; y < this.BOARD_HEIGHT; y++) {
                this.gameBoard[x][y] = [];
                for (let z = 0; z < this.BOARD_DEPTH; z++) {
                    this.gameBoard[x][y][z] = null;
                }
            }
        }
    }
    
    initControls() {
        // Button controls
        this.safeAddEventListener('pause-btn', 'click', () => this.togglePause());
        this.safeAddEventListener('drop-btn', 'click', () => this.hardDrop());
        this.safeAddEventListener('reset-btn', 'click', () => this.resetGame());
        this.safeAddEventListener('restart-btn', 'click', () => this.resetGame());
        
        // Movement controls
        this.safeAddEventListener('move-left', 'click', () => this.movePiece(-1, 0, 0));
        this.safeAddEventListener('move-right', 'click', () => this.movePiece(1, 0, 0));
        this.safeAddEventListener('move-forward', 'click', () => this.movePiece(0, 0, -1));
        this.safeAddEventListener('move-back', 'click', () => this.movePiece(0, 0, 1));
        this.safeAddEventListener('move-down', 'click', () => this.movePiece(0, -1, 0));
        
        // Rotation controls
        this.safeAddEventListener('rot-x', 'click', () => this.rotatePiece('x'));
        this.safeAddEventListener('rot-y', 'click', () => this.rotatePiece('y'));
        this.safeAddEventListener('rot-z', 'click', () => this.rotatePiece('z'));
        
        // Camera controls
        this.safeAddEventListener('cam-top', 'click', () => this.setCameraView('top'));
        this.safeAddEventListener('cam-iso', 'click', () => this.setCameraView('iso'));
        this.safeAddEventListener('cam-side', 'click', () => this.setCameraView('side'));
        
        // Keyboard controls
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }
    
    safeAddEventListener(id, event, handler) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(event, handler);
        } else {
            console.warn(`Element ${id} not found`);
        }
    }
    
    initNextPieceCanvas() {
        this.nextCanvas = document.getElementById('next-piece-canvas');
        if (this.nextCanvas) {
            this.nextCtx = this.nextCanvas.getContext('2d');
            this.nextCanvas.width = 150;
            this.nextCanvas.height = 80;
        }
    }
    
    handleKeyboard(event) {
        if (!this.gameRunning || this.gamePaused) return;
        
        switch(event.code) {
            case 'ArrowLeft':
            case 'KeyA':
                this.movePiece(-1, 0, 0);
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.movePiece(1, 0, 0);
                break;
            case 'ArrowUp':
            case 'KeyW':
                this.movePiece(0, 0, -1);
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.movePiece(0, 0, 1);
                break;
            case 'Space':
                event.preventDefault();
                this.hardDrop();
                break;
            case 'KeyQ':
                this.rotatePiece('x');
                break;
            case 'KeyE':
                this.rotatePiece('y');
                break;
            case 'KeyR':
                this.rotatePiece('z');
                break;
            case 'KeyP':
                this.togglePause();
                break;
        }
    }
    
    spawnNewPiece() {
        if (!this.nextPiece) {
            this.nextPiece = this.createRandomPiece();
        }
        
        this.currentPiece = this.nextPiece;
        this.nextPiece = this.createRandomPiece();
        
        // Position at top center of spawn area
        this.currentPiece.position = {
            x: Math.floor(this.BOARD_WIDTH / 2) - 2,
            y: this.SPAWN_Y,
            z: Math.floor(this.BOARD_DEPTH / 2) - 2
        };
        
        // CRITICAL FIX: Check for game over BEFORE adding piece to scene
        // Game over only occurs if spawn position is blocked
        if (this.checkCollision(this.currentPiece)) {
            this.gameOver();
            return;
        }
        
        this.addPieceToScene(this.currentPiece);
        this.updateGhostPiece();
        this.drawNextPiece();
    }
    
    createRandomPiece() {
        const template = this.tetrominoes[Math.floor(Math.random() * this.tetrominoes.length)];
        return {
            blocks: template.blocks.map(block => [...block]),
            color: template.color,
            mesh: null,
            position: { x: 0, y: 0, z: 0 }
        };
    }
    
    addPieceToScene(piece) {
        if (piece.mesh) {
            this.scene.remove(piece.mesh);
        }
        
        const group = new THREE.Group();
        const geometry = new THREE.BoxGeometry(this.BLOCK_SIZE, this.BLOCK_SIZE, this.BLOCK_SIZE);
        const material = new THREE.MeshLambertMaterial({ 
            color: piece.color,
            transparent: true,
            opacity: 0.9
        });
        
        piece.blocks.forEach(block => {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(
                block[0] * this.BLOCK_SIZE,
                block[1] * this.BLOCK_SIZE,
                block[2] * this.BLOCK_SIZE
            );
            
            try {
                mesh.castShadow = true;
            } catch (e) {
                // Shadows not supported
            }
            
            // Add glowing edges
            const edges = new THREE.EdgesGeometry(geometry);
            const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.8, transparent: true });
            const wireframe = new THREE.LineSegments(edges, edgeMaterial);
            mesh.add(wireframe);
            
            group.add(mesh);
        });
        
        group.position.set(
            piece.position.x + 0.5,
            piece.position.y + 0.5,
            piece.position.z + 0.5
        );
        
        piece.mesh = group;
        this.scene.add(group);
    }
    
    updateGhostPiece() {
        if (this.ghostPiece) {
            this.scene.remove(this.ghostPiece);
        }
        
        if (!this.currentPiece) return;
        
        // Create ghost piece at drop position
        const ghostPiece = {
            blocks: this.currentPiece.blocks.map(block => [...block]),
            position: { ...this.currentPiece.position }
        };
        
        // Find drop position
        while (!this.checkCollision(ghostPiece, 0, -1, 0)) {
            ghostPiece.position.y--;
        }
        
        const group = new THREE.Group();
        const geometry = new THREE.BoxGeometry(this.BLOCK_SIZE * 0.9, this.BLOCK_SIZE * 0.9, this.BLOCK_SIZE * 0.9);
        const material = new THREE.MeshBasicMaterial({ 
            color: this.currentPiece.color,
            transparent: true,
            opacity: 0.2,
            wireframe: true
        });
        
        ghostPiece.blocks.forEach(block => {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(
                block[0] * this.BLOCK_SIZE,
                block[1] * this.BLOCK_SIZE,
                block[2] * this.BLOCK_SIZE
            );
            group.add(mesh);
        });
        
        group.position.set(
            ghostPiece.position.x + 0.5,
            ghostPiece.position.y + 0.5,
            ghostPiece.position.z + 0.5
        );
        
        this.ghostPiece = group;
        this.scene.add(group);
    }
    
    drawNextPiece() {
        if (!this.nextCtx || !this.nextPiece) return;
        
        this.nextCtx.clearRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
        
        this.nextCtx.fillStyle = `#${this.nextPiece.color.toString(16).padStart(6, '0')}`;
        
        const scale = 8;
        const offsetX = 40;
        const offsetY = 20;
        
        this.nextPiece.blocks.forEach(block => {
            this.nextCtx.fillRect(
                offsetX + block[0] * scale,
                offsetY + block[1] * scale,
                scale - 1,
                scale - 1
            );
        });
    }
    
    movePiece(dx, dy, dz) {
        if (!this.currentPiece || !this.gameRunning || this.gamePaused) return false;
        
        if (!this.checkCollision(this.currentPiece, dx, dy, dz)) {
            this.currentPiece.position.x += dx;
            this.currentPiece.position.y += dy;
            this.currentPiece.position.z += dz;
            
            this.currentPiece.mesh.position.set(
                this.currentPiece.position.x + 0.5,
                this.currentPiece.position.y + 0.5,
                this.currentPiece.position.z + 0.5
            );
            
            this.updateGhostPiece();
            return true;
        }
        return false;
    }
    
    rotatePiece(axis) {
        if (!this.currentPiece || !this.gameRunning || this.gamePaused) return;
        
        const oldBlocks = this.currentPiece.blocks.map(block => [...block]);
        
        // Rotate blocks around origin
        this.currentPiece.blocks.forEach(block => {
            const [x, y, z] = block;
            switch (axis) {
                case 'x':
                    block[1] = -z;
                    block[2] = y;
                    break;
                case 'y':
                    block[0] = z;
                    block[2] = -x;
                    break;
                case 'z':
                    block[0] = -y;
                    block[1] = x;
                    break;
            }
        });
        
        // Check if rotation is valid
        if (this.checkCollision(this.currentPiece)) {
            // Revert rotation
            this.currentPiece.blocks = oldBlocks;
        } else {
            // Update visual representation
            this.addPieceToScene(this.currentPiece);
            this.updateGhostPiece();
        }
    }
    
    checkCollision(piece, dx = 0, dy = 0, dz = 0) {
        const newX = piece.position.x + dx;
        const newY = piece.position.y + dy;
        const newZ = piece.position.z + dz;
        
        for (const block of piece.blocks) {
            const x = newX + block[0];
            const y = newY + block[1];
            const z = newZ + block[2];
            
            // Check boundaries
            if (x < 0 || x >= this.BOARD_WIDTH || 
                y < 0 || y >= this.BOARD_HEIGHT || 
                z < 0 || z >= this.BOARD_DEPTH) {
                return true;
            }
            
            // Check collision with placed blocks
            if (this.gameBoard[x] && this.gameBoard[x][y] && this.gameBoard[x][y][z]) {
                return true;
            }
        }
        return false;
    }
    
    placePiece() {
        if (!this.currentPiece) 