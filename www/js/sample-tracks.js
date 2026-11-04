/**
 * Built-in Cyberpunk Synthesized Demo Tracks
 * Generates instant, copyright-free electronic cyberpunk audio streams for testing.
 */
class CyberSampleGenerator {
    static async generateTrack(type = 'chill') {
        const sampleRate = 44100;
        const duration = 24; // 24 seconds loop
        const totalSamples = sampleRate * duration;

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const offlineCtx = new OfflineAudioContext(2, totalSamples, sampleRate);

        if (type === 'chill') {
            // "I Really Want to Stay At Your House" / Night City Braindance Vibe
            const bpm = 110;
            const beatSec = 60 / bpm;
            const chords = [
                [220, 261.63, 329.63, 392], // Am7
                [174.61, 220, 261.63, 329.63], // Fmaj7
                [130.81, 164.81, 196, 246.94], // C
                [196, 246.94, 293.66, 349.23]  // G
            ];

            // Synth Pad
            chords.forEach((chord, chordIdx) => {
                const startTime = chordIdx * (duration / chords.length);
                const chordDuration = duration / chords.length;

                chord.forEach(freq => {
                    const osc = offlineCtx.createOscillator();
                    const filter = offlineCtx.createBiquadFilter();
                    const gain = offlineCtx.createGain();

                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(freq, startTime);

                    filter.type = 'lowpass';
                    filter.frequency.setValueAtTime(600, startTime);
                    filter.frequency.exponentialRampToValueAtTime(1400, startTime + chordDuration * 0.5);
                    filter.frequency.exponentialRampToValueAtTime(600, startTime + chordDuration);

                    gain.gain.setValueAtTime(0.001, startTime);
                    gain.gain.linearRampToValueAtTime(0.04, startTime + 0.8);
                    gain.gain.setValueAtTime(0.04, startTime + chordDuration - 0.8);
                    gain.gain.linearRampToValueAtTime(0.001, startTime + chordDuration);

                    osc.connect(filter);
                    filter.connect(gain);
                    gain.connect(offlineCtx.destination);

                    osc.start(startTime);
                    osc.stop(startTime + chordDuration);
                });
            });

            // Bassline
            for (let t = 0; t < duration; t += beatSec) {
                const step = Math.floor(t / (duration / chords.length)) % chords.length;
                const rootFreq = chords[step][0] / 2;

                const bassOsc = offlineCtx.createOscillator();
                const bassGain = offlineCtx.createGain();
                bassOsc.type = 'triangle';
                bassOsc.frequency.setValueAtTime(rootFreq, t);

                bassGain.gain.setValueAtTime(0.2, t);
                bassGain.gain.exponentialRampToValueAtTime(0.001, t + beatSec * 0.9);

                bassOsc.connect(bassGain);
                bassGain.connect(offlineCtx.destination);

                bassOsc.start(t);
                bassOsc.stop(t + beatSec * 0.9);
            }

            // Cyberpunk Arpeggio
            const arpNotes = [440, 523.25, 659.25, 783.99, 880, 659.25];
            let arpStep = 0;
            for (let t = 2; t < duration - 1; t += beatSec / 2) {
                const note = arpNotes[arpStep % arpNotes.length];
                arpStep++;

                const arpOsc = offlineCtx.createOscillator();
                const arpGain = offlineCtx.createGain();
                arpOsc.type = 'sine';
                arpOsc.frequency.setValueAtTime(note, t);

                arpGain.gain.setValueAtTime(0.07, t);
                arpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

                arpOsc.connect(arpGain);
                arpGain.connect(offlineCtx.destination);

                arpOsc.start(t);
                arpOsc.stop(t + 0.15);
            }

        } else {
            // "Sandevistan Overdrive" / Combat Mode High-Energy Darksynth
            const bpm = 135;
            const beatSec = 60 / bpm;

            for (let t = 0; t < duration; t += beatSec / 2) {
                const bassOsc = offlineCtx.createOscillator();
                const filter = offlineCtx.createBiquadFilter();
                const gain = offlineCtx.createGain();

                bassOsc.type = 'sawtooth';
                bassOsc.frequency.setValueAtTime(55, t); // A1

                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(2500, t);
                filter.frequency.exponentialRampToValueAtTime(200, t + beatSec * 0.4);
                filter.Q.setValueAtTime(5, t);

                gain.gain.setValueAtTime(0.25, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + beatSec * 0.45);

                bassOsc.connect(filter);
                filter.connect(gain);
                gain.connect(offlineCtx.destination);

                bassOsc.start(t);
                bassOsc.stop(t + beatSec * 0.45);
            }

            // Cyber Hi-Hats
            for (let t = 0; t < duration; t += beatSec / 4) {
                const noiseBuf = offlineCtx.createBuffer(1, sampleRate * 0.04, sampleRate);
                const out = noiseBuf.getChannelData(0);
                for (let i = 0; i < out.length; i++) out[i] = Math.random() * 2 - 1;

                const src = offlineCtx.createBufferSource();
                src.buffer = noiseBuf;

                const hpf = offlineCtx.createBiquadFilter();
                hpf.type = 'highpass';
                hpf.frequency.setValueAtTime(8000, t);

                const gain = offlineCtx.createGain();
                gain.gain.setValueAtTime(0.04, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

                src.connect(hpf);
                hpf.connect(gain);
                gain.connect(offlineCtx.destination);

                src.start(t);
            }
        }

        const renderedBuffer = await offlineCtx.startRendering();
        const wavBlob = this.bufferToWave(renderedBuffer, totalSamples);
        const url = URL.createObjectURL(wavBlob);

        return {
            id: 'sample-' + Date.now() + '-' + Math.random(),
            title: type === 'chill' ? 'SNAKE NATION // NOMAD HIGHWAY' : 'NIGHT CITY // BRAINDANCE SYNTH',
            artist: 'SNAKE NATION // BADLANDS 2077',
            album: 'SNDECK OST',
            year: '2077',
            duration: duration,
            url: url,
            isSample: true,
            coverArt: null
        };
    }

    static bufferToWave(abuffer, len) {
        let numOfChan = abuffer.numberOfChannels,
            length = len * numOfChan * 2 + 44,
            out = new DataView(new ArrayBuffer(length)),
            channels = [], i, sample,
            offset = 0,
            pos = 0;

        function setUint16(data) { out.setUint16(pos, data, true); pos += 2; }
        function setUint32(data) { out.setUint32(pos, data, true); pos += 4; }

        setUint32(0x46464952); // "RIFF"
        setUint32(length - 8);
        setUint32(0x45564157); // "WAVE"

        setUint32(0x20746d66); // "fmt "
        setUint32(16);
        setUint16(1);          // PCM
        setUint16(numOfChan);
        setUint32(abuffer.sampleRate);
        setUint32(abuffer.sampleRate * 2 * numOfChan);
        setUint16(numOfChan * 2);
        setUint16(16);         // 16-bit

        setUint32(0x61746164); // "data"
        setUint32(length - pos - 4);

        for (i = 0; i < abuffer.numberOfChannels; i++) {
            channels.push(abuffer.getChannelData(i));
        }

        while (offset < len) {
            for (i = 0; i < numOfChan; i++) {
                sample = Math.max(-1, Math.min(1, channels[i][offset]));
                sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
                out.setInt16(pos, sample, true);
                pos += 2;
            }
            offset++;
        }

        return new Blob([out.buffer], { type: "audio/wav" });
    }
}

window.CyberSampleGenerator = CyberSampleGenerator;
