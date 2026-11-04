/**
 * SNDeck Netrunner Ripper Engine (In-App Multi-Gateway Stream Extractor)
 * Extracts real audio streams directly inside the web app from YouTube, Spotify, and direct URLs.
 * Operates without external scripts or batch files.
 */
class CyberRipperEngine {
    constructor() {
        this.isProcessing = false;
        this.onLogUpdate = null;
        this.onProgressUpdate = null;

        // Resilient public gateways for YouTube audio resolution
        this.pipedInstances = [
            'https://pipedapi.kavin.rocks',
            'https://api.piped.privacydev.net',
            'https://pipedapi.leptons.xyz',
            'https://pipedapi.drgns.space',
            'https://pipedapi.tokhmi.xyz',
            'https://pipedapi.moomoo.me'
        ];

        this.invidiousInstances = [
            'https://inv.nadeko.net',
            'https://invidious.jing.rocks',
            'https://yewtu.be',
            'https://invidious.privacydev.net',
            'https://iv.datura.network'
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
            if (isTauri) {
                this.log('NATIVE YT-DLP ENGINE DETECTED - USING SYSTEM RIPPER...', 'system');
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
                        coverArt: null,
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
                    const res = await fetch(oembedUrl);
                    if (res.ok) {
                        const data = await res.json();
                        initialTitle = data.title;
                        initialCover = data.thumbnail_url;
                        this.log(`SPOTIFY TRACK: "${initialTitle}"`, 'success');
                    }
                } catch (e) {
                    this.log('SPOTIFY OEMBED TIMEOUT. SEARCHING HEURISTICALLY...', 'warn');
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
                    year: '2077',
                    duration: 240,
                    url: input,
                    coverArt: 'assets/omi_portrait.png',
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
                year: '2077',
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
        for (const base of this.pipedInstances) {
            try {
                const searchUrl = `${base}/search?q=${encodeURIComponent(query)}&filter=all`;
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 4000);

                const res = await fetch(searchUrl, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (res.ok) {
                    const data = await res.json();
                    const items = data.items || data;
                    if (items && items.length > 0) {
                        for (const item of items) {
                            if (item.url && item.url.includes('/watch?v=')) {
                                return this.extractYouTubeId(item.url);
                            }
                        }
                    }
                }
            } catch (err) {
                // Try next instance
            }
        }

        // Secondary fallback: Invidious search
        for (const base of this.invidiousInstances) {
            try {
                const searchUrl = `${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video`;
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 4000);

                const res = await fetch(searchUrl, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (res.ok) {
                    const data = await res.json();
                    if (data && data.length > 0 && data[0].videoId) {
                        return data[0].videoId;
                    }
                }
            } catch (err) {
                // Try next
            }
        }

        return null;
    }

    /**
     * Queries stream gateways to obtain a direct, playable audio stream URL.
     */
    async extractAudioStreamFromGateways(videoId) {
        // Try Piped instances first
        for (const base of this.pipedInstances) {
            try {
                this.log(`QUERYING GATEWAY: ${new URL(base).hostname}...`, 'info');
                const streamUrl = `${base}/streams/${videoId}`;

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);

                const res = await fetch(streamUrl, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (res.ok) {
                    const data = await res.json();
                    if (data.audioStreams && data.audioStreams.length > 0) {
                        // Pick best bitrate audio stream (m4a or webm/opus)
                        const streams = [...data.audioStreams].sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
                        const chosen = streams[0];

                        return {
                            audioUrl: chosen.url,
                            title: data.title || 'YouTube Audio',
                            uploader: data.uploader || 'YouTube Artist',
                            duration: data.duration || 180,
                            thumbnail: data.thumbnailUrl
                        };
                    }
                }
            } catch (err) {
                // Continue to next gateway
            }
        }

        // Try Invidious instances
        for (const base of this.invidiousInstances) {
            try {
                this.log(`QUERYING BACKUP GATEWAY: ${new URL(base).hostname}...`, 'info');
                const streamUrl = `${base}/api/v1/videos/${videoId}`;

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);

                const res = await fetch(streamUrl, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (res.ok) {
                    const data = await res.json();
                    if (data.adaptiveFormats) {
                        const audioOnly = data.adaptiveFormats.filter(f => f.type && f.type.startsWith('audio/'));
                        if (audioOnly.length > 0) {
                            audioOnly.sort((a, b) => (parseInt(b.bitrate, 10) || 0) - (parseInt(a.bitrate, 10) || 0));
                            return {
                                audioUrl: audioOnly[0].url,
                                title: data.title || 'YouTube Audio',
                                uploader: data.author || 'YouTube Artist',
                                duration: data.lengthSeconds || 180,
                                thumbnail: data.videoThumbnails ? data.videoThumbnails[0]?.url : null
                            };
                        }
                    }
                }
            } catch (err) {
                // Continue
            }
        }

        // Tertiary fallback: Cobalt API
        try {
            this.log('QUERYING COBALT PROXY GATEWAY...', 'info');
            const cobaltRes = await fetch('https://api.cobalt.tools/api/json', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url: `https://www.youtube.com/watch?v=${videoId}`,
                    downloadMode: 'audio',
                    audioFormat: 'mp3'
                })
            });

            if (cobaltRes.ok) {
                const cobaltData = await cobaltRes.json();
                if (cobaltData.url) {
                    return {
                        audioUrl: cobaltData.url,
                        title: 'YouTube Stream',
                        uploader: 'Cobalt Gateway',
                        duration: 180,
                        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
                    };
                }
            }
        } catch (e) {
            // Cobalt fallback failed
        }

        throw new Error('All stream gateways are currently unreachable.\n\nThis ripper uses public YouTube proxy APIs that can go down.\nTry again in a few minutes, or use the Download_From_Spotify_and_YT.bat script for guaranteed 320kbps downloads.');
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

window.CyberRipperEngine = new CyberRipperEngine();
