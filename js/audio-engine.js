/**
 * SNDeck Audio Engine
 * Integrates HTML5 Audio with Web Audio API for EQ, Analyser, and Sandevistan Overclock DSP.
 */
class CyberAudioEngine {
    constructor() {
        this.audio = new Audio();
        this.audio.crossOrigin = "anonymous";
        this.ctx = null;
        this.source = null;
        this.analyser = null;
        this.masterGain = null;
        this.eqNodes = [];
        this.sandevistanFilter = null;
        this.isSandevistanActive = false;
        this.initialized = false;

        this.eqBands = [
            { freq: 60, type: 'lowshelf', gain: 0 },
            { freq: 250, type: 'peaking', gain: 0 },
            { freq: 1000, type: 'peaking', gain: 0 },
            { freq: 4000, type: 'peaking', gain: 0 },
            { freq: 12000, type: 'highshelf', gain: 0 }
        ];

        // Callbacks
        this.onTimeUpdate = null;
        this.onTrackEnd = null;
        this.onLoadedMetadata = null;
        this.onPlayStateChange = null;

        this.setupAudioEvents();
    }

    initContext() {
        if (this.initialized) return;

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();

        this.source = this.ctx.createMediaElementSource(this.audio);
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 512;
        this.analyser.smoothingTimeConstant = 0.82;
        this.analyser.minDecibels = -85;
        this.analyser.maxDecibels = -12;

        this.masterGain = this.ctx.createGain();

        // Build EQ Filter Chain
        let prevNode = this.source;
        this.eqNodes = this.eqBands.map(band => {
            const filter = this.ctx.createBiquadFilter();
            filter.type = band.type;
            filter.frequency.value = band.freq;
            filter.gain.value = band.gain;
            prevNode.connect(filter);
            prevNode = filter;
            return filter;
        });

        // Sandevistan Overclock Filter (Dynamic low-end punch)
        this.sandevistanFilter = this.ctx.createBiquadFilter();
        this.sandevistanFilter.type = 'peaking';
        this.sandevistanFilter.frequency.value = 120;
        this.sandevistanFilter.gain.value = 0;
        this.sandevistanFilter.Q.value = 2.5;

        prevNode.connect(this.sandevistanFilter);
        this.sandevistanFilter.connect(this.analyser);
        this.analyser.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);

        this.initialized = true;
    }

    setupAudioEvents() {
        this.audio.addEventListener('timeupdate', () => {
            if (this.onTimeUpdate) {
                this.onTimeUpdate(this.audio.currentTime, this.audio.duration || 0);
            }
        });

        this.audio.addEventListener('ended', () => {
            if (this.onTrackEnd) this.onTrackEnd();
        });

        this.audio.addEventListener('loadedmetadata', () => {
            if (this.onLoadedMetadata) {
                this.onLoadedMetadata(this.audio.duration);
            }
        });

        this.audio.addEventListener('play', () => {
            if (this.onPlayStateChange) this.onPlayStateChange(true);
        });

        this.audio.addEventListener('pause', () => {
            if (this.onPlayStateChange) this.onPlayStateChange(false);
        });
    }

    async loadTrack(url) {
        this.initContext();
        if (this.ctx && this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
        this.audio.src = url;
        this.audio.load();
    }

    async play() {
        this.initContext();
        if (this.ctx && this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
        try {
            await this.audio.play();
        } catch (err) {
            console.warn("Autoplay / Play blocked:", err);
        }
    }

    pause() {
        this.audio.pause();
    }

    seek(seconds) {
        if (!isNaN(seconds) && seconds >= 0) {
            this.audio.currentTime = seconds;
        }
    }

    setVolume(value) {
        // value between 0.0 and 1.0
        const v = Math.max(0, Math.min(1, value));
        this.audio.volume = v;
    }

    getVolume() {
        return this.audio.volume;
    }

    setEQ(bandIndex, gainDb) {
        if (this.eqNodes[bandIndex]) {
            this.eqNodes[bandIndex].gain.setTargetAtTime(gainDb, this.ctx.currentTime, 0.05);
            this.eqBands[bandIndex].gain = gainDb;
        }
    }

    setPreset(name) {
        const presets = {
            flat: [0, 0, 0, 0, 0],
            bassBoost: [8, 5, 1, -1, 3],
            vocal: [-2, 1, 6, 4, 1],
            electronic: [7, 4, -1, 4, 6],
            rock: [5, 2, -1, 3, 5],
            // Aliases for compatibility
            gorillaPunch: [8, 5, 1, -1, 3],
            snakeNation: [6, 3, -1, 4, 6],
            cyberNight: [6, 3, -1, 4, 6],
            omiVocal: [-2, 1, 6, 4, 1],
            braindanceVocal: [-2, 1, 6, 4, 1],
            badlandsSynth: [7, 4, -1, 4, 6]
        };

        const gains = presets[name] || presets.flat;
        gains.forEach((g, idx) => this.setEQ(idx, g));
        return gains;
    }

    toggleSandevistan() {
        this.isSandevistanActive = !this.isSandevistanActive;
        const now = this.ctx ? this.ctx.currentTime : 0;

        if (this.isSandevistanActive) {
            // Overclock: slightly faster, boosted bass resonance
            this.audio.playbackRate = 1.12;
            if (this.sandevistanFilter && this.ctx) {
                this.sandevistanFilter.gain.setTargetAtTime(10, now, 0.1);
            }
        } else {
            // Restore normal
            this.audio.playbackRate = 1.0;
            if (this.sandevistanFilter && this.ctx) {
                this.sandevistanFilter.gain.setTargetAtTime(0, now, 0.1);
            }
        }
        return this.isSandevistanActive;
    }

    getFrequencyData() {
        if (!this.analyser) return new Uint8Array(0);
        const data = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(data);
        return data;
    }

    getTimeDomainData() {
        if (!this.analyser) return new Uint8Array(0);
        const data = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteTimeDomainData(data);
        return data;
    }
}

window.AudioEngine = new CyberAudioEngine();
