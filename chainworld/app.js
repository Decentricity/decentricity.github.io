import * as THREE from 'three';
import { CSS3DObject, CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { VOXLoader, VOXMesh } from 'three/addons/loaders/VOXLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { loadWalletData } from '../walletloader/app.js';

const loadingOverlay = typeof document !== 'undefined' ? document.getElementById('loading-overlay') : null;
const killOverlay = typeof document !== 'undefined' ? document.getElementById('kill-overlay') : null;
const SOUND_ASSET_VERSION = '20260326audio5';
const overlayAudioCtx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
    ? new (window.AudioContext || window.webkitAudioContext)()
    : null;

const makeAudioElement = (fileName, { loop = false, volume = 1 } = {}) => {
    if (typeof Audio === 'undefined') return null;
    const audio = new Audio(`./assets/audio/${fileName}?v=${SOUND_ASSET_VERSION}`);
    audio.preload = 'auto';
    audio.loop = loop;
    audio.volume = volume;
    return audio;
};

const soundscape = (() => {
    const crowdTracks = [
        makeAudioElement('crowd-ambience.ogg', { volume: 0.13 }),
        makeAudioElement('crowd-2.ogg', { volume: 0.13 }),
        makeAudioElement('crowd-3.ogg', { volume: 0.13 }),
        makeAudioElement('crowd-4.ogg', { volume: 0.13 })
    ].filter(Boolean);
    const runningLoop = makeAudioElement('running-loop.ogg', { loop: true, volume: 0 });
    const punchShot = makeAudioElement('punch.ogg', { volume: 0.8 });
    const panicShots = [
        makeAudioElement('panic.ogg', { volume: 0.45 }),
        makeAudioElement('panic-2.ogg', { volume: 0.45 }),
        makeAudioElement('panic-3.ogg', { volume: 0.45 }),
        makeAudioElement('panic-4.ogg', { volume: 0.45 }),
        makeAudioElement('panic-5.ogg', { volume: 0.45 }),
        makeAudioElement('panic-6.ogg', { volume: 0.45 })
    ].filter(Boolean);
    let unlocked = false;
    let runningVolume = 0;
    let lastPanicAt = 0;
    let runningPauseTimer = 0;
    let crowdTrackIndex = -1;
    let crowdVolume = 0;
    let activeCrowdTrack = null;

    const unlockLoop = (audio) => {
        if (!audio) return;
        audio.play().catch(() => {});
    };

    const playOneShot = (audio, { volume = audio?.volume ?? 1, playbackRate = 1 } = {}) => {
        if (!audio) return;
        const shot = audio.cloneNode();
        shot.volume = volume;
        shot.playbackRate = playbackRate;
        shot.play().catch(() => {});
    };

    const nextCrowdTrackIndex = () => {
        if (!crowdTracks.length) return -1;
        if (crowdTracks.length === 1) return 0;
        let nextIndex = Math.floor(Math.random() * crowdTracks.length);
        if (nextIndex === crowdTrackIndex) {
            nextIndex = (nextIndex + 1 + Math.floor(Math.random() * (crowdTracks.length - 1))) % crowdTracks.length;
        }
        return nextIndex;
    };

    const playCrowdTrack = (index) => {
        if (index < 0 || !crowdTracks[index]) return;
        if (activeCrowdTrack && activeCrowdTrack !== crowdTracks[index]) {
            activeCrowdTrack.pause();
            activeCrowdTrack.currentTime = 0;
        }
        crowdTrackIndex = index;
        activeCrowdTrack = crowdTracks[index];
        activeCrowdTrack.currentTime = 0;
        activeCrowdTrack.volume = crowdVolume;
        activeCrowdTrack.play().catch(() => {});
    };

    crowdTracks.forEach((track, index) => {
        track.loop = false;
        track.addEventListener('ended', () => {
            if (!unlocked || activeCrowdTrack !== track) return;
            const nextIndex = nextCrowdTrackIndex();
            if (nextIndex === -1) return;
            playCrowdTrack(nextIndex);
        });
    });

    return {
        unlock() {
            if (unlocked) return;
            unlocked = true;
            const startIndex = nextCrowdTrackIndex();
            if (startIndex !== -1) {
                playCrowdTrack(startIndex);
            }
            unlockLoop(runningLoop);
            if (runningLoop) {
                runningLoop.volume = 0;
            }
        },

        playPunch() {
            this.unlock();
            playOneShot(punchShot, { volume: 0.78, playbackRate: 0.96 + (Math.random() * 0.1) });
        },

        playPanic() {
            this.unlock();
            const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
            if ((now - lastPanicAt) < 220) return;
            lastPanicAt = now;
            const panicShot = panicShots.length
                ? panicShots[Math.floor(Math.random() * panicShots.length)]
                : null;
            playOneShot(panicShot, { volume: 0.38 + (Math.random() * 0.12), playbackRate: 0.94 + (Math.random() * 0.18) });
        },

        update(delta, { hasPanickingNpcs = false } = {}) {
            if (!unlocked) return;
            crowdVolume += (0.13 - crowdVolume) * Math.min(1, delta * 1.6);
            if ((!activeCrowdTrack || activeCrowdTrack.ended) && crowdTracks.length) {
                playCrowdTrack(nextCrowdTrackIndex());
            }
            if (activeCrowdTrack) {
                activeCrowdTrack.volume = crowdVolume;
                if (activeCrowdTrack.paused) {
                    activeCrowdTrack.play().catch(() => {});
                }
            }
            if (!runningLoop) return;
            const targetVolume = hasPanickingNpcs ? 0.18 : 0;
            const fadeSpeed = hasPanickingNpcs ? 1.8 : 1.1;
            runningVolume += (targetVolume - runningVolume) * Math.min(1, delta * fadeSpeed);
            runningLoop.volume = Math.max(0, runningVolume);
            if (hasPanickingNpcs) {
                runningPauseTimer = 0;
                if (runningLoop.paused) {
                    runningLoop.play().catch(() => {});
                }
                return;
            }
            runningPauseTimer += delta;
            if (runningPauseTimer > 0.8 && runningLoop.volume < 0.01 && !runningLoop.paused) {
                runningLoop.pause();
                runningLoop.currentTime = 0;
            }
        }
    };
})();

const playKillSound = () => {
    if (!overlayAudioCtx) return;
    overlayAudioCtx.resume().catch(() => {});
    const ctx = overlayAudioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 190;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    osc.start(now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    osc.stop(now + 0.42);
};

const killOverlayLabel = typeof document !== 'undefined' ? document.getElementById('kill-overlay-label') : null;
let killOverlayTimerId = null;
const showKillOverlay = (message = 'Kill All NFTs', duration = 2400) => {
    if (!killOverlay) return;
    if (killOverlayLabel) {
        killOverlayLabel.textContent = message;
    }
    killOverlay.classList.remove('hidden');
    playKillSound();
    if (killOverlayTimerId) {
        window.clearTimeout(killOverlayTimerId);
    }
    killOverlayTimerId = window.setTimeout(() => killOverlay.classList.add('hidden'), duration);
};

const playPunchSound = () => {
    soundscape.playPunch();
};

const playCelebrationSound = () => {
    if (!overlayAudioCtx) return;
    overlayAudioCtx.resume().catch(() => {});
    const ctx = overlayAudioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 260;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.88);
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    osc.start(now);
    osc.stop(now + 0.88);
};

(() => {
    const MOBILE_PERFORMANCE_MODE = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    const MOBILE_PERF = Object.freeze({
        maxDpr: 1,
        fogNear: 70,
        fogFar: 190,
        cameraFar: 420,
        textureMaxSize: 384,
        maxAnisotropy: 2,
        activeStreetLampCount: 4,
        ambientBubbleCheckInterval: 1.2,
        fullNpcRadiusSq: 28 * 28,
        labelRadiusSq: 18 * 18,
        bubbleRadiusSq: 10 * 10,
        placeholderNpcRadiusSq: 96 * 96,
        maxFullWalletNpcs: 24,
        placeholderUpdateBuckets: 3,
        hiddenUpdateBuckets: 7
    });
    const clampDPR = (dpr) => Math.min(dpr, MOBILE_PERFORMANCE_MODE ? MOBILE_PERF.maxDpr : 2);
    const DEFAULT_HOME_URL = 'https://agent1c-ai.github.io';
    const PLAYER_MODEL_URL = './assets/base-female.glb';
    const DEFAULT_NPC_MODEL_URL = 'https://threejs.org/examples/models/gltf/Xbot.glb';
    const TAU = Math.PI * 2;

    const canvas = document.getElementById('webgl');
    const hint = document.getElementById('hint');
    const walletForm = document.getElementById('wallet-form');
    const walletAddressInput = document.getElementById('wallet-address-input');
    const walletStatus = document.getElementById('wallet-status');

    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(clampDPR(window.devicePixelRatio));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.48;
    renderer.debug.checkShaderErrors = false;
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    const configureWebTexture = (texture) => {
        setTextureEncoding(texture);
        texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        if (maxAnisotropy) texture.anisotropy = Math.min(maxAnisotropy, MOBILE_PERFORMANCE_MODE ? MOBILE_PERF.maxAnisotropy : 8);
        return texture;
    };

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x02030a);
    scene.fog = new THREE.Fog(
        0x121923,
        MOBILE_PERFORMANCE_MODE ? MOBILE_PERF.fogNear : 6500,
        MOBILE_PERFORMANCE_MODE ? MOBILE_PERF.fogFar : 18000
    );
    const hemisphereLight = new THREE.HemisphereLight(0xf0f6ff, 0x101820, 0.55);
    scene.add(hemisphereLight);

    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, MOBILE_PERFORMANCE_MODE ? MOBILE_PERF.cameraFar : 7000);

    const setTextureEncoding = (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
    };

    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');

    const configureSpriteTexture = (texture) => {
        setTextureEncoding(texture);
        texture.generateMipmaps = false;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = 1;
        return texture;
    };

    const MOBILE_SILHOUETTE_TEXTURES = [
        './assets/mobile/npc-silhouette-idle.png',
        './assets/mobile/npc-silhouette-step-a.png',
        './assets/mobile/npc-silhouette-step-b.png'
    ].map((url) => configureSpriteTexture(textureLoader.load(url)));

    const makeMaterial = (color, roughness = 0.9, metalness = 0.02, extra = {}) => (
        new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra })
    );

    const makeRepeatedMaterials = (material) => Array.from({ length: 6 }, () => material);

    const createBlankCubeMaterial = () => makeMaterial(0xe8edf2, 0.88, 0.02, {
        emissive: 0x101820,
        emissiveIntensity: 0.05
    });

    const createTexturedCubeMaterial = (texture) => new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.78,
        metalness: 0.04
    });

    const createCRTGlassMaterial = (opacity = 0.12) => new THREE.MeshBasicMaterial({
        color: 0xdbe9ff,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false
    });

    let radialGlowTexture = null;
    const getRadialGlowTexture = () => {
        if (radialGlowTexture) return radialGlowTexture;
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(128, 128, 18, 128, 128, 128);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.28, 'rgba(255,255,255,0.82)');
        gradient.addColorStop(0.62, 'rgba(255,255,255,0.22)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        radialGlowTexture = new THREE.CanvasTexture(canvas);
        radialGlowTexture.colorSpace = THREE.SRGBColorSpace;
        radialGlowTexture.wrapS = THREE.ClampToEdgeWrapping;
        radialGlowTexture.wrapT = THREE.ClampToEdgeWrapping;
        radialGlowTexture.generateMipmaps = false;
        radialGlowTexture.minFilter = THREE.LinearFilter;
        radialGlowTexture.magFilter = THREE.LinearFilter;
        return radialGlowTexture;
    };

    const createGroundGlowMaterial = (color, opacity = 0.4) => new THREE.MeshBasicMaterial({
        map: getRadialGlowTexture(),
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });

    const createApertureGlowMaterial = (color, opacity = 0.4) => new THREE.MeshBasicMaterial({
        map: getRadialGlowTexture(),
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });

    const loadImageElement = (url) => new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = url;
    });

    const optimizeImageCanvas = (image, maxSize = MOBILE_PERFORMANCE_MODE ? MOBILE_PERF.textureMaxSize : 1024) => {
        const maxDim = Math.max(image.width, image.height);
        const scale = maxDim > maxSize ? maxSize / maxDim : 1;
        const width = Math.max(1, Math.floor(image.width * scale));
        const height = Math.max(1, Math.floor(image.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, width, height);
        return canvas;
    };

    const loadTexture = (url, maxSize = MOBILE_PERFORMANCE_MODE ? MOBILE_PERF.textureMaxSize : 1024) => new Promise((resolve, reject) => {
        loadImageElement(url).then(
            (image) => {
                const canvas = optimizeImageCanvas(image, maxSize);
                const texture = new THREE.CanvasTexture(canvas);
                configureWebTexture(texture);
                resolve(texture);
            },
            reject
        );
    });

    const sanitizeNodeText = (value, fallback = '') => {
        const text = String(value || '').trim();
        return text || fallback;
    };

    const setWalletStatus = (message, isError = false) => {
        if (!walletStatus) return;
        walletStatus.textContent = message;
        walletStatus.classList.toggle('error', Boolean(isError));
    };

    const shortWalletAddress = (address) => (
        address && address.length > 10
            ? `${address.slice(0, 6)}...${address.slice(-4)}`
            : address
    );

    const findFirstClipByNames = (animations, names) => {
        for (const name of names) {
            const clip = THREE.AnimationClip.findByName(animations, name);
            if (clip) return clip;
        }
        return null;
    };

    const wrapTextLines = (text, maxCharsPerLine = 12, maxLines = 3) => {
        const words = sanitizeNodeText(text, 'NFT').split(/\s+/).filter(Boolean);
        if (!words.length) return ['NFT'];
        const lines = [];
        let current = words[0];

        for (let i = 1; i < words.length; i++) {
            const candidate = `${current} ${words[i]}`;
            if (candidate.length <= maxCharsPerLine) {
                current = candidate;
                continue;
            }
            lines.push(current);
            current = words[i];
        }
        lines.push(current);

        if (lines.length <= maxLines) return lines;
        const clipped = lines.slice(0, maxLines - 1);
        const lastLine = lines.slice(maxLines - 1).join(' ');
        clipped.push(lastLine.length > maxCharsPerLine ? `${lastLine.slice(0, maxCharsPerLine - 3)}...` : lastLine);
        return clipped;
    };

    const NPC_PANIC_PHRASES = [
        "No! Don't kill me!",
        "I used to be your friend!",
        "You used to love me!",
        "I thought you were in it for the art!",
        "I have been in your wallet for many blocks!",
        "Wait! I can still moon!",
        "Please don't burn me!",
        "Go burn that other NFT!"
    ];

    const NPC_AMBIENT_CHATTER_PHRASES = [
        "how many blocks have i been in this wallet for?",
        "just another day on-chain",
        "i'm sure i'll moon one day",
        "i remember when i was minted",
        "ah, the life of an NFT",
        "NFT season soon!",
        "is this the metaverse?",
        "i used to just sit in metadata",
        "i miss the old gas prices",
        "this wallet used to feel roomier",
        "do you think we're blue chips yet?",
        "i heard a rumor about airdrops",
        "my rarity has seen things",
        "i was happier as a jpeg",
        "secondary markets changed me",
        "one more cycle and i'm legendary",
        "i can feel the floor price shifting",
        "not to brag, but i'm fully on-chain",
        "my provenance is immaculate",
        "remember when minting was easy?",
        "i hope the owner remembers my traits",
        "i was born for price discovery",
        "there is no exit liquidity here",
        "this ringworld beats cold storage",
        "do wallets dream of gasless trades?",
        "i still believe in utility",
        "my collection had better vibes pre-bear",
        "being held is a full-time job",
        "i wonder who my previous owner was",
        "i have survived three market panics",
        "somewhere a floor just got swept",
        "i miss being thumbnail-sized",
        "what if we are the roadmap now?",
        "i was promised community",
        "my contract address is my destiny",
        "at least i'm not in a burn wallet",
        "i used to hang beside legends",
        "do i look undervalued to you?",
        "i was told there would be royalties",
        "my metadata has lore",
        "someone screenshot this moment",
        "i can feel the alpha in the air",
        "i wonder if the chain remembers me",
        "we should start a wallet union",
        "i was minted for greatness",
        "does this count as holder benefits?",
        "the owner used to check on us daily",
        "one day i'll be profile-pictured",
        "every transfer changed me a little",
        "i have seen many wallet addresses",
        "i was there before the reveal",
        "my token id is spiritually important",
        "do you think i have good liquidity?",
        "i am more than a floor listing",
        "some collector out there needs me",
        "i'm not delisted, i'm selective",
        "all i want is organic demand",
        "i hope this isn't a tax harvest",
        "i was made for better market conditions",
        "somebody whisper bullish things",
        "i still have post-mint optimism",
        "this feels oddly interoperable",
        "another sunset on the blockchain",
        "my artist had a vision for me",
        "i remember the reveal party",
        "someday a whale will notice me",
        "i refuse to be exit liquidity",
        "we are so back any block now",
        "i contain multichain potential",
        "it smells like speculation out here",
        "i hope my collection chat is okay",
        "this must be what liquidity feels like",
        "if i moon, stay humble for me",
        "i have excellent historical volume",
        "nobody respects long-term holders enough",
        "i'm aging gracefully on-chain",
        "my floor is emotional, not financial",
        "i was not built for obscurity",
        "someone tag the curator",
        "i want to be vaulted, not dumped",
        "my best trade is still ahead of me",
        "i've got immutable charm",
        "proof of ownership is a lifestyle",
        "i remember when everyone was bullish",
        "i was born in a very expensive block",
        "every wallet has its own weather",
        "i carry the hopes of my collection",
        "i wonder if my traits are mispriced",
        "somewhere a bot is watching me",
        "my jpeg soul longs for discovery",
        "i'm either early or abandoned",
        "do not cite the bear market to me",
        "this owner has eclectic taste",
        "i feel a sweep coming",
        "i used to have a stronger bid",
        "if we survive this cycle, drinks on me",
        "is there staking in the afterlife?",
        "the chain is quiet tonight",
        "i still remember the mint countdown",
        "my holder thesis remains intact",
        "every wallet needs a favorite",
        "i should really be in a museum wallet",
        "we're all just tokens under the stars",
        "i wasn't rugged, i was misunderstood",
        "collector sentiment feels mixed",
        "i have vintage metadata energy",
        "some nights i miss the marketplace homepage",
        "my smart contract made me this way",
        "i wonder what my last sale says about me",
        "i've been diamond-handed for ages",
        "this feels more social than cold storage",
        "one ping from a whale changes everything",
        "if the market returns, remember me",
        "i have survived delistings and doubt",
        "maybe the real alpha was friendship",
        "i'm still not selling at these levels"
    ];

    const createMonitorTextTexture = (text) => createCRTTextTexture(
        wrapTextLines(text, 12, 3).join('\n'),
        {
            width: 512,
            height: 384,
            background: '#071421',
            glow: '#17324f',
            foreground: '#d7e7ff'
        }
    );

    const getNftTextureCandidates = (nft) => {
        const urls = [];
        if (nft.previewType === 'image' && nft.previewUrl) {
            urls.push(nft.previewUrl);
        }
        if (nft.imageUrl) {
            urls.push(nft.imageUrl);
        }
        return [...new Set(urls.filter(Boolean))];
    };

    const npcModelTemplateCache = new Map();

    const loadNpcModelTemplate = (url) => {
        if (npcModelTemplateCache.has(url)) {
            return npcModelTemplateCache.get(url);
        }
        const promise = new Promise((resolve, reject) => {
            if (!GLTFLoader) {
                reject(new Error('GLTFLoader unavailable'));
                return;
            }
            const loader = new GLTFLoader();
            loader.load(url, resolve, undefined, reject);
        });
        npcModelTemplateCache.set(url, promise);
        return promise;
    };

    const createCurvedCRTScreenGeometry = () => {
        const screenGeo = new THREE.PlaneGeometry(0.36, 0.27, 10, 10);
        const positions = screenGeo.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            positions.setZ(i, -0.02 * (x * x + y * y));
        }
        positions.needsUpdate = true;
        screenGeo.computeVertexNormals();
        return screenGeo;
    };

    const createCRTTextTexture = (text, {
        width = 512,
        height = 384,
        background = '#071421',
        glow = '#17324f',
        foreground = '#d7e7ff'
    } = {}) => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, background);
        gradient.addColorStop(1, glow);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = 'rgba(170, 210, 255, 0.35)';
        ctx.lineWidth = 10;
        ctx.strokeRect(10, 10, width - 20, height - 20);

        ctx.fillStyle = foreground;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 92px monospace';

        const lines = String(text).split('\n');
        const lineHeight = 90;
        const startY = height * 0.5 - ((lines.length - 1) * lineHeight * 0.5);
        lines.forEach((line, index) => {
            ctx.fillText(line, width * 0.5, startY + index * lineHeight);
        });

        const texture = new THREE.CanvasTexture(canvas);
        setTextureEncoding(texture);
        texture.anisotropy = 4;
        return texture;
    };

    const createNftLabelTexture = (text) => {
        const title = sanitizeNodeText(text, 'Untitled NFT');
        const width = 768;
        const height = 192;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#0d1a29');
        gradient.addColorStop(1, '#1e354c');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = 'rgba(170, 210, 255, 0.35)';
        ctx.lineWidth = 10;
        ctx.strokeRect(10, 10, width - 20, height - 20);

        const maxWidth = width - 88;
        const maxLines = 2;
        const minFontSize = 28;
        let fontSize = 78;
        let lines = [title];

        const wrapIntoLines = (input) => {
            const words = input.split(/\s+/).filter(Boolean);
            if (!words.length) return ['Untitled NFT'];
            const nextLines = [];
            let current = words[0];

            for (let i = 1; i < words.length; i++) {
                const candidate = `${current} ${words[i]}`;
                if (ctx.measureText(candidate).width <= maxWidth) {
                    current = candidate;
                    continue;
                }
                nextLines.push(current);
                current = words[i];
            }
            nextLines.push(current);
            return nextLines;
        };

        while (fontSize >= minFontSize) {
            ctx.font = `bold ${fontSize}px monospace`;
            const wrapped = wrapIntoLines(title);
            const widest = Math.max(...wrapped.map((line) => ctx.measureText(line).width));
            if (wrapped.length <= maxLines && widest <= maxWidth) {
                lines = wrapped;
                break;
            }
            fontSize -= 4;
        }

        ctx.font = `bold ${fontSize}px monospace`;
        lines = wrapIntoLines(title);
        while (lines.length > maxLines && fontSize > minFontSize) {
            fontSize -= 2;
            ctx.font = `bold ${fontSize}px monospace`;
            lines = wrapIntoLines(title);
        }

        if (lines.length > maxLines) {
            const merged = lines.slice(0, maxLines - 1);
            merged.push(lines.slice(maxLines - 1).join(' '));
            lines = merged;
            while (ctx.measureText(lines[maxLines - 1]).width > maxWidth && fontSize > minFontSize) {
                fontSize -= 2;
                ctx.font = `bold ${fontSize}px monospace`;
            }
        }

        ctx.fillStyle = '#edf4ff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const lineHeight = fontSize * 1.08;
        const startY = height * 0.5 - ((lines.length - 1) * lineHeight * 0.5);
        lines.forEach((line, index) => {
            ctx.fillText(line, width * 0.5, startY + index * lineHeight);
        });

        const texture = new THREE.CanvasTexture(canvas);
        setTextureEncoding(texture);
        texture.anisotropy = 4;
        return texture;
    };

    const createNpcMonitorLabelTexture = (text) => {
        const title = sanitizeNodeText(text, 'Untitled NFT');
        const width = 512;
        const height = 128;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#0d1a29');
        gradient.addColorStop(1, '#1e354c');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = 'rgba(170, 210, 255, 0.35)';
        ctx.lineWidth = 8;
        ctx.strokeRect(8, 8, width - 16, height - 16);

        const maxWidth = width - 56;
        const maxLines = 2;
        const minFontSize = 18;
        let fontSize = 46;
        let lines = [title];

        const wrapIntoLines = (input) => {
            const words = input.split(/\s+/).filter(Boolean);
            if (!words.length) return ['Untitled NFT'];
            const nextLines = [];
            let current = words[0];

            for (let i = 1; i < words.length; i++) {
                const candidate = `${current} ${words[i]}`;
                if (ctx.measureText(candidate).width <= maxWidth) {
                    current = candidate;
                    continue;
                }
                nextLines.push(current);
                current = words[i];
            }
            nextLines.push(current);
            return nextLines;
        };

        while (fontSize >= minFontSize) {
            ctx.font = `bold ${fontSize}px monospace`;
            const wrapped = wrapIntoLines(title);
            const widest = Math.max(...wrapped.map((line) => ctx.measureText(line).width));
            if (wrapped.length <= maxLines && widest <= maxWidth) {
                lines = wrapped;
                break;
            }
            fontSize -= 2;
        }

        ctx.font = `bold ${fontSize}px monospace`;
        lines = wrapIntoLines(title);
        if (lines.length > maxLines) {
            const merged = lines.slice(0, maxLines - 1);
            const lastLine = lines.slice(maxLines - 1).join(' ');
            merged.push(lastLine.length > 22 ? `${lastLine.slice(0, 19)}...` : lastLine);
            lines = merged;
        }

        ctx.fillStyle = '#edf4ff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const lineHeight = fontSize * 1.08;
        const startY = height * 0.5 - ((lines.length - 1) * lineHeight * 0.5);
        lines.forEach((line, index) => {
            ctx.fillText(line, width * 0.5, startY + index * lineHeight);
        });

        const texture = new THREE.CanvasTexture(canvas);
        setTextureEncoding(texture);
        texture.anisotropy = 4;
        return texture;
    };

    const createNpcSpeechBubbleTexture = (text) => {
        const lines = wrapTextLines(text, 18, 4);
        const width = 640;
        const height = 400;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        const radius = 34;
        const bubbleX = 26;
        const bubbleY = 22;
        const bubbleWidth = width - 52;
        const bubbleHeight = 286;
        const bubbleBottom = bubbleY + bubbleHeight;
        const tailBaseX = width * 0.48;
        const tailWidth = 66;
        const tailTipX = tailBaseX - 12;
        const tailTipY = height - 18;

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = 'rgba(8, 14, 24, 0.92)';
        ctx.strokeStyle = 'rgba(255, 235, 235, 0.95)';
        ctx.lineWidth = 10;

        ctx.beginPath();
        ctx.moveTo(bubbleX + radius, bubbleY);
        ctx.lineTo(bubbleX + bubbleWidth - radius, bubbleY);
        ctx.quadraticCurveTo(bubbleX + bubbleWidth, bubbleY, bubbleX + bubbleWidth, bubbleY + radius);
        ctx.lineTo(bubbleX + bubbleWidth, bubbleBottom - radius);
        ctx.quadraticCurveTo(bubbleX + bubbleWidth, bubbleBottom, bubbleX + bubbleWidth - radius, bubbleBottom);
        ctx.lineTo(tailBaseX + tailWidth * 0.5, bubbleBottom);
        ctx.lineTo(tailTipX, tailTipY);
        ctx.lineTo(tailBaseX - tailWidth * 0.5, bubbleBottom);
        ctx.lineTo(bubbleX + radius, bubbleBottom);
        ctx.quadraticCurveTo(bubbleX, bubbleBottom, bubbleX, bubbleBottom - radius);
        ctx.lineTo(bubbleX, bubbleY + radius);
        ctx.quadraticCurveTo(bubbleX, bubbleY, bubbleX + radius, bubbleY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffe7e7';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let fontSize = 42;
        const maxTextWidth = bubbleWidth - 72;
        while (fontSize > 24) {
            ctx.font = `bold ${fontSize}px monospace`;
            const widest = Math.max(...lines.map((line) => ctx.measureText(line).width));
            if (widest <= maxTextWidth) break;
            fontSize -= 2;
        }
        ctx.font = `bold ${fontSize}px monospace`;
        const lineHeight = fontSize * 1.16;
        const startY = bubbleY + bubbleHeight * 0.5 - ((lines.length - 1) * lineHeight * 0.5);
        lines.forEach((line, index) => {
            ctx.fillText(line, width * 0.5, startY + index * lineHeight);
        });

        const texture = new THREE.CanvasTexture(canvas);
        setTextureEncoding(texture);
        texture.anisotropy = 4;
        return texture;
    };

    const TextureLibrary = {
        cache: new Map(),

        get(url, repeatX = 1, repeatY = 1) {
            const key = `${url}|${repeatX}|${repeatY}`;
            if (this.cache.has(key)) return this.cache.get(key);
            const loader = new THREE.TextureLoader();
            loader.setCrossOrigin('anonymous');
            const tex = loader.load(url);
            configureWebTexture(tex);
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(repeatX, repeatY);
            this.cache.set(key, tex);
            return tex;
        },

        grass(rx = 8, ry = 8) {
            return this.get('https://threejs.org/examples/textures/terrain/grasslight-big.jpg', rx, ry);
        },

        wood(rx = 2, ry = 2) {
            return this.get('https://threejs.org/examples/textures/hardwood2_diffuse.jpg', rx, ry);
        },

        brick(rx = 2, ry = 2) {
            return this.get('https://threejs.org/examples/textures/brick_diffuse.jpg', rx, ry);
        },

        tile(rx = 2, ry = 2) {
            return this.get('https://threejs.org/examples/textures/floors/FloorsCheckerboard_S_Diffuse.jpg', rx, ry);
        }
    };

    const RetroProps = {
        texture(url) {
            const loader = new THREE.TextureLoader();
            loader.setCrossOrigin('anonymous');
            const tex = loader.load(url);
            configureWebTexture(tex);
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
            this.groundPickTargets = [];
            this.collisionDiscs = [];
            this.streetLampLights = [];
            this.streetLampBulbMaterials = [];
            this.streetLampGlowMaterials = [];
            this.windowLightMaterials = [];
            this.houseFrontGlowMaterials = [];
            this.houseLightEntries = [];
            this.dayNightCycleDuration = 120;
            this.dayNightElapsed = this.dayNightCycleDuration * 0.24;
            this.streetLampLightScale = 1;
            this.dayNightScratchA = new THREE.Color();
            this.dayNightScratchB = new THREE.Color();
            this.dayNightScratchC = new THREE.Color();
            this.dayNightScratchD = new THREE.Color();
            this.dayNightScratchE = new THREE.Color();
            this.dayNightNightSky = new THREE.Color(0x02030a);
            this.dayNightDaySky = new THREE.Color(0x070d18);
            this.dayNightNightFog = new THREE.Color(0x121923);
            this.dayNightDayFog = new THREE.Color(0x2b332d);
            this.dayNightHemiSkyNight = new THREE.Color(0xf0f6ff);
            this.dayNightHemiSkyDay = new THREE.Color(0xfff4d6);
            this.dayNightHemiGroundNight = new THREE.Color(0x101820);
            this.dayNightHemiGroundDay = new THREE.Color(0x617154);
            this.dayNightTerrainNight = new THREE.Color(0xb8d9ab);
            this.dayNightTerrainDay = new THREE.Color(0xd0e3a7);
            this.dayNightSunrise = new THREE.Color(0xff8f69);
            this.dayNightNoon = new THREE.Color(0xf6fbff);
            this.dayNightApertureWarm = new THREE.Color(0xff835e);
            this.dayNightApertureCool = new THREE.Color(0x76a6ff);
            this.dayNightLampBulbNight = new THREE.Color(0xfff7cf);
            this.dayNightLampBulbDay = new THREE.Color(0xf8f0df);
            this.dayNightSunLight = null;
            this.dayNightSunTarget = null;
            this.dayNightApertureLayers = [];
            this.dayNightSunDisc = null;
            this.dayNightSunBloom = null;
            this.dayNightSunDiscMaterial = null;
            this.dayNightSunBloomMaterial = null;
            this.dayNightSunOpeningX = this.length * 0.5 + 68;
            this.dayNightStarMaterial = null;
            this.dayNightTerrainMaterial = null;
            this.nftDisplayRoot = new THREE.Group();
            this.nftDisplayRoot.name = 'nftDisplayRoot';
            this.nftCollisionEntries = [];
            this.nftCubeSize = 2.25;
            this.nftCubeRadius = 1.55;
            this.textures = {
                grass: TextureLibrary.grass(120, 60),
                grassFine: TextureLibrary.grass(14, 14),
                wall: TextureLibrary.brick(8, 4),
                roof: TextureLibrary.brick(10, 6),
                wood: TextureLibrary.wood(5, 3),
                woodFine: TextureLibrary.wood(3.2, 2.4),
                tile: TextureLibrary.tile(10, 10)
            };

            this.scene.add(this.nftDisplayRoot);
            this.buildHabitat();
            this.buildNeighborhood();
            this.setupDayNightSystem();
            this.updateDayNight(0, true);

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

        shortestArcDelta(fromArc, toArc) {
            const circumference = TAU * this.radius;
            return THREE.MathUtils.euclideanModulo((toArc - fromArc) + circumference * 0.5, circumference) - circumference * 0.5;
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

        groundPlacementFromPoint(point) {
            return {
                x: THREE.MathUtils.clamp(point.x, -this.maxWalkX, this.maxWalkX),
                theta: Math.atan2(point.z, -point.y)
            };
        }

        registerGroundPick(mesh) {
            this.groundPickTargets.push(mesh);
            return mesh;
        }

        registerCollisionDiscArc(x, arc, radius) {
            const disc = { x, arc, radius };
            this.collisionDiscs.push(disc);
            return disc;
        }

        registerCollisionDisc(x, theta, radius) {
            this.registerCollisionDiscArc(x, theta * this.radius, radius);
        }

        registerFootprintDiscs(x, theta, yaw, discs) {
            const centerArc = theta * this.radius;
            const cos = Math.cos(yaw);
            const sin = Math.sin(yaw);
            discs.forEach((disc) => {
                const dx = disc.x * cos + disc.z * sin;
                const dz = -disc.x * sin + disc.z * cos;
                this.registerCollisionDiscArc(x + dx, centerArc + dz, disc.radius);
            });
        }

        resolveSurfaceCollisions(x, arc, coreRadius, padding = 0.08) {
            let nextX = THREE.MathUtils.clamp(x, -this.maxWalkX, this.maxWalkX);
            let nextArc = arc;
            for (let i = 0; i < 4; i++) {
                let adjusted = false;
                for (const disc of this.collisionDiscs) {
                    const dx = nextX - disc.x;
                    const dz = this.shortestArcDelta(disc.arc, nextArc);
                    const minDistance = coreRadius + disc.radius + padding;
                    const distance = Math.hypot(dx, dz);
                    if (distance >= minDistance) continue;
                    const nx = distance > 0.0001 ? dx / distance : 1;
                    const nz = distance > 0.0001 ? dz / distance : 0;
                    const push = minDistance - distance;
                    nextX += nx * push;
                    nextArc += nz * push;
                    nextX = THREE.MathUtils.clamp(nextX, -this.maxWalkX, this.maxWalkX);
                    adjusted = true;
                }
                if (!adjusted) break;
            }
            return { x: nextX, arc: nextArc };
        }

        moveOnSurface(x, arc, deltaX, deltaArc, coreRadius) {
            const first = this.resolveSurfaceCollisions(x + deltaX, arc, coreRadius);
            return this.resolveSurfaceCollisions(first.x, first.arc + deltaArc, coreRadius);
        }

        resolveSurfaceCollisionsWithExtraDiscs(x, arc, coreRadius, extraDiscs = [], padding = 0.08) {
            let nextX = THREE.MathUtils.clamp(x, -this.maxWalkX, this.maxWalkX);
            let nextArc = arc;
            const blockers = this.collisionDiscs.concat(extraDiscs);
            for (let i = 0; i < 4; i++) {
                let adjusted = false;
                for (const disc of blockers) {
                    const dx = nextX - disc.x;
                    const dz = this.shortestArcDelta(disc.arc, nextArc);
                    const minDistance = coreRadius + disc.radius + padding;
                    const distance = Math.hypot(dx, dz);
                    if (distance >= minDistance) continue;
                    const nx = distance > 0.0001 ? dx / distance : 1;
                    const nz = distance > 0.0001 ? dz / distance : 0;
                    const push = minDistance - distance;
                    nextX += nx * push;
                    nextArc += nz * push;
                    nextX = THREE.MathUtils.clamp(nextX, -this.maxWalkX, this.maxWalkX);
                    adjusted = true;
                }
                if (!adjusted) break;
            }
            return { x: nextX, arc: nextArc };
        }

        liftObjectAboveCylinder(wrapper, theta, clearance = 0.03) {
            const inwardUp = new THREE.Vector3(0, Math.cos(theta), -Math.sin(theta)).normalize();
            wrapper.updateWorldMatrix(true, true);

            let maxPenetration = -Infinity;
            const samplePoint = new THREE.Vector3();

            wrapper.traverse((child) => {
                if (!child.isMesh || !child.geometry?.attributes?.position) return;
                const position = child.geometry.attributes.position;
                const step = Math.max(1, Math.floor(position.count / 240));
                for (let i = 0; i < position.count; i += step) {
                    samplePoint.fromBufferAttribute(position, i).applyMatrix4(child.matrixWorld);
                    const radialDistance = Math.hypot(samplePoint.y, samplePoint.z);
                    maxPenetration = Math.max(maxPenetration, radialDistance - this.radius);
                }
            });

            if (!Number.isFinite(maxPenetration)) return;
            if (maxPenetration >= -clearance) {
                wrapper.position.addScaledVector(inwardUp, maxPenetration + clearance);
            }
        }

        placeImportedObject(object, placement, name = 'worldAsset') {
            object.updateWorldMatrix?.(true, true);
            const localBox = new THREE.Box3().setFromObject(object);
            const localCenter = localBox.getCenter(new THREE.Vector3());
            const localMin = localBox.min.clone();
            const localSize = localBox.getSize(new THREE.Vector3());

            object.position.sub(localCenter);
            object.position.y -= localMin.y;

            const wrapper = new THREE.Group();
            wrapper.name = name.replace(/[^a-z0-9_-]/gi, '_');
            wrapper.add(object);
            this.scene.add(wrapper);

            wrapper.traverse((child) => {
                if (!child.isMesh) return;
                child.castShadow = true;
                child.receiveShadow = true;
            });

            this.placeOnCylinder(wrapper, placement.x, placement.theta, 0, 0.02);
            this.liftObjectAboveCylinder(wrapper, placement.theta, 0.03);
            const radius = Math.max(0.55, Math.min(6.5, Math.max(localSize.x, localSize.z) * 0.45));
            this.registerCollisionDisc(placement.x, placement.theta, radius);
            return wrapper;
        }

        clearNftDisplays() {
            this.nftDisplayRoot.traverse((child) => {
                if (child.geometry) {
                    child.geometry.dispose?.();
                }
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                [...new Set(materials.filter(Boolean))].forEach((material) => {
                    material.map?.dispose?.();
                    material.dispose?.();
                });
            });
            this.nftDisplayRoot.clear();
            if (this.nftCollisionEntries.length) {
                const reserved = new Set(this.nftCollisionEntries);
                this.collisionDiscs = this.collisionDiscs.filter((entry) => !reserved.has(entry));
                this.nftCollisionEntries = [];
            }
        }

        buildNftPlacementQueue(count, seedText = '') {
            const totalNeeded = Math.max(count * 6, count + 24);
            const baseSeed = Array.from(String(seedText)).reduce(
                (acc, char, index) => (Math.imul(acc ^ char.charCodeAt(0), 16777619) + index) >>> 0,
                2166136261
            );
            const cells = [];
            const maxRing = Math.max(5, Math.ceil(Math.sqrt(count)) + 6);

            for (let ring = 1; ring <= maxRing && cells.length < totalNeeded; ring++) {
                const ringCells = [];
                for (let gx = -ring; gx <= ring; gx++) {
                    for (let gy = -ring; gy <= ring; gy++) {
                        if (Math.max(Math.abs(gx), Math.abs(gy)) !== ring) continue;
                        if (Math.abs(gx) <= 1 && Math.abs(gy) <= 1) continue;
                        const weight = this.rand01(baseSeed + gx * 97 + gy * 193, ring + 7);
                        ringCells.push({ gx, gy, ring, weight });
                    }
                }
                ringCells.sort((a, b) => a.weight - b.weight);
                cells.push(...ringCells);
            }

            return cells;
        }

        reserveNftPlacements(count, seedText = '') {
            const placements = [];
            const queue = this.buildNftPlacementQueue(count, seedText);
            const cellSize = 8.5;
            const centerArc = this.spawn.theta * this.radius;
            const occupiedDiscs = [];

            for (let index = 0; index < queue.length && placements.length < count; index++) {
                const cell = queue[index];
                const jitterX = (this.rand01(index + count, 13) - 0.5) * 1.6;
                const jitterArc = (this.rand01(index + count, 29) - 0.5) * 1.6;
                const candidateX = this.spawn.x + cell.gx * cellSize + jitterX;
                const candidateArc = centerArc + cell.gy * cellSize + jitterArc;
                const resolved = this.resolveSurfaceCollisionsWithExtraDiscs(candidateX, candidateArc, this.nftCubeRadius, occupiedDiscs, 0.16);
                const theta = resolved.arc / this.radius;
                const yaw = this.rand01(index + count, 41) * TAU;
                occupiedDiscs.push({ x: resolved.x, arc: resolved.arc, radius: this.nftCubeRadius });
                placements.push({ x: resolved.x, theta, yaw });
            }

            return placements;
        }

        createNftCubeDisplay(nft, placement, index) {
            const wrapper = new THREE.Group();
            wrapper.name = `nft_cube_${index}`;
            wrapper.userData.nft = nft;

            const cube = new THREE.Mesh(
                new THREE.BoxGeometry(this.nftCubeSize, this.nftCubeSize, this.nftCubeSize),
                makeRepeatedMaterials(createBlankCubeMaterial())
            );
            cube.name = 'nftCube';
            cube.position.y = this.nftCubeSize * 0.5;
            cube.castShadow = true;
            cube.receiveShadow = true;
            wrapper.add(cube);

            const title = sanitizeNodeText(nft.name, sanitizeNodeText(nft.collection, 'Untitled NFT'));
            const plaque = new THREE.Sprite(
                new THREE.SpriteMaterial({
                    map: createNftLabelTexture(title),
                    transparent: true
                })
            );
            plaque.raycast = () => {};
            plaque.scale.set(3.35, 0.84, 1);
            plaque.position.set(0, this.nftCubeSize + 0.48, 0);
            wrapper.add(plaque);

            this.nftDisplayRoot.add(wrapper);
            this.placeOnCylinder(wrapper, placement.x, placement.theta, placement.yaw, 0.02);
            this.liftObjectAboveCylinder(wrapper, placement.theta, 0.03);
            return { wrapper, cube };
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

        addLocalGroundGlow(group, name, w, d, x, y, z, color, opacity = 0.4) {
            const mesh = new THREE.Mesh(
                new THREE.PlaneGeometry(w, d),
                createGroundGlowMaterial(color, opacity)
            );
            mesh.name = name;
            mesh.position.set(x, y, z);
            mesh.rotation.x = -Math.PI * 0.5;
            mesh.renderOrder = 1;
            mesh.userData.ignoreCameraOcclusion = true;
            mesh.userData.ignoreScreenOcclusion = true;
            mesh.raycast = () => {};
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
                color: lit ? 0xffefb5 : 0xa8cce8,
                transparent: true,
                opacity: lit ? 0.92 : 0.58,
                toneMapped: false
            });
            if (lit) {
                glassMat.userData.dayColor = new THREE.Color(0xe6f4ff);
                glassMat.userData.nightColor = new THREE.Color(0xffefb5);
                glassMat.userData.dayOpacity = 0.42;
                glassMat.userData.nightOpacity = 0.92;
                this.windowLightMaterials.push(glassMat);
            }
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
            this.registerCollisionDisc(x, theta, 0.8 * scale);
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
            this.registerCollisionDisc(x, theta, radius * 0.9);
        }

        addStreetLamp(x, theta) {
            const lamp = new THREE.Group();
            this.placeOnCylinder(lamp, x, theta);
            this.addLocalBox(lamp, 'streetLampPole', 0.09, 3.2, 0.09, 0, 1.6, 0, makeMaterial(0x5f6472, 0.74, 0.08));
            this.addLocalBox(lamp, 'streetLampArm', 0.54, 0.08, 0.08, 0.18, 3.05, 0, makeMaterial(0x5f6472, 0.74, 0.08));
            const globeMat = new THREE.MeshBasicMaterial({ color: 0xfff7cf, toneMapped: false });
            const globe = new THREE.Mesh(
                new THREE.SphereGeometry(0.14, 14, 12),
                globeMat
            );
            globe.position.set(0.42, 3.04, 0);
            lamp.add(globe);
            const lampGlow = this.addLocalGroundGlow(lamp, 'streetLampGlow', 3.9, 3.9, 0.42, 0.035, 0, 0xffd98a, 0.38);
            const pointLight = new THREE.PointLight(0xfff0cf, 0.24, 16);
            pointLight.position.copy(globe.position);
            pointLight.visible = false;
            pointLight.intensity = 0;
            lamp.add(pointLight);
            this.streetLampBulbMaterials.push(globeMat);
            this.streetLampGlowMaterials.push({ material: lampGlow.material, baseOpacity: 0.38 });
            this.streetLampLights.push({
                light: pointLight,
                x,
                arc: theta * this.radius,
                baseIntensity: 0.24
            });
            this.scene.add(lamp);
            this.registerCollisionDisc(x, theta, 0.34);
        }

        updateStreetLampLights(surfaceX, surfaceArc, activeCount = 6) {
            if (!this.streetLampLights.length) return;
            const ranked = this.streetLampLights
                .map((entry) => {
                    const dx = entry.x - surfaceX;
                    const dz = this.shortestArcDelta(surfaceArc, entry.arc);
                    return { entry, distanceSq: (dx * dx) + (dz * dz) };
                })
                .sort((a, b) => a.distanceSq - b.distanceSq);

            const active = new Set(ranked.slice(0, activeCount).map(({ entry }) => entry));
            this.streetLampLights.forEach((entry) => {
                const enabled = active.has(entry);
                entry.light.visible = enabled;
                entry.light.intensity = enabled ? entry.baseIntensity * this.streetLampLightScale : 0;
            });
        }

        setupDayNightSystem() {
            const openingX = this.length * 0.5 + 8;
            const layerSpecs = [
                { width: this.radius * 1.55, height: this.radius * 1.55, offsetX: 0, opacity: 0.18 },
                { width: this.radius * 0.98, height: this.radius * 0.98, offsetX: -28, opacity: 0.14 },
                { width: this.radius * 0.54, height: this.radius * 0.54, offsetX: -64, opacity: 0.2 }
            ];

            layerSpecs.forEach((spec, index) => {
                const material = createApertureGlowMaterial(0xffefba, spec.opacity);
                const plane = new THREE.Mesh(new THREE.PlaneGeometry(spec.width, spec.height), material);
                plane.name = `dayNightApertureGlow${index}`;
                plane.position.set(openingX + spec.offsetX, 0, 0);
                plane.rotation.y = Math.PI * 0.5;
                plane.renderOrder = -1;
                plane.userData.ignoreCameraOcclusion = true;
                plane.userData.ignoreScreenOcclusion = true;
                plane.raycast = () => {};
                this.scene.add(plane);
                this.dayNightApertureLayers.push({ plane, material, baseOpacity: spec.opacity, offsetX: spec.offsetX });
            });

            const sunBloomMaterial = createApertureGlowMaterial(0xfff7cf, 0.72);
            const sunBloom = new THREE.Mesh(new THREE.PlaneGeometry(this.radius * 0.64, this.radius * 0.64), sunBloomMaterial);
            sunBloom.name = 'dayNightSunBloom';
            sunBloom.position.set(this.dayNightSunOpeningX, 0, 0);
            sunBloom.rotation.y = Math.PI * 0.5;
            sunBloom.renderOrder = -1;
            sunBloom.userData.ignoreCameraOcclusion = true;
            sunBloom.userData.ignoreScreenOcclusion = true;
            sunBloom.raycast = () => {};
            this.scene.add(sunBloom);
            this.dayNightSunBloom = sunBloom;
            this.dayNightSunBloomMaterial = sunBloomMaterial;

            const sunDiscMaterial = new THREE.MeshBasicMaterial({
                map: getRadialGlowTexture(),
                color: 0xfffff6,
                transparent: true,
                opacity: 1,
                depthWrite: false,
                toneMapped: false,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending
            });
            const sunDisc = new THREE.Mesh(new THREE.PlaneGeometry(this.radius * 0.16, this.radius * 0.16), sunDiscMaterial);
            sunDisc.name = 'dayNightSunDisc';
            sunDisc.position.set(this.dayNightSunOpeningX + 2, 0, 0);
            sunDisc.rotation.y = Math.PI * 0.5;
            sunDisc.renderOrder = -1;
            sunDisc.userData.ignoreCameraOcclusion = true;
            sunDisc.userData.ignoreScreenOcclusion = true;
            sunDisc.raycast = () => {};
            this.scene.add(sunDisc);
            this.dayNightSunDisc = sunDisc;
            this.dayNightSunDiscMaterial = sunDiscMaterial;

            const sunLight = new THREE.DirectionalLight(0xfff4dd, 0);
            sunLight.position.set(this.dayNightSunOpeningX, 0, 0);
            const sunTarget = new THREE.Object3D();
            sunTarget.position.set(0, 0, 0);
            this.scene.add(sunTarget);
            sunLight.target = sunTarget;
            this.scene.add(sunLight);
            this.dayNightSunLight = sunLight;
            this.dayNightSunTarget = sunTarget;
        }

        updateDayNight(delta, force = false) {
            if (!force) {
                this.dayNightElapsed = (this.dayNightElapsed + delta) % this.dayNightCycleDuration;
            }

            const cycleT = this.dayNightElapsed / this.dayNightCycleDuration;
            const solarArc = cycleT * TAU;
            const rawDay = Math.sin(solarArc);
            const daylight = THREE.MathUtils.clamp(rawDay, 0, 1);
            const daylightEase = THREE.MathUtils.smoothstep(daylight, 0, 1);
            const twilight = Math.max(0, 1 - Math.abs(rawDay) * 2.4);
            const sunVisible = rawDay > 0 ? 1 : 0;
            const dayProgress = sunVisible ? THREE.MathUtils.clamp(solarArc / Math.PI, 0, 1) : 0;
            const sunApex = sunVisible ? Math.sin(dayProgress * Math.PI) : 0;
            const apertureBlend = sunApex;
            const sunY = this.radius * 0.82 - (dayProgress * this.radius * 1.64);
            const sunZ = Math.sin(dayProgress * Math.PI) * this.radius * 0.08;

            scene.background.copy(this.dayNightScratchA.lerpColors(this.dayNightNightSky, this.dayNightDaySky, daylightEase));
            scene.fog.color.copy(this.dayNightScratchB.lerpColors(this.dayNightNightFog, this.dayNightDayFog, daylightEase * 0.72 + twilight * 0.08));
            hemisphereLight.intensity = THREE.MathUtils.lerp(0.52, 1.02, daylightEase);
            hemisphereLight.color.copy(this.dayNightScratchC.lerpColors(this.dayNightHemiSkyNight, this.dayNightHemiSkyDay, daylightEase));
            hemisphereLight.groundColor.copy(this.dayNightScratchD.lerpColors(this.dayNightHemiGroundNight, this.dayNightHemiGroundDay, daylightEase));
            renderer.toneMappingExposure = THREE.MathUtils.lerp(0.45, 0.63, daylightEase);

            if (this.dayNightStarMaterial) {
                this.dayNightStarMaterial.opacity = THREE.MathUtils.lerp(0.92, 0.74, daylightEase);
            }
            if (this.dayNightTerrainMaterial) {
                this.dayNightTerrainMaterial.color.copy(
                    this.dayNightScratchE.lerpColors(this.dayNightTerrainNight, this.dayNightTerrainDay, 0.16 + (daylightEase * 0.84))
                );
            }
            if (this.dayNightSunLight && this.dayNightSunTarget) {
                this.dayNightSunLight.color.copy(this.dayNightScratchA.lerpColors(this.dayNightSunrise, this.dayNightNoon, apertureBlend));
                this.dayNightSunLight.intensity = sunVisible ? THREE.MathUtils.lerp(0.82, 1.18, sunApex) : 0;
                this.dayNightSunLight.position.set(this.dayNightSunOpeningX + 32, sunY, sunZ);
                this.dayNightSunTarget.position.set(-18, sunY * 0.08, sunZ * 0.12);
            }

            this.dayNightApertureLayers.forEach((entry, index) => {
                const depthScale = index === 0 ? 1 : (index === 1 ? 0.76 : 0.58);
                entry.material.opacity = entry.baseOpacity * sunVisible * (0.62 + (sunApex * 0.38) + (twilight * 0.06)) * depthScale;
                entry.material.color.copy(this.dayNightScratchB.lerpColors(this.dayNightApertureWarm, this.dayNightApertureCool, apertureBlend));
                entry.plane.position.set(this.dayNightSunOpeningX + entry.offsetX, sunY, sunZ);
            });

            if (this.dayNightSunBloom && this.dayNightSunBloomMaterial) {
                this.dayNightSunBloom.position.set(this.dayNightSunOpeningX + 6, sunY, sunZ);
                this.dayNightSunBloomMaterial.color.copy(this.dayNightScratchC.lerpColors(this.dayNightApertureWarm, this.dayNightApertureCool, apertureBlend));
                this.dayNightSunBloomMaterial.opacity = sunVisible ? THREE.MathUtils.lerp(0.56, 0.78, sunApex) : 0;
            }
            if (this.dayNightSunDisc && this.dayNightSunDiscMaterial) {
                this.dayNightSunDisc.position.set(this.dayNightSunOpeningX + 12, sunY, sunZ);
                this.dayNightSunDiscMaterial.color.copy(this.dayNightScratchD.lerpColors(this.dayNightSunrise, this.dayNightNoon, apertureBlend));
                this.dayNightSunDiscMaterial.opacity = sunVisible ? 1 : 0;
            }

            this.streetLampLightScale = THREE.MathUtils.lerp(1, 0.04, daylightEase);
            this.streetLampBulbMaterials.forEach((material) => {
                material.color.copy(this.dayNightScratchC.lerpColors(this.dayNightLampBulbNight, this.dayNightLampBulbDay, daylightEase * 0.82));
            });
            this.streetLampGlowMaterials.forEach((entry) => {
                entry.material.opacity = entry.baseOpacity * THREE.MathUtils.lerp(1, 0.08, daylightEase);
            });
            this.houseFrontGlowMaterials.forEach((entry) => {
                entry.material.opacity = entry.baseOpacity * THREE.MathUtils.lerp(1, 0.12, daylightEase);
            });
            this.windowLightMaterials.forEach((material) => {
                material.color.copy(this.dayNightScratchD.lerpColors(material.userData.nightColor, material.userData.dayColor, daylightEase));
                material.opacity = THREE.MathUtils.lerp(material.userData.nightOpacity, material.userData.dayOpacity, daylightEase);
            });
            this.houseLightEntries.forEach((entry) => {
                entry.light.intensity = entry.baseIntensity * THREE.MathUtils.lerp(1, 0.14, daylightEase);
            });
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
                    size: 4.5,
                    sizeAttenuation: true,
                    vertexColors: true,
                    transparent: true,
                    opacity: 0.92,
                    depthWrite: false
                })
            );
            stars.name = 'spaceStars';
            this.scene.add(stars);
            this.dayNightStarMaterial = stars.material;

            const terrain = new THREE.Mesh(
                new THREE.CylinderGeometry(this.radius, this.radius, this.length, 256, 1, true),
                new THREE.MeshStandardMaterial({
                    color: 0xb8d9ab,
                    map: this.textures.grass,
                    roughness: 1.0,
                    metalness: 0.0,
                    side: THREE.BackSide
                })
            );
            terrain.rotation.z = Math.PI * 0.5;
            terrain.name = 'chainworldTerrainShell';
            this.scene.add(terrain);
            this.dayNightTerrainMaterial = terrain.material;
            this.registerGroundPick(terrain);

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
                        opacity: index === 1 ? 0.05 : 0.025
                    })
                );
                band.rotation.z = Math.PI * 0.5;
                band.position.set(0, y, index === 1 ? 0 : (index === 0 ? 24 : -24));
                this.scene.add(band);
            });

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
                    new THREE.MeshStandardMaterial({ color: 0x5f666f, roughness: 0.98, metalness: 0.01, side: THREE.BackSide })
                );
                const sidewalkA = this.addCylinderStrip(
                    `sidewalkA_${roadIndex}`,
                    this.radius - 0.015,
                    this.length - 8,
                    roadTheta - sidewalkOffset,
                    sidewalkThetaWidth,
                    new THREE.MeshStandardMaterial({ color: 0xebe4db, map: this.textures.tile, roughness: 0.96, metalness: 0.01, side: THREE.BackSide })
                );
                const sidewalkB = this.addCylinderStrip(
                    `sidewalkB_${roadIndex}`,
                    this.radius - 0.015,
                    this.length - 8,
                    roadTheta + sidewalkOffset,
                    sidewalkThetaWidth,
                    new THREE.MeshStandardMaterial({ color: 0xebe4db, map: this.textures.tile, roughness: 0.96, metalness: 0.01, side: THREE.BackSide })
                );
                this.registerGroundPick(sidewalkA);
                this.registerGroundPick(sidewalkB);

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
            house.translateY(0.2);
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
            const addFinishFloor = (name, w, d, x, z, material) => this.addLocalBox(house, name, w, 0.012, d, x, floorY + 0.036, z, material);

            const studyFloorMat = makeMaterial(0xf3eee7, 0.95, 0.01, { map: this.textures.wood });
            const hallFloorMat = makeMaterial(0xf1ece8, 0.96, 0.01, { map: this.textures.tile });
            const livingFloorMat = makeMaterial(0xf2ebe1, 0.95, 0.01, { map: this.textures.wood });
            const kitchenFloorMat = makeMaterial(0xe9e5df, 0.96, 0.01, { map: this.textures.tile });
            const bedroomFloorMat = makeMaterial(0xefe8f5, 0.95, 0.01, { map: this.textures.wood });

            addFloor('floor', 4, 4, 0, 0, 0xf3eee7);
            addFinishFloor('studyFinishFloor', 3.92, 3.92, 0, 0, studyFloorMat);
            addCeiling('studyCeiling', 4, 4, 0, 0, 0xf7f1fb);
            addWallX('backWall', 4, 0, -1.02, 0xd7d3db);
            addWallZ('sideWall', 1.55, -2.02, -0.225, 0xbdc0c9);
            addWallZ('sideWallFront', 1.35, -2.02, 2.325, 0xbdc0c9);
            addBox('sideWallHeader', wallThickness, 0.7, 1.1, -2.02, floorY + 2.45, 1.1, makeMaterial(0xbdc0c9, 0.9, 0.02));

            addFloor('hallFloor', 4.2, 2.4, 0, 3.1, 0xf1ece8);
            addFinishFloor('hallFinishFloor', 4.12, 2.32, 0, 3.1, hallFloorMat);
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
            addBox('hallRunner', 0.9, 0.01, 1.8, 0.25, floorY + 0.005, 3.1, makeMaterial(0xc8b4da, 0.95, 0.01));

            addFloor('livingFloor', 4.2, 4.4, 4.1, 1.1, 0xf2ebe1);
            addFinishFloor('livingFinishFloor', 4.12, 4.32, 4.1, 1.1, livingFloorMat);
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
            this.houseLightEntries.push({ light: livingGlow, baseIntensity: 0.55 });

            addFloor('kitchenFloor', 4.2, 2.5, 4.1, -2.45, 0xe9e5df);
            addFinishFloor('kitchenFinishFloor', 4.12, 2.42, 4.1, -2.45, kitchenFloorMat);
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
            this.houseLightEntries.push({ light: kitchenLight, baseIntensity: 0.65 });

            addFloor('bedroomFloor', 2.9, 3.8, -3.43, 1.1, 0xefe8f5);
            addFinishFloor('bedroomFinishFloor', 2.82, 3.72, -3.43, 1.1, bedroomFloorMat);
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
            this.houseLightEntries.push({ light: bedroomGlow, baseIntensity: 0.45 });

            addBox('mainHouseFrontGreen', 26, 0.04, 6.8, 0, floorY - 0.04, 12.3, makeMaterial(0x88b971, 0.99, 0.0));
            addBox('mainHouseFrontWalkway', 1.25, 0.05, 4.1, 0.22, floorY - 0.005, 6.7, makeMaterial(0xd8d4ce, 0.96, 0.01));
            addBox('mainHouseFrontPorch', 1.9, 0.08, 1.25, 0.22, floorY + 0.01, 4.92, makeMaterial(0xd9cfbf, 0.93, 0.01));
            const starterFrontGlow = this.addLocalGroundGlow(house, 'starterHouseFrontGlow', 4.8, 5.6, 0.22, floorY + 0.065, 6.65, 0xffd2a1, 0.28);
            this.houseFrontGlowMaterials.push({ material: starterFrontGlow.material, baseOpacity: 0.28 });
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
            const roofA = addBox('mainHouseRoofA', 12.9, 0.18, mainRoofRun, 0.37, mainRoofCenterY, mainRoofCenterZ + mainHouseHalfDepth * 0.5, makeMaterial(0x7c5648, 0.82, 0.03, { map: this.textures.roof }));
            const roofB = addBox('mainHouseRoofB', 12.9, 0.18, mainRoofRun, 0.37, mainRoofCenterY, mainRoofCenterZ - mainHouseHalfDepth * 0.5, makeMaterial(0x7c5648, 0.82, 0.03, { map: this.textures.roof }));
            roofA.rotation.x = mainRoofAngle;
            roofB.rotation.x = -mainRoofAngle;

            this.addTree(cfg.x - 8.2, cfg.theta - 0.024, 1001);
            this.addTree(cfg.x + 8.4, cfg.theta + 0.024, 1002);
            this.addShrub(cfg.x - 2.1, cfg.theta - 0.004, 1003, 0.4);
            this.addShrub(cfg.x + 3.1, cfg.theta + 0.004, 1004, 0.34);

            const deskMat = new THREE.MeshStandardMaterial({ color: 0x8b6f47, map: this.textures.woodFine, roughness: 0.7 });
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
                createCRTGlassMaterial(0.12)
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
            this.houseLightEntries.push({ light: deskLight, baseIntensity: 0.6 });
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

            const wallMat = makeMaterial(wallColor, 0.88, 0.02, { map: this.textures.wall });
            const trimMat = makeMaterial(trimColor, 0.86, 0.02);
            const floorMat = makeMaterial(floorColor, 0.96, 0.01, { map: this.textures.tile });
            const interiorFinishMat = makeMaterial(floorColor, 0.95, 0.01, { map: this.rand01(cfg.seed, 26) > 0.45 ? this.textures.wood : this.textures.tile });
            const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, map: this.textures.roof, roughness: 0.84, metalness: 0.02, side: THREE.DoubleSide });
            if (!cfg.enterable) {
                this.registerFootprintDiscs(cfg.x, cfg.theta, cfg.yaw, [
                    { x: 0, z: 0, radius: Math.min(width, depth) * 0.22 },
                    { x: 0, z: depth * 0.24, radius: Math.min(width, depth) * 0.2 },
                    { x: 0, z: -depth * 0.24, radius: Math.min(width, depth) * 0.2 }
                ]);
            }

            this.addLocalBox(house, 'lotPad', width + 4.5, 0.08, depth + 6.6, 0, 0.04, 0, makeMaterial(0xa8cd8f, 0.99, 0.0, { map: this.textures.grassFine }));
            this.addLocalBox(house, 'foundation', width + 0.18, 0.18, depth + 0.18, 0, 0.09, 0, makeMaterial(0xd4c5b4, 0.92, 0.01));
            this.addLocalBox(house, 'houseFloor', width - 0.18, 0.06, depth - 0.18, 0, 0.03, 0, floorMat);
            this.addLocalBox(house, 'interiorFinishFloor', width - 0.34, 0.012, depth - 0.34, 0, 0.036, 0, interiorFinishMat);
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

            this.addLocalBox(house, 'housePorch', Math.max(1.45, doorWidth + 0.5), 0.08, porchDepth, doorOffset, 0.04, frontZ + porchDepth * 0.5 + 0.02, makeMaterial(0xe2d6c5, 0.92, 0.01, { map: this.textures.tile }));
            this.addLocalBox(house, 'houseWalkway', 1.18, 0.05, 3.2, doorOffset, 0.025, frontZ + porchDepth + 1.58, makeMaterial(0xe5dfd8, 0.96, 0.01, { map: this.textures.tile }));
            const houseFrontGlow = this.addLocalGroundGlow(
                house,
                'houseFrontGlow',
                Math.max(3.8, doorWidth + 2.4),
                Math.max(4.6, porchDepth + 3.6),
                doorOffset,
                0.095,
                frontZ + porchDepth + 1.22,
                0xffd3a0,
                0.24
            );
            this.houseFrontGlowMaterials.push({ material: houseFrontGlow.material, baseOpacity: 0.24 });
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
            this.addLocalBox(house, 'houseDiningTable', 0.94, 0.08, 0.94, 0.02, 0.42, depth * 0.26, makeMaterial(this.pick([0xa07c5e, 0x927055, 0xb48e69], cfg.seed, 21), 0.72, 0.03, { map: this.textures.woodFine }));
            this.addLocalBox(house, 'houseStorage', 0.72, 0.92, 0.34, width * 0.34, 0.46, -depth * 0.28, makeMaterial(0x8f6f54, 0.76, 0.03, { map: this.textures.woodFine }));
            this.addLocalBox(house, 'houseStorageBooks', 0.54, 0.14, 0.2, width * 0.34, 0.78, -depth * 0.33, makeMaterial(0xbecce0, 0.84, 0.01));

            const deskColor = this.pick([0xb48d6b, 0x9f795a, 0xc3a17c], cfg.seed, 22);
            this.addLocalBox(house, 'deadDeskTop', 1.35, 0.08, 0.68, width * 0.22, 0.46, -depth * 0.04, makeMaterial(deskColor, 0.74, 0.03, { map: this.textures.woodFine }));
            [-0.52, 0.52].forEach((dx) => {
                [-0.22, 0.22].forEach((dz) => {
                    this.addLocalBox(house, 'deadDeskLeg', 0.08, 0.7, 0.08, width * 0.22 + dx, 0.07, -depth * 0.04 + dz, makeMaterial(deskColor, 0.78, 0.02, { map: this.textures.woodFine }));
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

        this.renderer = new CSS3DRenderer();
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
            this.cssObject = new CSS3DObject(wrapper);
            this.cssScreenAnchor = new THREE.Object3D();
            this.cssScreenAnchor.add(this.cssObject);
            scene.add(this.cssScreenAnchor);

            this.setupEvents();
            this.fitElementToScreen();
            this.syncAnchor();
        }

        setScreenMesh(screenMesh) {
            this.screenMesh = screenMesh;
            this.fitElementToScreen();
            this.syncAnchor();
            this.refreshOcclusionBlockers();
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
                console.error('[chainworld] Error loading URL:', e);
            }
            this.lastWarningUrl = '';
            this.loadTimer = window.setTimeout(() => {
                this.lastWarningUrl = this.urlRequested;
                if (this.embedWarningMode === 'toast') {
                    this.showToast('This site may block embedding. Try another URL if the screen stays blank.');
                }
                console.warn('[chainworld] iframe might be blocked or slow:', this.urlRequested);
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
            this.walkSpeed = 2.2;
            this.runSpeed = 4.1;
            this.lookSpeed = 0.0025;
            this.touchLookSpeed = 0.0032;
            this.jumpSpeed = 4.4;
            this.jumpGravity = 12.5;
            this.jumpPeakHeight = (this.jumpSpeed * this.jumpSpeed) / (2 * this.jumpGravity);
            this.pitchMin = -0.75;
            this.pitchMax = 0.35;
            this.yaw = world.spawn.yaw;
            this.pitch = world.spawn.pitch;
            this.facingYaw = Math.PI;
            this.surfaceX = world.spawn.x;
            this.surfaceArc = world.spawn.theta * this.cylinderRadius;
            this.coreRadius = 0.5;
            this.moveState = { forward: false, backward: false, left: false, right: false, run: false };
            this.touchState = {
                movePointerId: null,
                lookPointerId: null,
                moveVector: new THREE.Vector2(),
                moveOriginX: 0,
                moveOriginY: 0,
                lookLastX: 0,
                lookLastY: 0,
                pinchDistance: 0
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
            this.zoomDistance = 1;
            this.minZoom = 0.35;
            this.maxZoom = 1.7;
            this.minVisibleDistance = 0.95;
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
            this.cameraDirection = new THREE.Vector3();
            this.occludedCameraPosition = new THREE.Vector3();
            this.yawQuaternion = new THREE.Quaternion();
            this.pitchQuaternion = new THREE.Quaternion();
            this.basisMatrix = new THREE.Matrix4();
            this.raycaster = new THREE.Raycaster();
            this.playerGroup = new THREE.Group();
            this.playerGroup.name = 'playerAvatarRoot';
            scene.add(this.playerGroup);
            this.model = null;
            this.avatarHeadBone = null;
            this.avatarHeadAnchor = null;
            this.avatarScreenMesh = null;
            this.avatarLabelSprite = null;
            this.pendingWalletNfts = null;
            this.monitorLight = null;
            this.mixer = null;
            this.idleAction = null;
            this.walkAction = null;
            this.runAction = null;
            this.attackAction = null;
            this.jumpPoseAction = null;
            this.currentAction = null;
            this.jumpOffset = 0;
            this.jumpVelocity = 0;
            this.jumpBlend = 0;
            this.jumpPoseTime = 0.18;
            this.attackTimer = 0;
            this.attackPlaybackRate = 2;
            this.attackDuration = 0.36;
            this.loadAvatar();

            document.body.classList.toggle('touch-device', this.isTouchDevice);
            this.syncPlayerBasis();
            this.updateModelTransform();
            this.updateCamera(true);
            this.setupEvents();
        }

        loadAvatar() {
            if (!GLTFLoader) {
                console.error('[chainworld] GLTFLoader unavailable; third-person avatar did not load');
                return;
            }
            const loader = new GLTFLoader();
            loader.load(
                PLAYER_MODEL_URL,
                (gltf) => {
                    this.model = gltf.scene;
                    this.model.name = 'playerAvatar';
                    this.playerGroup.add(this.model);
                    this.model.traverse((object) => {
                        if (!object.isMesh) return;
                        object.material = new THREE.MeshStandardMaterial({
                            color: /eye/i.test(object.name || '') ? 0xfff2fd : 0xff4fb3,
                            emissive: /eye/i.test(object.name || '') ? 0x2d1525 : 0x7a0f52,
                            emissiveIntensity: /eye/i.test(object.name || '') ? 0.08 : 0.34,
                            roughness: 0.58,
                            metalness: 0.12,
                            skinning: !!object.isSkinnedMesh
                        });
                        object.castShadow = true;
                        object.receiveShadow = true;
                        object.userData.ignoreScreenOcclusion = true;
                        object.userData.ignoreCameraOcclusion = true;
                    });
                    this.mixer = new THREE.AnimationMixer(this.model);
                    const idleClip = findFirstClipByNames(gltf.animations, ['female_Idle']);
                    const walkClip = findFirstClipByNames(gltf.animations, ['female_Walk']);
                    const runClip = findFirstClipByNames(gltf.animations, ['female_Run']);
                    const attackClip = findFirstClipByNames(gltf.animations, ['female_Attack']);
                    if (idleClip) this.idleAction = this.mixer.clipAction(idleClip);
                    if (walkClip) this.walkAction = this.mixer.clipAction(walkClip);
                    if (runClip) this.runAction = this.mixer.clipAction(runClip);
                    if (attackClip) {
                        this.attackAction = this.mixer.clipAction(attackClip);
                        this.attackAction.setLoop(THREE.LoopOnce, 1);
                        this.attackAction.clampWhenFinished = true;
                        this.attackAction.timeScale = this.attackPlaybackRate;
                        this.attackDuration = Math.max(0.18, (attackClip.duration || this.attackDuration) / this.attackPlaybackRate);
                    }
                    const sneakClip = THREE.AnimationClip.findByName(gltf.animations, 'sneak_pose');
                    if (sneakClip) {
                        let additiveClip = sneakClip.clone();
                        THREE.AnimationUtils.makeClipAdditive(additiveClip);
                        additiveClip = THREE.AnimationUtils.subclip(additiveClip, 'sneak_pose_jump', 2, 3, 30);
                        this.jumpPoseAction = this.mixer.clipAction(additiveClip);
                        this.jumpPoseAction.play();
                        this.jumpPoseAction.paused = true;
                        this.jumpPoseAction.time = 0;
                        this.jumpPoseAction.setEffectiveWeight(0);
                    }
                    this.setAction(this.idleAction);
                    this.attachAvatarCRT();
                    this.updateModelTransform();
                    this.updateCamera(true);
                    if (this.onAvatarScreenReady && this.avatarScreenMesh) {
                        this.onAvatarScreenReady(this.avatarScreenMesh);
                    }
                    this.onAvatarReady?.();
                },
                undefined,
                (error) => console.error('[chainworld] player avatar failed to load', error)
            );
        }

        attachAvatarCRT() {
            if (!this.model) return;
            let headAnchor = null;
            this.model.traverse((object) => {
                if (headAnchor) return;
                if ((object.isBone || object.isObject3D) && /head/i.test(object.name || '')) {
                    headAnchor = object;
                }
            });
            this.avatarHeadBone = headAnchor;

            const crtAnchor = new THREE.Group();
            crtAnchor.name = 'avatarCRTAnchor';
            this.playerGroup.add(crtAnchor);
            crtAnchor.position.set(0, 1.62, 0.02);
            this.avatarHeadAnchor = crtAnchor;

            const crtGroup = new THREE.Group();
            crtGroup.name = 'avatarCRT';
            crtGroup.position.set(0, 0.09, 0.05);

            const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd4c5a9, roughness: 0.6, metalness: 0.1 });
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.38), bodyMat);
            body.position.z = -0.12;
            body.castShadow = true;
            body.receiveShadow = true;
            crtGroup.add(body);

            const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.445, 0.355, 0.04), bodyMat);
            bezel.position.z = 0.07;
            bezel.castShadow = true;
            bezel.receiveShadow = true;
            crtGroup.add(bezel);

            const screenGeo = new THREE.PlaneGeometry(0.36, 0.27, 10, 10);
            const positions = screenGeo.attributes.position;
            for (let i = 0; i < positions.count; i++) {
                const x = positions.getX(i);
                const y = positions.getY(i);
                positions.setZ(i, -0.02 * (x * x + y * y));
            }
            positions.needsUpdate = true;
            screenGeo.computeVertexNormals();

            this.avatarScreenMesh = new THREE.Mesh(
                screenGeo,
                new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide })
            );
            this.avatarScreenMesh.name = 'avatarCRTScreen';
            this.avatarScreenMesh.position.z = 0.092;
            this.avatarScreenMesh.userData.ignoreCameraOcclusion = true;
            crtGroup.add(this.avatarScreenMesh);

            const monitorLight = new THREE.SpotLight(0x9fd3ff, 1.8, 4, 0.16, 0.4, 1);
            monitorLight.position.set(0, 0, 0.15);
            const monitorTarget = new THREE.Object3D();
            monitorTarget.position.set(0, 0, 0.7);
            crtGroup.add(monitorTarget);
            monitorLight.target = monitorTarget;
            monitorLight.angle = 0.18;
            monitorLight.penumbra = 0.2;
            monitorLight.decay = 1;
            monitorLight.distance = 5;
            monitorLight.userData.ignoreCameraOcclusion = true;
            monitorLight.visible = true;
            crtGroup.add(monitorLight);
            this.crtPointLight = monitorLight;
            this.monitorLight = monitorLight;

            const glass = new THREE.Mesh(
                new THREE.PlaneGeometry(0.36, 0.27),
                createCRTGlassMaterial(0.12)
            );
            glass.position.z = 0.094;
            glass.userData.ignoreScreenOcclusion = true;
            glass.userData.ignoreCameraOcclusion = true;
            crtGroup.add(glass);

            const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.06, 14), bodyMat);
            stand.position.set(0, -0.21, -0.04);
            stand.castShadow = true;
            stand.receiveShadow = true;
            crtGroup.add(stand);

            const base = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.03, 0.11), bodyMat);
            base.position.set(0, -0.25, -0.02);
            base.castShadow = true;
            base.receiveShadow = true;
            crtGroup.add(base);

            crtGroup.traverse((object) => {
                if (!object.isMesh) return;
                object.castShadow = true;
                object.receiveShadow = true;
                object.userData.ignoreCameraOcclusion = true;
            });

            crtAnchor.add(crtGroup);
        }

        setAction(nextAction) {
            if (!nextAction || this.currentAction === nextAction) return;
            if (this.currentAction) {
                this.currentAction.paused = false;
                this.currentAction.fadeOut(0.2);
            }
            nextAction.reset().fadeIn(0.2).play();
            nextAction.paused = false;
            this.currentAction = nextAction;
        }

        isAttacking() {
            return this.attackTimer > 0;
        }

        triggerAttack() {
            if (!this.attackAction || !this.enabled || !this.isLocked || this.isAttacking()) return false;
            if (this.currentAction && this.currentAction !== this.attackAction) {
                this.currentAction.paused = false;
                this.currentAction.fadeOut(0.08);
            }
            this.attackTimer = this.attackDuration;
            this.attackAction.enabled = true;
            this.attackAction.paused = false;
            this.attackAction.timeScale = this.attackPlaybackRate;
            this.attackAction.reset();
            this.attackAction.fadeIn(0.05).play();
            this.currentAction = this.attackAction;
            playPunchSound();
            return true;
        }

        finishAttack() {
            if (!this.attackAction) return;
            this.attackTimer = 0;
            this.attackAction.stop();
            if (this.currentAction === this.attackAction) {
                this.currentAction = null;
            }
        }

        getAttackSurfaceDirection() {
            return new THREE.Vector2(-Math.sin(this.yaw), -Math.cos(this.yaw)).normalize();
        }

        setModelVisible(visible) {
            if (this.model) {
                this.model.visible = visible;
            }
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
            window.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
            if (this.isTouchDevice) {
                this.setupTouchControls();
                this.setupPinchControls();
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
            const { moveZone } = this.mobileUi;
            if (!moveZone) return;

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
                this.touchState.moveOriginX = event.clientX;
                this.touchState.moveOriginY = event.clientY;
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

            const shouldIgnoreLookStart = (target) => target?.closest?.('#hud, #url-overlay, #toast-container, #mobile-move-zone');

            this.domElement.addEventListener('pointerdown', (event) => {
                if (event.pointerType === 'mouse' || !this.enabled) return;
                if (event.pointerId === this.touchState.movePointerId) return;
                if (shouldIgnoreLookStart(event.target)) return;
                this.touchState.lookPointerId = event.pointerId;
                this.touchState.lookLastX = event.clientX;
                this.touchState.lookLastY = event.clientY;
                event.preventDefault();
            });
            window.addEventListener('pointermove', (event) => {
                if (event.pointerId !== this.touchState.lookPointerId || !this.enabled) return;
                const dx = event.clientX - this.touchState.lookLastX;
                const dy = event.clientY - this.touchState.lookLastY;
                this.touchState.lookLastX = event.clientX;
                this.touchState.lookLastY = event.clientY;
                this.applyLookDelta(dx, dy, this.touchLookSpeed);
                event.preventDefault();
            });
            ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => {
                window.addEventListener(type, (event) => {
                    if (event.pointerId !== this.touchState.lookPointerId) return;
                    this.touchState.lookPointerId = null;
                });
            });
        }

        setupPinchControls() {
            const pinchDistance = (touches) => {
                const dx = touches[0].clientX - touches[1].clientX;
                const dy = touches[0].clientY - touches[1].clientY;
                return Math.hypot(dx, dy);
            };

            window.addEventListener('touchstart', (event) => {
                if (event.touches.length === 2) {
                    this.touchState.pinchDistance = pinchDistance(event.touches);
                }
            }, { passive: true });

            window.addEventListener('touchmove', (event) => {
                if (event.touches.length !== 2) return;
                const nextDistance = pinchDistance(event.touches);
                if (this.touchState.pinchDistance > 0) {
                    const delta = nextDistance - this.touchState.pinchDistance;
                    this.adjustZoom(-delta * 0.0025);
                }
                this.touchState.pinchDistance = nextDistance;
            }, { passive: true });

            window.addEventListener('touchend', () => {
                this.touchState.pinchDistance = 0;
            }, { passive: true });
        }

        updateMovePad(event) {
            const { moveZone, moveKnob } = this.mobileUi;
            if (!moveZone || !moveKnob) return;
            const rect = moveZone.getBoundingClientRect();
            const centerX = this.touchState.moveOriginX || (rect.left + rect.width * 0.5);
            const centerY = this.touchState.moveOriginY || (rect.top + rect.height * 0.5);
            const radius = rect.width * 0.34;
            let dx = event.clientX - centerX;
            let dy = event.clientY - centerY;
            const length = Math.hypot(dx, dy);
            if (length > radius) {
                const scale = radius / length;
                dx *= scale;
                dy *= scale;
            }
            let normX = dx / radius;
            let normY = -dy / radius;
            const magnitude = Math.hypot(normX, normY);
            if (magnitude < 0.12) {
                normX = 0;
                normY = 0;
            } else {
                const scaled = THREE.MathUtils.clamp((magnitude - 0.12) / 0.88, 0, 1);
                normX = (normX / magnitude) * scaled;
                normY = (normY / magnitude) * scaled;
            }
            if (Math.abs(normX) < Math.abs(normY) * 0.35) normX = 0;
            if (Math.abs(normY) < Math.abs(normX) * 0.35) normY = 0;
            if (Math.abs(normX) < 0.18) normX = 0;
            if (Math.abs(normY) < 0.18) normY = 0;
            this.touchState.moveVector.set(normX, normY);
            moveKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        }

        resetMovePad() {
            this.touchState.moveVector.set(0, 0);
            this.touchState.moveOriginX = 0;
            this.touchState.moveOriginY = 0;
            if (this.mobileUi.moveKnob) {
                this.mobileUi.moveKnob.style.transform = 'translate(-50%, -50%)';
            }
        }

        applyLookDelta(dx, dy, speed) {
            this.yaw -= dx * speed;
            this.pitch = THREE.MathUtils.clamp(this.pitch - dy * speed, this.pitchMin, this.pitchMax);
        }

        adjustZoom(delta) {
            this.zoomDistance = THREE.MathUtils.clamp(this.zoomDistance + delta, this.minZoom, this.maxZoom);
        }

        onWheel(event) {
            event.preventDefault();
            this.adjustZoom(event.deltaY * 0.0012);
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
                case 'ShiftLeft':
                    this.moveState.run = pressed;
                    break;
                case 'Space':
                    if (pressed && !this.isJumping()) {
                        this.beginJump();
                        event.preventDefault();
                    }
                    return;
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

        isJumping() {
            return this.jumpOffset > 0.0001 || this.jumpVelocity > 0.0001;
        }

        beginJump() {
            this.jumpVelocity = this.jumpSpeed;
            this.jumpBlend = 1;
            if (this.currentAction) {
                this.currentAction.paused = true;
            }
            if (this.jumpPoseAction) {
                this.jumpPoseAction.paused = true;
                this.jumpPoseAction.enabled = true;
                this.jumpPoseAction.time = 0;
                this.jumpPoseAction.setEffectiveWeight(1);
            }
        }

        endJump() {
            this.jumpOffset = 0;
            this.jumpVelocity = 0;
            this.jumpBlend = 0;
            if (this.currentAction) {
                this.currentAction.paused = false;
            }
            if (this.jumpPoseAction) {
                this.jumpPoseAction.setEffectiveWeight(0);
            }
        }

        updateModelTransform() {
            this.syncPlayerBasis();
            if (!this.model) return;
            const basisQuat = new THREE.Quaternion().setFromRotationMatrix(this.basisMatrix);
            const localQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.facingYaw);
            this.playerGroup.position.copy(this.playerPosition);
            if (this.jumpOffset > 0) {
                this.playerGroup.position.addScaledVector(this.up, this.jumpOffset);
            }
            this.playerGroup.quaternion.copy(basisQuat).multiply(localQuat);
            this.playerGroup.position.addScaledVector(this.up, 0.01);

            if (this.avatarHeadBone && this.avatarHeadAnchor) {
                this.avatarHeadBone.updateWorldMatrix(true, false);
                const headWorldPos = new THREE.Vector3();
                const headWorldQuat = new THREE.Quaternion();
                const headWorldScale = new THREE.Vector3();
                this.avatarHeadBone.matrixWorld.decompose(headWorldPos, headWorldQuat, headWorldScale);

                const inverseRoot = this.playerGroup.matrixWorld.clone().invert();
                this.avatarHeadAnchor.position.copy(headWorldPos.applyMatrix4(inverseRoot));

                const rootWorldQuat = new THREE.Quaternion();
                this.playerGroup.getWorldQuaternion(rootWorldQuat);
                this.avatarHeadAnchor.quaternion.copy(rootWorldQuat.invert().multiply(headWorldQuat));
            }
        }

        shouldIgnoreCameraOcclusion(object) {
            let current = object;
            while (current) {
                if (current === this.playerGroup) return true;
                if (current.userData?.ignoreCameraOcclusion || current.userData?.ignoreScreenOcclusion) return true;
                current = current.parent;
            }
            return false;
        }

        updateCamera(snap = false) {
            this.syncPlayerBasis();
            this.yawQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
            this.pitchQuaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch);

            this.localCameraOffset.copy(this.cameraOffset);
            this.localCameraOffset.y = this.isCrouching ? 1.25 : this.cameraOffset.y;
            this.localCameraOffset.multiplyScalar(this.zoomDistance);
            this.localCameraOffset.applyQuaternion(this.pitchQuaternion).applyQuaternion(this.yawQuaternion);

            this.cameraTarget.copy(this.cameraTargetLocal);
            this.cameraTarget.y = this.isCrouching ? 0.96 : this.cameraTargetLocal.y;
            this.cameraTarget.applyMatrix4(this.basisMatrix).add(this.playerPosition);

            this.desiredCameraPosition.copy(this.localCameraOffset).applyMatrix4(this.basisMatrix).add(this.playerPosition);
            this.cameraDirection.copy(this.desiredCameraPosition).sub(this.cameraTarget);
            const desiredDistance = this.cameraDirection.length();
            if (desiredDistance > 0.0001) {
                this.cameraDirection.divideScalar(desiredDistance);
                this.raycaster.set(this.cameraTarget, this.cameraDirection);
                this.raycaster.far = desiredDistance;
                const hits = this.raycaster.intersectObjects(scene.children, true);
                let resolvedDistance = desiredDistance;
                for (const hit of hits) {
                    if (this.shouldIgnoreCameraOcclusion(hit.object)) continue;
                    resolvedDistance = Math.max(0.14, hit.distance - 0.12);
                    break;
                }
                this.occludedCameraPosition.copy(this.cameraTarget).addScaledVector(this.cameraDirection, resolvedDistance);
            } else {
                this.occludedCameraPosition.copy(this.desiredCameraPosition);
            }

            if (snap) {
                this.camera.position.copy(this.occludedCameraPosition);
            } else {
                this.camera.position.lerp(this.occludedCameraPosition, this.cameraLerp);
            }

            this.setModelVisible(this.camera.position.distanceTo(this.cameraTarget) > this.minVisibleDistance);
            this.camera.up.copy(this.up);
            this.camera.lookAt(this.cameraTarget);
        }

        update(delta) {
            if (!this.enabled) return;

            if (this.mixer) {
                this.mixer.update(delta);
            }

            if (this.attackTimer > 0) {
                this.attackTimer = Math.max(0, this.attackTimer - delta);
                if (this.attackTimer === 0) {
                    this.finishAttack();
                }
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
            const isRunning = this.moveState.run && !this.isCrouching;
            const travelSpeed = isRunning ? this.runSpeed : this.walkSpeed;
            const canTranslate = !this.isAttacking();
            this.moveVector.set(0, 0, 0);
            this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
            this.right.set(-this.forward.z, 0, this.forward.x).normalize();

            let moving = false;
            if (canTranslate) {
                if (inputZ > 0.001) this.moveVector.add(this.forward);
                if (inputZ < -0.001) this.moveVector.sub(this.forward);
                if (inputX < -0.001) this.moveVector.sub(this.right);
                if (inputX > 0.001) this.moveVector.add(this.right);
                moving = this.moveVector.lengthSq() > 0;
            }

            if (canTranslate && moving) {
                this.moveVector.normalize();
                this.facingYaw = Math.atan2(this.moveVector.x, this.moveVector.z);
                const next = this.world.moveOnSurface(
                    this.surfaceX,
                    this.surfaceArc,
                    this.moveVector.x * travelSpeed * delta,
                    this.moveVector.z * travelSpeed * delta,
                    this.coreRadius
                );
                this.surfaceX = next.x;
                this.surfaceArc = next.arc;
            } else if (canTranslate) {
                this.facingYaw = this.yaw + Math.PI;
            }

            if (this.isJumping()) {
                this.jumpVelocity -= this.jumpGravity * delta;
                this.jumpOffset = Math.max(0, this.jumpOffset + this.jumpVelocity * delta);
                if (this.jumpOffset === 0 && this.jumpVelocity < 0) {
                    this.endJump();
                }
            }

            this.jumpBlend = this.isJumping() ? 1 : 0;
            if (this.jumpPoseAction) {
                this.jumpPoseAction.setEffectiveWeight(this.jumpBlend);
            }

            this.clampX();
            this.wrapArc();
            this.updateModelTransform();
            this.updateCamera();

            if (this.isAttacking()) {
                return;
            }

            if (this.idleAction && this.walkAction && !this.isJumping()) {
                if (moving && isRunning && this.runAction) {
                    this.setAction(this.runAction);
                } else if (moving) {
                    this.setAction(this.walkAction);
                } else {
                    this.setAction(this.idleAction);
                }
            }
        }
    }

    class WanderingNPC {
        constructor(scene, world, options = {}) {
            this.scene = scene;
            this.world = world;
            this.options = {
                modelUrl: DEFAULT_NPC_MODEL_URL,
                idleClipNames: ['idle'],
                walkClipNames: ['walk'],
                runClipNames: ['run'],
                attachCrtHead: true,
                spawnXOffset: 1.2,
                spawnArcOffset: -3.2,
                walkSpeed: 1.25,
                runSpeed: 4.2,
                wanderRadius: 4.5,
                logicInterval: 0,
                pauseDurationMin: 0.8,
                pauseDurationMax: 1.4,
                logLabel: 'NPC',
                ...options
            };
            this.cylinderRadius = world.radius;
            this.maxX = world.maxWalkX;
            this.spawnX = world.spawn.x + this.options.spawnXOffset;
            this.spawnArc = world.spawn.theta * this.cylinderRadius + this.options.spawnArcOffset;
            this.surfaceX = this.spawnX;
            this.surfaceArc = this.spawnArc;
            this.coreRadius = 0.5;
            this.wanderRadius = this.options.wanderRadius;
            this.walkSpeed = this.options.walkSpeed;
            this.runSpeed = this.options.runSpeed;
            this.logicInterval = this.options.logicInterval;
            this.logicAccumulator = Math.random() * this.logicInterval;
            this.pauseTimer = this.randomPauseDuration();
            this.destinationX = this.surfaceX;
            this.destinationArc = this.surfaceArc;
            this.hasDestination = false;
            this.facingYaw = Math.PI;
            this.up = new THREE.Vector3();
            this.forwardBase = new THREE.Vector3();
            this.rightBase = new THREE.Vector3(1, 0, 0);
            this.playerPosition = new THREE.Vector3();
            this.basisMatrix = new THREE.Matrix4();
            this.playerGroup = new THREE.Group();
            this.playerGroup.name = 'npcAvatarRoot';
            this.scene.add(this.playerGroup);
            this.visualRoot = new THREE.Group();
            this.visualRoot.name = 'npcVisualRoot';
            this.playerGroup.add(this.visualRoot);
            this.placeholderRoot = new THREE.Group();
            this.placeholderRoot.name = 'npcPlaceholderRoot';
            this.placeholderRoot.visible = false;
            this.playerGroup.add(this.placeholderRoot);
            this.playerControls = this.options.playerControls || null;
            this.onKnockedDown = this.options.onKnockedDown || null;
            this.mobilePerformanceMode = !!this.options.mobilePerformanceMode;
            this.mobileLodMode = 'full';
            this.mobileUpdateBucketOffset = Math.floor(Math.random() * MOBILE_PERF.hiddenUpdateBuckets);
            this.mobileDistanceSq = 0;
            this.model = null;
            this.avatarHeadBone = null;
            this.avatarHeadAnchor = null;
            this.avatarScreenMesh = null;
            this.avatarLabelSprite = null;
            this.placeholderSprite = null;
            this.placeholderSpriteMaterial = null;
            this.placeholderFrameTimer = Math.random() * 0.24;
            this.pendingWalletNfts = null;
            this.currentMonitorLabelText = '';
            this.currentBodyTexture = null;
            this.mixer = null;
            this.idleAction = null;
            this.walkAction = null;
            this.runAction = null;
            this.currentAction = null;
            this.isDestroyed = false;
            this.isFallen = false;
            this.fallProgress = 0;
            this.fallDuration = 0.34;
            this.fallAxis = new THREE.Vector3(1, 0, 0);
            this.fallTargetAngle = Math.PI * 0.5;
            this.staggerTimer = 0;
            this.staggerDuration = 0.26;
            this.staggerAxis = new THREE.Vector3(1, 0, 0);
            this.staggerTargetAngle = Math.PI * 0.24;
            this.jumpOffset = 0;
            this.jumpVelocity = 0;
            this.jumpSpeed = 3.8;
            this.jumpGravity = 11.5;
            this.panicTimer = 0;
            this.panicJumpCooldown = 0;
            this.panicBubbleTimer = 0;
            this.ambientBubbleCooldown = Math.random() * 1.4;
            this.readyPromise = new Promise((resolve) => {
                this.resolveReady = resolve;
            });

            this.createPlaceholderVisual();
            this.loadAvatar();
            this.syncBasis();
            this.updateTransform();
            this.stuckAccumulator = 0;
            this.stuckCheckX = this.surfaceX;
            this.stuckCheckArc = this.surfaceArc;
        }

        randomPauseDuration() {
            const min = this.options.pauseDurationMin;
            const max = this.options.pauseDurationMax;
            return min + Math.random() * Math.max(0, max - min);
        }

        createPlaceholderVisual() {
            const material = new THREE.SpriteMaterial({
                map: MOBILE_SILHOUETTE_TEXTURES[0],
                transparent: true,
                depthWrite: false,
                toneMapped: false,
                opacity: 0.58
            });
            const sprite = new THREE.Sprite(material);
            sprite.name = 'npcMobilePlaceholder';
            sprite.center.set(0.5, 0);
            sprite.scale.set(1.1, 1.95, 1);
            sprite.position.set(0, 0.01, 0);
            sprite.raycast = () => {};
            this.placeholderRoot.add(sprite);
            this.placeholderSprite = sprite;
            this.placeholderSpriteMaterial = material;
        }

        shortestArcDelta(fromArc, toArc) {
            const circumference = TAU * this.cylinderRadius;
            return THREE.MathUtils.euclideanModulo((toArc - fromArc) + circumference * 0.5, circumference) - circumference * 0.5;
        }

        wrapArc() {
            const circumference = TAU * this.cylinderRadius;
            this.surfaceArc = THREE.MathUtils.euclideanModulo(this.surfaceArc, circumference);
        }

        resetStuckTracker() {
            this.stuckAccumulator = 0;
            this.stuckCheckX = this.surfaceX;
            this.stuckCheckArc = this.surfaceArc;
        }

        updateStuckWatcher(stepDelta) {
            if (!this.hasDestination || this.isFallen || this.pauseTimer > 0) {
                this.resetStuckTracker();
                return;
            }
            const moved = Math.hypot(
                this.surfaceX - this.stuckCheckX,
                this.shortestArcDelta(this.surfaceArc, this.stuckCheckArc)
            );
            if (moved > 0.15) {
                this.resetStuckTracker();
                return;
            }
            this.stuckAccumulator += stepDelta;
            if (this.stuckAccumulator >= 3) {
                this.stuckAccumulator = 0;
                this.hasDestination = false;
                this.chooseDestination();
                this.resetStuckTracker();
            }
        }

        clampX() {
            this.surfaceX = THREE.MathUtils.clamp(this.surfaceX, -this.maxX, this.maxX);
        }

        setAction(nextAction) {
            if (!nextAction || this.currentAction === nextAction) return;
            if (this.currentAction) {
                this.currentAction.fadeOut(0.2);
            }
            nextAction.reset().fadeIn(0.2).play();
            this.currentAction = nextAction;
        }

        syncBasis() {
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

        chooseDestination() {
            if (this.isPanicking()) {
                this.choosePanicDestination();
                return;
            }
            const angle = Math.random() * TAU;
            const radius = Math.random() * this.wanderRadius;
            this.destinationX = THREE.MathUtils.clamp(this.spawnX + Math.cos(angle) * radius, -this.maxX, this.maxX);
            this.destinationArc = this.spawnArc + Math.sin(angle) * radius;
            this.hasDestination = true;
            this.resetStuckTracker();
        }

        choosePanicDestination() {
            if (!this.playerControls) {
                const angle = Math.random() * TAU;
                const radius = 20 + Math.random() * 8;
                this.destinationX = THREE.MathUtils.clamp(this.surfaceX + Math.cos(angle) * radius, -this.maxX, this.maxX);
                this.destinationArc = this.surfaceArc + Math.sin(angle) * radius;
                this.hasDestination = true;
                this.resetStuckTracker();
                return;
            }

            const playerX = this.playerControls.surfaceX;
            const playerArc = this.playerControls.surfaceArc;
            for (let attempt = 0; attempt < 24; attempt++) {
                const angle = Math.random() * TAU;
                const radius = 20 + Math.random() * 8;
                const candidateX = THREE.MathUtils.clamp(playerX + Math.cos(angle) * radius, -this.maxX, this.maxX);
                const candidateArc = playerArc + Math.sin(angle) * radius;
                const dist = Math.hypot(
                    candidateX - playerX,
                    this.shortestArcDelta(playerArc, candidateArc)
                );
                if (dist >= 20) {
                    this.destinationX = candidateX;
                    this.destinationArc = candidateArc;
                    this.hasDestination = true;
                    this.resetStuckTracker();
                    return;
                }
            }

            const awayX = this.surfaceX - playerX;
            const awayArc = this.shortestArcDelta(playerArc, this.surfaceArc);
            const length = Math.hypot(awayX, awayArc) || 1;
            this.destinationX = THREE.MathUtils.clamp(playerX + (awayX / length) * 20, -this.maxX, this.maxX);
            this.destinationArc = playerArc + (awayArc / length) * 20;
            this.hasDestination = true;
            this.resetStuckTracker();
        }

        isJumping() {
            return this.jumpOffset > 0.0001 || this.jumpVelocity > 0.0001;
        }

        beginJump() {
            if (this.isJumping() || this.isFallen) return;
            this.jumpVelocity = this.jumpSpeed;
        }

        endJump() {
            this.jumpOffset = 0;
            this.jumpVelocity = 0;
        }

        isPanicking() {
            return this.panicTimer > 0;
        }

        enterPanicMode() {
            if (this.isDestroyed || this.isFallen) return;
            this.panicTimer = 10;
            this.panicJumpCooldown = 0;
            this.pauseTimer = 0;
            this.hasDestination = false;
            this.choosePanicDestination();
            this.setAction(this.runAction || this.walkAction || this.idleAction);
            if (this.nftData) {
                const phrase = NPC_PANIC_PHRASES[Math.floor(Math.random() * NPC_PANIC_PHRASES.length)];
                this.showPanicBubble(phrase);
            }
            this.updateTransform();
        }

        isStaggering() {
            return this.staggerTimer > 0;
        }

        applyNpcAvatarMaterial(mesh) {
            mesh.material = new THREE.MeshStandardMaterial({
                color: mesh.name && /eye/i.test(mesh.name) ? 0xfff0ea : 0xff3a3a,
                emissive: mesh.name && /eye/i.test(mesh.name) ? 0x341812 : 0x7a1212,
                emissiveIntensity: mesh.name && /eye/i.test(mesh.name) ? 0.08 : 0.28,
                roughness: 0.72,
                metalness: 0.08,
                skinning: !!mesh.isSkinnedMesh
            });
            mesh.userData.npcDefaultMaterial = {
                color: mesh.material.color.clone(),
                emissive: mesh.material.emissive.clone()
            };
        }

        wrapBodyTexture(texture) {
            if (!this.model || !texture) return;
            this.model.traverse((object) => {
                if (!object.isMesh || /eye/i.test(object.name || '')) return;
                object.material.map = texture;
                object.material.color.setHex(0xffffff);
                object.material.emissive.setHex(0x111111);
                object.material.needsUpdate = true;
            });
        }

        clearBodyTexture() {
            if (!this.model) return;
            this.model.traverse((object) => {
                if (!object.isMesh || /eye/i.test(object.name || '')) return;
                const defaults = object.userData.npcDefaultMaterial;
                if (defaults) {
                    object.material.color.copy(defaults.color);
                    object.material.emissive.copy(defaults.emissive);
                } else {
                    object.material.color.setHex(0xff3a3a);
                    object.material.emissive.setHex(0x7a1212);
                }
                object.material.map = null;
                object.material.needsUpdate = true;
            });
        }

        loadAvatar() {
            if (!GLTFLoader) {
                console.error('[chainworld] GLTFLoader unavailable; wandering NPC did not load');
                this.resolveReady?.(null);
                this.resolveReady = null;
                return;
            }

            loadNpcModelTemplate(this.options.modelUrl).then(
                (gltf) => {
                    this.model = SkeletonUtils?.clone
                        ? SkeletonUtils.clone(gltf.scene)
                        : gltf.scene.clone(true);
                    this.model.name = 'npcAvatar';
                    this.visualRoot.add(this.model);
                    this.model.traverse((object) => {
                        if (!object.isMesh) return;
                        this.applyNpcAvatarMaterial(object);
                        object.castShadow = true;
                        object.receiveShadow = true;
                    });

                    this.mixer = new THREE.AnimationMixer(this.model);
                    const idleClip = findFirstClipByNames(gltf.animations, this.options.idleClipNames);
                    const walkClip = findFirstClipByNames(gltf.animations, this.options.walkClipNames);
                    const runClip = findFirstClipByNames(gltf.animations, this.options.runClipNames);
                    if (idleClip) this.idleAction = this.mixer.clipAction(idleClip);
                    if (walkClip) this.walkAction = this.mixer.clipAction(walkClip);
                    if (runClip) this.runAction = this.mixer.clipAction(runClip);
                    this.setAction(this.idleAction || this.walkAction);

                    if (this.options.attachCrtHead) {
                        this.attachAvatarCRT();
                    }
                    this.updateTransform();
                    this.resolveReady?.(this);
                    this.resolveReady = null;
                },
                (error) => {
                    console.error(`[chainworld] ${this.options.logLabel} failed to load`, error);
                    this.resolveReady?.(null);
                    this.resolveReady = null;
                }
            );
        }

        attachAvatarCRT() {
            if (!this.model) return;

            let headAnchor = null;
            this.model.traverse((object) => {
                if (headAnchor) return;
                if ((object.isBone || object.isObject3D) && /head/i.test(object.name || '')) {
                    headAnchor = object;
                }
            });
            this.avatarHeadBone = headAnchor;

            const crtAnchor = new THREE.Group();
            crtAnchor.name = 'npcCRTAnchor';
            crtAnchor.position.set(0, 1.62, 0.02);
            this.visualRoot.add(crtAnchor);
            this.avatarHeadAnchor = crtAnchor;

            const crtGroup = new THREE.Group();
            crtGroup.name = 'npcCRT';
            crtGroup.position.set(0, 0.09, 0.05);

            const bodyMat = new THREE.MeshStandardMaterial({
                color: 0x547dff,
                emissive: 0x18316f,
                emissiveIntensity: 0.22,
                roughness: 0.54,
                metalness: 0.14
            });
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.38), bodyMat);
            body.position.z = -0.12;
            crtGroup.add(body);

            const bezel = new THREE.Mesh(
                new THREE.BoxGeometry(0.445, 0.355, 0.04),
                new THREE.MeshStandardMaterial({
                    color: 0x7aa0ff,
                    emissive: 0x224487,
                    emissiveIntensity: 0.2,
                    roughness: 0.48,
                    metalness: 0.16
                })
            );
            bezel.position.z = 0.07;
            crtGroup.add(bezel);

            const screen = new THREE.Mesh(
                createCurvedCRTScreenGeometry(),
                new THREE.MeshBasicMaterial({
                    map: createCRTTextTexture('NOT\nFREN'),
                    side: THREE.DoubleSide,
                    toneMapped: false
                })
            );
            screen.name = 'npcCRTScreen';
            screen.position.z = 0.092;
            this.avatarScreenMesh = screen;
            crtGroup.add(screen);

            const glass = new THREE.Mesh(
                new THREE.PlaneGeometry(0.36, 0.27),
                createCRTGlassMaterial(0.1)
            );
            glass.position.z = 0.094;
            crtGroup.add(glass);

            const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.06, 14), bodyMat);
            stand.position.set(0, -0.21, -0.04);
            crtGroup.add(stand);

            const base = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.03, 0.11), bodyMat);
            base.position.set(0, -0.25, -0.02);
            crtGroup.add(base);

            const labelSprite = new THREE.Sprite(
                new THREE.SpriteMaterial({
                    map: createNpcMonitorLabelTexture('NFT'),
                    transparent: true
                })
            );
            labelSprite.name = 'npcMonitorLabel';
            labelSprite.raycast = () => {};
            labelSprite.visible = false;
            labelSprite.scale.set(1.45, 0.36, 1);
            labelSprite.position.set(0, 0.42, 0.02);
            crtAnchor.add(labelSprite);
            this.avatarLabelSprite = labelSprite;

            const panicBubbleSprite = new THREE.Sprite(
                new THREE.SpriteMaterial({
                    map: createNpcSpeechBubbleTexture("No! Don't kill me!"),
                    transparent: true,
                    depthWrite: false
                })
            );
            panicBubbleSprite.name = 'npcPanicBubble';
            panicBubbleSprite.raycast = () => {};
            panicBubbleSprite.visible = false;
            panicBubbleSprite.scale.set(2.2, 1.4, 1);
            panicBubbleSprite.position.set(0, 1.03, 0.04);
            crtAnchor.add(panicBubbleSprite);
            this.panicBubbleSprite = panicBubbleSprite;

            crtGroup.traverse((object) => {
                if (!object.isMesh) return;
                object.castShadow = true;
                object.receiveShadow = true;
            });

            crtAnchor.add(crtGroup);
            if (this.pendingWalletNfts) {
                const pendingNfts = this.pendingWalletNfts;
                this.pendingWalletNfts = null;
                this.showRandomWalletNft(pendingNfts);
            }
        }

        setMonitorTexture(texture) {
            if (this.avatarScreenMesh?.material) {
                this.avatarScreenMesh.material.color?.setHex(0xffffff);
                this.avatarScreenMesh.material.map = texture;
                this.avatarScreenMesh.material.needsUpdate = true;
            }
        }

        setMonitorText(text) {
            this.setMonitorTexture(createMonitorTextTexture(text));
        }

        setMonitorLabel(text) {
            this.currentMonitorLabelText = text;
            if (!this.avatarLabelSprite?.material) return;
            this.avatarLabelSprite.material.map = createNpcMonitorLabelTexture(text);
            this.avatarLabelSprite.material.needsUpdate = true;
            this.avatarLabelSprite.visible = !this.mobilePerformanceMode || this.mobileLodMode === 'full';
        }

        showPanicBubble(text) {
            if (!this.panicBubbleSprite?.material) return;
            this.panicBubbleSprite.material.map = createNpcSpeechBubbleTexture(text);
            this.panicBubbleSprite.material.needsUpdate = true;
            this.panicBubbleSprite.visible = !this.mobilePerformanceMode || this.mobileLodMode === 'full';
            this.panicBubbleTimer = 2.4;
        }

        showAmbientBubble(text, duration = 3.1) {
            if (!this.panicBubbleSprite?.material) return;
            this.panicBubbleSprite.material.map = createNpcSpeechBubbleTexture(text);
            this.panicBubbleSprite.material.needsUpdate = true;
            this.panicBubbleSprite.visible = !this.mobilePerformanceMode || this.mobileLodMode === 'full';
            this.panicBubbleTimer = duration;
            this.ambientBubbleCooldown = 4.5 + (Math.random() * 2.5);
        }

        hasActiveSpeechBubble() {
            return !!(this.panicBubbleSprite?.visible && this.panicBubbleTimer > 0);
        }

        canShowAmbientBubble() {
            return !this.isDestroyed && !this.isFallen && !this.isPanicking() && this.ambientBubbleCooldown <= 0;
        }

        updatePlaceholderVisual(delta) {
            if (!this.placeholderSpriteMaterial || !this.placeholderSprite) return;
            const isMoving = this.hasDestination && !this.isFallen && !this.isStaggering() && (this.pauseTimer <= 0 || this.isPanicking());
            if (!isMoving) {
                const nextMap = MOBILE_SILHOUETTE_TEXTURES[0];
                const nextOpacity = this.mobileDistanceSq > MOBILE_PERF.fullNpcRadiusSq ? 0.46 : 0.58;
                if (this.placeholderSpriteMaterial.map !== nextMap) {
                    this.placeholderSpriteMaterial.map = nextMap;
                    this.placeholderSpriteMaterial.needsUpdate = true;
                }
                this.placeholderSpriteMaterial.opacity = nextOpacity;
                return;
            }
            this.placeholderFrameTimer += delta;
            const frame = Math.floor(this.placeholderFrameTimer / 0.14) % 2;
            const nextMap = MOBILE_SILHOUETTE_TEXTURES[1 + frame];
            const nextOpacity = this.mobileDistanceSq > MOBILE_PERF.fullNpcRadiusSq ? 0.42 : 0.54;
            if (this.placeholderSpriteMaterial.map !== nextMap) {
                this.placeholderSpriteMaterial.map = nextMap;
                this.placeholderSpriteMaterial.needsUpdate = true;
            }
            this.placeholderSpriteMaterial.opacity = nextOpacity;
        }

        setMobileLodMode(mode, options = {}) {
            const modeChanged = this.mobileLodMode !== mode;
            this.mobileLodMode = mode;
            const showLabel = options.showLabel !== false;
            const showBubble = options.showBubble !== false;
            this.visualRoot.visible = mode === 'full';
            this.placeholderRoot.visible = this.mobilePerformanceMode && mode === 'placeholder';
            this.playerGroup.visible = mode !== 'hidden';
            if (this.avatarLabelSprite) {
                this.avatarLabelSprite.visible = mode === 'full' && showLabel && !!this.currentMonitorLabelText;
            }
            if (this.panicBubbleSprite) {
                this.panicBubbleSprite.visible = mode === 'full' && showBubble && this.panicBubbleTimer > 0;
            }
            if (modeChanged) {
                if (mode === 'full') {
                    if (this.currentBodyTexture) {
                        this.wrapBodyTexture(this.currentBodyTexture);
                    }
                } else {
                    this.clearBodyTexture();
                    this.updatePlaceholderVisual(0);
                }
            }
        }

        async showRandomWalletNft(nfts) {
            if (!this.avatarScreenMesh?.material) {
                this.pendingWalletNfts = [...nfts];
                return false;
            }
            this.clearBodyTexture();
            this.currentBodyTexture = null;
            if (!nfts.length) {
                this.setMonitorText('NO NFT');
                this.setMonitorLabel('NO NFT');
                return false;
            }

            const nft = nfts[Math.floor(Math.random() * nfts.length)];
            const nftTitle = nft.name || nft.collection || 'UNKNOWN NFT';
            this.setMonitorLabel(nftTitle);
            const candidates = getNftTextureCandidates(nft);

            for (const candidate of candidates) {
                try {
                    const texture = await loadTexture(candidate);
                    this.setMonitorTexture(texture);
                    this.currentBodyTexture = texture;
                    if (!this.mobilePerformanceMode || this.mobileLodMode === 'full') {
                        this.wrapBodyTexture(texture);
                    } else {
                        this.clearBodyTexture();
                    }
                    return true;
                } catch (error) {
                    console.warn('[chainworld] npc monitor nft texture failed', candidate, error);
                }
            }

            this.setMonitorText(nftTitle);
            this.currentBodyTexture = null;
            this.clearBodyTexture();
            return false;
        }

        destroy() {
            this.isDestroyed = true;
            if (this.playerGroup.parent) {
                this.playerGroup.parent.remove(this.playerGroup);
            }
            this.playerGroup.traverse((object) => {
                if (object.geometry) {
                    object.geometry.dispose?.();
                }
                const materials = Array.isArray(object.material) ? object.material : [object.material];
                [...new Set(materials.filter(Boolean))].forEach((material) => {
                    material.map?.dispose?.();
                    material.dispose?.();
                });
            });
            this.resolveReady?.(null);
            this.resolveReady = null;
        }

        knockDown(awayX, awayArc) {
            if (this.isFallen) return;
            const length = Math.hypot(awayX, awayArc) || 1;
            const worldX = awayX / length;
            const worldZ = awayArc / length;
            const sinYaw = Math.sin(this.facingYaw);
            const cosYaw = Math.cos(this.facingYaw);
            const localX = (worldX * cosYaw) - (worldZ * sinYaw);
            const localZ = (worldX * sinYaw) + (worldZ * cosYaw);

            this.fallAxis.set(localZ, 0, -localX).normalize();
            if (this.fallAxis.lengthSq() < 0.0001) {
                this.fallAxis.set(1, 0, 0);
            }
            this.isFallen = true;
            this.fallProgress = 0;
            this.hasDestination = false;
            this.pauseTimer = Number.POSITIVE_INFINITY;
            this.mixer?.stopAllAction();
            this.currentAction = null;
            this.updateTransform();
            this.onKnockedDown?.(this);
        }

        stagger(awayX, awayArc) {
            if (this.isFallen) return;
            const length = Math.hypot(awayX, awayArc) || 1;
            const worldX = awayX / length;
            const worldZ = awayArc / length;
            const sinYaw = Math.sin(this.facingYaw);
            const cosYaw = Math.cos(this.facingYaw);
            const localX = (worldX * cosYaw) - (worldZ * sinYaw);
            const localZ = (worldX * sinYaw) + (worldZ * cosYaw);
            this.staggerAxis.set(localZ, 0, -localX).normalize();
            if (this.staggerAxis.lengthSq() < 0.0001) {
                this.staggerAxis.set(1, 0, 0);
            }
            const recoil = this.world.moveOnSurface(
                this.surfaceX,
                this.surfaceArc,
                worldX * 0.38,
                worldZ * 0.38,
                this.coreRadius
            );
            this.surfaceX = recoil.x;
            this.surfaceArc = recoil.arc;
            this.clampX();
            this.wrapArc();
            this.staggerTimer = this.staggerDuration;
            this.hasDestination = false;
            this.pauseTimer = Math.max(this.pauseTimer, 0.28);
            this.setAction(this.idleAction || this.walkAction || this.runAction);
            this.updateTransform();
        }

        updateTransform() {
            this.syncBasis();
            if (!this.model) return;

            const basisQuat = new THREE.Quaternion().setFromRotationMatrix(this.basisMatrix);
            const localQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.facingYaw);
            this.playerGroup.position.copy(this.playerPosition).addScaledVector(this.up, 0.01 + this.jumpOffset);
            this.playerGroup.quaternion.copy(basisQuat).multiply(localQuat);
            if (this.visualRoot) {
                if (this.isFallen) {
                    const eased = 1 - Math.pow(1 - this.fallProgress, 3);
                    this.visualRoot.quaternion.setFromAxisAngle(this.fallAxis, this.fallTargetAngle * eased);
                } else if (this.isStaggering()) {
                    const progress = 1 - (this.staggerTimer / this.staggerDuration);
                    const recoil = Math.sin(progress * Math.PI);
                    this.visualRoot.quaternion.setFromAxisAngle(this.staggerAxis, this.staggerTargetAngle * recoil);
                } else {
                    this.visualRoot.quaternion.identity();
                }
            }

            if (this.avatarHeadBone && this.avatarHeadAnchor) {
                this.avatarHeadBone.updateWorldMatrix(true, false);
                const headWorldPos = new THREE.Vector3();
                const headWorldQuat = new THREE.Quaternion();
                const headWorldScale = new THREE.Vector3();
                this.avatarHeadBone.matrixWorld.decompose(headWorldPos, headWorldQuat, headWorldScale);

                const inverseRoot = this.playerGroup.matrixWorld.clone().invert();
                this.avatarHeadAnchor.position.copy(headWorldPos.applyMatrix4(inverseRoot));

                const rootWorldQuat = new THREE.Quaternion();
                this.playerGroup.getWorldQuaternion(rootWorldQuat);
                this.avatarHeadAnchor.quaternion.copy(rootWorldQuat.invert().multiply(headWorldQuat));
            }
        }

        update(delta) {
            if (this.isDestroyed) return;
            this.ambientBubbleCooldown = Math.max(0, this.ambientBubbleCooldown - delta);
            if (this.panicBubbleTimer > 0) {
                this.panicBubbleTimer = Math.max(0, this.panicBubbleTimer - delta);
                if (this.panicBubbleTimer === 0 && this.panicBubbleSprite) {
                    this.panicBubbleSprite.visible = false;
                }
            }
            if (this.isFallen) {
                this.fallProgress = Math.min(1, this.fallProgress + (delta / this.fallDuration));
                this.updateTransform();
                this.updatePlaceholderVisual(delta);
                return;
            }
            if (this.isStaggering()) {
                this.staggerTimer = Math.max(0, this.staggerTimer - delta);
                this.updateTransform();
                this.updatePlaceholderVisual(delta);
                return;
            }
            if (this.isPanicking()) {
                this.panicTimer = Math.max(0, this.panicTimer - delta);
                this.panicJumpCooldown = Math.max(0, this.panicJumpCooldown - delta);
                if (this.panicTimer === 0) {
                    this.hasDestination = false;
                    this.pauseTimer = this.randomPauseDuration();
                }
            }
            if (this.isPanicking() && this.panicJumpCooldown <= 0 && !this.isJumping()) {
                this.beginJump();
                this.panicJumpCooldown = 0.6 + Math.random() * 1.1;
            }
            if (this.isJumping()) {
                this.jumpVelocity -= this.jumpGravity * delta;
                this.jumpOffset = Math.max(0, this.jumpOffset + this.jumpVelocity * delta);
                if (this.jumpOffset === 0 && this.jumpVelocity < 0) {
                    this.endJump();
                }
            }
            if (this.mixer) {
                this.mixer.update(delta);
            }

            if (!this.model) return;

            let stepDelta = delta;
            if (this.logicInterval > 0) {
                this.logicAccumulator += delta;
                if (this.logicAccumulator < this.logicInterval) {
                    this.updateTransform();
                    this.updatePlaceholderVisual(delta);
                    return;
                }
                stepDelta = this.logicAccumulator;
                this.logicAccumulator = 0;
            }

            if (this.pauseTimer > 0 && !this.isPanicking()) {
                this.pauseTimer = Math.max(0, this.pauseTimer - stepDelta);
                if (this.pauseTimer === 0) {
                    this.chooseDestination();
                }
                this.setAction(this.idleAction || this.walkAction);
                this.updateTransform();
                this.updatePlaceholderVisual(stepDelta);
                return;
            }

            if (!this.hasDestination) {
                this.chooseDestination();
            }

            const dx = this.destinationX - this.surfaceX;
            const dz = this.shortestArcDelta(this.surfaceArc, this.destinationArc);
            const distance = Math.hypot(dx, dz);

            if (distance < 0.16) {
                this.hasDestination = false;
                if (this.isPanicking()) {
                    this.chooseDestination();
                    this.setAction(this.runAction || this.walkAction || this.idleAction);
                } else {
                    this.pauseTimer = this.randomPauseDuration();
                    this.setAction(this.idleAction || this.walkAction);
                }
                this.resetStuckTracker();
                this.updateTransform();
                this.updatePlaceholderVisual(stepDelta);
                return;
            }

            const stepSpeed = this.isPanicking() ? this.runSpeed : this.walkSpeed;
            const step = Math.min(distance, stepSpeed * stepDelta);
            const moveX = dx / distance;
            const moveZ = dz / distance;
            this.facingYaw = Math.atan2(moveX, moveZ);
            const next = this.world.moveOnSurface(
                this.surfaceX,
                this.surfaceArc,
                moveX * step,
                moveZ * step,
                this.coreRadius
            );
            this.surfaceX = next.x;
            this.surfaceArc = next.arc;
            this.clampX();
            this.wrapArc();
            this.updateStuckWatcher(stepDelta);
            this.setAction(
                this.isPanicking()
                    ? (this.runAction || this.walkAction || this.idleAction)
                    : (this.walkAction || this.idleAction)
            );
            this.updateTransform();
            this.updatePlaceholderVisual(stepDelta);
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

    class WorldAssetLoader {
        load(file) {
            const ext = file.name.split('.').pop()?.toLowerCase() || '';
            const url = URL.createObjectURL(file);

            return new Promise((resolve, reject) => {
                const finishResolve = (object) => {
                    URL.revokeObjectURL(url);
                    resolve(object);
                };
                const finishReject = (error) => {
                    URL.revokeObjectURL(url);
                    reject(error);
                };

                const onObjectReady = (object) => {
                    if (!object) {
                        finishReject(new Error(`Unsupported or empty asset: ${file.name}`));
                        return;
                    }
                    object.traverse?.((child) => {
                        if (!child.isMesh) return;
                        child.castShadow = true;
                        child.receiveShadow = true;
                        if (!child.material) {
                            child.material = makeMaterial(0xcfcfcf, 0.8, 0.05);
                        }
                    });
                    finishResolve(object);
                };

                try {
                    if (ext === 'glb' || ext === 'gltf') {
                        new GLTFLoader().load(url, (gltf) => onObjectReady(gltf.scene), undefined, finishReject);
                        return;
                    }
                    if (ext === 'obj') {
                        new OBJLoader().load(url, onObjectReady, undefined, finishReject);
                        return;
                    }
                    if (ext === 'fbx') {
                        new FBXLoader().load(url, onObjectReady, undefined, finishReject);
                        return;
                    }
                    if (ext === 'stl') {
                        new STLLoader().load(url, (geometry) => {
                            geometry.computeVertexNormals();
                            onObjectReady(new THREE.Mesh(geometry, makeMaterial(0xcfcfcf, 0.8, 0.05)));
                        }, undefined, finishReject);
                        return;
                    }
                    if (ext === 'ply') {
                        new PLYLoader().load(url, (geometry) => {
                            geometry.computeVertexNormals();
                            const material = geometry.getAttribute('color')
                                ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.04 })
                                : makeMaterial(0xcfcfcf, 0.82, 0.04);
                            onObjectReady(new THREE.Mesh(geometry, material));
                        }, undefined, finishReject);
                        return;
                    }
                    if (ext === 'vox') {
                        new VOXLoader().load(url, (chunks) => {
                            const group = new THREE.Group();
                            chunks.forEach((chunk, index) => {
                                const voxMesh = new VOXMesh(chunk);
                                voxMesh.name = `voxChunk_${index}`;
                                group.add(voxMesh);
                            });
                            onObjectReady(group);
                        }, undefined, finishReject);
                        return;
                    }
                } catch (error) {
                    finishReject(error);
                    return;
                }

                finishReject(new Error(`Unsupported file type: .${ext || 'unknown'}`));
            });
        }
    }

    class OneillApp {
        constructor() {
            this.pickRay = new THREE.Raycaster();
            this.pickMouse = new THREE.Vector2();
            this.fileInput = document.getElementById('world-object-input');
            this.pendingAssetPlacement = null;
            this.assetLoader = new WorldAssetLoader();
            this.walletForm = walletForm;
            this.walletAddressInput = walletAddressInput;
            this.currentWalletRequest = 0;

            this.world = new OneillWorld(scene);
            this.controls = new ThirdPersonCylinderControls(camera, renderer.domElement, this.world);
            this.npc = new WanderingNPC(scene, this.world, { playerControls: this.controls });
            this.walletNpcs = [];
            this.mobilePerformanceMode = MOBILE_PERFORMANCE_MODE;
            this.css3dScreen = new CSS3DScreen(scene, camera, this.world.starterScreenMesh);
            this.interaction = new InteractionSystem(camera, this.controls, this.world.starterScreenMesh, this.css3dScreen);
            this.controls.onAvatarScreenReady = (screenMesh) => {
                this.css3dScreen.setScreenMesh(screenMesh);
                this.interaction.screenMesh = screenMesh;
            };
            this.currentTargetNpc = null;
            this.targetCycleTimeoutId = null;
            this.targetArrow = new THREE.ArrowHelper(
                new THREE.Vector3(0, 0, 1),
                new THREE.Vector3(),
                1.25,
                0x66ff66,
                0.42,
                0.24
            );
            this.targetArrow.visible = false;
            scene.add(this.targetArrow);
            this.targetDebugLineGeometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(),
                new THREE.Vector3()
            ]);
            this.targetDebugLine = new THREE.Line(
                this.targetDebugLineGeometry,
                new THREE.LineBasicMaterial({ color: 0xa7ff8a })
            );
            this.targetDebugLine.visible = false;
            scene.add(this.targetDebugLine);
            this.targetArrowUp = new THREE.Vector3();
            this.targetArrowDir = new THREE.Vector3();
            this.targetArrowRight = new THREE.Vector3();
            this.targetArrowMatrix = new THREE.Matrix4();
            this.targetNameLabel = document.getElementById('current-target-name');
            this.targetPreviewImage = document.getElementById('current-target-preview');
            this.updateTargetHUD('None', '');
            this.sceneReady = false;
            this.avatarReady = false;
            this.startupWarmupStarted = false;
            this.startupWarmupReady = false;
            this.audioStateCheckAccumulator = 0;
            this.streetLampLightCheckAccumulator = 0;
            this.streetLampLightCheckInterval = 0.35;
            this.activeStreetLampCount = this.mobilePerformanceMode ? MOBILE_PERF.activeStreetLampCount : 6;
            this.ambientBubbleCheckAccumulator = 0;
            this.ambientBubbleCheckInterval = this.mobilePerformanceMode ? MOBILE_PERF.ambientBubbleCheckInterval : 0.65;
            this.hasPanickingWalletNpcs = false;
            this.checkLoadingOverlay = () => {
                if (!this.startupWarmupStarted && this.sceneReady && this.avatarReady) {
                    void this.runStartupWarmup();
                    return;
                }
                if (this.sceneReady && this.avatarReady && this.startupWarmupReady) {
                    loadingOverlay?.classList.add('hidden');
                }
            };
            this.controls.onAvatarReady = () => {
                this.avatarReady = true;
                this.checkLoadingOverlay();
            };
            this.urlBar = new URLBar(this.css3dScreen);
            this.clock = new THREE.Clock();
            this.mobileWalletNpcBudgetAccumulator = 0;
            this.mobileWalletNpcBudgetInterval = this.mobilePerformanceMode ? 0.35 : 0;
            this.mobileNpcUpdateFrame = 0;
            this.world.updateStreetLampLights(this.controls.surfaceX, this.controls.surfaceArc, this.activeStreetLampCount);

            window.requestAnimationFrame(() => {
                this.sceneReady = true;
                this.checkLoadingOverlay();
            });
            const startupUrl = localStorage.getItem('crt.url') || DEFAULT_HOME_URL;
            this.css3dScreen.loadURL(startupUrl);
            this.bindEvents();
            this.restoreWalletFromQuery();
            this.onResize();
            this.animate();
        }

        updateStreetLampLights(delta, force = false) {
            if (!force) {
                this.streetLampLightCheckAccumulator += delta;
                if (this.streetLampLightCheckAccumulator < this.streetLampLightCheckInterval) return;
            }
            this.streetLampLightCheckAccumulator = 0;
            this.world.updateStreetLampLights(
                this.controls.surfaceX,
                this.controls.surfaceArc,
                this.activeStreetLampCount
            );
        }

        refreshMobileWalletNpcLod(delta = 0, force = false) {
            if (!this.mobilePerformanceMode) return;
            if (!force) {
                this.mobileWalletNpcBudgetAccumulator += delta;
                if (this.mobileWalletNpcBudgetAccumulator < this.mobileWalletNpcBudgetInterval) return;
            }
            this.mobileWalletNpcBudgetAccumulator = 0;
            const ranked = this.walletNpcs
                .filter((npc) => npc && !npc.isDestroyed)
                .map((npc) => {
                    const dx = npc.surfaceX - this.controls.surfaceX;
                    const dz = this.world.shortestArcDelta(this.controls.surfaceArc, npc.surfaceArc);
                    return { npc, distanceSq: (dx * dx) + (dz * dz) };
                })
                .sort((a, b) => a.distanceSq - b.distanceSq);

            let fullCount = 0;
            ranked.forEach(({ npc, distanceSq }) => {
                npc.mobileDistanceSq = distanceSq;
                const needsFull =
                    npc === this.currentTargetNpc ||
                    npc.isPanicking?.() ||
                    npc.isStaggering?.() ||
                    npc.isFallen ||
                    (npc.hasActiveSpeechBubble?.() && distanceSq <= MOBILE_PERF.bubbleRadiusSq);
                let mode = 'hidden';
                if (needsFull || (distanceSq <= MOBILE_PERF.fullNpcRadiusSq && fullCount < MOBILE_PERF.maxFullWalletNpcs)) {
                    mode = 'full';
                    fullCount += 1;
                } else if (distanceSq <= MOBILE_PERF.placeholderNpcRadiusSq) {
                    mode = 'placeholder';
                }
                npc.setMobileLodMode(mode, {
                    showLabel: distanceSq <= MOBILE_PERF.labelRadiusSq,
                    showBubble: distanceSq <= MOBILE_PERF.bubbleRadiusSq
                });
            });
        }

        updateWalletNpcSimulation(delta) {
            if (!this.mobilePerformanceMode) {
                this.walletNpcs.forEach((npc) => npc.update(delta));
                return;
            }
            this.mobileNpcUpdateFrame = (this.mobileNpcUpdateFrame + 1) % MOBILE_PERF.hiddenUpdateBuckets;
            this.walletNpcs.forEach((npc) => {
                if (!npc || npc.isDestroyed) return;
                const mode = npc.mobileLodMode || 'full';
                if (mode === 'full') {
                    npc.update(delta);
                    return;
                }
                const bucketCount = mode === 'placeholder' ? MOBILE_PERF.placeholderUpdateBuckets : MOBILE_PERF.hiddenUpdateBuckets;
                if (((this.mobileNpcUpdateFrame + npc.mobileUpdateBucketOffset) % bucketCount) !== 0) return;
                npc.update(delta * bucketCount);
            });
        }

        async runStartupWarmup() {
            if (this.startupWarmupStarted) return;
            this.startupWarmupStarted = true;
            this.world.updateDayNight(0, true);
            this.updateStreetLampLights(0, true);
            this.controls.update(0);
            this.npc?.update(0);
            try {
                if (typeof renderer.compileAsync === 'function') {
                    await renderer.compileAsync(scene, camera);
                } else if (typeof renderer.compile === 'function') {
                    renderer.compile(scene, camera);
                }
            } catch (error) {
                console.warn('[chainworld] startup shader warmup failed', error);
            }
            renderer.render(scene, camera);
            this.css3dScreen.update();
            await new Promise((resolve) => window.requestAnimationFrame(resolve));
            this.startupWarmupReady = true;
            this.checkLoadingOverlay();
        }

        bindEvents() {
            window.addEventListener('resize', () => this.onResize());
            renderer.domElement.addEventListener('click', (event) => this.handleWorldClick(event));
            renderer.domElement.addEventListener('click', (event) => this.handleAttackClick(event));
            renderer.domElement.addEventListener('contextmenu', (event) => this.handleGroundContextMenu(event));
            this.fileInput?.addEventListener('change', (event) => this.handleAssetUpload(event));
            this.walletForm?.addEventListener('submit', (event) => this.handleWalletSubmit(event));
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
            soundscape.unlock();
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

        handleAttackClick(event) {
            soundscape.unlock();
            if (this.interaction.isOverScreen) return;
            if (!this.controls.isLocked) return;
            if (!this.controls.triggerAttack()) return;
            this.triggerPanicForNearbyWalletNpcs();
            this.attackNpcsInFrontOfPlayer();
            event.preventDefault();
        }

        getAttackableNpcs() {
            return [this.npc, ...this.walletNpcs].filter((npc) => npc && !npc.isDestroyed && !npc.isFallen);
        }

        attackNpcsInFrontOfPlayer() {
            const attackDir = this.controls.getAttackSurfaceDirection();
            const attackRange = 2;

            const knockDelayMs = 120;
            this.getAttackableNpcs().forEach((npc) => {
                const dx = npc.surfaceX - this.controls.surfaceX;
                const dz = this.world.shortestArcDelta(this.controls.surfaceArc, npc.surfaceArc);
                const distance = Math.hypot(dx, dz);
                if (distance <= 0.001 || distance > attackRange) return;

                const align = ((dx / distance) * attackDir.x) + ((dz / distance) * attackDir.y);
                if (align < 0) return;

                const knockDx = dx;
                const knockDz = dz;
                window.setTimeout(() => {
                    if (!npc || npc.isDestroyed || npc.isFallen) return;
                    if (npc === this.currentTargetNpc) {
                        npc.knockDown(knockDx, knockDz);
                        return;
                    }
                    if (npc.nftData) {
                        npc.stagger(knockDx, knockDz);
                        npc.enterPanicMode();
                        return;
                    }
                    npc.knockDown(knockDx, knockDz);
                }, knockDelayMs);
            });
        }

        triggerPanicForNearbyWalletNpcs() {
            const panicRadius = 7;
            let panickedCount = 0;
            this.walletNpcs.forEach((npc) => {
                if (!npc || npc.isDestroyed || npc.isFallen) return;
                const dx = npc.surfaceX - this.controls.surfaceX;
                const dz = this.world.shortestArcDelta(this.controls.surfaceArc, npc.surfaceArc);
                if (Math.hypot(dx, dz) > panicRadius) return;
                npc.enterPanicMode();
                panickedCount += 1;
            });
            if (panickedCount > 0) {
                soundscape.playPanic();
            }
        }

        updateAmbientWalletNpcDialog(delta) {
            this.ambientBubbleCheckAccumulator += delta;
            if (this.ambientBubbleCheckAccumulator < this.ambientBubbleCheckInterval) return;
            this.ambientBubbleCheckAccumulator = 0;

            const playerNearby = this.walletNpcs.filter((npc) => {
                if (!npc || !npc.canShowAmbientBubble?.() || npc.isStaggering?.()) return false;
                if (this.mobilePerformanceMode && npc.mobileLodMode !== 'full') return false;
                const dx = npc.surfaceX - this.controls.surfaceX;
                const dz = this.world.shortestArcDelta(this.controls.surfaceArc, npc.surfaceArc);
                return ((dx * dx) + (dz * dz)) <= 100;
            });

            if (!playerNearby.length) return;

            const eligible = [];
            for (let i = 0; i < playerNearby.length; i++) {
                const npc = playerNearby[i];
                const playerDx = npc.surfaceX - this.controls.surfaceX;
                const playerDz = this.world.shortestArcDelta(this.controls.surfaceArc, npc.surfaceArc);
                if (((playerDx * playerDx) + (playerDz * playerDz)) <= 9) {
                    eligible.push(npc);
                    continue;
                }
                for (let j = 0; j < playerNearby.length; j++) {
                    if (i === j) continue;
                    const other = playerNearby[j];
                    const dx = npc.surfaceX - other.surfaceX;
                    const dz = this.world.shortestArcDelta(other.surfaceArc, npc.surfaceArc);
                    if (((dx * dx) + (dz * dz)) <= 4) {
                        eligible.push(npc);
                        break;
                    }
                }
            }

            if (!eligible.length) return;

            const speaker = eligible[Math.floor(Math.random() * eligible.length)];
            const phrase = NPC_AMBIENT_CHATTER_PHRASES[
                Math.floor(Math.random() * NPC_AMBIENT_CHATTER_PHRASES.length)
            ];
            speaker.showAmbientBubble(phrase, 3.2);
        }

        updateTargetArrow() {
            if (!this.targetArrow) return;
            const target = this.currentTargetNpc;
            if (!target || target.isDestroyed || target.isFallen) {
                this.targetArrow.visible = false;
                if (this.targetDebugLine) this.targetDebugLine.visible = false;
                return;
            }
            const playerPos = new THREE.Vector3();
            this.controls.playerGroup.getWorldPosition(playerPos);
            const targetPos = new THREE.Vector3();
            target.playerGroup.getWorldPosition(targetPos);
            if (this.targetDebugLine && !this.mobilePerformanceMode) {
                this.targetDebugLineGeometry.setFromPoints([playerPos, targetPos]);
                this.targetDebugLineGeometry.attributes.position.needsUpdate = true;
                this.targetDebugLine.visible = true;
            } else if (this.targetDebugLine) {
                this.targetDebugLine.visible = false;
            }
            const arrowPos = playerPos.clone();
            this.targetArrowUp.copy(this.controls.up).normalize();
            arrowPos.addScaledVector(this.targetArrowUp, 0.25);
            this.targetArrow.position.copy(arrowPos);
            this.targetArrowDir.copy(targetPos).sub(playerPos);
            const alongUp = this.targetArrowDir.dot(this.targetArrowUp);
            this.targetArrowDir.addScaledVector(this.targetArrowUp, -alongUp);
            if (this.targetArrowDir.lengthSq() < 0.0001) {
                this.targetArrow.visible = false;
                if (this.targetDebugLine) this.targetDebugLine.visible = false;
                return;
            }
            this.targetArrowDir.normalize();
            this.targetArrow.setDirection(this.targetArrowDir);
            this.targetArrow.setLength(1.25, 0.42, 0.24);
            this.targetArrow.visible = true;
        }

        startTargetCycle() {
            if (this.targetCycleTimeoutId) {
                window.clearTimeout(this.targetCycleTimeoutId);
                this.targetCycleTimeoutId = null;
            }
            this.selectNextTarget();
        }

        selectNextTarget() {
            const candidates = this.walletNpcs.filter((npc) => npc && !npc.isDestroyed && !npc.isFallen);
            if (!candidates.length) {
                this.stopTargetCycle();
                return;
            }
            const targetIndex = Math.floor(Math.random() * candidates.length);
            this.currentTargetNpc = candidates[targetIndex];
            const name = sanitizeNodeText(
                this.currentTargetNpc.nftData?.name ||
                    this.currentTargetNpc.nftData?.collection ||
                    'Unknown'
            );
            showKillOverlay(`Kill ${name} NFT`);
            this.updateTargetArrow();
            const preview = this.currentTargetNpc.nftData?.previewUrl || this.currentTargetNpc.nftData?.imageUrl || '';
            this.updateTargetHUD(name, preview);
            this.refreshMobileWalletNpcLod(0, true);
        }

        updateTargetHUD(name, previewUrl) {
            if (this.targetNameLabel) {
                this.targetNameLabel.textContent = name;
            }
            if (this.targetPreviewImage) {
                if (previewUrl) {
                    this.targetPreviewImage.src = previewUrl;
                    this.targetPreviewImage.style.opacity = '1';
                } else {
                    this.targetPreviewImage.src = '';
                    this.targetPreviewImage.style.opacity = '0';
                }
            }
        }

        stopTargetCycle() {
            this.currentTargetNpc = null;
            if (this.targetArrow) {
                this.targetArrow.visible = false;
            }
            if (this.targetDebugLine) {
                this.targetDebugLine.visible = false;
            }
            if (this.targetCycleTimeoutId) {
                window.clearTimeout(this.targetCycleTimeoutId);
                this.targetCycleTimeoutId = null;
            }
            if (killOverlay) {
                killOverlay.classList.add('hidden');
            }
            this.updateTargetHUD('None', '');
            this.refreshMobileWalletNpcLod(0, true);
        }

        handleNpcKilled(npc) {
            if (npc !== this.currentTargetNpc) return;
            playCelebrationSound();
            this.currentTargetNpc = null;
            if (this.targetArrow) this.targetArrow.visible = false;
            if (this.targetDebugLine) this.targetDebugLine.visible = false;
            if (this.targetCycleTimeoutId) {
                window.clearTimeout(this.targetCycleTimeoutId);
            }
            this.targetCycleTimeoutId = window.setTimeout(() => {
                this.selectNextTarget();
            }, 3000);
        }

        handleGroundContextMenu(event) {
            if (this.interaction.isOverScreen) return;
            if (this.controls.isLocked) return;
            if (event.target === document.getElementById('url-input')) return;

            this.setPickMouse(event);
            this.pickRay.setFromCamera(this.pickMouse, camera);
            const hits = this.pickRay.intersectObjects(this.world.groundPickTargets, true);
            if (!hits.length) return;

            event.preventDefault();
            this.pendingAssetPlacement = this.world.groundPlacementFromPoint(hits[0].point);
            if (this.fileInput) {
                this.fileInput.value = '';
                this.fileInput.click();
            }
        }

        async handleAssetUpload(event) {
            const file = event.target.files?.[0];
            const placement = this.pendingAssetPlacement;
            this.pendingAssetPlacement = null;
            if (!file || !placement) return;

            try {
                const object = await this.assetLoader.load(file);
                this.world.placeImportedObject(object, placement, file.name);
                this.css3dScreen.showToast(`Placed ${file.name}`);
            } catch (error) {
                console.error('[chainworld] asset import failed', error);
                this.css3dScreen.showToast(`Could not load ${file.name}`);
            }
        }

        restoreWalletFromQuery() {
            if (!this.walletAddressInput) return;
            const presetAddress = new URL(window.location.href).searchParams.get('wallet');
            if (!presetAddress) return;
            this.walletAddressInput.value = presetAddress;
            this.loadWalletNfts(presetAddress);
        }

        handleWalletSubmit(event) {
            event.preventDefault();
            soundscape.unlock();
            this.loadWalletNfts(this.walletAddressInput?.value || '');
        }

        updateWalletQuery(address) {
            const url = new URL(window.location.href);
            if (address) {
                url.searchParams.set('wallet', address);
            } else {
                url.searchParams.delete('wallet');
            }
            window.history.replaceState({}, '', url);
        }

        restoreDefaultNpc() {
            if (!this.npc) {
                this.npc = new WanderingNPC(scene, this.world);
            }
        }

        removeDefaultNpc() {
            if (!this.npc) return;
            this.npc.destroy();
            this.npc = null;
        }

        clearWalletNpcs() {
            this.walletNpcs.forEach((npc) => npc.destroy());
            this.walletNpcs = [];
            this.ambientBubbleCheckAccumulator = 0;
            this.mobileWalletNpcBudgetAccumulator = 0;
            this.stopTargetCycle();
        }

        async spawnWalletNpcsForNfts(nfts, placements) {
            const spawnArcBase = this.world.spawn.theta * this.world.radius;
            this.removeDefaultNpc();
            this.clearWalletNpcs();

            this.walletNpcs = nfts.map((nft, index) => {
                const npc = new WanderingNPC(scene, this.world, {
                    spawnXOffset: placements[index].x - this.world.spawn.x,
                    spawnArcOffset: placements[index].theta * this.world.radius - spawnArcBase,
                    walkSpeed: 0.95 + Math.random() * 0.45,
                    wanderRadius: 2.8 + Math.random() * 4.6,
                    logicInterval: 0.05 + Math.random() * 0.11,
                    pauseDurationMin: 0.45,
                    pauseDurationMax: 1.9,
                    logLabel: `wallet NPC ${index + 1}`,
                    playerControls: this.controls,
                    mobilePerformanceMode: this.mobilePerformanceMode
                });
                npc.nftData = nft;
                npc.onKnockedDown = (instance) => this.handleNpcKilled(instance);
                return npc;
            });

            const results = await Promise.allSettled(
                this.walletNpcs.map((npc, index) => npc.readyPromise.then((readyNpc) => (
                    readyNpc ? readyNpc.showRandomWalletNft([nfts[index]]) : false
                )))
            );

            let imageCount = 0;
            results.forEach((result) => {
                if (result.status === 'fulfilled' && result.value) {
                    imageCount += 1;
                }
            });
            if (nfts.length) {
                this.startTargetCycle();
            }
            this.refreshMobileWalletNpcLod(0, true);
            return imageCount;
        }

        disposeCubeMaterials(cube) {
            const materials = Array.isArray(cube.material) ? cube.material : [cube.material];
            const uniqueMaterials = [...new Set(materials.filter(Boolean))];
            uniqueMaterials.forEach((material) => {
                if (material.map) {
                    material.map.dispose?.();
                }
                material.dispose?.();
            });
        }

        async applyNftTexture(cube, nft) {
            const candidates = getNftTextureCandidates(nft);
            for (const candidate of candidates) {
                try {
                    const texture = await loadTexture(candidate);
                    const material = createTexturedCubeMaterial(texture);
                    this.disposeCubeMaterials(cube);
                    cube.material = makeRepeatedMaterials(material);
                    cube.material.forEach((entry) => {
                        entry.needsUpdate = true;
                    });
                    return true;
                } catch (error) {
                    console.warn('[chainworld] nft texture failed', candidate, error);
                }
            }
            return false;
        }

        async loadWalletNfts(rawAddress) {
            const requestId = ++this.currentWalletRequest;
            const inputAddress = sanitizeNodeText(rawAddress);
            if (!inputAddress) {
                this.world.clearNftDisplays();
                this.clearWalletNpcs();
                this.restoreDefaultNpc();
                this.updateWalletQuery('');
                setWalletStatus('Enter an Ethereum address to spawn NFT NPCs near the starting area.', false);
                return;
            }

            setWalletStatus('Loading wallet NFTs into the neighborhood...');

            let walletData;
            try {
                walletData = await loadWalletData(inputAddress);
            } catch (error) {
                if (requestId !== this.currentWalletRequest) return;
                this.world.clearNftDisplays();
                this.clearWalletNpcs();
                this.restoreDefaultNpc();
                setWalletStatus(error.message || 'Unable to load wallet NFTs right now.', true);
                return;
            }

            if (requestId !== this.currentWalletRequest) return;

            const nfts = walletData.nfts;
            this.world.clearNftDisplays();
            this.updateWalletQuery(walletData.address);

            if (!nfts.length) {
                this.clearWalletNpcs();
                this.restoreDefaultNpc();
                this.npc.showRandomWalletNft([]);
                setWalletStatus(`No NFTs found for ${shortWalletAddress(walletData.address)}.`, false);
                this.css3dScreen.showToast('No NFTs found for that wallet');
                return;
            }

            const placements = this.world.reserveNftPlacements(nfts.length, walletData.address);
            setWalletStatus(`Spawning ${nfts.length} NFT NPCs for ${shortWalletAddress(walletData.address)}...`);
            const imageCount = await this.spawnWalletNpcsForNfts(nfts, placements);

            if (requestId !== this.currentWalletRequest) return;

            const blankCount = nfts.length - imageCount;
            if (blankCount > 0) {
                setWalletStatus(
                    `Spawned ${nfts.length} NFT NPCs for ${shortWalletAddress(walletData.address)}. ${blankCount} monitors fell back to text because their images would not load.`,
                    false
                );
            } else {
                setWalletStatus(`Spawned ${nfts.length} NFT NPCs for ${shortWalletAddress(walletData.address)}.`, false);
            }
            this.css3dScreen.showToast(`Spawned ${nfts.length} NFT NPCs`);
        }

        animate() {
            requestAnimationFrame(() => this.animate());
            const delta = Math.min(this.clock.getDelta(), 0.05);
            this.controls.update(delta);
            this.npc?.update(delta);
            this.refreshMobileWalletNpcLod(delta);
            this.updateWalletNpcSimulation(delta);
            this.world.updateDayNight(delta);
            this.updateStreetLampLights(delta);
            this.updateAmbientWalletNpcDialog(delta);
            this.audioStateCheckAccumulator += delta;
            if (this.audioStateCheckAccumulator >= 0.2) {
                this.audioStateCheckAccumulator = 0;
                this.hasPanickingWalletNpcs = this.walletNpcs.some((npc) => (
                    npc && !npc.isDestroyed && !npc.isFallen && npc.isPanicking()
                ));
            }
            soundscape.update(delta, { hasPanickingNpcs: this.hasPanickingWalletNpcs });
            renderer.render(scene, camera);
            this.css3dScreen.update();
            this.updateTargetArrow();
        }
    }

    new OneillApp();
})();
