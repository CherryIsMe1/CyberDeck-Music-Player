/**
 * SNDeck Playlist & Track Manager
 * Handles track storage, custom playlists, sorting, filtering, shuffle, repeat, and localStorage persistence.
 */
const LEGACY_STORAGE_MIGRATIONS = [
    ['sndeck_playlists', 'edgerunners_playlists'],
    ['sndeck_favorites', 'edgerunners_favorites'],
    ['sndeck_tracks', 'edgerunners_tracks']
];

class CyberPlaylistManager {
    constructor() {
        this.tracks = new Map(); // id -> track object
        this.playlists = {
            'all': { id: 'all', name: 'ALL TRACKS', trackIds: [], system: true },
            'favorites': { id: 'favorites', name: 'FAVORITES', trackIds: [], system: true },
            'recent': { id: 'recent', name: 'RECENTLY PLAYED', trackIds: [], system: true }
        };

        this.activePlaylistId = 'all';
        this.currentTrackId = null;
        this.searchQuery = '';
        this.sortBy = 'date-desc'; // 'title-asc', 'title-desc', 'artist-asc', 'duration-asc', 'duration-desc', 'date-desc'
        
        // Playback Modes
        this.repeatMode = 'all'; // 'off' | 'all' | 'one'
        this.isShuffle = false;
        this.shuffledOrder = [];
        this.shuffleIndex = -1;

        // Change listeners
        this.onLibraryChange = null;
        this.onActivePlaylistChange = null;
        this.onTrackChange = null;

        this.migrateLegacyStorage();
        this.loadFromStorage();
    }

    migrateLegacyStorage() {
        try {
            for (const [currentKey, legacyKey] of LEGACY_STORAGE_MIGRATIONS) {
                const currentValue = localStorage.getItem(currentKey);
                const legacyValue = localStorage.getItem(legacyKey);
                if ((currentValue === null || currentValue === '') && legacyValue !== null) {
                    localStorage.setItem(currentKey, legacyValue);
                }
            }

            LEGACY_STORAGE_MIGRATIONS.forEach(([, legacyKey]) => localStorage.removeItem(legacyKey));
        } catch (error) {
            console.warn('Legacy library data was kept because it could not be migrated completely:', error);
        }
    }

    loadFromStorage() {
        try {
            const savedPlaylists = localStorage.getItem('sndeck_playlists') || localStorage.getItem('edgerunners_playlists');
            if (savedPlaylists) {
                const parsed = JSON.parse(savedPlaylists);
                Object.keys(parsed).forEach(key => {
                    if (!this.playlists[key]) {
                        this.playlists[key] = parsed[key];
                    } else if (!this.playlists[key].system) {
                        this.playlists[key] = parsed[key];
                    } else {
                        this.playlists[key].trackIds = parsed[key].trackIds || [];
                    }
                });
            }

            const savedFavs = localStorage.getItem('sndeck_favorites') || localStorage.getItem('edgerunners_favorites');
            if (savedFavs) {
                this.playlists.favorites.trackIds = JSON.parse(savedFavs);
            }

            // Restore persisted tracks (Tauri mode: recreate from file paths)
            const savedTracks = localStorage.getItem('sndeck_tracks') || localStorage.getItem('edgerunners_tracks');
            if (savedTracks) {
                const trackList = JSON.parse(savedTracks);
                const seenPaths = new Set();
                const validIds = new Set();

                for (const t of trackList) {
                    if (t.filePath) {
                        const norm = t.filePath.toLowerCase().replace(/\\/g, '/');
                        if (seenPaths.has(norm)) {
                            continue; // Skip duplicate file
                        }
                        seenPaths.add(norm);
                    }

                    // Cover art is always re-extracted from files on startup
                    // (localStorage is too small for many track covers)

                    if (typeof window.__TAURI__ !== 'undefined' && t.filePath) {
                        t.url = window.__TAURI__.core.convertFileSrc(t.filePath);
                        this.tracks.set(t.id, t);
                        validIds.add(t.id);
                        // Always restore cover art from actual file
                        this.restoreTrackCover(t);
                    } else if (!t.filePath) {
                        // Non-Tauri blob: URLs cannot be restored
                    }
                }

                // Filter out any duplicate or removed track IDs from all playlists
                Object.keys(this.playlists).forEach(key => {
                    const pl = this.playlists[key];
                    if (pl && Array.isArray(pl.trackIds)) {
                        pl.trackIds = pl.trackIds.filter(id => validIds.has(id));
                    }
                });
            }
        } catch (e) {
            console.warn("Error reading playlist data from localStorage:", e);
        }
    }

