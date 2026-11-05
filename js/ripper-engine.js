/**
 * SNDeck audio downloader
 * Extracts real audio streams directly inside the web app from YouTube, Spotify, and direct URLs.
 * Operates without external scripts or batch files.
 */
class CyberRipperEngine {
    constructor() {
        this.isProcessing = false;
        this.onLogUpdate = null;
        this.onProgressUpdate = null;

        // Resilient public gateways for YouTube audio resolution
        // Curated from the projects' current public instance lists. These can
        // still go offline, so every request is bounded and retried in parallel.
        this.pipedInstances = [
            'https://pipedapi.leptons.xyz',
            'https://piped-api.privacy.com.de',
            'https://pipedapi.adminforge.de',
            'https://api.piped.yt',
            'https://pipedapi.kavin.rocks'
        ];

        this.invidiousInstances = [
            'https://inv.nadeko.net',
            'https://invidious.tiekoetter.com',
            'https://invidious.nerdvpn.de'
        ];
    }

    log(message, type = 'info') {
        const time = new Date().toTimeString().split(' ')[0];
        const logLine = `[${time}] ${message}`;
        if (this.onLogUpdate) {
            this.onLogUpdate(logLine, type);
        }
    }

    setProgress(percent) {
        if (this.onProgressUpdate) {
            this.onProgressUpdate(Math.min(100, Math.max(0, percent)));
        }
    }

    async fetchJsonWithTimeout(url, options = {}, timeoutMs = 5500) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            if (!response.ok) throw new Error(`Gateway returned HTTP ${response.status}`);
            return await response.json();
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async firstGatewayResult(instances, message, makeUrl, parse, options = {}) {
        const attempts = instances.map(async (base) => {
            this.log(`${message}: ${new URL(base).hostname}...`, 'info');
            const data = await this.fetchJsonWithTimeout(makeUrl(base), options);
            const result = parse(data);
            if (!result) throw new Error('Gateway returned no usable result');
            return result;
        });

        try {
            return await Promise.any(attempts);
        } catch (_) {
            return null;
        }
    }

