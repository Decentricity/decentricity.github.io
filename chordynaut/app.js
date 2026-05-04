const { useState, useEffect, useRef, useCallback, useMemo } = React;

// Envelope Editor V2 Component
function EnvelopeEditorV2({
    value,
    onChange,
    maxTime = 4,
}) {
    const svgRef = useRef(null);
    const [dragging, setDragging] = useState(null);
    const [tooltip, setTooltip] = useState(null);
    const [altPressed, setAltPressed] = useState(false);

    const width = 260; // Smaller width
    const height = 120; // Smaller height
    const padding = 10;
    const plotWidth = width - 2 * padding;
    const plotHeight = height - 2 * padding;

    // Mapping helpers
    const timeToX = (t) => (t / maxTime) * plotWidth;
    const xToTime = (x) => Math.max(0, Math.min(maxTime, (x / plotWidth) * maxTime));
    const levelToY = (lv) => (1 - lv) * plotHeight;
    const yToLevel = (y) => {
        const lv = 1 - (y / plotHeight);
        return Math.max(0, Math.min(1, lv));
    };

    // Snapping grids
    const timeGrid = [0.05, 0.1, 0.2, 0.5, 1, 2, 3, 4];
    const sustainGrid = [0, 0.25, 0.5, 0.75, 1];

    const snap = (v, grid, pxPerUnit, tolerance = 6) => {
        if (altPressed) return v;
        for (const g of grid) {
            if (Math.abs(v - g) * pxPerUnit < tolerance) return g;
        }
        return v;
    };

    // Convert envelope to seconds for internal use
    const attack = value.attack / 1000;
    const decay = value.decay / 1000;
    const sustain = value.sustain / 100;
    const release = value.release / 1000;

    // Calculate positions
    const ax = timeToX(attack);
    const dx = timeToX(attack + decay);
    const rx = plotWidth - timeToX(release);
    const y1 = levelToY(1);
    const ys = levelToY(sustain);
    const y0 = levelToY(0);

    // Build polyline points
    const points = [
        [0, y0],
        [ax, y1],
        [dx, ys],
        [rx, ys],
        [plotWidth, y0],
    ].map(p => `${p[0] + padding},${p[1] + padding}`).join(' ');

    // Handle positions
    const handles = {
        attack: { x: ax + padding, y: y1 + padding, type: 'attack' },
        decay: { x: dx + padding, y: ys + padding, type: 'decay' },
        sustain: { x: (dx + rx) / 2 + padding, y: ys + padding, type: 'sustain' },
        release: { x: rx + padding, y: ys + padding, type: 'release' },
    };

    const handlePointerDown = (e) => {
        e.preventDefault();
        const svg = svgRef.current;
        const rect = svg.getBoundingClientRect();
        const x = e.clientX - rect.left - padding;
        const y = e.clientY - rect.top - padding;

        // Check handles first (44px touch target)
        const touchSize = 44;
        for (const [key, handle] of Object.entries(handles)) {
            const hx = handle.x - padding;
            const hy = handle.y - padding;
            if (Math.abs(x - hx) < touchSize / 2 && Math.abs(y - hy) < touchSize / 2) {
                setDragging({ type: 'handle', handle: key, startX: x, startY: y });
                return;
            }
        }

        // Check regions
        if (x >= 0 && x <= ax) {
            setDragging({ type: 'region', region: 'attack' });
            handleDrag(x, y, { type: 'region', region: 'attack' });
        } else if (x > ax && x <= dx) {
            setDragging({ type: 'region', region: 'decay' });
            handleDrag(x, y, { type: 'region', region: 'decay' });
        } else if (x > dx && x <= rx) {
            setDragging({ type: 'region', region: 'plateau' });
            handleDrag(x, y, { type: 'region', region: 'plateau' });
        } else if (x > rx && x <= plotWidth) {
            setDragging({ type: 'region', region: 'release' });
            handleDrag(x, y, { type: 'region', region: 'release' });
        }
    };

    const handleDrag = (x, y, dragState) => {
        const newEnv = { ...value };
        const pxPerSecond = plotWidth / maxTime;

        if (dragState.type === 'handle' || dragState.type === 'region') {
            const target = dragState.handle || dragState.region;

            if (target === 'attack') {
                let newAttack = snap(xToTime(x), timeGrid, pxPerSecond);
                newAttack = Math.max(0, Math.min(maxTime - decay / 1000 - release / 1000, newAttack));
                newEnv.attack = newAttack * 1000;
            } else if (target === 'decay') {
                let newDecay = snap(xToTime(x) - attack, timeGrid, pxPerSecond);
                newDecay = Math.max(0, Math.min(maxTime - attack - release / 1000, newDecay));
                newEnv.decay = newDecay * 1000;

                let newSustain = snap(yToLevel(y), sustainGrid, plotHeight);
                newEnv.sustain = newSustain * 100;
            } else if (target === 'sustain' || target === 'plateau') {
                let newSustain = snap(yToLevel(y), sustainGrid, plotHeight);
                newEnv.sustain = newSustain * 100;
            } else if (target === 'release') {
                let newRelease = snap(plotWidth - x, timeGrid, pxPerSecond / maxTime * plotWidth);
                newRelease = xToTime(newRelease);
                newRelease = Math.max(0, Math.min(maxTime - attack - decay / 1000, newRelease));
                newEnv.release = newRelease * 1000;
            }
        }

        onChange(newEnv);

        // Update tooltip
        setTooltip({
            x: x + padding,
            y: y + padding,
            text: `A:${(newEnv.attack / 1000).toFixed(2)}  D:${(newEnv.decay / 1000).toFixed(2)}  S:${(newEnv.sustain / 100).toFixed(2)}  R:${(newEnv.release / 1000).toFixed(2)}`
        });
    };

    const handlePointerMove = (e) => {
        if (!dragging) return;
        e.preventDefault();

        const svg = svgRef.current;
        const rect = svg.getBoundingClientRect();
        const x = e.clientX - rect.left - padding;
        const y = e.clientY - rect.top - padding;

        requestAnimationFrame(() => {
            handleDrag(x, y, dragging);
        });
    };

    const handlePointerUp = (e) => {
        e.preventDefault();
        setDragging(null);
        setTooltip(null);
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Alt') setAltPressed(true);
        };
        const handleKeyUp = (e) => {
            if (e.key === 'Alt') setAltPressed(false);
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    return React.createElement('svg', {
        ref: svgRef,
        width: width,
        height: height,
        style: {
            border: '1px solid rgba(0,255,255,0.2)',
            borderRadius: '4px',
            background: 'rgba(10,15,25,0.5)',
            cursor: dragging ? 'grabbing' : 'grab',
            touchAction: 'none',
            display: 'block',
        },
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerUp,
        onPointerCancel: handlePointerUp,
    },
        // Grid lines
        React.createElement('g', { opacity: 0.15 },
            // Vertical time divisions
            [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].map(t =>
                React.createElement('line', {
                    key: `v${t}`,
                    x1: timeToX(t) + padding,
                    y1: padding,
                    x2: timeToX(t) + padding,
                    y2: height - padding,
                    stroke: '#00ffff',
                    strokeWidth: 0.5,
                })
            ),
            // Horizontal level divisions
            [0.25, 0.5, 0.75].map(lv =>
                React.createElement('line', {
                    key: `h${lv}`,
                    x1: padding,
                    y1: levelToY(lv) + padding,
                    x2: width - padding,
                    y2: levelToY(lv) + padding,
                    stroke: '#00ffff',
                    strokeWidth: 0.5,
                })
            )
        ),

        // ADSR polyline
        React.createElement('polyline', {
            points: points,
            fill: 'none',
            stroke: '#ff0080',
            strokeWidth: 2,
            strokeLinejoin: 'round',
        }),

        // Invisible hit areas for regions (for tap-to-place)
        React.createElement('rect', {
            x: padding,
            y: padding,
            width: ax,
            height: plotHeight,
            fill: 'transparent',
            style: { cursor: 'pointer' }
        }),
        React.createElement('rect', {
            x: ax + padding,
            y: padding,
            width: dx - ax,
            height: plotHeight,
            fill: 'transparent',
            style: { cursor: 'pointer' }
        }),
        React.createElement('rect', {
            x: dx + padding,
            y: padding,
            width: rx - dx,
            height: plotHeight,
            fill: 'transparent',
            style: { cursor: 'pointer' }
        }),
        React.createElement('rect', {
            x: rx + padding,
            y: padding,
            width: plotWidth - rx,
            height: plotHeight,
            fill: 'transparent',
            style: { cursor: 'pointer' }
        }),

        // Handles with large invisible touch targets
        Object.entries(handles).map(([key, handle]) =>
            React.createElement('g', { key: key },
                // Invisible touch target (44x44px)
                React.createElement('circle', {
                    cx: handle.x,
                    cy: handle.y,
                    r: 22,
                    fill: 'transparent',
                    style: { cursor: 'grab' }
                }),
                // Visible handle
                React.createElement('circle', {
                    cx: handle.x,
                    cy: handle.y,
                    r: 4,
                    fill: '#00ffff',
                    stroke: '#ff0080',
                    strokeWidth: 1,
                })
            )
        ),

        // Tooltip
        tooltip && React.createElement('g', null,
            React.createElement('rect', {
                x: Math.min(tooltip.x + 5, width - 140),
                y: tooltip.y - 20,
                width: 135,
                height: 18,
                fill: 'rgba(0,0,0,0.8)',
                rx: 3,
            }),
            React.createElement('text', {
                x: Math.min(tooltip.x + 10, width - 135),
                y: tooltip.y - 8,
                fill: '#00ffff',
                fontSize: 10,
                fontFamily: 'monospace',
            }, tooltip.text)
        )
    );
}

// Metronome Popover Component
function MetronomePopover({ children, onClose }) {
    const popoverRef = useRef(null);

    useEffect(() => {
        const onDoc = (e) => {
            const el = popoverRef.current;
            if (el && !el.contains(e.target)) onClose();
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [onClose]);

    return React.createElement('div', {
        ref: popoverRef,
        className: 'metronome-popover',
        onClick: (e) => e.stopPropagation()
    }, children);
}

// Audio Engine
class AudioEngine {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.chordBus = null;
        this.strumBus = null;
        this.voices = new Map();
        this.maxVoices = 16;
        this.waveform = 'square';
        this.adsr = {
            attack: 10,
            decay: 100,
            sustain: 70,
            release: 200
        };
        this.volume = 0.8;
        this._voiceId = 0;
        this.loopTimer = null;
        
        // Audio recording setup
        this.mediaStreamDest = null;
        this.mediaRecorder = null;
        this.recordedChunks = [];
    }

    init(existingContext = null) {
        if (!this.audioContext) {
            this.audioContext = existingContext || new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = this.volume;
            
            this.chordBus = this.audioContext.createGain();
            this.chordBus.gain.value = 1.0;
            this.chordBus.connect(this.masterGain);
            
            this.strumBus = this.audioContext.createGain();
            this.strumBus.gain.value = 1.0;
            this.strumBus.connect(this.masterGain);
            
            const compressor = this.audioContext.createDynamicsCompressor();
            compressor.threshold.value = -20;
            compressor.knee.value = 10;
            compressor.ratio.value = 12;
            compressor.attack.value = 0;
            compressor.release.value = 0.25;
            
            this.masterGain.connect(compressor);
            compressor.connect(this.audioContext.destination);
            
            // Setup recorder destination
            this.mediaStreamDest = this.audioContext.createMediaStreamDestination();
            this.masterGain.connect(this.mediaStreamDest);
        }
        
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    startRecording() {
        if (!this.mediaStreamDest) return;
        
        this.recordedChunks = [];
        this.mediaRecorder = new MediaRecorder(this.mediaStreamDest.stream);
        this.mediaRecorder.ondataavailable = e => {
            if (e.data.size > 0) {
                this.recordedChunks.push(e.data);
            }
        };
        this.mediaRecorder.start();
    }

    async stopRecording() {
        if (!this.mediaRecorder) return null;
        
        return new Promise((resolve) => {
            this.mediaRecorder.onstop = async () => {
                try {
                    const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
                    const arrayBuffer = await blob.arrayBuffer();
                    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                    resolve(audioBuffer);
                } catch (err) {
                    console.error('Error decoding audio:', err);
                    resolve(null);
                }
            };
            this.mediaRecorder.stop();
        });
    }

    midiToFreq(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    noteOn(midiNote, velocity = 1.0, isChord = false, sampleData = null) {
        this.init();
        
        if (this.voices.has(midiNote)) {
            this.noteOff(midiNote);
        }
        
        const now = this.audioContext.currentTime;
        const freq = this.midiToFreq(midiNote);
        
        if (this.voices.size >= this.maxVoices) {
            const oldestKey = this.voices.keys().next().value;
            this.noteOff(oldestKey);
        }

        const bus = isChord ? this.chordBus : this.strumBus;
        const gainNode = this.audioContext.createGain();

        // Apply ADSR envelope with velocity scaling (convert ms to seconds)
        const attackTime = this.adsr.attack / 1000;
        const decayTime = this.adsr.decay / 1000;
        const targetAmp = this.volume * velocity;
        const sustainLevel = Math.max(0.01, (this.adsr.sustain / 100) * targetAmp);

        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(targetAmp, now + attackTime);
        gainNode.gain.exponentialRampToValueAtTime(sustainLevel, now + attackTime + decayTime);

        let source, filter;

        // Use sampled voice if provided
        if (sampleData && sampleData.buffer) {
            source = this.audioContext.createBufferSource();
            source.buffer = sampleData.buffer;
            source.loop = true;
            const ratio = freq / sampleData.baseFreq;
            source.playbackRate.value = ratio;
            
            filter = this.audioContext.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = freq * 3;
            filter.Q.value = 1;
            
            source.connect(gainNode).connect(filter).connect(bus);
            source.start(now);
        } else {
            // Use oscillator
            source = this.audioContext.createOscillator();
            source.type = this.waveform;
            source.frequency.value = freq;

            filter = this.audioContext.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = freq * 3;
            filter.Q.value = 1;

            source.connect(gainNode).connect(filter).connect(bus);
            source.start(now);
        }

        const id = ++this._voiceId;
        this.voices.set(midiNote, { id, source, gainNode, filter });
    }

    noteOff(midiNote) {
        const voice = this.voices.get(midiNote);
        if (!voice) return;

        const now = this.audioContext.currentTime;
        const releaseTime = this.adsr.release / 1000;
        const expectedId = voice.id;

        voice.gainNode.gain.cancelScheduledValues(now);
        voice.gainNode.gain.setValueAtTime(voice.gainNode.gain.value, now);
        voice.gainNode.gain.exponentialRampToValueAtTime(0.001, now + releaseTime);

        try {
            voice.source.stop(now + releaseTime);
        } catch {}

        setTimeout(() => {
            const v = this.voices.get(midiNote);
            if (v && v.id === expectedId) {
                this.voices.delete(midiNote);
            }
        }, releaseTime * 1000 + 50);
    }

    stopAllImmediately() {
        const now = this.audioContext ? this.audioContext.currentTime : 0;
        this.voices.forEach(voice => {
            try {
                voice.gainNode.gain.cancelScheduledValues(now);
                voice.gainNode.gain.setValueAtTime(0, now);
                voice.source.stop(now);
            } catch {}
        });
        this.voices.clear();
    }

    setWaveform(waveform) {
        this.waveform = waveform;
    }

    setADSR(adsr) {
        this.adsr = { ...this.adsr, ...adsr };
    }

    setVolume(volume) {
        this.volume = volume;
        if (this.masterGain) {
            this.masterGain.gain.setValueAtTime(volume, this.audioContext.currentTime);
        }
    }

    setChordVolume(volume) {
        if (this.chordBus) {
            this.chordBus.gain.setValueAtTime(volume, this.audioContext.currentTime);
        }
    }

    stopAll() {
        this.voices.forEach((voice, note) => {
            this.noteOff(note);
        });
    }
}

// Chord definitions
const CHORD_DEFINITIONS = {
    "maj": [0,4,7],
    "min": [0,3,7],
    "7th": [0,4,7,10],
    "dim": [0,3,6],
    "sus": [0,5,7],
    "maj7": [0,4,7,11],
    "min7": [0,3,7,10],
    "9th": [0,4,7,10,14],
    "min9": [0,3,7,10,14],
    "aug": [0,4,8],
    "add9": [0,4,7,14],
    "11th": [0,4,7,10,14,17],
    "13th": [0,4,7,10,14,17,21]
};

const AVAILABLE_QUALITIES = ["maj7","min7","9th","min9","11th","13th","aug","add9"];
const AVAILABLE_ROOTS = ["C#","D♭","D#","E♭","F#","G♭","G#","A♭","A#","B♭"];

const defaultQualities = ["maj", "min", "7th", "dim", "sus"];

// Mode definitions - melody scale intervals
const MODE_DEFS = {
    ionian: { name: "Major", offsets: [0,2,4,5,7,9,11] },
    dorian: { name: "Dorian", offsets: [0,2,3,5,7,9,10] },
    phrygian: { name: "Phrygian", offsets: [0,1,3,5,7,8,10] },
    lydian: { name: "Lydian", offsets: [0,2,4,6,7,9,11] },
    mixolydian: { name: "Mixolydian", offsets: [0,2,4,5,7,9,10] },
    aeolian: { name: "Natural Minor", offsets: [0,2,3,5,7,8,10] },
    locrian: { name: "Locrian", offsets: [0,1,3,5,6,8,10] },
    harmonicMinor: { name: "Harmonic Minor", offsets: [0,2,3,5,7,8,11] },
    melodicMinor: { name: "Melodic Minor", offsets: [0,2,3,5,7,9,11] },
    majorPentatonic: { name: "Major Pentatonic", offsets: [0,2,4,7,9] },
    minorPentatonic: { name: "Minor Pentatonic", offsets: [0,3,5,7,10] }
};

// Diatonic chord quality tables (triads)
const TRIADS_BY_MODE = {
    ionian: ['maj','min','min','maj','maj','min','dim'],
    dorian: ['min','min','maj','maj','min','dim','maj'],
    phrygian: ['min','maj','maj','min','dim','maj','min'],
    lydian: ['maj','maj','min','dim','maj','min','min'],
    mixolydian: ['maj','min','dim','maj','min','min','maj'],
    aeolian: ['min','dim','maj','min','min','maj','maj'],
    locrian: ['dim','maj','min','min','maj','maj','min'],
    harmonicMinor: ['min','dim','aug','min','maj','maj','dim'],
    melodicMinor: ['min','min','aug','maj','maj','dim','dim']
};

// Diatonic chord quality tables (sevenths)
const SEVENTHS_BY_MODE = {
    ionian: ['maj7','min7','min7','maj7','7th','min7','dim'],
    dorian: ['min7','min7','maj7','7th','min7','dim','maj7'],
    phrygian: ['min7','maj7','7th','min7','dim','maj7','min7'],
    lydian: ['maj7','maj7','min7','dim','maj7','min7','min7'],
    mixolydian: ['7th','min7','dim','maj7','min7','min7','maj7'],
    aeolian: ['min7','dim','maj7','min7','min7','maj7','7th'],
    locrian: ['dim','maj7','min7','min7','maj7','7th','min7'],
    harmonicMinor: ['min7','dim','maj7','min7','7th','maj7','dim'],
    melodicMinor: ['min7','min7','maj7','7th','7th','dim','dim']
};

// Helper: parent mode for pentatonics (for chord qualities)
function parentForPentatonic(mode) {
    if (mode === 'majorPentatonic') return 'ionian';
    if (mode === 'minorPentatonic') return 'aeolian';
    return mode;
}

// Chord Generator
class ChordGenerator {
    constructor() {
        this.chromatic = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    }

    noteToMidi(noteName) {
        const flatToSharp = {
            'D♭': 'C#', 'E♭': 'D#', 'G♭': 'F#', 'A♭': 'G#', 'B♭': 'A#'
        };
        const normalizedNote = flatToSharp[noteName] || noteName;
        
        const baseOctave = 4;
        const index = this.chromatic.indexOf(normalizedNote);
        if (index === -1) return 60;
        return 12 * baseOctave + index;
    }

    midiToNoteName(midiNote) {
        const noteIndex = midiNote % 12;
        const octave = Math.floor(midiNote / 12) - 1;
        return this.chromatic[noteIndex] + octave;
    }

    getChordNotes(root, quality) {
        const baseRoot = this.noteToMidi(root);
        const intervals = CHORD_DEFINITIONS[quality] || CHORD_DEFINITIONS['maj'];
        return intervals.map(interval => baseRoot + interval);
    }

    getStrumNotes(chordNotes) {
        const notes = [];
        const baseNotes = chordNotes.slice();
        
        for (let i = 0; i < 12; i++) {
            const noteIndex = i % baseNotes.length;
            const octave = Math.floor(i / baseNotes.length);
            notes.push(baseNotes[noteIndex] + (octave * 12));
        }
        
        return notes.reverse();
    }
}

// Helper: grid root from tonic (circle of fifths, unchanged)
function gridRootPcForColumn(tonicPc, col) {
    return (tonicPc + 7 * col) % 12;
}

// Build melody notes for strum pad using mode
function buildMelodyLaneNotes({ tonicPc, modeId, laneCount, topMidi = 84, bottomMidi = 48 }) {
    const offsets = MODE_DEFS[modeId].offsets;
    const isScaleTone = (m) => offsets.includes(((m % 12) - tonicPc + 12) % 12);

    const asc = [];
    for (let m = bottomMidi; m <= topMidi; m++) {
        if (isScaleTone(m)) asc.push(m);
    }

    const desc = asc.reverse(); // top = highest, bottom = lowest
    if (desc.length < laneCount) {
        while (desc.length < laneCount) desc.push(desc[desc.length - 1]);
    }
    return desc.slice(0, laneCount);
}

// Pitch detection using autocorrelation
function detectPitch(data, sampleRate) {
    let bestOffset = -1, bestCorr = 0;
    for (let offset = 50; offset < 1000; offset++) {
        let corr = 0;
        for (let i = 0; i < data.length - offset; i++) {
            corr += data[i] * data[i + offset];
        }
        if (corr > bestCorr) {
            bestCorr = corr;
            bestOffset = offset;
        }
    }
    return bestOffset > 0 ? sampleRate / bestOffset : 440;
}

// Orientation check
function checkOrientation() {
    const isLandscape = window.innerWidth > window.innerHeight;
    const orientationLock = document.getElementById('orientation-lock');
    const root = document.getElementById('root');
    
    if (isLandscape) {
        orientationLock.style.display = 'none';
        root.classList.remove('hidden');
        setTimeout(() => {
            if (window.recomputeLayout) window.recomputeLayout();
        }, 100);
    } else {
        orientationLock.style.display = 'flex';
        root.classList.add('hidden');
    }
}

function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
           (navigator.userAgent.includes("Mac") && "ontouchend" in document);
}

// iOS Audio Start Overlay Component
function IOSStartOverlay({ onStart }) {
    const handleStart = useCallback(() => {
        const AC = window.AudioContext || window.webkitAudioContext;
        const ctx = new AC();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0.0001;
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.02);
        ctx.resume();
        
        onStart(ctx);
    }, [onStart]);

    return React.createElement('div', {
        id: 'ios-start-overlay',
        onClick: handleStart,
        style: {
            position: 'fixed',
            inset: 0,
            background: 'black',
            color: 'white',
            fontFamily: 'sans-serif',
            fontSize: '1.2em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            zIndex: 9999,
            cursor: 'pointer',
            padding: '2rem'
        }
    }, 'tap anywhere to start (use one finger)');
}

// About Overlay Component
function AboutOverlay({ onClose }) {
    const isMobile = window.innerWidth < 1024;

    useEffect(() => {
        if (window.recomputeLayout) {
            window.recomputeLayout();
        }
        return () => {
            if (window.recomputeLayout) {
                setTimeout(() => window.recomputeLayout(), 0);
            }
        };
    }, []);

    return React.createElement('div', {
        className: 'config-overlay',
        style: { zIndex: 10000 }
    },
        React.createElement('div', {
            style: {
                width: '100%',
                maxWidth: '600px',
                background: 'rgba(26, 26, 46, 0.98)',
                borderRadius: '12px',
                padding: '30px',
                position: 'relative'
            }
        },
            React.createElement('h2', {
                style: {
                    fontSize: '1.8em',
                    marginBottom: '20px',
                    color: '#e94560',
                    textAlign: 'center'
                }
            }, 'About Chordynaut'),
            
            React.createElement('div', {
                style: {
                    fontSize: '1.1em',
                    lineHeight: '1.8',
                    color: '#e0e0e0',
                    marginBottom: '30px'
                }
            },
                React.createElement('p', { style: { marginBottom: '15px' } },
                    'Chordynaut was made by ',
                    React.createElement('a', {
                        href: 'https://x.com/decentricity',
                        target: '_blank',
                        rel: 'noopener noreferrer',
                        style: { color: '#2ec4b6', textDecoration: 'underline' }
                    }, 'Decentricity'),
                    ' / ',
                    React.createElement('a', {
                        href: 'https://linkedin.com/in/decentricity',
                        target: '_blank',
                        rel: 'noopener noreferrer',
                        style: { color: '#2ec4b6', textDecoration: 'underline' }
                    }, 'Ms. Pandu Sastrowardoyo'),
                    ' with the help of ',
                    React.createElement('a', {
                        href: 'https://berrry.app',
                        target: '_blank',
                        rel: 'noopener noreferrer',
                        style: { color: '#2ec4b6', textDecoration: 'underline' }
                    }, 'Berrry'),
                    ' by ',
                    React.createElement('a', {
                        href: 'https://x.com/vgrichina',
                        target: '_blank',
                        rel: 'noopener noreferrer',
                        style: { color: '#2ec4b6', textDecoration: 'underline' }
                    }, 'vlad.near'),
                    '.'
                ),
                React.createElement('p', null,
                    'This instrument is inspired by the autoharps of the early 20th century as well as the Suzuki Omnichord, a digital harp created in the 1980s.'
                ),
                isMobile && React.createElement('p', {
                    style: { marginTop: '1em', fontSize: '0.9em', opacity: 0.8, textAlign: 'center' }
                }, 'For the best experience, scroll up once until this app fills your screen, then press OK.')
            ),
            
            React.createElement('button', {
                onClick: () => {
                    onClose();
                    if (window.recomputeLayout) {
                        setTimeout(() => window.recomputeLayout(), 0);
                    }
                },
                style: {
                    background: '#ff6faf',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 40px',
                    fontWeight: 'bold',
                    fontSize: '1.1em',
                    color: 'black',
                    cursor: 'pointer',
                    width: '100%',
                    transition: 'all 0.2s'
                },
                onMouseEnter: (e) => {
                    e.target.style.background = '#ff85bf';
                    e.target.style.transform = 'scale(1.05)';
                },
                onMouseLeave: (e) => {
                    e.target.style.background = '#ff6faf';
                    e.target.style.transform = 'scale(1)';
                }
            }, 'OK')
        )
    );
}

function getRowColor(quality, index) {
    if (defaultQualities.includes(quality)) return "";
    const hues = [200, 260, 320, 30, 90, 140];
    const hue = hues[index % hues.length];
    return `hsl(${hue}, 70%, 50%)`;
}

// Main App Component
function App() {
    const audioEngineRef = useRef(new AudioEngine());
    const chordGenRef = useRef(new ChordGenerator());
    
    // Anti-race guard for strum starts
    const recentStrumStarts = useRef(new Map());
    const STRUM_RECENT_TTL = 0.15;
    const STRUM_ZONES_COUNT = 12;
    
    const TONICS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    
    const [waveform, setWaveform] = useState('square');
    const [adsr, setAdsr] = useState({ attack: 10, decay: 100, sustain: 70, release: 200 });
    const [tonic, setTonic] = useState(() => {
        return localStorage.getItem('chordynaut.tonic') || 'F';
    });
    const [mode, setMode] = useState(() => {
        return localStorage.getItem('chordynaut.mode') || 'ionian';
    });
    const [latch, setLatch] = useState(false);
    const [chordVolume, setChordVolume] = useState(1.0);
    const [currentChord, setCurrentChord] = useState(null);
    const [activeChordButton, setActiveChordButton] = useState(null);
    const [activeStrumZones, setActiveStrumZones] = useState(new Set());
    const [strumPointers, setStrumPointers] = useState(new Map());
    const [showSettings, setShowSettings] = useState(false);
    const [showIOSOverlay, setShowIOSOverlay] = useState(isIOS());
    const [showConfig, setShowConfig] = useState(false);
    const [showAbout, setShowAbout] = useState(false);
    
    // Countdown state
    const [countdown, setCountdown] = useState(0);
    const countdownTimerRef = useRef(null);
    const countdownActionRef = useRef(null);
    
    // Microphone sampling state
    const [sampleData, setSampleData] = useState({
        buffer: null,
        baseFreq: 440,
        isActive: false
    });
    const [currentVoice, setCurrentVoice] = useState('square');
    const [isRecordingSample, setIsRecordingSample] = useState(false);
    const [isClearSampleConfirmOpen, setIsClearSampleConfirmOpen] = useState(false);
    
    // Metronome state
    const [bpm, setBpm] = useState(100);
    const [timeSignature, setTimeSignature] = useState("4/4");
    const [isMetronomeOn, setIsMetronomeOn] = useState(false);
    const [barCount, setBarCount] = useState(0);
    const [metronomeMuted, setMetronomeMuted] = useState(false);
    const [currentBeat, setCurrentBeat] = useState(-1);
    const [showMetronomePopover, setShowMetronomePopover] = useState(false);
    
    const [extraRoots, setExtraRoots] = useState([]);
    const [extraQualities, setExtraQualities] = useState([]);
    
    const [isRecording, setIsRecording] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [recordedEvents, setRecordedEvents] = useState([]);
    const [recordStart, setRecordStart] = useState(0);
    
    // Loop state
    const [loopBuffers, setLoopBuffers] = useState([]);
    const [isLooping, setIsLooping] = useState(false);
    const [isOverdubbing, setIsOverdubbing] = useState(false);
    const [loopStartedMetronome, setLoopStartedMetronome] = useState(false);
    const loopStartTimeRef = useRef(0);
    
    // Loop length state with persistence
    const [loopLength, setLoopLength] = useState(() => {
        const v = localStorage.getItem('chordynaut.loopBars');
        const n = v ? parseInt(v, 10) : 4;
        return Number.isFinite(n) && n > 0 ? n : 4;
    });
    
    // Clear loop confirmation state
    const [isClearLoopConfirmOpen, setIsClearLoopConfirmOpen] = useState(false);
    
    useEffect(() => {
        localStorage.setItem('chordynaut.loopBars', String(loopLength));
    }, [loopLength]);
    
    // Download state
    const [isDownloadOpen, setIsDownloadOpen] = useState(false);
    
    // Event tracking refs for export
    const loopEventsRef = useRef([]);
    const performanceEventsRef = useRef([]);
    
    const chordPointersRef = useRef(new Map());
    const currentChordRef = useRef(null);
    
    // Melody mode override
    const strumNotesOverrideRef = useRef(null);

    // Persist tonic and mode
    useEffect(() => {
        localStorage.setItem('chordynaut.tonic', tonic);
    }, [tonic]);

    useEffect(() => {
        localStorage.setItem('chordynaut.mode', mode);
    }, [mode]);

    const ROOTS = useMemo(() => {
        const chromatic = chordGenRef.current.chromatic;
        const fifthsPattern = [0, 7, 2, 9, 4, 11, 6];
        const tonicIndex = chromatic.indexOf(tonic);
        return fifthsPattern.map(offset => chromatic[(tonicIndex + offset) % 12]);
    }, [tonic]);

    const roots = useMemo(() => [...ROOTS, ...extraRoots], [ROOTS, extraRoots]);
    
    // Get chord qualities based on selected mode
    const qualities = useMemo(() => {
        const parentMode = parentForPentatonic(mode);
        const triads = TRIADS_BY_MODE[parentMode] || TRIADS_BY_MODE.ionian;
        const sevenths = SEVENTHS_BY_MODE[parentMode] || SEVENTHS_BY_MODE.ionian;
        
        // Map degrees to column colors based on quality
        const qualityColors = {
            'maj': ["#4f83ff","#4a78f0","#456edc","#3f65c8","#395bb4","#3452a0","#2e488c"],
            'min': ["#b15cff","#a456f0","#974add","#8a3fca","#7d34b6","#7029a3","#631f8f"],
            '7th': ["#ff77c7","#f46fbc","#e964b2","#de59a7","#d34f9d","#c84592","#bd3a88"],
            'dim': ["#ffcc5c","#f0be56","#e0b24d","#d1a544","#c1983a","#b18b31","#a17f28"],
            'sus': ["#33d681","#30c877","#2eba6d","#2bac63","#289e59","#26904f","#238245"],
            'aug': ["#ff6b35","#f26430","#e55d2a","#d85624","#cb4f1f","#be4819","#b14114"]
        };
        
        const base = [
            { label: 'maj', key: 'maj', colors: qualityColors['maj'] },
            { label: 'min', key: 'min', colors: qualityColors['min'] },
            { label: '7th', key: '7th', colors: qualityColors['7th'] },
            { label: 'dim', key: 'dim', colors: qualityColors['dim'] },
            { label: 'sus', key: 'sus', colors: qualityColors['sus'] }
        ];
        
        const extra = extraQualities.map((q, idx) => ({
            label: q,
            key: q,
            colors: Array(7).fill(getRowColor(q, idx))
        }));
        
        return [...base, ...extra];
    }, [mode, extraQualities]);

    const beatsPerBar = useMemo(() => parseInt(timeSignature.split("/")[0]), [timeSignature]);

    // Auto-open About overlay on first load
    useEffect(() => {
        const timer = setTimeout(() => {
            setShowAbout(true);
        }, 400);
        return () => clearTimeout(timer);
    }, []);

    // Universal countdown helper
    const startCountdown = useCallback((seconds, onDone) => {
        if (countdownTimerRef.current) return;
        setCountdown(seconds);
        countdownActionRef.current = onDone;

        let n = seconds;
        countdownTimerRef.current = setInterval(() => {
            n -= 1;
            if (n > 0) {
                setCountdown(n);
            } else {
                clearInterval(countdownTimerRef.current);
                countdownTimerRef.current = null;
                setCountdown(0);
                const cb = countdownActionRef.current;
                countdownActionRef.current = null;
                if (typeof cb === 'function') cb();
            }
        }, 1000);
    }, []);

    // Countdown cancellation helper
    const cancelCountdown = useCallback(() => {
        if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
        }
        setCountdown(0);
        countdownActionRef.current = null;
    }, []);

    // Helper functions for anti-race guard
    const markRecentStrum = useCallback((midi) => {
        const ac = audioEngineRef.current?.audioContext;
        if (!ac) return;
        recentStrumStarts.current.set(midi, ac.currentTime);
    }, []);

    const isRecentStrum = useCallback((midi) => {
        const ac = audioEngineRef.current?.audioContext;
        if (!ac) return false;
        const t = recentStrumStarts.current.get(midi);
        return t != null && (ac.currentTime - t) < STRUM_RECENT_TTL;
    }, []);

    const gcRecentStrums = useCallback(() => {
        const ac = audioEngineRef.current?.audioContext;
        if (!ac) return;
        const now = ac.currentTime;
        for (const [midi, t] of recentStrumStarts.current) {
            if (now - t >= STRUM_RECENT_TTL) recentStrumStarts.current.delete(midi);
        }
    }, []);

    // Helper functions for download
    const ts = useCallback(() => {
        return new Date().toISOString().replace(/[:.]/g, '-');
    }, []);

    const saveBlob = useCallback((name, blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
    }, []);

    // Convert AudioBuffer to WAV Blob
    const audioBufferToWav = useCallback((audioBuffer) => {
        const numChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const format = 1;
        const bitDepth = 16;
        
        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;
        
        const data = [];
        for (let i = 0; i < numChannels; i++) {
            data.push(audioBuffer.getChannelData(i));
        }
        
        const interleaved = new Int16Array(audioBuffer.length * numChannels);
        for (let i = 0; i < audioBuffer.length; i++) {
            for (let channel = 0; channel < numChannels; channel++) {
                const sample = Math.max(-1, Math.min(1, data[channel][i]));
                interleaved[i * numChannels + channel] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            }
        }
        
        const buffer = new ArrayBuffer(44 + interleaved.length * 2);
        const view = new DataView(buffer);
        
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };
        
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + interleaved.length * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);
        writeString(36, 'data');
        view.setUint32(40, interleaved.length * 2, true);
        
        const interleavedView = new Int16Array(buffer, 44);
        interleavedView.set(interleaved);
        
        return new Blob([buffer], { type: 'audio/wav' });
    }, []);

    // Export function
    const exportSelection = useCallback(async (kind) => {
        const files = [];
        const stamp = ts();
        
        if (kind === 'loop_json' || kind === 'all') {
            if (loopEventsRef.current?.length) {
                files.push({
                    name: `loop_${stamp}.json`,
                    blob: new Blob([JSON.stringify({
                        type: 'loop',
                        events: loopEventsRef.current,
                        bpm: bpm,
                        timeSignature: timeSignature,
                        tonic: tonic
                    }, null, 2)], { type: 'application/json' })
                });
            }
        }
        
        if (kind === 'performance_json' || kind === 'all') {
            if (performanceEventsRef.current?.length) {
                files.push({
                    name: `performance_${stamp}.json`,
                    blob: new Blob([JSON.stringify({
                        type: 'performance',
                        events: performanceEventsRef.current,
                        bpm: bpm,
                        timeSignature: timeSignature,
                        tonic: tonic
                    }, null, 2)], { type: 'application/json' })
                });
            }
        }
        
        if ((kind === 'loop_wav' || kind === 'all') && loopBuffers.length > 0) {
            const ac = audioEngineRef.current.audioContext;
            const totalLength = loopBuffers.reduce((sum, buf) => sum + buf.length, 0);
            const mergedBuffer = ac.createBuffer(
                loopBuffers[0].numberOfChannels,
                totalLength,
                loopBuffers[0].sampleRate
            );
            
            let offset = 0;
            loopBuffers.forEach(buf => {
                for (let ch = 0; ch < buf.numberOfChannels; ch++) {
                    mergedBuffer.getChannelData(ch).set(buf.getChannelData(ch), offset);
                }
                offset += buf.length;
            });
            
            const wavBlob = audioBufferToWav(mergedBuffer);
            files.push({ name: `loop_${stamp}.wav`, blob: wavBlob });
        }
        
        if ((kind === 'performance_wav' || kind === 'all') && window.performanceWavBlob) {
            files.push({ name: `performance_${stamp}.wav`, blob: window.performanceWavBlob });
        }
        
        if (!files.length) return;
        
        if (files.length === 1 && kind !== 'all') {
            saveBlob(files[0].name, files[0].blob);
            setIsDownloadOpen(false);
            return;
        }
        
        const { default: JSZip } = await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm');
        const zip = new JSZip();
        files.forEach(f => zip.file(f.name, f.blob));
        const blob = await zip.generateAsync({ type: 'blob' });
        saveBlob(`chordynaut_export_${stamp}.zip`, blob);
        setIsDownloadOpen(false);
    }, [bpm, timeSignature, tonic, loopBuffers, ts, saveBlob, audioBufferToWav]);

    const handleIOSStart = useCallback((audioContext) => {
        audioEngineRef.current.init(audioContext);
        setShowIOSOverlay(false);
    }, []);

    // Microphone sampling function
    const startMicSample = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const ac = audioEngineRef.current?.audioContext || new (window.AudioContext || window.webkitAudioContext)();
            audioEngineRef.current.init(ac);
            
            const source = ac.createMediaStreamSource(stream);
            const processor = ac.createScriptProcessor(4096, 1, 1);
            const chunks = [];
            
            source.connect(processor);
            processor.connect(ac.destination);
            setIsRecordingSample(true);

            processor.onaudioprocess = (e) => {
                const input = e.inputBuffer.getChannelData(0);
                chunks.push(new Float32Array(input));
            };

            setTimeout(async () => {
                processor.disconnect();
                source.disconnect();
                stream.getTracks().forEach(track => track.stop());
                setIsRecordingSample(false);

                const bufferLength = chunks.reduce((a, c) => a + c.length, 0);
                const merged = new Float32Array(bufferLength);
                let offset = 0;
                for (const c of chunks) {
                    merged.set(c, offset);
                    offset += c.length;
                }

                const buffer = ac.createBuffer(1, merged.length, ac.sampleRate);
                buffer.copyToChannel(merged, 0, 0);

                const baseFreq = detectPitch(merged, ac.sampleRate);

                setSampleData({ buffer, baseFreq, isActive: true });
                setCurrentVoice('sample');
            }, 1500);

        } catch (err) {
            console.error("Mic access failed:", err);
            alert("Microphone access denied or unavailable");
            setIsRecordingSample(false);
        }
    }, []);

    const clearSample = useCallback(() => {
        setSampleData({ buffer: null, baseFreq: 440, isActive: false });
        setCurrentVoice('square');
    }, []);

    useEffect(() => {
        if (currentVoice !== 'sample') {
            audioEngineRef.current.setWaveform(currentVoice);
        }
    }, [currentVoice]);

    useEffect(() => {
        audioEngineRef.current.setADSR(adsr);
    }, [adsr]);

    useEffect(() => {
        currentChordRef.current = currentChord;
    }, [currentChord]);

    useEffect(() => {
        setTimeout(() => {
            if (window.recomputeLayout) window.recomputeLayout();
        }, 50);
    }, [showSettings]);

    // Melody mode: toggle override based on chord state, tonic, and mode
    useEffect(() => {
        const anyChordDown = chordPointersRef.current.size > 0;
        
        if (!anyChordDown) {
            // Melody mode ON - rebuild with current mode
            const chromatic = chordGenRef.current.chromatic;
            const tonicPc = chromatic.indexOf(tonic);
            strumNotesOverrideRef.current = buildMelodyLaneNotes({
                tonicPc,
                modeId: mode,
                laneCount: STRUM_ZONES_COUNT,
                topMidi: 84,
                bottomMidi: 48
            });
        } else {
            // Chord mode ON
            strumNotesOverrideRef.current = null;
        }
    }, [tonic, mode, currentChord]);

    // Initialize melody mode on startup
    useEffect(() => {
        const chromatic = chordGenRef.current.chromatic;
        const tonicPc = chromatic.indexOf(tonic);
        strumNotesOverrideRef.current = buildMelodyLaneNotes({
            tonicPc,
            modeId: mode,
            laneCount: STRUM_ZONES_COUNT,
            topMidi: 84,
            bottomMidi: 48
        });
    }, []);

    useEffect(() => {
        if (!isMetronomeOn) {
            setCurrentBeat(-1);
            return;
        }

        const ac = audioEngineRef.current?.audioContext ||
                  new (window.AudioContext || window.webkitAudioContext)();

        let beat = 0;
        const interval = (60 / bpm) * 1000;

        const click = () => {
            setCurrentBeat(beat);
            
            if (!metronomeMuted) {
                const osc = ac.createOscillator();
                const gain = ac.createGain();
                gain.gain.value = beat === 0 ? 0.3 : 0.15;
                osc.frequency.value = beat === 0 ? 1200 : 800;
                osc.connect(gain).connect(ac.destination);
                osc.start();
                osc.stop(ac.currentTime + 0.05);
            }

            beat = (beat + 1) % beatsPerBar;
            if (beat === 0) setBarCount(prev => prev + 1);
        };

        click();
        const timer = setInterval(click, interval);
        return () => {
            clearInterval(timer);
            setCurrentBeat(-1);
        };
    }, [isMetronomeOn, bpm, beatsPerBar, metronomeMuted]);

    // Loop playback
    useEffect(() => {
        if (!isLooping || loopBuffers.length === 0) return;
        
        const ac = audioEngineRef.current.audioContext;
        const loopDur = loopLength * beatsPerBar * (60 / bpm);
        
        const playAllLoops = () => {
            const now = ac.currentTime;
            loopBuffers.forEach(buffer => {
                const src = ac.createBufferSource();
                src.buffer = buffer;
                src.connect(audioEngineRef.current.masterGain);
                src.start(now);
            });
        };

        playAllLoops();
        const timer = setInterval(playAllLoops, loopDur * 1000);

        return () => clearInterval(timer);
    }, [isLooping, loopBuffers, loopLength, bpm, beatsPerBar]);

    useEffect(() => {
        return () => {
            if (audioEngineRef.current.loopTimer) {
                clearInterval(audioEngineRef.current.loopTimer);
            }
        };
    }, []);

    useEffect(() => {
        const hardKill = () => {
            audioEngineRef.current.stopAllImmediately();
            chordPointersRef.current.clear();
            setActiveStrumZones(new Set());
            setStrumPointers(new Map());
            setActiveChordButton(null);
            setCurrentChord(null);
        };

        const onVis = () => {
            if (document.hidden) hardKill();
        };

        window.addEventListener('blur', hardKill);
        document.addEventListener('visibilitychange', onVis);

        return () => {
            window.removeEventListener('blur', hardKill);
            document.removeEventListener('visibilitychange', onVis);
        };
    }, []);

    const getZoneFromPointer = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const zoneHeight = rect.height / 12;
        const zone = Math.floor(y / zoneHeight);
        return zone >= 0 && zone < 12 ? zone : -1;
    };

    const recordEvent = useCallback((type, note, velocity = 1.0, source = 'performance') => {
        if (!isRecording && !isOverdubbing) return;
        const ac = audioEngineRef.current?.audioContext;
        if (!ac) return;
        
        const now = ac.currentTime;
        const event = {
            time: now - recordStart,
            type: type,
            note: note,
            velocity: velocity,
            source: source
        };
        
        if (isRecording) {
            setRecordedEvents(prev => [...prev, event]);
            performanceEventsRef.current = [...performanceEventsRef.current, event];
        }
        
        if (isOverdubbing) {
            loopEventsRef.current = [...loopEventsRef.current, event];
        }
    }, [isRecording, isOverdubbing, recordStart]);

    const startLoopRecording = useCallback(async (lengthBars) => {
        const ac = audioEngineRef.current?.audioContext;
        if (!ac) return;
        
        const loopDur = lengthBars * beatsPerBar * (60 / bpm);
        
        audioEngineRef.current.startRecording();
        setIsOverdubbing(true);
        setBarCount(0);
        loopStartTimeRef.current = ac.currentTime;
        
        setTimeout(async () => {
            const audioBuffer = await audioEngineRef.current.stopRecording();
            if (audioBuffer) {
                setLoopBuffers(prev => [...prev, audioBuffer]);
                console.log('Recorded loop buffer, duration:', audioBuffer.duration);
            }
            setIsOverdubbing(false);
        }, loopDur * 1000);
        
    }, [beatsPerBar, bpm]);

    const playRecording = useCallback(() => {
        if (!recordedEvents.length) return;
        const ac = audioEngineRef.current?.audioContext;
        if (!ac) return;

        setIsPlaying(true);
        const startTime = ac.currentTime;

        recordedEvents.forEach(ev => {
            const delay = ev.time * 1000;
            setTimeout(() => {
                if (ev.type === "noteOn") {
                    audioEngineRef.current.noteOn(ev.note, ev.velocity);
                } else if (ev.type === "noteOff") {
                    audioEngineRef.current.noteOff(ev.note);
                }
            }, delay);
        });

        const total = recordedEvents.at(-1)?.time || 0;
        setTimeout(() => setIsPlaying(false), (total + 0.2) * 1000);
    }, [recordedEvents]);

    const playChord = useCallback((root, quality) => {
        const engine = audioEngineRef.current;
        const chordGen = chordGenRef.current;
        const oldChord = currentChordRef.current;
        
        const newChordNotes = chordGen.getChordNotes(root, quality);
        const newStrumNotes = chordGen.getStrumNotes(newChordNotes);
        
        setCurrentChord({ root, quality, notes: newChordNotes, strumNotes: newStrumNotes });
        setActiveChordButton(`${root}-${quality}`);
        
        // Clear melody override (chord mode ON)
        strumNotesOverrideRef.current = null;
        
        // Retarget strum pointers
        setStrumPointers(prev => {
            const next = new Map(prev);
            for (const [pid, p] of next.entries()) {
                const desired = newStrumNotes[p.zone] ?? null;

                if (p.note != null && p.note !== desired) {
                    engine.noteOff(p.note);
                    recordEvent("noteOff", p.note);
                }

                if (desired != null) {
                    const sample = currentVoice === 'sample' ? sampleData : null;
                    engine.noteOn(desired, p.velocity, false, sample);
                    recordEvent("noteOn", desired, p.velocity);
                    markRecentStrum(desired);
                    p.note = desired;
                    setActiveStrumZones(prevZones => {
                        const nz = new Set(prevZones);
                        nz.add(p.zone);
                        return nz;
                    });
                } else {
                    p.note = null;
                    setActiveStrumZones(prevZones => {
                        const nz = new Set(prevZones);
                        nz.delete(p.zone);
                        return nz;
                    });
                }
            }
            return next;
        });
        
        // Start chord tones
        const sample = currentVoice === 'sample' ? sampleData : null;
        newChordNotes.forEach(n => {
            engine.noteOn(n, 1.0, true, sample);
            recordEvent("noteOn", n, 1.0);
        });
        
        // Guarded cleanup
        setTimeout(() => {
            gcRecentStrums();
            if (!engine) return;

            const chordSet = new Set((currentChordRef.current?.notes) || newChordNotes);

            function heldByStrum(midi) {
                let held = false;
                setStrumPointers(prev => {
                    for (const [, p] of prev) { 
                        if (p.note === midi) { 
                            held = true; 
                            break; 
                        } 
                    }
                    return prev;
                });
                return held;
            }

            engine.voices.forEach((voice, midi) => {
                if (!chordSet.has(midi) && !heldByStrum(midi) && !isRecentStrum(midi)) {
                    engine.noteOff(midi);
                }
            });
        }, 60);
    }, [recordEvent, currentVoice, sampleData, markRecentStrum, gcRecentStrums, isRecentStrum]);

    const releaseChord = useCallback(() => {
        if (latch) return;
        
        const engine = audioEngineRef.current;
        if (!engine) return;
        
        const chord = currentChordRef.current;
        
        if (chord) {
            const allChordNotes = new Set([
                ...(chord.notes || []),
                ...(chord.strumNotes || [])
            ]);
            
            for (const [midi, v] of engine.voices.entries()) {
                if (allChordNotes.has(midi)) {
                    engine.noteOff(midi);
                    recordEvent("noteOff", midi);
                }
            }
        }
        
        engine.stopAllImmediately();
        
        currentChordRef.current = null;
        setCurrentChord(null);
        setActiveChordButton(null);
        setActiveStrumZones(new Set());
        setStrumPointers(new Map());
        
        // Restore melody override
        const chromatic = chordGenRef.current.chromatic;
        const tonicPc = chromatic.indexOf(tonic);
        strumNotesOverrideRef.current = buildMelodyLaneNotes({
            tonicPc,
            modeId: mode,
            laneCount: STRUM_ZONES_COUNT,
            topMidi: 84,
            bottomMidi: 48
        });
    }, [latch, recordEvent, tonic, mode]);

    const handleChordPointerDown = useCallback((e, root, quality) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        
        chordPointersRef.current.set(e.pointerId, { root, quality });
        
        playChord(root, quality);
    }, [playChord]);

    const handleChordPointerUp = useCallback((e) => {
        e.preventDefault();
        e.currentTarget.releasePointerCapture?.(e.pointerId);
        
        chordPointersRef.current.delete(e.pointerId);
        
        if (chordPointersRef.current.size === 0 && !latch) {
            const engine = audioEngineRef.current;
            if (engine) {
                for (const pointer of strumPointers.values()) {
                    if (pointer.note != null) {
                        engine.noteOff(pointer.note);
                        recordEvent("noteOff", pointer.note);
                    }
                }
            }
            
            releaseChord();
        }
    }, [releaseChord, latch, strumPointers, recordEvent]);

    const handleChordPointerCancel = useCallback((e) => {
        e.preventDefault();
        e.currentTarget.releasePointerCapture?.(e.pointerId);
        
        chordPointersRef.current.delete(e.pointerId);
        
        if (chordPointersRef.current.size === 0 && !latch) {
            const engine = audioEngineRef.current;
            if (engine) {
                for (const pointer of strumPointers.values()) {
                    if (pointer.note != null) {
                        engine.noteOff(pointer.note);
                        recordEvent("noteOff", pointer.note);
                    }
                }
            }
            
            releaseChord();
        }
    }, [releaseChord, latch, strumPointers, recordEvent]);

    const handleStrumPointerDown = useCallback((e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);

        const zone = getZoneFromPointer(e);
        if (zone === -1) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const relX = (e.clientX - rect.left) / rect.width;
        const velocity = Math.min(1, Math.max(0.05, relX));

        // Get active strum notes (melody or chord)
        const activeStrumNotes = strumNotesOverrideRef.current || currentChord?.strumNotes || [];
        
        let note = activeStrumNotes[zone] ?? null;
        if (note) {
            const prev = strumPointers.get(e.pointerId);
            if (!prev || prev.note !== note) {
                const sample = currentVoice === 'sample' ? sampleData : null;
                audioEngineRef.current.noteOn(note, velocity, false, sample);
                recordEvent("noteOn", note, velocity);
                markRecentStrum(note);
            }
        }

        setStrumPointers(prev => {
            const next = new Map(prev);
            next.set(e.pointerId, { zone, velocity, note });
            return next;
        });
        if (note !== null) {
            setActiveStrumZones(prev => new Set(prev).add(zone));
        }
    }, [currentChord, recordEvent, currentVoice, sampleData, strumPointers, markRecentStrum]);

    const handleStrumPointerMove = useCallback((e) => {
        e.preventDefault();
        const pointer = strumPointers.get(e.pointerId);
        if (!pointer) return;

        const newZone = getZoneFromPointer(e);
        if (newZone === -1) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const relX = (e.clientX - rect.left) / rect.width;
        const velocity = Math.min(1, Math.max(0.05, relX));

        const activeStrumNotes = strumNotesOverrideRef.current || currentChord?.strumNotes || [];

        if (!activeStrumNotes.length) {
            setStrumPointers(prev => {
                const next = new Map(prev);
                const p = next.get(e.pointerId);
                if (p) { p.zone = newZone; p.velocity = velocity; }
                return next;
            });
            return;
        }

        if (pointer.note != null && newZone !== pointer.zone) {
            audioEngineRef.current.noteOff(pointer.note);
            recordEvent("noteOff", pointer.note);
            setActiveStrumZones(prev => {
                const nz = new Set(prev);
                nz.delete(pointer.zone);
                return nz;
            });
        }

        const newNote = activeStrumNotes[newZone] ?? null;
        if (newNote != null) {
            const sample = currentVoice === 'sample' ? sampleData : null;
            audioEngineRef.current.noteOn(newNote, velocity, false, sample);
            recordEvent("noteOn", newNote, velocity);
            markRecentStrum(newNote);
            setStrumPointers(prev => {
                const next = new Map(prev);
                next.set(e.pointerId, { zone: newZone, velocity, note: newNote });
                return next;
            });
            setActiveStrumZones(prev => {
                const nz = new Set(prev);
                nz.add(newZone);
                return nz;
            });
        } else {
            setStrumPointers(prev => {
                const next = new Map(prev);
                next.set(e.pointerId, { zone: newZone, velocity, note: null });
                return next;
            });
        }
    }, [strumPointers, currentChord, recordEvent, currentVoice, sampleData, markRecentStrum]);

    const handleStrumPointerUp = useCallback((e) => {
        e.preventDefault();
        e.currentTarget.releasePointerCapture?.(e.pointerId);
        
        const pointer = strumPointers.get(e.pointerId);
        if (pointer) {
            if (pointer.note != null) {
                audioEngineRef.current.noteOff(pointer.note);
                recordEvent("noteOff", pointer.note);
            }
            
            setActiveStrumZones(prev => {
                const next = new Set(prev);
                next.delete(pointer.zone);
                return next;
            });
            setStrumPointers(prev => {
                const next = new Map(prev);
                next.delete(e.pointerId);
                return next;
            });
        }
    }, [strumPointers, recordEvent]);

    const handleResetConfig = useCallback(() => {
        setExtraRoots([]);
        setExtraQualities([]);
    }, []);

    // Clear loop handler
    const handleClearLoop = useCallback(() => {
        // Stop looping and overdubbing
        setIsLooping(false);
        setIsOverdubbing(false);
        
        // Clear all loop buffers and events
        setLoopBuffers([]);
        loopEventsRef.current = [];
        
        // Clear any loop timers
        if (audioEngineRef.current.loopTimer) {
            clearInterval(audioEngineRef.current.loopTimer);
            audioEngineRef.current.loopTimer = null;
        }
        
        // Stop metronome if it was started by the loop
        if (loopStartedMetronome) {
            setIsMetronomeOn(false);
            setLoopStartedMetronome(false);
        }
        
        // Cancel any ongoing countdown
        cancelCountdown();
        
        // Close the confirmation dialog
        setIsClearLoopConfirmOpen(false);
    }, [loopStartedMetronome, cancelCountdown]);

    if (showIOSOverlay) {
        return React.createElement(IOSStartOverlay, { onStart: handleIOSStart });
    }

    if (showAbout) {
        return React.createElement(AboutOverlay, { onClose: () => setShowAbout(false) });
    }

    return React.createElement('div', {
        className: 'h-screen flex flex-col overflow-hidden'
    },
        React.createElement('div', {
            className: 'top-bar flex-shrink-0 px-2 py-1 flex items-center justify-between bg-cosmic-panel'
        },
            React.createElement('div', {
                className: 'flex items-center gap-2'
            },
                React.createElement('button', {
                    className: 'fullscreen-btn',
                    title: 'fullscreen mode',
                    onClick: () => setShowAbout(true),
                    style: {
                        fontSize: '1.2em',
                        marginRight: '8px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent-color, cyan)',
                        cursor: 'pointer',
                        transition: 'transform 0.2s ease',
                    },
                    onMouseDown: e => e.currentTarget.style.transform = 'scale(0.9)',
                    onMouseUp: e => e.currentTarget.style.transform = 'scale(1.0)',
                }, '⛶'),
                React.createElement('h1', {
                    className: 'logo-text text-sm font-bold bg-gradient-to-r from-cosmic-glow via-cosmic-secondary to-cosmic-tertiary bg-clip-text text-transparent cursor-pointer',
                    onClick: () => setShowAbout(true),
                    style: { userSelect: 'none' }
                }, 'Chordynaut'),
                countdown > 0 && React.createElement('span', {
                    className: 'countdown-badge',
                    title: 'recording starts in...'
                }, String(countdown)),
                React.createElement('div', {
                    className: 'voice-selector'
                },
                    ['square', 'sawtooth', 'triangle'].map(wave => 
                        React.createElement('button', {
                            key: wave,
                            className: `voice-btn ${currentVoice === wave ? 'active' : ''}`,
                            onClick: () => setCurrentVoice(wave),
                            title: wave,
                            style: { fontSize: '0.9em', padding: '2px 5px' }
                        }, 
                            wave === 'square' ? '▢' :
                            wave === 'sawtooth' ? '⋀' : '△'
                        )
                    ),
                    React.createElement('button', {
                        className: `voice-btn mic-btn ${currentVoice === 'sample' ? 'active' : ''} ${isRecordingSample ? 'recording' : ''}`,
                        onClick: () => {
                            if (!sampleData.isActive) {
                                startCountdown(3, () => {
                                    startMicSample();
                                });
                            } else {
                                setCurrentVoice('sample');
                            }
                        },
                        title: sampleData.isActive ? 'Use mic sample' : 'Record mic sample',
                        style: { fontSize: '0.9em', padding: '2px 5px' }
                    }, '🎤'),
                    sampleData.isActive && React.createElement('button', {
                        className: 'mic-clear-btn',
                        onClick: () => setIsClearSampleConfirmOpen(true),
                        title: 'Clear recorded sample',
                        style: { fontSize: '0.8em', padding: '2px 4px' }
                    }, '❌')
                )
            ),
            React.createElement('div', {
                className: 'flex items-center gap-1'
            },
                React.createElement('button', {
                    className: `record-btn ${isRecording ? 'active' : ''}`,
                    onClick: () => {
                        const ac = audioEngineRef.current?.audioContext;
                        if (!isRecording) {
                            startCountdown(3, () => {
                                setRecordedEvents([]);
                                performanceEventsRef.current = [];
                                setRecordStart(ac?.currentTime || 0);
                                setIsRecording(true);
                            });
                        } else {
                            setIsRecording(false);
                        }
                    },
                    style: { width: '24px', height: '24px', fontSize: '0.9em' }
                }, '⏺'),
                React.createElement('button', {
                    className: 'play-btn',
                    disabled: !recordedEvents.length || isRecording || isPlaying,
                    onClick: () => playRecording(),
                    style: { fontSize: '0.8em', padding: '3px 6px' }
                }, '■'),
                React.createElement('button', {
                    className: 'play-btn',
                    disabled: !recordedEvents.length || isRecording || isPlaying,
                    onClick: () => playRecording(),
                    style: { fontSize: '0.8em', padding: '3px 6px' }
                }, '▶'),
                React.createElement('span', {
                    style: { color: 'rgba(255,255,255,0.3)', margin: '0 2px', fontSize: '0.9em' }
                }, '|'),
                React.createElement('button', {
                    className: 'btn-icon download-btn',
                    title: 'Download',
                    onClick: () => setIsDownloadOpen(true),
                    style: { fontSize: '0.9em', padding: '3px 5px' }
                }, '⬇️'),
                React.createElement('span', {
                    style: { color: 'rgba(255,255,255,0.3)', margin: '0 2px', fontSize: '0.9em' }
                }, '|'),
                React.createElement('button', {
                    className: 'clear-loop-btn',
                    onClick: () => setIsClearLoopConfirmOpen(true),
                    disabled: !isLooping && loopBuffers.length === 0 && !countdownTimerRef.current,
                    title: 'Clear loop',
                    style: { 
                        fontSize: '0.9em', 
                        padding: '3px 6px',
                        background: 'linear-gradient(135deg, rgba(255,0,128,.12), rgba(0,255,255,.08))',
                        border: '1px solid rgba(0,255,255,0.25)',
                        boxShadow: '0 0 8px rgba(255,0,128,0.3), inset 0 0 6px rgba(0,255,255,0.1)',
                        borderRadius: '6px',
                        color: 'white',
                        marginLeft: '6px',
                        cursor: 'pointer',
                        transition: 'box-shadow 0.2s, transform 0.2s',
                        opacity: (!isLooping && loopBuffers.length === 0 && !countdownTimerRef.current) ? 0.4 : 1
                    },
                    onMouseEnter: (e) => {
                        if (!e.currentTarget.disabled) {
                            e.currentTarget.style.boxShadow = '0 0 10px #ff0080, 0 0 20px #00f6ff';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                        }
                    },
                    onMouseLeave: (e) => {
                        e.currentTarget.style.boxShadow = '0 0 8px rgba(255,0,128,0.3), inset 0 0 6px rgba(0,255,255,0.1)';
                        e.currentTarget.style.transform = 'translateY(0)';
                    }
                }, 'C'),
                React.createElement('button', {
                    className: `loop-btn ${isLooping ? 'active' : ''}`,
                    onClick: () => {
                        if (!isLooping) {
                            // If a countdown is already running, ignore double-press
                            if (countdownTimerRef.current) return;

                            // Do NOT start metronome or loop yet; wait for countdown to finish
                            startCountdown(3, () => {
                                // Sync start: metronome + loop + recording begin together
                                if (!isMetronomeOn) {
                                    setLoopStartedMetronome(true);
                                    setIsMetronomeOn(true);
                                } else {
                                    // If metro already on, reset bar count to align the downbeat
                                    setBarCount(0);
                                }

                                setBarCount(0);          // Reset bars for good measure
                                setIsLooping(true);      // Arm loop playback system

                                // Start first pass capture immediately for exactly one loop length
                                startLoopRecording(loopLength);
                            });
                        } else {
                            // Stopping loop (existing behavior preserved)
                            setIsLooping(false);
                            setIsOverdubbing(false);
                            setLoopBuffers([]);
                            loopEventsRef.current = [];
                            if (audioEngineRef.current.loopTimer) {
                                clearInterval(audioEngineRef.current.loopTimer);
                            }
                            if (loopStartedMetronome) setIsMetronomeOn(false);
                            setLoopStartedMetronome(false);

                            // If we were in a countdown toward starting, cancel it
                            cancelCountdown();
                        }
                    },
                    style: { fontSize: '0.9em', padding: '3px 6px' }
                }, '🔁'),
                React.createElement('button', {
                    className: `overdub-btn ${isOverdubbing ? 'active' : ''}`,
                    disabled: !isLooping && !countdownTimerRef.current,
                    onClick: () => {
                        if (isLooping) {
                            // Loop already playing → start overdub immediately, no countdown, no metro toggles
                            startLoopRecording(loopLength);
                        } else {
                            // Loop not active → behave like loop start with countdown sync
                            if (countdownTimerRef.current) return; // ignore double-press during countdown
                            startCountdown(3, () => {
                                if (!isMetronomeOn) {
                                    setLoopStartedMetronome(true);
                                    setIsMetronomeOn(true);
                                } else {
                                    setBarCount(0);
                                }
                                setBarCount(0);
                                setIsLooping(true);
                                startLoopRecording(loopLength);
                            });
                        }
                    },
                    style: { fontSize: '0.9em', padding: '3px 6px' }
                }, '⬤'),
                isMetronomeOn && React.createElement('div', {
                    className: 'metronome-pulse-container'
                },
                    [...Array(beatsPerBar)].map((_, i) =>
                        React.createElement('div', {
                            key: i,
                            className: `pulse-dot ${currentBeat === i ? 'active' : ''}`,
                            style: { width: '8px', height: '8px' }
                        })
                    )
                ),
                React.createElement('div', { className: 'flex items-center space-x-1' },
                    React.createElement('select', {
                        value: tonic,
                        onChange: (e) => setTonic(e.target.value),
                        className: 'bg-gray-800 text-white text-xs px-1 py-0.5 rounded border border-gray-600 focus:outline-none'
                    },
                        TONICS.map(t => React.createElement('option', { key: t, value: t }, t))
                    )
                ),
                React.createElement('button', {
                    onClick: () => {
                        setShowConfig(true);
                        setTimeout(() => {
                            if (window.recomputeLayout) window.recomputeLayout();
                        }, 0);
                    },
                    className: 'config-btn',
                    style: { fontSize: '0.8em', padding: '3px 6px' }
                }, '🎹🎚️'),
                React.createElement('button', {
                    onClick: () => {
                        setShowSettings(!showSettings);
                        setTimeout(() => {
                            if (window.recomputeLayout) window.recomputeLayout();
                        }, 0);
                    },
                    className: 'px-2 py-0.5 rounded bg-cosmic-accent text-gray-400 hover:bg-cosmic-highlight font-bold text-xs'
                }, showSettings ? '×' : '⚙')
            )
        ),

        showSettings && React.createElement('div', {
            className: 'settings-toolbar'
        },
            React.createElement('div', {
                className: 'envelope-wrap'
            },
                React.createElement(EnvelopeEditorV2, {
                    value: adsr,
                    onChange: setAdsr,
                    maxTime: 4,
                })
            ),
            React.createElement('div', {
                className: 'mode-group'
            },
                React.createElement('label', null, 'Mode'),
                React.createElement('select', {
                    value: mode,
                    onChange: (e) => setMode(e.target.value),
                    className: 'mode-select'
                },
                    Object.entries(MODE_DEFS).map(([key, def]) =>
                        React.createElement('option', { key: key, value: key }, def.name)
                    )
                )
            ),
            React.createElement('div', {
                className: 'looplen-group',
                style: { display: 'inline-flex', alignItems: 'center', gap: 8 }
            },
                React.createElement('label', { style: { opacity: 0.8 } }, 'loop'),
                React.createElement('select', {
                    value: loopLength,
                    onChange: (e) => setLoopLength(parseInt(e.target.value, 10)),
                    className: 'compact-select'
                },
                    [1, 2, 4, 8].map(b =>
                        React.createElement('option', { key: b, value: b }, `${b} bar${b > 1 ? 's' : ''}`)
                    )
                )
            ),
            React.createElement('div', {
                className: 'volume-group'
            },
                React.createElement('label', null, 'Chord Volume'),
                React.createElement('input', {
                    type: 'range',
                    min: 0,
                    max: 1.5,
                    step: 0.01,
                    value: chordVolume,
                    onChange: (e) => {
                        const v = parseFloat(e.target.value);
                        setChordVolume(v);
                        const eng = audioEngineRef.current;
                        if (eng && eng.chordBus) {
                            eng.chordBus.gain.setValueAtTime(v, eng.audioContext.currentTime);
                        }
                    },
                    className: 'volume-slider'
                }),
                React.createElement('span', {
                    className: 'vol-readout'
                }, `${Math.round(chordVolume * 100)}%`)
            ),
            React.createElement('div', {
                className: 'metro-group',
                style: { position: 'relative' }
            },
                React.createElement('button', {
                    className: 'metro-btn',
                    onClick: () => setShowMetronomePopover(!showMetronomePopover)
                }, 'Metronome'),
                showMetronomePopover && React.createElement(MetronomePopover, {
                    onClose: () => setShowMetronomePopover(false)
                },
                    React.createElement('div', {
                        style: { display: 'flex', flexDirection: 'column', gap: '8px' }
                    },
                        React.createElement('label', {
                            style: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9em' }
                        },
                            React.createElement('input', {
                                type: 'checkbox',
                                checked: isMetronomeOn,
                                onChange: (e) => setIsMetronomeOn(e.target.checked)
                            }),
                            'On'
                        ),
                        React.createElement('div', {
                            style: { display: 'flex', alignItems: 'center', gap: '6px' }
                        },
                            React.createElement('label', {
                                style: { fontSize: '0.9em', minWidth: '36px' }
                            }, 'BPM'),
                            React.createElement('input', {
                                type: 'number',
                                min: 30,
                                max: 240,
                                value: bpm,
                                onChange: (e) => setBpm(parseInt(e.target.value) || 100),
                                style: { 
                                    width: '60px',
                                    background: '#1a1a2e',
                                    color: 'white',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    borderRadius: '4px',
                                    padding: '2px 4px'
                                }
                            })
                        ),
                        React.createElement('div', {
                            style: { display: 'flex', alignItems: 'center', gap: '6px' }
                        },
                            React.createElement('label', {
                                style: { fontSize: '0.9em', minWidth: '36px' }
                            }, 'Sig'),
                            React.createElement('select', {
                                value: timeSignature,
                                onChange: (e) => setTimeSignature(e.target.value),
                                style: {
                                    background: '#1a1a2e',
                                    color: 'white',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    borderRadius: '4px',
                                    padding: '2px 4px'
                                }
                            },
                                ["2/4","3/4","4/4","6/8","7/8"].map(sig =>
                                    React.createElement('option', { key: sig, value: sig }, sig)
                                )
                            )
                        ),
                        React.createElement('label', {
                            style: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9em' }
                        },
                            React.createElement('input', {
                                type: 'checkbox',
                                checked: metronomeMuted,
                                onChange: (e) => setMetronomeMuted(e.target.checked)
                            }),
                            'Mute'
                        )
                    )
                )
            )
        ),

        isClearSampleConfirmOpen && React.createElement('div', {
            className: 'overlay-backdrop',
            onClick: () => setIsClearSampleConfirmOpen(false)
        },
            React.createElement('div', {
                className: 'overlay-card',
                onClick: (e) => e.stopPropagation()
            },
                React.createElement('p', null, 'clear recorded sample?'),
                React.createElement('div', {
                    className: 'overlay-actions'
                },
                    React.createElement('button', {
                        onClick: () => {
                            clearSample();
                            setIsClearSampleConfirmOpen(false);
                        }
                    }, 'yes'),
                    React.createElement('button', {
                        onClick: () => setIsClearSampleConfirmOpen(false)
                    }, 'no')
                )
            )
        ),

        isClearLoopConfirmOpen && React.createElement('div', {
            className: 'overlay-backdrop',
            onClick: () => setIsClearLoopConfirmOpen(false)
        },
            React.createElement('div', {
                className: 'overlay-card',
                onClick: (e) => e.stopPropagation()
            },
                React.createElement('p', null, 'Clear loop and stop playback?'),
                React.createElement('div', {
                    className: 'overlay-actions'
                },
                    React.createElement('button', {
                        onClick: handleClearLoop
                    }, 'yes'),
                    React.createElement('button', {
                        onClick: () => setIsClearLoopConfirmOpen(false)
                    }, 'no')
                )
            )
        ),

        isDownloadOpen && React.createElement('div', {
            className: 'overlay-backdrop',
            onClick: () => setIsDownloadOpen(false)
        },
            React.createElement('div', {
                className: 'overlay-card',
                onClick: (e) => e.stopPropagation()
            },
                React.createElement('h3', null, 'download'),
                React.createElement('div', {
                    className: 'dl-grid'
                },
                    React.createElement('button', {
                        disabled: !loopEventsRef.current?.length,
                        onClick: () => exportSelection('loop_json')
                    }, 'loop (json)'),
                    React.createElement('button', {
                        disabled: !performanceEventsRef.current?.length,
                        onClick: () => exportSelection('performance_json')
                    }, 'performance (json)'),
                    React.createElement('button', {
                        disabled: !loopBuffers.length,
                        onClick: () => exportSelection('loop_wav')
                    }, 'loop (wav)'),
                    React.createElement('button', {
                        disabled: !window.performanceWavBlob,
                        onClick: () => exportSelection('performance_wav')
                    }, 'performance (wav)'),
                    React.createElement('button', {
                        disabled: !loopEventsRef.current?.length && 
                                  !performanceEventsRef.current?.length &&
                                  !loopBuffers.length && !window.performanceWavBlob,
                        onClick: () => exportSelection('all')
                    }, 'all')
                ),
                React.createElement('div', {
                    className: 'overlay-actions'
                },
                    React.createElement('button', {
                        onClick: () => setIsDownloadOpen(false)
                    }, 'close')
                )
            )
        ),

        showConfig && React.createElement('div', {
            className: 'config-overlay'
        },
            React.createElement('div', {
                className: 'config-header'
            },
                React.createElement('h2', null, 'Configure Chord Keyboard'),
                React.createElement('button', {
                    className: 'close-btn',
                    onClick: () => {
                        setShowConfig(false);
                        setTimeout(() => {
                            if (window.recomputeLayout) window.recomputeLayout();
                        }, 0);
                    }
                }, '✕')
            ),

            React.createElement('section', null,
                React.createElement('h3', null, 'Add Chord Rows (Qualities)'),
                React.createElement('div', {
                    className: 'button-grid'
                },
                    AVAILABLE_QUALITIES.map(q =>
                        React.createElement('button', {
                            key: q,
                            className: extraQualities.includes(q) ? 'active' : '',
                            onClick: () => {
                                if (!extraQualities.includes(q)) {
                                    setExtraQualities([...extraQualities, q]);
                                }
                            }
                        }, q)
                    )
                )
            ),

            React.createElement('section', null,
                React.createElement('h3', null, 'Add Chord Columns (Roots)'),
                React.createElement('div', {
                    className: 'button-grid'
                },
                    AVAILABLE_ROOTS.map(r =>
                        React.createElement('button', {
                            key: r,
                            className: extraRoots.includes(r) ? 'active' : '',
                            onClick: () => {
                                if (!extraRoots.includes(r)) {
                                    setExtraRoots([...extraRoots, r]);
                                }
                            }
                        }, r)
                    )
                )
            ),

            React.createElement('div', {
                style: {
                    width: '100%',
                    maxWidth: '600px',
                    display: 'flex',
                    gap: '12px',
                    marginTop: '20px'
                }
            },
                React.createElement('button', {
                    className: 'save-btn',
                    onClick: () => {
                        setShowConfig(false);
                        setTimeout(() => {
                            if (window.recomputeLayout) window.recomputeLayout();
                        }, 0);
                    },
                    style: { flex: 1 }
                }, 'Done'),
                React.createElement('button', {
                    onClick: handleResetConfig,
                    style: {
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '8px',
                        padding: '10px 30px',
                        fontWeight: 'bold',
                        fontSize: '1em',
                        color: 'white',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        flex: 1
                    },
                    onMouseEnter: (e) => {
                        e.target.style.background = 'rgba(255,255,255,0.2)';
                    },
                    onMouseLeave: (e) => {
                        e.target.style.background = 'rgba(255,255,255,0.1)';
                    }
                }, 'Reset to Defaults')
            )
        ),

        React.createElement('div', {
            className: 'workspace flex-1 grid grid-cols-2 gap-1 p-1 min-h-0 overflow-hidden'
        },
            React.createElement('div', {
                className: 'chord-grid-root bg-cosmic-panel rounded flex flex-col overflow-hidden p-1'
            },
                React.createElement('div', {
                    className: 'chord-grid',
                    style: {
                        gridTemplateColumns: `repeat(${roots.length}, 1fr)`,
                        gridTemplateRows: `repeat(${qualities.length}, 1fr)`
                    }
                },
                    qualities.map((quality, rowIndex) =>
                        roots.map((root, chordIndex) => {
                            const shadeIndex = chordIndex % quality.colors.length;
                            const bgColor = quality.colors[shadeIndex];
                            
                            return React.createElement('button', {
                                key: `${root}-${quality.key}`,
                                onPointerDown: (e) => handleChordPointerDown(e, root, quality.key),
                                onPointerUp: handleChordPointerUp,
                                onPointerCancel: handleChordPointerCancel,
                                onContextMenu: (e) => e.preventDefault(),
                                onTouchStart: (e) => e.preventDefault(),
                                draggable: false,
                                className: `chord-button ${
                                    activeChordButton === `${root}-${quality.key}` ? 'active' : ''
                                } font-bold text-xs transition-all touch-none flex flex-col items-center justify-center`,
                                style: {
                                    backgroundColor: bgColor || getRowColor(quality.key, rowIndex)
                                }
                            },
                                React.createElement('span', { className: 'text-sm' }, root),
                                React.createElement('span', { className: 'text-xs opacity-75' }, quality.label)
                            );
                        })
                    )
                )
            ),

            React.createElement('div', {
                className: 'bg-cosmic-panel rounded flex flex-col overflow-hidden p-1'
            },
                React.createElement('div', {
                    className: 'flex-1 relative rounded overflow-hidden strum-pad',
                    onPointerDown: handleStrumPointerDown,
                    onPointerMove: handleStrumPointerMove,
                    onPointerUp: handleStrumPointerUp,
                    onPointerCancel: handleStrumPointerUp,
                    onContextMenu: (e) => e.preventDefault(),
                    onTouchStart: (e) => e.preventDefault(),
                    draggable: false,
                    style: { 
                        touchAction: 'none',
                        backgroundImage: 'url(https://decentricity.github.io/1760829170789.jpg)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat'
                    }
                },
                    Array.from({ length: 12 }).map((_, i) => {
                        const chordGen = chordGenRef.current;
                        let noteName = '';
                        let isRootNote = false;
                        
                        // Use active strum notes (melody or chord)
                        const activeStrumNotes = strumNotesOverrideRef.current || currentChord?.strumNotes || [];
                        
                        if (activeStrumNotes.length > 0) {
                            const midiNote = activeStrumNotes[i];
                            noteName = chordGen.midiToNoteName(midiNote);
                            if (currentChord) {
                                isRootNote = midiNote % 12 === currentChord.notes[0] % 12;
                            }
                        }
                        
                        return React.createElement('div', {
                            key: i,
                            className: `strum-zone ${activeStrumZones.has(i) ? 'active' : ''}`,
                            style: {
                                height: `${100 / 12}%`,
                                position: 'absolute',
                                top: `${(i * 100) / 12}%`,
                                left: 0,
                                right: 0,
                                backgroundColor: isRootNote ? 'rgba(233, 69, 96, 0.4)' : 
                                                (i % 2 === 0 ? 'rgba(22, 33, 62, 0.6)' : 'rgba(15, 52, 96, 0.6)')
                            }
                        },
                            noteName && React.createElement('span', {
                                className: `strum-note-label ${isRootNote ? 'root-note' : ''}`,
                                style: {
                                    position: 'absolute',
                                    left: '8px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    fontSize: '11px',
                                    fontWeight: isRootNote ? 'bold' : 'normal',
                                    opacity: isRootNote ? 1 : 0.7,
                                    pointerEvents: 'none',
                                    textShadow: '0 1px 2px rgba(0,0,0,0.8)'
                                }
                            }, noteName)
                        );
                    })
                )
            )
        ),

        React.createElement('div', {
            className: 'flex-shrink-0 text-center text-xs text-gray-600 py-0.5'
        },
            React.createElement('a', {
                href: 'https://berrry.app',
                target: '_blank',
                className: 'hover:text-cosmic-glow transition-colors'
            }, '🍓 berrry.app')
        )
    );
}

window.addEventListener('load', () => {
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));