    saveToStorage() {
        try {
            localStorage.setItem('sndeck_playlists', JSON.stringify(this.playlists));
            localStorage.setItem('sndeck_favorites', JSON.stringify(this.playlists.favorites.trackIds));

            // Persist track metadata (without cover art or file blobs — saves space).
            // Cover art is re-extracted from the actual audio files on startup via
            // restoreTrackCover(), so we never store it in localStorage.
            const trackData = [];
            this.tracks.forEach(track => {
                const { file, coverArt, ...rest } = track; // eslint-disable-line no-unused-vars
                trackData.push(rest);
            });
            localStorage.setItem('sndeck_tracks', JSON.stringify(trackData));
            LEGACY_STORAGE_MIGRATIONS.forEach(([, legacyKey]) => localStorage.removeItem(legacyKey));
        } catch (e) {
            console.warn("Error writing to localStorage:", e);
        }
    }

    async addFiles(fileList) {
        const newTracks = [];
        const existingKeys = new Set(
            Array.from(this.tracks.values()).map(t => {
                if (t.filePath) return t.filePath.toLowerCase().replace(/\\/g, '/');
                if (t.file) return `${t.file.name}_${t.file.size}`;
                return `${t.title}_${t.artist}`;
            })
        );

        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            if (!file.name.toLowerCase().endsWith('.mp3') && !file.type.includes('audio')) {
                continue;
            }

            const fileKey = `${file.name}_${file.size}`;
            if (existingKeys.has(fileKey)) {
                continue; // Skip duplicate file
            }
            existingKeys.add(fileKey);

            const id = 'track_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
            const metadata = await window.ID3Parser.parse(file);
            const url = URL.createObjectURL(file);

            // Get duration
            let duration = 0;
            try {
                duration = await this.getAudioDuration(url);
            } catch (e) {
                duration = 0;
            }

            const track = {
                id,
                file,
                url,
                title: metadata.title || file.name,
                artist: metadata.artist || 'Unknown Artist',
                album: metadata.album || 'Unknown Album',
                year: metadata.year || '',
                coverArt: metadata.coverArt || null,
                duration: duration,
                dateAdded: Date.now()
            };

            this.tracks.set(id, track);
            this.playlists.all.trackIds.push(id);
            newTracks.push(track);
        }

