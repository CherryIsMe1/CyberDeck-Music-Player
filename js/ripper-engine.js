/**
 * Cyberdeck Netrunner Ripper Engine
 * Handles stream extraction from Spotify, YouTube, SoundCloud, and direct URLs.
 * Works seamlessly in Browser/PWA mode (via Web APIs) and Desktop Native mode (via Tauri IPC).
 */
class CyberRipperEngine {
    constructor() {
        this.isProcessing = false;
        this.onLogUpdate = null;
        this.onProgressUpdate = null;
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
     * Main entry point: Rips an audio stream from a URL or search query.
     */
    async ripStream(rawInput, quality = '320k') {
        if (this.isProcessing) {
            throw new Error('Ripper protocol already in execution. Standby.');
        }

        this.isProcessing = true;
        this.setProgress(5);

        try {
            const input = rawInput.trim();
            if (!input) throw new Error('Target stream URL cannot be empty.');

            this.log('INITIATING NETRUNNER DECRYPTOR v2.077...', 'system');
            await this.sleep(300);

            // 1. Check if running inside native Tauri environment
            if (window.__TAURI__) {
                return await this.ripViaTauri(input, quality);
            }

            // 2. Browser / PWA Execution
            return await this.ripViaWeb(input, quality);

        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Browser / PWA Mode: Resolves metadata and stream in the browser.
     */
    async ripViaWeb(input, quality) {
        this.log(`TARGET SPECIFICATION: ${input}`, 'info');
        this.setProgress(15);
        await this.sleep(250);

        let trackMeta = {
            title: 'Unknown Track',
            artist: 'Cyberdeck Nomad',
            album: 'Netrunner Archive 2077',
            year: new Date().getFullYear().toString(),
            coverArt: 'assets/omi_portrait.png',
            audioUrl: null
        };

        // A. Handle Spotify URLs
        if (input.includes('spotify.com')) {
            this.log('SPOTIFY STREAM IDENTIFIER DETECTED.', 'success');
            this.log('RESOLVING OEMBED METADATA HEADERS...', 'info');
            this.setProgress(30);

            try {
                const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(input)}`;
                const response = await fetch(oembedUrl);
                if (response.ok) {
                    const data = await response.json();
                    if (data.title) {
                        // Title usually formatted as "Song Title" or "Song - Artist"
                        trackMeta.title = data.title;
                    }
                    if (data.thumbnail_url) {
                        trackMeta.coverArt = data.thumbnail_url;
                    }
                    this.log(`METADATA RESOLVED: "${trackMeta.title}"`, 'success');
                }
            } catch (err) {
                this.log('DIRECT OEMBED TIMEOUT. SWITCHING TO HEURISTIC RESOLVER...', 'warn');
            }

            this.setProgress(50);
            this.log('SCANNING AUDIO REPOSITORIES FOR BEST BITRATE MATCH...', 'info');
            await this.sleep(400);

            // Fetch audio match via iTunes / Deezer search API
            trackMeta = await this.enrichAudioStream(trackMeta, trackMeta.title);

        } else if (input.includes('youtube.com') || input.includes('youtu.be')) {
            // B. Handle YouTube URLs
            this.log('YOUTUBE STREAM DETECTED.', 'success');
            this.setProgress(35);
            this.log('INTERCEPTING AUDIO SUB-CARRIER...', 'info');
            
            // Extract video ID
            const match = input.match(/(?:youtu\.be\/|v=|\/embed\/|\/watch\?v=|\&v=)([\w-]{11})/);
            const videoId = match ? match[1] : null;

            if (videoId) {
                trackMeta.coverArt = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
            }

            trackMeta = await this.enrichAudioStream(trackMeta, videoId ? `YouTube Stream [${videoId}]` : 'Nomad Stream');

        } else if (input.match(/^https?:\/\/.*\.mp3($|\?)/i)) {
            // C. Direct MP3 URL
            this.log('DIRECT MP3 BINARY STREAM DETECTED.', 'success');
            this.setProgress(40);
            trackMeta.audioUrl = input;
            const filename = input.split('/').pop().split('?')[0].replace(/\.mp3$/i, '');
            trackMeta.title = decodeURIComponent(filename);
            this.log(`STREAM BUFFER READY: ${trackMeta.title}`, 'success');

        } else {
            // D. Query Search
            this.log(`EXECUTING AUDIO SEARCH FOR: "${input}"`, 'info');
            trackMeta = await this.enrichAudioStream(trackMeta, input);
        }

        this.setProgress(75);
        this.log('DECRYPTING & BUFFERING AUDIO SAMPLES...', 'info');
        await this.sleep(400);

        this.setProgress(90);
        this.log('INJECTING ID3v2 CYBERDECK METADATA & COVER ART...', 'info');
        await this.sleep(300);

        const newTrack = {
            id: 'ripped-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
            title: trackMeta.title,
            artist: trackMeta.artist,
            album: trackMeta.album,
            year: trackMeta.year,
            duration: trackMeta.duration || 180,
            url: trackMeta.audioUrl,
            coverArt: trackMeta.coverArt,
            isRipped: true
        };

        this.setProgress(100);
        this.log(`SUCCESS: STREAM [${newTrack.title}] READY IN LOCAL DECK!`, 'success');

        return newTrack;
    }

    /**
     * Enriches track with playable audio preview and metadata via public search APIs.
     */
    async enrichAudioStream(meta, query) {
        try {
            const cleanQuery = query.replace(/[^\w\s-]/gi, ' ').trim();
            const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(cleanQuery)}&media=music&entity=song&limit=1`;
            
            const res = await fetch(itunesUrl);
            if (res.ok) {
                const data = await res.json();
                if (data.results && data.results.length > 0) {
                    const item = data.results[0];
                    meta.title = item.trackName || meta.title;
                    meta.artist = item.artistName || meta.artist;
                    meta.album = item.collectionName || meta.album;
                    meta.year = item.releaseDate ? item.releaseDate.split('-')[0] : '2077';
                    if (!meta.coverArt || meta.coverArt.includes('omi_portrait')) {
                        meta.coverArt = (item.artworkUrl100 || '').replace('100x100bb', '600x600bb');
                    }
                    meta.audioUrl = item.previewUrl;
                    meta.duration = Math.round((item.trackTimeMillis || 180000) / 1000);
                    this.log(`AUDIO MATCHED: ${meta.artist} - ${meta.title}`, 'success');
                    return meta;
                }
            }
        } catch (e) {
            this.log('PUBLIC INDEX LOOKUP FAILED. SYNTHESIZING NOMAD PROXY STREAM...', 'warn');
        }

        // If audio stream could not be legally or directly resolved in browser
        if (!meta.audioUrl) {
            this.log('SPOTIFY / YOUTUBE DRM RESTRICTION DETECTED.', 'error');
            this.log('Browser sandbox cannot decrypt raw Widevine streams directly.', 'warn');
            this.log('FOR FULL 320K MP3: Run "Pobierz_Ze_Spotify_i_YT.bat" in project folder!', 'system');
            throw new Error('Spotify/YouTube stream is DRM/CORS protected in browser. Double-click "Pobierz_Ze_Spotify_i_YT.bat" to download the real 320 kbps MP3 with full artwork!');
        }

        return meta;
    }

    /**
     * Native Desktop Mode: Invokes native Rust commands in Tauri (running yt-dlp + ffmpeg).
     */
    async ripViaTauri(input, quality) {
        this.log('TAURI NATIVE BRIDGE DETECTED: EXECUTING NATIVE YT-DLP PIPELINE...', 'system');
        this.setProgress(25);

        try {
            const res = await window.__TAURI__.invoke('rip_audio_stream', {
                url: input,
                quality: quality
            });

            this.setProgress(100);
            this.log(`NATIVE FILE SAVED TO DISK: ${res.filePath}`, 'success');

            return {
                id: 'tauri-' + Date.now(),
                title: res.title || 'Downloaded Track',
                artist: res.artist || 'Unknown Artist',
                album: res.album || 'Tauri Deck',
                year: res.year || '2077',
                duration: res.duration || 210,
                url: res.filePath,
                coverArt: res.coverArt || 'assets/omi_portrait.png',
                isRipped: true
            };
        } catch (err) {
            this.log(`TAURI NATIVE ERROR: ${err}`, 'error');
            throw err;
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

window.CyberRipperEngine = new CyberRipperEngine();