    /**
     * Main entry point: Rips and injects audio stream directly into the SNDeck.
     */
    async ripStream(rawInput, quality = '320k') {
        if (this.isProcessing) {
            throw new Error('Ripper protocol already in execution. Standby.');
        }

        this.isProcessing = true;
        this.setProgress(5);

        try {
            const input = rawInput.trim();
            if (!input) throw new Error('Target stream URL or query cannot be empty.');

            // -- TAURI NATIVE PATH --------------------------------------------
            const isTauri = typeof window.__TAURI__ !== 'undefined';
            const isAndroid = /Android/i.test(navigator.userAgent);
            if (isTauri && !isAndroid) {
                this.log('NATIVE YT-DLP ENGINE DETECTED - USING SYSTEM RIPPER...', 'system');
                this.log('PREPARING NATIVE RIPPER...', 'info');
                this.setProgress(10);
                try {
                    const results = await window.__TAURI__.core.invoke('rip_audio_stream', { url: input, quality });
                    this.setProgress(100);
                    this.log('DOWNLOAD COMPLETE: ' + results.length + ' track(s)', 'success');
                    return results.map((result, index) => ({
                        id: 'ripped-' + Date.now() + '-' + index,
                        title: result.title || 'Ripped Track',
                        artist: result.artist || 'YouTube',
                        album: result.album || 'SNDeck',
                        year: result.year || '',
                        duration: result.duration || 0,
                        url: window.__TAURI__.core.convertFileSrc(result.filePath),
                        filePath: result.filePath,
                        coverArt: result.coverArt || null,
                        isRipped: true
                    }));
                } catch (err) {
                    this.log('NATIVE RIPPER ERROR: ' + err, 'error');
                    throw new Error(err);
                }
            }
            // -- END TAURI NATIVE PATH ----------------------------------------

            this.log('INITIATING IN-APP STREAM EXTRACTOR...', 'system');
            await this.sleep(250);

            let videoId = null;
            let initialTitle = null;
            let initialCover = null;

            // 1. Check if Spotify link: resolve metadata then bridge to YouTube audio
            if (input.includes('spotify.com')) {
                this.log('SPOTIFY LINK DETECTED: RESOLVING METADATA...', 'info');
                this.setProgress(20);

                try {
                    const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(input)}`;
                    const data = await this.fetchJsonWithTimeout(oembedUrl, {}, 5500);
                    initialTitle = data.title;
                    initialCover = data.thumbnail_url;
                    this.log(`SPOTIFY TRACK: "${initialTitle}"`, 'success');
                } catch (e) {
                    this.log('SPOTIFY METADATA UNAVAILABLE. SEARCHING BY LINK...', 'warn');
                }

                this.log('BRIDGING SPOTIFY TRACK TO YOUTUBE AUDIO STREAM...', 'info');
                this.setProgress(35);
                const searchTarget = initialTitle || input;
                videoId = await this.searchYouTubeVideoId(searchTarget);

            } else if (input.includes('youtube.com') || input.includes('youtu.be')) {
                // 2. Direct YouTube link
                this.log('YOUTUBE LINK DETECTED: PARSING VIDEO ID...', 'info');
                this.setProgress(25);
                videoId = this.extractYouTubeId(input);

            } else if (input.match(/^https?:\/\/.*\.mp3($|\?)/i)) {
                // 3. Direct MP3 URL
                this.log('DIRECT MP3 STREAM DETECTED.', 'success');
                this.setProgress(90);
                const filename = input.split('/').pop().split('?')[0].replace(/\.mp3$/i, '');
                return {
                    id: 'direct-' + Date.now(),
                    title: decodeURIComponent(filename),
                    artist: 'Network Stream',
                    album: 'SNDeck Ripper',
                    year: new Date().getFullYear().toString(),
                    duration: 240,
                    url: input,
                    coverArt: 'assets/cyber_vinyl.svg',
                    isRipped: true
                };

            } else {
                // 4. Raw search query (e.g. "I Really Want to Stay At Your House")
                this.log(`SEARCHING AUDIO REPOSITORY FOR: "${input}"...`, 'info');
                this.setProgress(25);
                videoId = await this.searchYouTubeVideoId(input);
            }

            if (!videoId) {
                throw new Error('Could not resolve a matching YouTube audio stream for this query.');
            }

            this.log(`YOUTUBE STREAM ID LOCATED: [${videoId}]`, 'success');
            this.setProgress(50);

            // 5. Extract real playable audio stream URL from public gateways
            this.log('INTERCEPTING AUDIO CARRIER VIA STREAM GATEWAYS...', 'info');
            const streamData = await this.extractAudioStreamFromGateways(videoId);

            this.setProgress(85);
            this.log(`AUDIO STREAM LOCKED: ${streamData.title}`, 'success');

            const finalCover = initialCover || streamData.thumbnail || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
            const finalTitle = initialTitle || streamData.title;

            this.setProgress(100);
            this.log(`SUCCESS: STREAM READY IN SNDECK DECK!`, 'success');

            return {
                id: 'yt-' + videoId + '-' + Date.now(),
                title: finalTitle,
                artist: streamData.uploader || 'YouTube Audio',
                album: 'SNDeck Stream',
                year: new Date().getFullYear().toString(),
                duration: streamData.duration || 180,
                url: streamData.audioUrl,
                coverArt: finalCover,
                isRipped: true
            };

        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Extracts YouTube Video ID from any standard URL format.
     */
    extractYouTubeId(url) {
        const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/;
        const match = url.match(regExp);
        return match ? match[1] : null;
    }

    /**
     * Searches YouTube for a matching track and returns the top videoId.
     */
    async searchYouTubeVideoId(query) {
        const encodedQuery = encodeURIComponent(query);
        const pipedId = await this.firstGatewayResult(
            this.pipedInstances,
            'SEARCHING PIPED',
            base => `${base}/search?q=${encodedQuery}&filter=all`,
            data => {
                const items = Array.isArray(data) ? data : data.items;
                if (!Array.isArray(items)) return null;
                for (const item of items) {
                    if (item && item.url) {
                        const id = this.extractYouTubeId(item.url) || item.url.match(/[?&]v=([\w-]{11})/)?.[1];
                        if (id) return id;
                    }
                    if (item && item.videoId && /^[\w-]{11}$/.test(item.videoId)) return item.videoId;
                }
                return null;
            }
        );
        if (pipedId) return pipedId;

        return this.firstGatewayResult(
            this.invidiousInstances,
            'SEARCHING INVIDIOUS',
            base => `${base}/api/v1/search?q=${encodedQuery}&type=video`,
            data => Array.isArray(data) && data[0] && /^[\w-]{11}$/.test(data[0].videoId || '')
                ? data[0].videoId
                : null
        );
    }

    /**
     * Queries stream gateways to obtain a direct, playable audio stream URL.
     */
    async extractAudioStreamFromGateways(videoId) {
        const pipedResult = await this.firstGatewayResult(
            this.pipedInstances,
            'QUERYING PIPED GATEWAY',
            base => `${base}/streams/${videoId}`,
            data => {
                if (!Array.isArray(data.audioStreams) || data.audioStreams.length === 0) return null;
                const streams = data.audioStreams.filter(stream => stream && stream.url)
                    .sort((a, b) => (Number(b.bitrate) || 0) - (Number(a.bitrate) || 0));
                const chosen = streams[0];
                if (!chosen) return null;
                return {
                    audioUrl: chosen.url,
                    title: data.title || 'YouTube Audio',
                    uploader: data.uploader || 'YouTube Artist',
                    duration: data.duration || 180,
                    thumbnail: data.thumbnailUrl
                };
            }
        );
        if (pipedResult) return pipedResult;

        const invidiousResult = await this.firstGatewayResult(
            this.invidiousInstances,
            'QUERYING INVIDIOUS BACKUP',
            base => `${base}/api/v1/videos/${videoId}`,
            data => {
                if (!Array.isArray(data.adaptiveFormats)) return null;
                const audioOnly = data.adaptiveFormats.filter(format =>
                    format && format.type && format.type.startsWith('audio/') && format.url
                ).sort((a, b) => (parseInt(b.bitrate, 10) || 0) - (parseInt(a.bitrate, 10) || 0));
                if (!audioOnly.length) return null;
                return {
                    audioUrl: audioOnly[0].url,
                    title: data.title || 'YouTube Audio',
                    uploader: data.author || 'YouTube Artist',
                    duration: data.lengthSeconds || 180,
                    thumbnail: data.videoThumbnails ? data.videoThumbnails[0]?.url : null
                };
            }
        );
        if (invidiousResult) return invidiousResult;

        throw new Error('Public audio gateways did not return a playable stream. Check your connection and retry, or import the audio file directly.');
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

window.CyberRipperEngine = new CyberRipperEngine();
