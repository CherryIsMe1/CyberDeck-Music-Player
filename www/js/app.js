/**
 * Cyberpunk Edgerunners 2 - OMI // SNAKE NATION AUDIO DECK
 * Main App Controller
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Visualizer
    const canvas = document.getElementById('cyberVisualizerCanvas');
    const visualizer = new window.CyberVisualizer(canvas);
    visualizer.start();

    // 2. DOM Elements
    const elements = {
        // Files
        fileInput: document.getElementById('fileInput'),
        folderInput: document.getElementById('folderInput'),
        btnImportFiles: document.getElementById('btnImportFiles'),
        btnImportFolder: document.getElementById('btnImportFolder'),
        dropZoneOverlay: document.getElementById('dropZoneOverlay'),

        // Player Controls
        btnPlayMaster: document.getElementById('btnPlayMaster'),
        playMasterIcon: document.getElementById('playMasterIcon'),
        btnPrev: document.getElementById('btnPrev'),
        btnNext: document.getElementById('btnNext'),
        btnShuffle: document.getElementById('btnShuffle'),
        btnRepeat: document.getElementById('btnRepeat'),
        repeatLabel: document.getElementById('repeatLabel'),
        seekBarWrapper: document.getElementById('seekBarWrapper'),
        seekBarProgress: document.getElementById('seekBarProgress'),
        currentTimeDisplay: document.getElementById('currentTimeDisplay'),
        durationDisplay: document.getElementById('durationDisplay'),
        volumeSlider: document.getElementById('volumeSlider'),
        volPercent: document.getElementById('volPercent'),
        btnMute: document.getElementById('btnMute'),
        muteIconSlot: document.getElementById('muteIconSlot'),
        btnToggleCover: document.getElementById('btnToggleCover'),
        headerCoverStatus: document.getElementById('headerCoverStatus'),
        btnToggleSound: document.getElementById('btnToggleSound'),

        // Display
        trackLiveTitle: document.getElementById('trackLiveTitle'),
        trackLiveArtist: document.getElementById('trackLiveArtist'),
        trackLiveAlbum: document.getElementById('trackLiveAlbum'),
        holoTurntable: document.getElementById('holoTurntable'),
        holoCoverArt: document.getElementById('holoCoverArt'),

        // Playlists
        playlistsContainer: document.getElementById('playlistsContainer'),
        btnNewPlaylist: document.getElementById('btnNewPlaylist'),
        playlistModal: document.getElementById('playlistModal'),
        playlistNameInput: document.getElementById('playlistNameInput'),
        btnConfirmPlaylist: document.getElementById('btnConfirmPlaylist'),
        btnCancelPlaylist: document.getElementById('btnCancelPlaylist'),
        activePlaylistTitle: document.getElementById('activePlaylistTitle'),

        // Ripper
        btnOpenRipper: document.getElementById('btnOpenRipper'),
        ripperModal: document.getElementById('ripperModal'),
        btnCloseRipper: document.getElementById('btnCloseRipper'),
        btnExecuteRip: document.getElementById('btnExecuteRip'),
        ripperUrlInput: document.getElementById('ripperUrlInput'),
        ripperQuality: document.getElementById('ripperQuality'),
        ripperTargetPlaylist: document.getElementById('ripperTargetPlaylist'),
        ripperConsoleLog: document.getElementById('ripperConsoleLog'),
        ripperProgressFill: document.getElementById('ripperProgressFill'),
        ripperStatusDot: document.getElementById('ripperStatusDot'),

        // Tracks
        trackScrollList: document.getElementById('trackScrollList'),
        searchInput: document.getElementById('searchInput'),
        sortSelect: document.getElementById('sortSelect'),
        trackCountBadge: document.getElementById('trackCountBadge'),

        // EQ
        presetSelect: document.getElementById('presetSelect'),
        eqSliders: document.querySelectorAll('.eq-slider'),

        // Mode Pills
        modePills: document.querySelectorAll('.btn-mode-pill')
    };

    let isSeeking = false;
    let isMuted = false;
    let prevVolume = 0.8;
    let coverMode = localStorage.getItem('edgerunners_cover_mode') || 'omi'; // 'omi' | 'album'

    // Update Turntable Cover Art Display
    function updateCoverArtDisplay() {
        const track = window.PlaylistManager.getCurrentTrack();
        if (coverMode === 'omi') {
            elements.holoCoverArt.src = 'assets/omi_portrait.png';
            elements.btnToggleCover.textContent = 'DISC VIEW: OMI PORTRAIT';
            elements.btnToggleCover.classList.remove('mode-album');
            if (elements.headerCoverStatus) {
                elements.headerCoverStatus.textContent = 'OMI PORTRAIT';
                elements.headerCoverStatus.style.color = 'var(--omi-pink)';
            }
        } else {
            if (track && track.coverArt) {
                elements.holoCoverArt.src = track.coverArt;
            } else {
                elements.holoCoverArt.src = 'assets/cyber_vinyl.svg';
            }
            elements.btnToggleCover.textContent = 'DISC VIEW: ALBUM COVER';
            elements.btnToggleCover.classList.add('mode-album');
            if (elements.headerCoverStatus) {
                elements.headerCoverStatus.textContent = 'ALBUM COVER';
                elements.headerCoverStatus.style.color = 'var(--omi-green)';
            }
        }
    }

    window.onCoverRestored = (restoredTrack) => {
        const current = window.PlaylistManager.getCurrentTrack();
        if (current && current.id === restoredTrack.id) {
            updateCoverArtDisplay();
        }
    };

    // SVG Icons
    const ICONS = {
        play: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
        pause: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
        volume: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
        mute: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>',
        favFilled: '<svg viewBox="0 0 24 24" width="11" height="11" fill="var(--omi-purple)"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>',
        favOutline: '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>'
    };

    // =========================================================================
    // AUDIO ENGINE CALLBACKS
    // =========================================================================
    window.AudioEngine.onTimeUpdate = (currentTime, duration) => {
        if (!isSeeking) {
            const percent = duration > 0 ? (currentTime / duration) * 100 : 0;
            elements.seekBarProgress.style.width = `${percent}%`;
            elements.currentTimeDisplay.textContent = formatTime(currentTime);
        }
    };

    window.AudioEngine.onLoadedMetadata = (duration) => {
        elements.durationDisplay.textContent = formatTime(duration);
    };

    window.AudioEngine.onTrackEnd = () => {
        playNextTrack();
    };

    window.AudioEngine.onPlayStateChange = (isPlaying) => {
        updatePlayButtonState(isPlaying);
    };

    // =========================================================================
    // PLAYBACK CONTROLS
    // =========================================================================
    function updatePlayButtonState(isPlaying) {
        if (isPlaying) {
            elements.playMasterIcon.innerHTML = ICONS.pause;
            elements.btnPlayMaster.setAttribute('title', 'Pause (Space)');
            elements.holoTurntable.classList.add('spinning');
        } else {
            elements.playMasterIcon.innerHTML = ICONS.play;
            elements.btnPlayMaster.setAttribute('title', 'Play (Space)');
            elements.holoTurntable.classList.remove('spinning');
        }
    }

    async function playTrack(track) {
        if (!track) return;
        window.CyberSound.playClick();
        window.PlaylistManager.setCurrentTrack(track.id);

        // Update Now Playing UI
        elements.trackLiveTitle.textContent = track.title || 'Unknown Track';
        elements.trackLiveArtist.textContent = track.artist || 'Unknown Artist';
        elements.trackLiveAlbum.textContent = `${track.album || 'NOMAD_DECK'} • ${track.year || '2077'}`;

        updateCoverArtDisplay();
        if (!track.coverArt && track.filePath && window.PlaylistManager.restoreTrackCover) {
            window.PlaylistManager.restoreTrackCover(track).then(() => {
                updateCoverArtDisplay();
            });
        }

        // Set system MediaSession
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: track.title,
                artist: track.artist,
                album: track.album,
                artwork: track.coverArt ? [{ src: track.coverArt, sizes: '512x512', type: 'image/jpeg' }] : [{ src: 'assets/omi_portrait.png', sizes: '512x512', type: 'image/png' }]
            });
        }

        await window.AudioEngine.loadTrack(track.url);
        await window.AudioEngine.play();
        renderTracks();
    }

    function playNextTrack() {
        const next = window.PlaylistManager.getNextTrack();
        if (next) {
            playTrack(next);
        } else {
            window.AudioEngine.pause();
        }
    }

    function playPrevTrack() {
        const prev = window.PlaylistManager.getPreviousTrack();
        if (prev) {
            playTrack(prev);
        }
    }

    // Play/Pause Master
    elements.btnPlayMaster.addEventListener('click', async () => {
        window.CyberSound.playClick();
        const current = window.PlaylistManager.getCurrentTrack();
        if (!current) {
            const activeList = window.PlaylistManager.getActiveTracks();
            if (activeList.length > 0) {
                await playTrack(activeList[0]);
            } else {
                loadSampleDemoTrack('chill');
            }
            return;
        }

        if (window.AudioEngine.audio.paused) {
            await window.AudioEngine.play();
        } else {
            window.AudioEngine.pause();
        }
    });

    elements.btnNext.addEventListener('click', () => {
        window.CyberSound.playClick();
        playNextTrack();
    });

    elements.btnPrev.addEventListener('click', () => {
        window.CyberSound.playClick();
        playPrevTrack();
    });

    // Shuffle & Repeat
    elements.btnShuffle.addEventListener('click', () => {
        window.CyberSound.playGlitch();
        const active = window.PlaylistManager.toggleShuffle();
        elements.btnShuffle.classList.toggle('active', active);
    });

    elements.btnRepeat.addEventListener('click', () => {
        window.CyberSound.playClick();
        const mode = window.PlaylistManager.cycleRepeat();
        elements.btnRepeat.classList.toggle('active', mode !== 'off');
        elements.repeatLabel.textContent = mode === 'one' ? 'LOOP 1' : mode === 'all' ? 'LOOP ALL' : 'LOOP OFF';
        elements.btnRepeat.setAttribute('title', `Loop: ${mode.toUpperCase()}`);
    });

    // Seek bar
    elements.seekBarWrapper.addEventListener('click', (e) => {
        const rect = elements.seekBarWrapper.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        const duration = window.AudioEngine.audio.duration;
        if (!isNaN(duration) && duration > 0) {
            const targetTime = pos * duration;
            window.AudioEngine.seek(targetTime);
            elements.seekBarProgress.style.width = `${pos * 100}%`;
        }
    });

    // Volume
    function updateVolumeDisplay(val) {
        elements.volPercent.textContent = `${Math.round(val * 100)}%`;
        if (val === 0) {
            elements.muteIconSlot.innerHTML = ICONS.mute;
            isMuted = true;
        } else {
            elements.muteIconSlot.innerHTML = ICONS.volume;
            isMuted = false;
        }
    }

    elements.volumeSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        window.AudioEngine.setVolume(val);
        updateVolumeDisplay(val);
    });

    elements.btnMute.addEventListener('click', () => {
        window.CyberSound.playClick();
        if (isMuted) {
            window.AudioEngine.setVolume(prevVolume);
            elements.volumeSlider.value = prevVolume;
            updateVolumeDisplay(prevVolume);
        } else {
            prevVolume = window.AudioEngine.getVolume() || 0.8;
            window.AudioEngine.setVolume(0);
            elements.volumeSlider.value = 0;
            updateVolumeDisplay(0);
        }
    });

    // Toggle Cover Mode (Omi Portrait vs Album Art)
    function cycleCoverMode() {
        window.CyberSound.playClick();
        coverMode = coverMode === 'omi' ? 'album' : 'omi';
        localStorage.setItem('edgerunners_cover_mode', coverMode);
        updateCoverArtDisplay();
        if (!track.coverArt && track.filePath && window.PlaylistManager.restoreTrackCover) {
            window.PlaylistManager.restoreTrackCover(track).then(() => {
                updateCoverArtDisplay();
            });
        }
    }

    elements.btnToggleCover.addEventListener('click', cycleCoverMode);
    elements.holoTurntable.addEventListener('click', cycleCoverMode);

    // UI Sound Mute Toggle
    elements.btnToggleSound.addEventListener('click', () => {
        const enabled = window.CyberSound.toggle();
        elements.btnToggleSound.textContent = enabled ? 'SFX: ON' : 'SFX: OFF';
        elements.btnToggleSound.classList.toggle('active', enabled);
    });

    // Visualizer Mode Pills
    elements.modePills.forEach(pill => {
        pill.addEventListener('click', () => {
            window.CyberSound.playClick();
            elements.modePills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            visualizer.setMode(pill.dataset.mode);
        });
    });

    // Equalizer Sliders
    elements.eqSliders.forEach(slider => {
        slider.addEventListener('input', (e) => {
            const bandIdx = parseInt(e.target.dataset.band, 10);
            const val = parseFloat(e.target.value);
            window.AudioEngine.setEQ(bandIdx, val);
        });
    });

    elements.presetSelect.addEventListener('change', (e) => {
        window.CyberSound.playClick();
        const gains = window.AudioEngine.setPreset(e.target.value);
        elements.eqSliders.forEach((slider, idx) => {
            slider.value = gains[idx] || 0;
        });
    });

    // =========================================================================
    // IMPORT FILES & FOLDERS
    // =========================================================================
    const isTauri = typeof window.__TAURI__ !== 'undefined';

    elements.btnImportFiles.addEventListener('click', async () => {
        window.CyberSound.playClick();
        if (isTauri) {
            try {
                const paths = await window.__TAURI__.dialog.open({
                    multiple: true,
                    filters: [{ name: 'Audio', extensions: ['mp3', 'mp4', 'flac', 'wav', 'ogg', 'm4a', 'aac'] }]
                });
                if (paths) {
                    const pathArray = Array.isArray(paths) ? paths : [paths];
                    const added = await window.PlaylistManager.addFilesFromPaths(pathArray);
                    window.CyberSound.playSuccess();
                    renderPlaylists();
                    renderTracks();
                    if (!window.PlaylistManager.currentTrackId && added.length > 0) {
                        playTrack(added[0]);
                    }
                }
            } catch (err) {
                console.error('Tauri file dialog error:', err);
            }
        } else {
            elements.fileInput.click();
        }
    });

    elements.btnImportFolder.addEventListener('click', async () => {
        window.CyberSound.playClick();
        if (isTauri) {
            try {
                const folder = await window.__TAURI__.dialog.open({
                    directory: true,
                    multiple: false
                });
                if (folder) {
                    const audioPaths = await window.__TAURI__.core.invoke('read_audio_files_in_dir', { dirPath: folder });
                    if (audioPaths && audioPaths.length > 0) {
                        const added = await window.PlaylistManager.addFilesFromPaths(audioPaths);
                        window.CyberSound.playSuccess();
                        renderPlaylists();
                        renderTracks();
                        if (!window.PlaylistManager.currentTrackId && added.length > 0) {
                            playTrack(added[0]);
                        }
                    }
                }
            } catch (err) {
                console.error('Tauri folder dialog error:', err);
            }
        } else {
            elements.folderInput.click();
        }
    });

    elements.fileInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files.length > 0) {
            await handleAddedFiles(e.target.files);
        }
    });

    elements.folderInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files.length > 0) {
            await handleAddedFiles(e.target.files);
        }
    });

    async function handleAddedFiles(fileList) {
        const added = await window.PlaylistManager.addFiles(fileList);
        window.CyberSound.playSuccess();
        renderPlaylists();
        renderTracks();
        if (!window.PlaylistManager.currentTrackId && added.length > 0) {
            playTrack(added[0]);
        }
    }



    async function loadSampleDemoTrack(type) {
        const sample = await window.CyberSampleGenerator.generateTrack(type);
        window.PlaylistManager.addCustomTrack(sample);
        renderPlaylists();
        renderTracks();
        playTrack(sample);
    }

    // =========================================================================
    // DRAG & DROP
    // =========================================================================
    window.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.dropZoneOverlay.classList.add('active');
    });

    window.addEventListener('dragleave', (e) => {
        if (e.clientX <= 0 || e.clientY <= 0) {
            elements.dropZoneOverlay.classList.remove('active');
        }
    });

    window.addEventListener('drop', async (e) => {
        e.preventDefault();
        elements.dropZoneOverlay.classList.remove('active');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            await handleAddedFiles(e.dataTransfer.files);
        }
    });

    // =========================================================================
    // PLAYLISTS MANAGEMENT
    // =========================================================================
    function renderPlaylists() {
        elements.playlistsContainer.innerHTML = '';
        const pls = window.PlaylistManager.playlists;

        Object.values(pls).forEach(pl => {
            const item = document.createElement('div');
            item.className = `playlist-item ${pl.id === window.PlaylistManager.activePlaylistId ? 'active' : ''}`;

            const nameSpan = document.createElement('span');
            nameSpan.textContent = pl.name;

            const rightWrap = document.createElement('div');
            rightWrap.style.display = 'flex';
            rightWrap.style.alignItems = 'center';

            const badge = document.createElement('span');
            badge.className = 'playlist-badge';
            badge.textContent = pl.trackIds.length;
            rightWrap.appendChild(badge);

            if (!pl.system) {
                const delBtn = document.createElement('button');
                delBtn.className = 'btn-del-playlist';
                delBtn.innerHTML = '&times;';
                delBtn.setAttribute('title', 'Delete playlist');
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`Delete playlist "${pl.name}"?`)) {
                        window.PlaylistManager.deletePlaylist(pl.id);
                        renderPlaylists();
                        renderTracks();
                    }
                });
                rightWrap.appendChild(delBtn);
            }

            item.appendChild(nameSpan);
            item.appendChild(rightWrap);

            item.addEventListener('click', () => {
                window.CyberSound.playClick();
                window.PlaylistManager.setActivePlaylist(pl.id);
                elements.activePlaylistTitle.textContent = pl.name;
                renderPlaylists();
                renderTracks();
            });

            elements.playlistsContainer.appendChild(item);
        });
    }

    elements.btnNewPlaylist.addEventListener('click', () => {
        window.CyberSound.playClick();
        elements.playlistNameInput.value = '';
        elements.playlistModal.classList.add('open');
        elements.playlistNameInput.focus();
    });

    elements.btnCancelPlaylist.addEventListener('click', () => {
        elements.playlistModal.classList.remove('open');
    });

    elements.btnConfirmPlaylist.addEventListener('click', () => {
        const val = elements.playlistNameInput.value;
        if (val) {
            window.CyberSound.playSuccess();
            const newId = window.PlaylistManager.createPlaylist(val);
            window.PlaylistManager.setActivePlaylist(newId);
            elements.playlistModal.classList.remove('open');
            renderPlaylists();
            renderTracks();
        }
    });

    // =========================================================================
    // NETRUNNER STREAM RIPPER MODAL & EXECUTION
    // =========================================================================
    function populateRipperPlaylists() {
        if (!elements.ripperTargetPlaylist) return;
        elements.ripperTargetPlaylist.innerHTML = '';
        Object.values(window.PlaylistManager.playlists).forEach(pl => {
            const opt = document.createElement('option');
            opt.value = pl.id;
            opt.textContent = pl.name;
            if (pl.id === window.PlaylistManager.activePlaylistId) opt.selected = true;
            elements.ripperTargetPlaylist.appendChild(opt);
        });
    }

    if (elements.btnOpenRipper) {
        elements.btnOpenRipper.addEventListener('click', () => {
            window.CyberSound.playClick();
            populateRipperPlaylists();
            elements.ripperUrlInput.value = '';
            elements.ripperProgressFill.style.width = '0%';
            elements.ripperModal.classList.add('open');
            elements.ripperUrlInput.focus();
        });
    }

    if (elements.btnCloseRipper) {
        elements.btnCloseRipper.addEventListener('click', () => {
            elements.ripperModal.classList.remove('open');
        });
    }

    // Connect Ripper logger & progress callbacks
    if (window.CyberRipperEngine) {
        window.CyberRipperEngine.onLogUpdate = (line, type) => {
            if (!elements.ripperConsoleLog) return;
            const logEl = document.createElement('div');
            logEl.className = `log-line ${type}`;
            logEl.textContent = line;
            elements.ripperConsoleLog.appendChild(logEl);
            elements.ripperConsoleLog.scrollTop = elements.ripperConsoleLog.scrollHeight;
        };

        window.CyberRipperEngine.onProgressUpdate = (percent) => {
            if (elements.ripperProgressFill) {
                elements.ripperProgressFill.style.width = `${percent}%`;
            }
        };
    }

    if (elements.btnExecuteRip) {
        elements.btnExecuteRip.addEventListener('click', async () => {
            const url = elements.ripperUrlInput.value.trim();
            if (!url) {
                alert('Please paste a valid Spotify, YouTube, or audio stream link.');
                return;
            }

            window.CyberSound.playSandevistan();
            elements.btnExecuteRip.disabled = true;
            elements.btnExecuteRip.textContent = 'RIPPING STREAM...';
            if (elements.ripperStatusDot) elements.ripperStatusDot.style.background = 'var(--omi-pink)';

            try {
                const quality = elements.ripperQuality.value;
                const rippedTrack = await window.CyberRipperEngine.ripStream(url, quality);

                // Add to selected playlist
                const targetPlId = elements.ripperTargetPlaylist.value || 'all';
                if (isTauri && rippedTrack.filePath) {
                    // Native rip: use addFilesFromPaths so the track is persisted properly
                    const added = await window.PlaylistManager.addFilesFromPaths([rippedTrack.filePath]);
                    const persistedTrack = added[0] || rippedTrack;
                    if (targetPlId !== 'all') {
                        window.PlaylistManager.addTrackToPlaylist(targetPlId, persistedTrack.id);
                    }
                    window.CyberSound.playSuccess();
                    renderPlaylists();
                    renderTracks();
                    playTrack(persistedTrack);
                } else {
                    window.PlaylistManager.addCustomTrack(rippedTrack);
                    if (targetPlId !== 'all') {
                        window.PlaylistManager.addTrackToPlaylist(targetPlId, rippedTrack.id);
                    }
                    window.CyberSound.playSuccess();
                    renderPlaylists();
                    renderTracks();
                    playTrack(rippedTrack);
                }

                if (elements.ripperStatusDot) elements.ripperStatusDot.style.background = 'var(--omi-green)';
                setTimeout(() => {
                    elements.ripperModal.classList.remove('open');
                }, 1200);

            } catch (err) {
                window.CyberSound.playBuzzer();
                if (elements.ripperConsoleLog) {
                    const errEl = document.createElement('div');
                    errEl.className = 'log-line error';
                    errEl.textContent = `> RIP PROTOCOL FAILED: ${err.message || err}`;
                    elements.ripperConsoleLog.appendChild(errEl);
                }
            } finally {
                elements.btnExecuteRip.disabled = false;
                elements.btnExecuteRip.textContent = 'EXECUTE RIP';
            }
        });
    }

    // =========================================================================
    // TRACK LIST RENDERING & SEARCH/SORT
    // =========================================================================
    function renderTracks() {
        const activeTracks = window.PlaylistManager.getActiveTracks();
        elements.trackScrollList.innerHTML = '';
        elements.trackCountBadge.textContent = `${activeTracks.length} TRACKS`;

        if (activeTracks.length === 0) {
            const emptyNotice = document.createElement('div');
            emptyNotice.style.padding = '35px 15px';
            emptyNotice.style.textAlign = 'center';
            emptyNotice.style.color = 'var(--cyber-text-dim)';
            emptyNotice.style.fontFamily = "'Share Tech Mono', monospace";
            emptyNotice.innerHTML = `
                <div style="font-size: 13px; color: var(--omi-green); letter-spacing: 1px; margin-bottom: 6px;">[EMPTY AUDIO DIRECTORY]</div>
                <div style="font-size: 11px;">Drag & drop MP3 files here or click + ADD MP3 FILES</div>
            `;
            elements.trackScrollList.appendChild(emptyNotice);
            return;
        }

        activeTracks.forEach((track, index) => {
            const isCurrent = track.id === window.PlaylistManager.currentTrackId;
            const isFav = window.PlaylistManager.isFavorite(track.id);

            const row = document.createElement('div');
            row.className = `track-row ${isCurrent ? 'active' : ''}`;

            // Track index or indicator
            const numEl = document.createElement('div');
            numEl.className = 'track-row-num';
            numEl.textContent = isCurrent ? '>' : index + 1;

            // Details
            const detailsEl = document.createElement('div');
            detailsEl.className = 'track-row-details';

            const titleEl = document.createElement('div');
            titleEl.className = 'track-row-title';
            titleEl.textContent = track.title;

            const subEl = document.createElement('div');
            subEl.className = 'track-row-sub';
            subEl.textContent = `${track.artist} • ${track.album}`;

            detailsEl.appendChild(titleEl);
            detailsEl.appendChild(subEl);

            // Duration
            const durEl = document.createElement('div');
            durEl.className = 'track-row-duration';
            durEl.textContent = formatTime(track.duration);

            // Favorite Button (Pure SVG, no emojis)
            const favBtn = document.createElement('button');
            favBtn.className = `btn-track-action ${isFav ? 'favorited' : ''}`;
            favBtn.innerHTML = `${isFav ? ICONS.favFilled : ICONS.favOutline} <span>FAV</span>`;
            favBtn.setAttribute('title', isFav ? 'Remove from Favorites' : 'Add to Favorites');
            favBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.CyberSound.playClick();
                window.PlaylistManager.toggleFavorite(track.id);
                renderTracks();
                renderPlaylists();
            });

            // Add to Playlist Button
            const addPlBtn = document.createElement('button');
            addPlBtn.className = 'btn-track-action';
            addPlBtn.innerHTML = `<span>+</span> <span>PL</span>`;
            addPlBtn.setAttribute('title', 'Add to Playlist');
            addPlBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                promptAddToPlaylist(track);
            });

            row.appendChild(numEl);
            row.appendChild(detailsEl);
            row.appendChild(durEl);
            row.appendChild(favBtn);
            row.appendChild(addPlBtn);

            row.addEventListener('click', () => {
                playTrack(track);
            });

            elements.trackScrollList.appendChild(row);
        });
    }

    function promptAddToPlaylist(track) {
        const customPlaylists = Object.values(window.PlaylistManager.playlists)
            .filter(p => !p.system);

        if (customPlaylists.length === 0) {
            alert("No custom playlists found. Click '+ NEW' in the left panel to create one.");
            return;
        }

        const names = customPlaylists.map((p, idx) => `${idx + 1}. ${p.name}`).join('\n');
        const choice = prompt(`Select playlist number for "${track.title}":\n\n${names}`);
        const chosenIdx = parseInt(choice, 10) - 1;

        if (!isNaN(chosenIdx) && customPlaylists[chosenIdx]) {
            const targetPl = customPlaylists[chosenIdx];
            window.PlaylistManager.addTrackToPlaylist(targetPl.id, track.id);
            window.CyberSound.playSuccess();
            renderPlaylists();
        }
    }

    // Search & Sort Event Listeners
    elements.searchInput.addEventListener('input', (e) => {
        window.PlaylistManager.setSearchQuery(e.target.value);
        renderTracks();
    });

    elements.sortSelect.addEventListener('change', (e) => {
        window.CyberSound.playClick();
        window.PlaylistManager.setSortBy(e.target.value);
        renderTracks();
    });

    // =========================================================================
    // KEYBOARD SHORTCUTS & MEDIA KEYS
    // =========================================================================
    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;

        switch (e.code) {
            case 'Space':
                e.preventDefault();
                elements.btnPlayMaster.click();
                break;
            case 'ArrowRight':
                e.preventDefault();
                window.AudioEngine.seek(window.AudioEngine.audio.currentTime + 5);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                window.AudioEngine.seek(Math.max(0, window.AudioEngine.audio.currentTime - 5));
                break;
            case 'ArrowUp':
                e.preventDefault();
                const newVolUp = Math.min(1, window.AudioEngine.getVolume() + 0.05);
                window.AudioEngine.setVolume(newVolUp);
                elements.volumeSlider.value = newVolUp;
                updateVolumeDisplay(newVolUp);
                break;
            case 'ArrowDown':
                e.preventDefault();
                const newVolDown = Math.max(0, window.AudioEngine.getVolume() - 0.05);
                window.AudioEngine.setVolume(newVolDown);
                elements.volumeSlider.value = newVolDown;
                updateVolumeDisplay(newVolDown);
                break;
            case 'KeyN':
                playNextTrack();
                break;
            case 'KeyP':
                playPrevTrack();
                break;
            case 'KeyS':
            case 'KeyC':
                cycleCoverMode();
                break;
            case 'KeyM':
                elements.btnMute.click();
                break;
        }
    });

    // Native MediaSession Action Handlers
    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', () => window.AudioEngine.play());
        navigator.mediaSession.setActionHandler('pause', () => window.AudioEngine.pause());
        navigator.mediaSession.setActionHandler('previoustrack', () => playPrevTrack());
        navigator.mediaSession.setActionHandler('nexttrack', () => playNextTrack());
    }

    function formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    // Initial Render
    updateCoverArtDisplay();
    renderPlaylists();
    renderTracks();
});
