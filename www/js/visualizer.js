/**
 * SNDeck audio visualizer
 * Modes:
 * 1. BASIC (record only; the record spins during playback)
 * 2. GORILLA BARS (Full-width 48-bar logarithmic frequency spectrum with peak hold)
 * 3. WAVEFORM (Audio waveform visualizer)
 * 4. BADLANDS 3D (Synthwave wireframe desert with mountains, sliced neon sun & cyber highway)
 */
class CyberVisualizer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.mode = 'gorilla-bars'; // 'basic' | 'ring-wave' | 'gorilla-bars' | 'waveform' | 'badlands-3d'
        this.isRunning = false;
        this.peakLevels = [];
        this.peakDecay = 1.4;
        this.rotationAngle = 0;
        this.gridOffset = 0;

        // Omi Color Palette
        this.colors = {
            green: '#00FF88',     // Omi dark green hair & tactical badges
            purple: '#B026FF',    // Snake Nation purple tattoo
            pink: '#FF1A75',      // Hot pink tattoo & harness
            blue: '#0088FF',      // Blue vest & outer optics
            yellow: '#FCEE0A',    // High-top sneakers & warnings
            orange: '#FF7700',    // Sunset orange
            white: '#FFFFFF'
        };
        this.setTheme();

        // Static stars for Badlands 3D sky
        this.stars = [];
        for (let i = 0; i < 45; i++) {
            this.stars.push({
                x: Math.random(),
                y: Math.random(),
                size: Math.random() * 1.8 + 0.8,
                alpha: Math.random() * 0.7 + 0.3,
                speed: Math.random() * 0.02 + 0.01
            });
        }

        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        if (window.ResizeObserver) {
            new ResizeObserver(() => this.resize()).observe(this.canvas.parentElement || this.canvas);
        }
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const w = rect.width > 0 ? rect.width : (this.canvas.parentElement ? this.canvas.parentElement.clientWidth : 600);
        const h = rect.height > 0 ? rect.height : (this.canvas.parentElement ? this.canvas.parentElement.clientHeight : 300);
        
        this.canvas.width = w * dpr;
        this.canvas.height = h * dpr;
        this.ctx.resetTransform?.();
        this.ctx.scale(dpr, dpr);
        this.width = w;
        this.height = h;
    }

    setMode(newMode) {
        this.mode = newMode;
    }

    setTheme() {
        const styles = getComputedStyle(document.body);
        for (const [key, variable] of Object.entries({
            green: '--omi-green', purple: '--omi-purple', pink: '--omi-pink',
            blue: '--omi-blue', yellow: '--omi-yellow', orange: '--omi-orange', white: '--cyber-text'
        })) {
            const value = styles.getPropertyValue(variable).trim();
            if (value) this.colors[key] = value;
        }
    }

    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.render();
        }
    }

    stop() {
        this.isRunning = false;
    }

    /**
     * Musical Octave / Perceptual Frequency Curve (35 Hz - 9,500 Hz)
     * Maps bars across actual musical octaves where all instruments live,
     * with balanced acoustic compensation and power curve so bars dance dynamically
     * without hitting the ceiling or clipping out!
     */
    getLogFrequency(index, totalPoints, freqData) {
        if (!freqData || freqData.length === 0) return 0;
        
        const norm = index / Math.max(1, totalPoints - 1);
        
        // Spread bars across the analyser's full usable range, including high treble.
        const sampleRate = window.AudioEngine.ctx?.sampleRate || 48000;
        const nyquist = sampleRate / 2;
        const fMin = 35;
        const fMax = nyquist * 0.94;
        const targetFreq = fMin * Math.pow(fMax / fMin, norm);

        const binSize = nyquist / freqData.length;
        const centerBin = targetFreq / binSize;
        
        // Dynamic bandwidth: narrower at bass, wider at upper octaves
        const bandwidthBins = Math.max(1, centerBin * 0.22 + 0.9);
        const startBin = Math.max(1, Math.floor(centerBin - bandwidthBins / 2));
        const endBin = Math.min(freqData.length - 1, Math.ceil(centerBin + bandwidthBins / 2));
        
        let sum = 0;
        let count = 0;
        for (let b = startBin; b <= endBin; b++) {
            sum += freqData[b] || 0;
            count++;
        }
        let val = count > 0 ? (sum / count) : (freqData[Math.floor(centerBin)] || 0);
        
        // Treble sparkle boost for hi-hats/cymbals in upper registers
        if (norm > 0.72) {
            const hfOffset = Math.floor(65 + (norm - 0.72) * 55);
            const hfVal = freqData[Math.min(freqData.length - 1, hfOffset)] || 0;
            if (hfVal > val) val = (val * 0.45) + (hfVal * 0.55);
        }
        
        // Natural acoustic slope weighting:
        // Gentle tilt so high-mids and treble keep pace with heavy bass,
        // without artificially slamming values into 255.
        const acousticWeight = 0.92 + Math.pow(norm, 1.1) * 0.55;
        val = Math.min(255, val * acousticWeight);
        
        return val;
    }

    render() {
        if (!this.isRunning) return;
        requestAnimationFrame(() => this.render());

        const w = this.width;
        const h = this.height;
        if (!w || !h) return;

        const freqData = window.AudioEngine.getFrequencyData();
        const timeData = window.AudioEngine.getTimeDomainData();

        const cleanMode = this.mode === 'basic' || this.mode === 'ring-wave';
        // Clean radial modes use a solid clear so they leave no glow trails.
        this.ctx.fillStyle = cleanMode ? 'rgba(7, 9, 14, 1)' : 'rgba(7, 9, 14, 0.32)';
        this.ctx.fillRect(0, 0, w, h);

        if (!cleanMode) this.drawBackgroundHUD(w, h);

        switch (this.mode) {
            case 'basic':
                break;
            case 'ring-wave':
                this.drawRingWave(timeData, w, h);
                break;
            case 'gorilla-bars':
                this.drawGorillaBars(freqData, w, h);
                break;
            case 'waveform':
                this.drawWaveform(timeData, w, h);
                break;
            case 'badlands-3d':
                this.drawBadlands3D(freqData, w, h);
                break;
        }
    }

    drawBackgroundHUD(w, h) {
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(0, 255, 136, 0.04)';
        this.ctx.lineWidth = 1;

        // Center crosshairs
        const cx = w / 2;
        const cy = h / 2;

        this.ctx.beginPath();
        this.ctx.moveTo(cx - 30, cy);
        this.ctx.lineTo(cx + 30, cy);
        this.ctx.moveTo(cx, cy - 30);
        this.ctx.lineTo(cx, cy + 30);
        this.ctx.stroke();

        // Corner brackets in Omi pink
        const bSize = 14;
        const margin = 10;
        this.ctx.strokeStyle = 'rgba(255, 26, 117, 0.25)';
        // Top-left
        this.ctx.strokeRect(margin, margin, bSize, 1);
        this.ctx.strokeRect(margin, margin, 1, bSize);
        // Top-right
        this.ctx.strokeRect(w - margin - bSize, margin, bSize, 1);
        this.ctx.strokeRect(w - margin, margin, 1, bSize);
        // Bottom-left
        this.ctx.strokeRect(margin, h - margin, bSize, 1);
        this.ctx.strokeRect(margin, h - margin - bSize, 1, bSize);
        // Bottom-right
        this.ctx.strokeRect(w - margin - bSize, h - margin, bSize, 1);
        this.ctx.strokeRect(w - margin, h - margin - bSize, 1, bSize);

        this.ctx.restore();
    }

    /** Mode: a smooth circular waveform around the record. */
    drawRingWave(timeData, w, h) {
        const cx = w / 2;
        const cy = h / 2;
        const minDimension = Math.min(w, h);
        const baseRadius = minDimension * 0.34;
        const amplitude = minDimension * 0.12;
        const pointCount = 256;

        const gradient = this.ctx.createLinearGradient(cx - baseRadius, cy, cx + baseRadius, cy);
        gradient.addColorStop(0, this.colors.pink);
        gradient.addColorStop(0.5, this.colors.green);
        gradient.addColorStop(1, this.colors.pink);
        this.ctx.strokeStyle = gradient;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        for (let i = 0; i <= pointCount; i++) {
            const angle = (i / pointCount) * Math.PI * 2 - Math.PI / 2;
            const sampleIndex = Math.floor((i % pointCount) / pointCount * timeData.length);
            const rawSample = ((timeData[sampleIndex] ?? 128) - 128) / 128;
            const sample = Math.max(-1, Math.min(1, rawSample * 3));
            const radius = baseRadius + sample * amplitude;
            const x = cx + Math.cos(angle) * radius;
            const y = cy + Math.sin(angle) * radius;
            if (i === 0) this.ctx.moveTo(x, y);
            else this.ctx.lineTo(x, y);
        }
        this.ctx.stroke();
    }

    /**
     * Mode 2: Gorilla Bars (Full-Width Logarithmic 48-Bar Spectrum)
     * Every bar across the entire screen moves dynamically in rhythm!
     */
    drawGorillaBars(freqData, w, h) {
        const barCount = 64;
        const barSpacing = 3;
        const totalSpacing = barSpacing * (barCount - 1);
        const barWidth = Math.max(3, (w - 24 - totalSpacing) / barCount);
        // Keep headroom while letting quiet treble bands use the full width.
        const maxHeight = h * 0.68;
        const offsetX = (w - (barCount * barWidth + totalSpacing)) / 2;

        for (let i = 0; i < barCount; i++) {
            const rawVal = this.getLogFrequency(i, barCount, freqData);
            const normVal = Math.min(1.0, rawVal / 255);
            // Power curve keeps bass dynamic and avoids flat ceiling wall
            const dynamicVal = Math.pow(normVal, 0.78);
            const barHeight = Math.max(3, dynamicVal * maxHeight);
            const x = offsetX + i * (barWidth + barSpacing);
            const y = h - barHeight - 18;

            // Peak tracking across all bars
            if (!this.peakLevels[i] || barHeight > this.peakLevels[i]) {
                this.peakLevels[i] = barHeight;
            } else {
                this.peakLevels[i] = Math.max(0, this.peakLevels[i] - this.peakDecay);
            }

            // Draw segmented blocks
            const segments = 16;
            const segHeight = barHeight / segments;

            for (let s = 0; s < segments; s++) {
                const segY = h - 18 - (s + 1) * segHeight;
                const ratio = s / segments;

                let col;
                if (ratio > 0.75) {
                    col = this.colors.pink; // Hot pink top peaks
                } else if (ratio > 0.45) {
                    col = this.colors.purple; // Snake Nation purple
                } else if (ratio > 0.2) {
                    col = this.colors.green;  // Green theme accent
                } else {
                    col = this.colors.blue;   // Deep cobalt blue base
                }

                this.ctx.fillStyle = col;
                this.ctx.fillRect(x, segY, barWidth, segHeight - 1.4);
            }

            // Peak indicator line in Omi Hot Pink / Yellow
            const peakY = h - 18 - this.peakLevels[i];
            this.ctx.fillStyle = i % 2 === 0 ? this.colors.pink : this.colors.yellow;
            this.ctx.fillRect(x, peakY - 2, barWidth, 2);
        }
    }

    /**
     * Mode 3: Waveform (Oscilloscope)
     */
    drawWaveform(timeData, w, h) {
        const cy = h / 2;
        const sliceWidth = w / (timeData.length || 1);

        this.ctx.save();
        this.ctx.lineWidth = 2.5;
        this.ctx.strokeStyle = this.colors.green;
        this.ctx.shadowColor = this.colors.green;
        this.ctx.shadowBlur = 10;

        this.ctx.beginPath();
        let x = 0;
        for (let i = 0; i < timeData.length; i++) {
            const v = timeData[i] / 128.0;
            const y = v * cy;

            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
            x += sliceWidth;
        }
        this.ctx.stroke();

        // Chromatic split wave in Omi's hot pink
        this.ctx.strokeStyle = this.colors.pink;
        this.ctx.shadowColor = this.colors.pink;
        this.ctx.shadowBlur = 8;
        this.ctx.beginPath();
        x = 0;
        for (let i = 0; i < timeData.length; i++) {
            const v = timeData[i] / 128.0;
            const y = v * cy + 3.5;
            if (i === 0) this.ctx.moveTo(x, y);
            else this.ctx.lineTo(x, y);
            x += sliceWidth;
        }
        this.ctx.stroke();

        this.ctx.restore();
    }

    /**
     * Mode 4: Badlands 3D (Synthwave Wireframe Desert with Mountains, Highway & Sliced Neon Sun)
     */
    drawBadlands3D(freqData, w, h) {
        const horizon = h * 0.45;
        const vanishingX = w / 2;

        let bass = 0;
        for (let i = 1; i <= 6; i++) bass += freqData[i] || 0;
        bass /= 6;
        const bassRatio = bass / 255;

        this.gridOffset = (this.gridOffset + bassRatio * 6 + 1.8) % 36;

        this.ctx.save();

        // 1. Sky & Stars (Above Horizon)
        this.stars.forEach(star => {
            const sx = star.x * w;
            const sy = star.y * horizon;
            const flicker = star.alpha + Math.sin(Date.now() * star.speed) * 0.2;
            this.ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.1, flicker)})`;
            this.ctx.fillRect(sx, sy, star.size, star.size);
        });

        // 2. Large, responsive sunset disc, scaled to the available canvas.
        const sunRadius = Math.min(w * 0.18, h * 0.29) * (0.96 + bassRatio * 0.12);
        const sunGrad = this.ctx.createLinearGradient(vanishingX, horizon - sunRadius, vanishingX, horizon);
        sunGrad.addColorStop(0, '#FF1A75');  // Omi Hot Pink at top
        sunGrad.addColorStop(0.5, '#FF7700'); // Orange middle
        sunGrad.addColorStop(1, '#FCEE0A');   // Yellow base

        this.ctx.save();
        this.ctx.shadowColor = '#FF1A75';
        this.ctx.shadowBlur = 24;
        this.ctx.fillStyle = sunGrad;

        // Draw sun semicircle
        this.ctx.beginPath();
        this.ctx.arc(vanishingX, horizon, sunRadius, Math.PI, Math.PI * 2);
        this.ctx.closePath();
        this.ctx.fill();

        // Strictly clip all cuts to the sun semicircle shape:
        // Ensures slats NEVER bleed outside into the sky/mountains (eliminating the square artifact!)
        this.ctx.beginPath();
        this.ctx.arc(vanishingX, horizon, sunRadius, Math.PI, Math.PI * 2);
        this.ctx.closePath();
        this.ctx.clip();

        // Punch transparent horizontal synthwave scanline slats directly into the sun
        this.ctx.globalCompositeOperation = 'destination-out';
        this.ctx.fillStyle = '#000000';
        const numSlices = 7;
        for (let s = 1; s <= numSlices; s++) {
            const sliceY = horizon - (s / (numSlices + 1)) * (sunRadius * 0.82);
            const sliceHeight = 1.2 + s * 1.1;
            this.ctx.fillRect(vanishingX - sunRadius - 5, sliceY, (sunRadius + 5) * 2, sliceHeight);
        }
        this.ctx.restore();

        // Bright rim keeps the sun readable against the horizon and mountain line.
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.arc(vanishingX, horizon, sunRadius, Math.PI, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(255, 224, 128, 0.95)';
        this.ctx.lineWidth = Math.max(2, sunRadius * 0.018);
        this.ctx.shadowColor = '#FF7700';
        this.ctx.shadowBlur = Math.max(18, sunRadius * 0.32);
        this.ctx.stroke();
        this.ctx.restore();

        // 3. Wireframe Badlands Mountains on Horizon
        this.drawWireframeMountains(w, horizon, freqData);

        // 4. Horizon Glow Line
        this.ctx.strokeStyle = '#FF1A75';
        this.ctx.lineWidth = 2;
        this.ctx.shadowColor = '#FF1A75';
        this.ctx.shadowBlur = 10;
        this.ctx.beginPath();
        this.ctx.moveTo(0, horizon);
        this.ctx.lineTo(w, horizon);
        this.ctx.stroke();

        // 5. 3D Perspective Ground Grid (Below Horizon)
        this.ctx.shadowBlur = 0;
        this.ctx.strokeStyle = 'rgba(0, 255, 136, 0.35)';
        this.ctx.lineWidth = 1.4;

        // Perspective converging longitudinal lines
        const lineCount = 20;
        for (let i = -lineCount / 2; i <= lineCount / 2; i++) {
            const bottomX = vanishingX + (i * (w / (lineCount * 0.65)));
            this.ctx.beginPath();
            this.ctx.moveTo(vanishingX, horizon);
            this.ctx.lineTo(bottomX, h);
            this.ctx.stroke();
        }

        // Horizontal latitude lines rushing forward with undulating terrain waves
        for (let y = horizon + 4; y < h; y += (y - horizon) * 0.22 + 4) {
            const dynamicY = y + this.gridOffset * ((y - horizon) / (h - horizon));
            if (dynamicY > horizon && dynamicY <= h) {
                // Audio undulation wave
                const waveProg = (dynamicY - horizon) / (h - horizon);
                const undulate = Math.sin(dynamicY * 0.08 + this.gridOffset * 0.5) * (bassRatio * 5 * waveProg);

                this.ctx.beginPath();
                this.ctx.moveTo(0, dynamicY + undulate);
                this.ctx.lineTo(w, dynamicY + undulate);
                this.ctx.stroke();
            }
        }

        // 6. Central Badlands Highway
        const roadBottomW = 120;
        this.ctx.strokeStyle = 'rgba(255, 26, 117, 0.7)';
        this.ctx.lineWidth = 2;
        this.ctx.shadowColor = '#FF1A75';
        this.ctx.shadowBlur = 8;

        // Left road curb
        this.ctx.beginPath();
        this.ctx.moveTo(vanishingX - 4, horizon);
        this.ctx.lineTo(vanishingX - roadBottomW / 2, h);
        this.ctx.stroke();

        // Right road curb
        this.ctx.beginPath();
        this.ctx.moveTo(vanishingX + 4, horizon);
        this.ctx.lineTo(vanishingX + roadBottomW / 2, h);
        this.ctx.stroke();

        // Center dashed line
        this.ctx.strokeStyle = 'rgba(252, 238, 10, 0.8)';
        this.ctx.setLineDash([8, 12]);
        this.ctx.lineDashOffset = -this.gridOffset * 2.5;
        this.ctx.beginPath();
        this.ctx.moveTo(vanishingX, horizon);
        this.ctx.lineTo(vanishingX, h);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        this.ctx.restore();
    }

    /**
     * Badlands Horizon Mountain Range (Wireframe Peaks reacting to Audio)
     */
    drawWireframeMountains(w, horizon, freqData) {
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(176, 38, 255, 0.75)';
        this.ctx.lineWidth = 1.6;
        this.ctx.shadowColor = '#B026FF';
        this.ctx.shadowBlur = 8;

        // Low-mid frequency for mountain breathing
        const midEnergy = (freqData[8] || 0) / 255;

        // Left Mountain Peaks
        this.ctx.beginPath();
        this.ctx.moveTo(0, horizon);
        this.ctx.lineTo(w * 0.08, horizon - 28 - midEnergy * 15);
        this.ctx.lineTo(w * 0.16, horizon - 12);
        this.ctx.lineTo(w * 0.25, horizon - 45 - midEnergy * 20);
        this.ctx.lineTo(w * 0.36, horizon - 18);
        this.ctx.lineTo(w * 0.42, horizon);
        this.ctx.stroke();

        // Right Mountain Peaks
        this.ctx.beginPath();
        this.ctx.moveTo(w * 0.58, horizon);
        this.ctx.lineTo(w * 0.64, horizon - 20);
        this.ctx.lineTo(w * 0.74, horizon - 48 - midEnergy * 22);
        this.ctx.lineTo(w * 0.84, horizon - 15);
        this.ctx.lineTo(w * 0.92, horizon - 32 - midEnergy * 14);
        this.ctx.lineTo(w, horizon);
        this.ctx.stroke();

        this.ctx.restore();
    }
}

window.CyberVisualizer = CyberVisualizer;