        if (newTracks.length > 0) {
            this.saveToStorage();
            this.notifyChange();
        }
        return newTracks;
    }

    /**
     * Tauri mode: add tracks from real filesystem paths.
     * Uses convertFileSrc for stable URLs and persists filePath for reload.
     */
    async addFilesFromPaths(paths, rippedMetadataByPath = new Map()) {
        const newTracks = [];
        const existingPaths = new Set(
            Array.from(this.tracks.values())
                .filter(t => t.filePath)
                .map(t => t.filePath.toLowerCase().replace(/\\/g, '/'))
        );

        for (const filePath of paths) {
            const normPath = filePath.toLowerCase().replace(/\\/g, '/');
            if (existingPaths.has(normPath)) {
                continue; // Skip duplicate file
            }
            existingPaths.add(normPath);
            const rippedMetadata = rippedMetadataByPath.get(normPath) || {};

            const url = window.__TAURI__.core.convertFileSrc(filePath);

            // Extract filename (handle both / and \ separators)
            const rawName = filePath.replace(/\\/g, '/').split('/').pop();
            let nameNoExt = rawName.replace(/\.[^.]+$/, '');
            try {
                nameNoExt = decodeURIComponent(nameNoExt);
            } catch (_) {}

            let fallbackTitle = nameNoExt;
            let fallbackArtist = 'Unknown Artist';
            const cleanName = nameNoExt.replace(/^\d+[\s.-]+/, '');
            if (cleanName.includes(' - ')) {
                const parts = cleanName.split(' - ');
                fallbackArtist = parts[0].trim();
                fallbackTitle = parts.slice(1).join(' - ').trim();
            }

            const id = 'track_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

            // Attempt ID3 parsing via fetch + File object
            let metadata = {};
            try {
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                const file = new File([arrayBuffer], rawName, { type: 'audio/mpeg' });
                metadata = await window.ID3Parser.parse(file);
            } catch (e) {
                // Fall back to filename-based metadata
            }

            let duration = 0;
            try {
                duration = await this.getAudioDuration(url);
            } catch (e) {
                duration = 0;
            }

            const track = {
                id,
                filePath,
                url,
                title: rippedMetadata.title || metadata.title || fallbackTitle,
                artist: rippedMetadata.artist || metadata.artist || fallbackArtist,
                album: rippedMetadata.album || metadata.album || 'Unknown Album',
                year: rippedMetadata.year || metadata.year || '',
                coverArt: metadata.coverArt || rippedMetadata.coverArt || null,
                duration: duration || Number(rippedMetadata.duration) || 0,
                dateAdded: Date.now()
            };

            this.tracks.set(id, track);
            this.playlists.all.trackIds.push(id);
            newTracks.push(track);
        }

        if (newTracks.length > 0) {
            this.saveToStorage();
            this.notifyChange();
        }
        return newTracks;
    }

    addCustomTrack(track) {
        this.tracks.set(track.id, track);
        if (!this.playlists.all.trackIds.includes(track.id)) {
            this.playlists.all.trackIds.push(track.id);
        }
        this.notifyChange();
    }

    async restoreTrackCover(track) {
        if (!track || !track.url || track.coverArt) return;
        // Wait for ID3Parser to be available (scripts may load async)
        const waitForParser = () => new Promise(resolve => {
            if (window.ID3Parser) return resolve();
            const check = setInterval(() => {
                if (window.ID3Parser) { clearInterval(check); resolve(); }
            }, 50);
            setTimeout(() => { clearInterval(check); resolve(); }, 3000);
        });
        await waitForParser();
        if (!window.ID3Parser) return;

        try {
            const response = await fetch(track.url);
            const arrayBuffer = await response.arrayBuffer();
            const rawName = (track.filePath || 'track.mp3').replace(/\\/g, '/').split('/').pop();
            const file = new File([arrayBuffer], rawName, { type: 'audio/mpeg' });
            const metadata = await window.ID3Parser.parse(file);
            if (metadata.coverArt) {
                track.coverArt = metadata.coverArt;
                // Notify the UI that a cover was restored
                if (window.onCoverRestored) {
                    window.onCoverRestored(track);
                }
            }
        } catch (e) {
            // silent fallback — disc shows vinyl SVG
        }
    }

    getAudioDuration(url) {
        return new Promise((resolve) => {
            const tempAudio = new Audio();
            tempAudio.preload = 'metadata';
            let settled = false;
            let timeoutId;
            const finish = (duration) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutId);
                tempAudio.removeEventListener('loadedmetadata', onMetadata);
                tempAudio.removeEventListener('error', onError);
                tempAudio.removeAttribute('src');
                tempAudio.load();
                resolve(duration);
            };
            const onMetadata = () => finish(Number.isFinite(tempAudio.duration) ? tempAudio.duration : 0);
            const onError = () => finish(0);
            tempAudio.addEventListener('loadedmetadata', onMetadata);
            tempAudio.addEventListener('error', onError);
            // Some local formats take longer than 400 ms to expose their metadata.
            timeoutId = setTimeout(() => finish(0), 2000);
            tempAudio.src = url;
        });
    }

    createPlaylist(name) {
        const id = 'pl_' + Date.now();
        const trimmed = (name || '').trim() || 'NEW PLAYLIST';
        this.playlists[id] = {
            id,
            name: trimmed.toUpperCase(),
            trackIds: [],
            system: false
        };
        this.saveToStorage();
        this.notifyChange();
        return id;
    }

    renamePlaylist(id, newName) {
        if (this.playlists[id] && !this.playlists[id].system) {
            this.playlists[id].name = newName.trim().toUpperCase();
            this.saveToStorage();
            this.notifyChange();
        }
    }

    togglePlaylistFavorite(id) {
        const playlist = this.playlists[id];
        if (!playlist || playlist.system) return false;
        playlist.favorite = !playlist.favorite;
        this.saveToStorage();
        this.notifyChange();
        return playlist.favorite;
    }

    deletePlaylist(id) {
        if (this.playlists[id] && !this.playlists[id].system) {
            delete this.playlists[id];
            if (this.activePlaylistId === id) {
                this.activePlaylistId = 'all';
            }
            this.saveToStorage();
            this.notifyChange();
        }
    }

    reorderCustomPlaylists(orderedIds) {
        const systemEntries = Object.entries(this.playlists).filter(([, playlist]) => playlist.system);
        const customEntries = Object.entries(this.playlists).filter(([, playlist]) => !playlist.system);
        const byId = new Map(customEntries);
        const reordered = orderedIds.map(id => [id, byId.get(id)]).filter(([, playlist]) => playlist);
        const included = new Set(reordered.map(([id]) => id));
        customEntries.forEach(([id, playlist]) => {
            if (!included.has(id)) reordered.push([id, playlist]);
        });
        this.playlists = Object.fromEntries([...systemEntries, ...reordered]);
        this.saveToStorage();
        this.notifyChange();
    }

    addTrackToPlaylist(playlistId, trackId) {
        const pl = this.playlists[playlistId];
        if (pl && !pl.trackIds.includes(trackId)) {
            pl.trackIds.push(trackId);
            this.saveToStorage();
            this.notifyChange();
            return true;
        }
        return false;
    }

    removeTrackFromPlaylist(playlistId, trackId) {
        const pl = this.playlists[playlistId];
        if (pl) {
            pl.trackIds = pl.trackIds.filter(id => id !== trackId);
            this.saveToStorage();
            this.notifyChange();
        }
    }

    removeTracksFromPlaylist(playlistId, trackIds) {
        const pl = this.playlists[playlistId];
        if (!pl || pl.system || !Array.isArray(trackIds) || trackIds.length === 0) return 0;
        const removeIds = new Set(trackIds);
        const previousCount = pl.trackIds.length;
        pl.trackIds = pl.trackIds.filter(id => !removeIds.has(id));
        const removedCount = previousCount - pl.trackIds.length;
        if (removedCount > 0) {
            this.saveToStorage();
            this.notifyChange();
        }
        return removedCount;
    }

    deleteTracksFromLibrary(trackIds) {
        if (!Array.isArray(trackIds) || trackIds.length === 0) return 0;
        const deleteIds = new Set(trackIds.filter(id => this.tracks.has(id)));
        if (deleteIds.size === 0) return 0;

        deleteIds.forEach(id => this.tracks.delete(id));
        Object.values(this.playlists).forEach(playlist => {
            playlist.trackIds = playlist.trackIds.filter(id => !deleteIds.has(id));
        });
        this.shuffledOrder = this.shuffledOrder.filter(id => !deleteIds.has(id));

        if (deleteIds.has(this.currentTrackId)) {
            this.currentTrackId = null;
            if (this.onTrackChange) this.onTrackChange(null);
        }
        this.shuffleIndex = this.currentTrackId ? this.shuffledOrder.indexOf(this.currentTrackId) : 0;

        this.saveToStorage();
        this.notifyChange();
        return deleteIds.size;
    }

    toggleFavorite(trackId) {
        const favs = this.playlists.favorites.trackIds;
        const idx = favs.indexOf(trackId);
        let isFav = false;
        if (idx >= 0) {
            favs.splice(idx, 1);
            isFav = false;
        } else {
            favs.push(trackId);
            isFav = true;
        }
        this.saveToStorage();
        this.notifyChange();
        return isFav;
    }

    isFavorite(trackId) {
        return this.playlists.favorites.trackIds.includes(trackId);
    }

    setActivePlaylist(playlistId) {
        if (this.playlists[playlistId]) {
            this.activePlaylistId = playlistId;
            this.buildShuffleList();
            if (this.onActivePlaylistChange) this.onActivePlaylistChange(playlistId);
        }
    }

    getActiveTracks() {
        const pl = this.playlists[this.activePlaylistId] || this.playlists.all;
        let trackList = pl.trackIds
            .map(id => this.tracks.get(id))
            .filter(t => t !== undefined);

        // Filter by search query
        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            trackList = trackList.filter(t => 
                (t.title && t.title.toLowerCase().includes(q)) ||
                (t.artist && t.artist.toLowerCase().includes(q)) ||
                (t.album && t.album.toLowerCase().includes(q))
            );
        }

        // Sort
        trackList.sort((a, b) => {
            switch (this.sortBy) {
                case 'title-asc':
                    return a.title.localeCompare(b.title);
                case 'title-desc':
                    return b.title.localeCompare(a.title);
                case 'artist-asc':
                    return a.artist.localeCompare(b.artist);
                case 'duration-asc':
                    return (a.duration || 0) - (b.duration || 0);
                case 'duration-desc':
                    return (b.duration || 0) - (a.duration || 0);
                case 'date-desc':
                default:
                    return (b.dateAdded || 0) - (a.dateAdded || 0);
            }
        });

        return trackList;
    }

    setSearchQuery(q) {
        this.searchQuery = q.trim();
        this.buildShuffleList();
        this.notifyChange();
    }

    setSortBy(sortKey) {
        this.sortBy = sortKey;
        this.buildShuffleList();
        this.notifyChange();
    }

    toggleShuffle() {
        this.isShuffle = !this.isShuffle;
        if (this.isShuffle) {
            this.buildShuffleList();
        }
        return this.isShuffle;
    }

    cycleRepeat() {
        const modes = ['off', 'all', 'one'];
        const nextIdx = (modes.indexOf(this.repeatMode) + 1) % modes.length;
        this.repeatMode = modes[nextIdx];
        return this.repeatMode;
    }

    buildShuffleList() {
        const currentList = this.getActiveTracks();
        this.shuffledOrder = [...currentList.map(t => t.id)];
        // Fisher-Yates shuffle
        for (let i = this.shuffledOrder.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.shuffledOrder[i], this.shuffledOrder[j]] = [this.shuffledOrder[j], this.shuffledOrder[i]];
        }
        if (this.currentTrackId) {
            this.shuffleIndex = this.shuffledOrder.indexOf(this.currentTrackId);
        } else {
            this.shuffleIndex = 0;
        }
    }

    getTrack(id) {
        return this.tracks.get(id);
    }

    getCurrentTrack() {
        return this.currentTrackId ? this.tracks.get(this.currentTrackId) : null;
    }

    setCurrentTrack(id) {
        this.currentTrackId = id;
        if (id) {
            // Update recent playlist
            const recent = this.playlists.recent.trackIds;
            const rIdx = recent.indexOf(id);
            if (rIdx >= 0) recent.splice(rIdx, 1);
            recent.unshift(id);
            if (recent.length > 30) recent.pop();

            if (this.isShuffle) {
                this.shuffleIndex = this.shuffledOrder.indexOf(id);
            }
        }
        if (this.onTrackChange) this.onTrackChange(this.getCurrentTrack());
    }

    getNextTrack() {
        const activeTracks = this.getActiveTracks();
        if (activeTracks.length === 0) return null;

        if (this.repeatMode === 'one' && this.currentTrackId) {
            return this.getCurrentTrack();
        }

        if (this.isShuffle) {
            if (this.shuffledOrder.length === 0) this.buildShuffleList();
            this.shuffleIndex++;
            if (this.shuffleIndex >= this.shuffledOrder.length) {
                if (this.repeatMode === 'off') return null;
                this.buildShuffleList();
                this.shuffleIndex = 0;
            }
            const nextId = this.shuffledOrder[this.shuffleIndex];
            return this.tracks.get(nextId) || activeTracks[0];
        }

        const currentIdx = activeTracks.findIndex(t => t.id === this.currentTrackId);
        if (currentIdx === -1) return activeTracks[0];

        const nextIdx = currentIdx + 1;
        if (nextIdx >= activeTracks.length) {
            if (this.repeatMode === 'off') return null;
            return activeTracks[0];
        }
        return activeTracks[nextIdx];
    }

    getPreviousTrack() {
        const activeTracks = this.getActiveTracks();
        if (activeTracks.length === 0) return null;

        if (this.isShuffle) {
            this.shuffleIndex = Math.max(0, this.shuffleIndex - 1);
            const prevId = this.shuffledOrder[this.shuffleIndex];
            return this.tracks.get(prevId) || activeTracks[0];
        }

        const currentIdx = activeTracks.findIndex(t => t.id === this.currentTrackId);
        if (currentIdx <= 0) {
            return activeTracks[activeTracks.length - 1];
        }
        return activeTracks[currentIdx - 1];
    }

    notifyChange() {
        if (this.onLibraryChange) this.onLibraryChange();
    }
}

window.PlaylistManager = new CyberPlaylistManager();
