import { clamp, round, safeError } from "./utils.js";
export class AmbientAudioSensor {
    context = null;
    analyser = null;
    stream = null;
    raf = 0;
    features = {
        status: "pending",
        descriptor: "Unknown"
    };
    async start() {
        if (this.stream) {
            return;
        }
        if (!navigator.mediaDevices?.getUserMedia) {
            this.features = {
                status: "unavailable",
                descriptor: "Unknown",
                error: "Microphone API unavailable"
            };
            return;
        }
        try {
            // Audio never leaves the browser. This stream is reduced to numeric descriptors only.
            // Hardware migration: browser microphone becomes a MEMS microphone plus onboard DSP.
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });
            this.context = new AudioContext();
            const source = this.context.createMediaStreamSource(this.stream);
            this.analyser = this.context.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.78;
            source.connect(this.analyser);
            this.features = {
                status: "granted",
                descriptor: "Quiet"
            };
            this.tick();
        }
        catch (error) {
            this.features = {
                status: "denied",
                descriptor: "Unknown",
                error: safeError(error)
            };
        }
    }
    snapshot() {
        return { ...this.features };
    }
    tick = () => {
        if (!this.analyser || !this.context) {
            return;
        }
        const timeData = new Uint8Array(this.analyser.fftSize);
        const freqData = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteTimeDomainData(timeData);
        this.analyser.getByteFrequencyData(freqData);
        let sumSquares = 0;
        let zeroCrossings = 0;
        let last = 0;
        for (let index = 0; index < timeData.length; index += 1) {
            const sample = ((timeData[index] ?? 128) - 128) / 128;
            sumSquares += sample * sample;
            if (index > 0 && Math.sign(sample) !== Math.sign(last)) {
                zeroCrossings += 1;
            }
            last = sample;
        }
        const rms = Math.sqrt(sumSquares / timeData.length);
        const loudnessDb = 20 * Math.log10(Math.max(rms, 0.00001));
        const spectrum = this.spectrum(freqData, this.context.sampleRate);
        const noisiness = clamp(zeroCrossings / timeData.length + spectrum.trebleEnergy * 0.38);
        const speechProbability = clamp(spectrum.midEnergy * 1.35 - spectrum.bassEnergy * 0.22 - spectrum.trebleEnergy * 0.2 + rms * 0.8);
        this.features = {
            status: "granted",
            averageVolume: round(rms, 3),
            loudnessDb: round(loudnessDb, 1),
            noisiness: round(noisiness, 2),
            spectralCentroidHz: round(spectrum.centroidHz),
            bassEnergy: round(spectrum.bassEnergy, 2),
            midEnergy: round(spectrum.midEnergy, 2),
            trebleEnergy: round(spectrum.trebleEnergy, 2),
            speechProbability: round(speechProbability, 2),
            descriptor: this.describe(rms, noisiness, speechProbability, spectrum)
        };
        this.raf = window.requestAnimationFrame(this.tick);
    };
    spectrum(freqData, sampleRate) {
        const nyquist = sampleRate / 2;
        let weighted = 0;
        let total = 0;
        let bass = 0;
        let mid = 0;
        let treble = 0;
        let bassCount = 0;
        let midCount = 0;
        let trebleCount = 0;
        for (let index = 0; index < freqData.length; index += 1) {
            const value = (freqData[index] ?? 0) / 255;
            const hz = (index / freqData.length) * nyquist;
            weighted += hz * value;
            total += value;
            if (hz < 250) {
                bass += value;
                bassCount += 1;
            }
            else if (hz < 3400) {
                mid += value;
                midCount += 1;
            }
            else {
                treble += value;
                trebleCount += 1;
            }
        }
        return {
            centroidHz: total ? weighted / total : 0,
            bassEnergy: bassCount ? bass / bassCount : 0,
            midEnergy: midCount ? mid / midCount : 0,
            trebleEnergy: trebleCount ? treble / trebleCount : 0
        };
    }
    describe(rms, noisiness, speechProbability, spectrum) {
        if (rms < 0.012) {
            return "Silence";
        }
        if (rms > 0.18 && speechProbability > 0.5) {
            return "Crowd-like";
        }
        if (rms > 0.16 || noisiness > 0.55) {
            return spectrum.trebleEnergy > spectrum.midEnergy ? "Busy street" : "Loud";
        }
        if (spectrum.bassEnergy > spectrum.midEnergy * 1.8 && noisiness > 0.35) {
            return "Wind";
        }
        if (spectrum.trebleEnergy > spectrum.midEnergy * 1.4 && rms < 0.08) {
            return "Nature";
        }
        return "Quiet";
    }
    stop() {
        if (this.raf) {
            window.cancelAnimationFrame(this.raf);
        }
        this.stream?.getTracks().forEach((track) => track.stop());
        void this.context?.close();
        this.stream = null;
        this.context = null;
        this.analyser = null;
    }
}
