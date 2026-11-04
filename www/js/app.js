/**
 * SNDeck audio player
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
        themeSelect: document.getElementById('themeSelect'),
        btnCreateTheme: document.getElementById('btnCreateTheme'),
        btnDeleteTheme: document.getElementById('btnDeleteTheme'),
        themeDialog: document.getElementById('themeDialog'),
        btnCloseThemeDialog: document.getElementById('btnCloseThemeDialog'),
        customThemeForm: document.getElementById('customThemeForm'),
        customThemeName: document.getElementById('customThemeName'),
        customThemePrimary: document.getElementById('customThemePrimary'),
        customThemeSecondary: document.getElementById('customThemeSecondary'),
        customThemeAccent: document.getElementById('customThemeAccent'),
        customThemeHighlight: document.getElementById('customThemeHighlight'),
        btnPortraitSettings: document.getElementById('btnPortraitSettings'),
        portraitDialog: document.getElementById('portraitDialog'),
        portraitThemeName: document.getElementById('portraitThemeName'),
        btnClosePortraitDialog: document.getElementById('btnClosePortraitDialog'),
        btnChoosePortrait: document.getElementById('btnChoosePortrait'),
        btnResetPortrait: document.getElementById('btnResetPortrait'),
        portraitFileInput: document.getElementById('portraitFileInput'),
        headerClanStatus: document.getElementById('headerClanStatus'),
        headerCoverStatus: document.getElementById('headerCoverStatus'),
        btnToggleRetro: document.getElementById('btnToggleRetro'),
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
        playlistPickerModal: document.getElementById('playlistPickerModal'),
        playlistPickerTitle: document.getElementById('playlistPickerTitle'),
        playlistPickerHint: document.getElementById('playlistPickerHint'),
        playlistPickerList: document.getElementById('playlistPickerList'),
        btnCancelPlaylistPicker: document.getElementById('btnCancelPlaylistPicker'),

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
        bulkSelectionBar: document.getElementById('bulkSelectionBar'),
        selectedTrackCount: document.getElementById('selectedTrackCount'),
        btnMoveSelected: document.getElementById('btnMoveSelected'),
        btnRemoveSelected: document.getElementById('btnRemoveSelected'),
        btnDeleteSelected: document.getElementById('btnDeleteSelected'),
        btnClearSelection: document.getElementById('btnClearSelection'),

        // EQ
        presetSelect: document.getElementById('presetSelect'),
        eqSliders: document.querySelectorAll('.eq-slider'),

        // Mode Pills
        modePills: document.querySelectorAll('.btn-mode-pill')
    };

    let isSeeking = false;
    let seekPointerId = null;
    let isMuted = false;
    const spinBoostSources = new Set();
    let spinBoostStartedAt = 0;
    let spinBoostFrame = null;
    let pKeyDownAt = null;
    let recordPointerDownAt = null;
    let suppressTurntableClick = false;
    const savedVolume = localStorage.getItem('sndeck_volume');
    const parsedVolume = savedVolume === null ? 0.8 : parseFloat(savedVolume);
    const initialVolume = Number.isFinite(parsedVolume) ? Math.max(0, Math.min(1, parsedVolume)) : 0.8;
    const savedPrevVolume = parseFloat(localStorage.getItem('sndeck_prev_volume'));
    let prevVolume = Number.isFinite(savedPrevVolume) && savedPrevVolume > 0
        ? Math.min(1, savedPrevVolume)
        : (initialVolume > 0 ? initialVolume : 0.8);
    const defaultPortrait = 'assets/cyber_vinyl.svg';
    const themes = {
        omi: { label: 'SN', portrait: defaultPortrait, clan: 'SNAKE NATION', clanColor: '--omi-purple' },
        snd: { label: 'ER', portrait: defaultPortrait, clan: 'SNAKE NATION', clanColor: '--omi-blue' },
        basic: { label: 'BASIC', portrait: defaultPortrait, clan: 'BASIC', clanColor: '--omi-green' },
        blossom: { label: 'BLOSSOM', portrait: defaultPortrait, clan: 'BLOSSOM', clanColor: '--omi-pink' }
    };
    const customThemes = [];
    const customThemeColorKeys = ['green', 'blue', 'pink', 'purple'];
    const validThemeColor = value => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
    const rgbFromHex = hex => {
        const value = hex.slice(1);
        return `${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)}`;
    };
    try {
        const savedThemes = JSON.parse(localStorage.getItem('sndeck_custom_themes') || '[]');
        if (Array.isArray(savedThemes)) {
            savedThemes.slice(0, 16).forEach((theme, index) => {
                if (!theme || typeof theme.id !== 'string' || !theme.id.startsWith('custom-') ||
                    typeof theme.label !== 'string' || !theme.label.trim() || theme.label.length > 24 ||
                    !customThemeColorKeys.every(key => validThemeColor(theme.colors && theme.colors[key]))) return;
                theme.label = theme.label.trim();
                themes[theme.id] = {
                    label: theme.label.toUpperCase(), clan: theme.label.toUpperCase(), clanColor: '--omi-green',
                    portrait: defaultPortrait, custom: true, colors: theme.colors
                };
                customThemes.push({ id: theme.id, label: theme.label, colors: theme.colors });
                const option = document.createElement('option');
                option.value = theme.id;
                option.textContent = theme.label.toUpperCase();
                elements.themeSelect.appendChild(option);
            });
        }
    } catch (error) {
        localStorage.removeItem('sndeck_custom_themes');
    }
    function applyCustomThemeColors(theme) {
        const properties = ['--omi-green', '--omi-blue', '--omi-pink', '--omi-purple', '--omi-yellow',
            '--omi-green-rgb', '--omi-blue-rgb', '--omi-pink-rgb', '--omi-purple-rgb', '--omi-yellow-rgb',
            '--omi-green-glow', '--omi-blue-glow', '--omi-pink-glow', '--omi-purple-glow', '--cyber-panel-border'];
        properties.forEach(property => document.body.style.removeProperty(property));
        if (!theme || !theme.custom) return;
        const colors = theme.colors;
        for (const key of customThemeColorKeys) {
            document.body.style.setProperty(`--omi-${key}`, colors[key]);
            document.body.style.setProperty(`--omi-${key}-rgb`, rgbFromHex(colors[key]));
            document.body.style.setProperty(`--omi-${key}-glow`, `0 0 14px rgba(${rgbFromHex(colors[key])}, .4)`);
        }
        document.body.style.setProperty('--omi-yellow', colors.pink);
        document.body.style.setProperty('--omi-yellow-rgb', rgbFromHex(colors.pink));
        document.body.style.setProperty('--cyber-panel-border', `rgba(${rgbFromHex(colors.pink)}, .3)`);
    }
    function saveCustomThemes() {
        localStorage.setItem('sndeck_custom_themes', JSON.stringify(customThemes));
    }
    let customPortraits = {};
    try {
        const savedPortraits = JSON.parse(localStorage.getItem('sndeck_custom_portraits') || '{}');
        for (const themeKey of Object.keys(themes)) {
            if (typeof savedPortraits[themeKey] === 'string' && savedPortraits[themeKey].startsWith('data:image/')) {
                customPortraits[themeKey] = savedPortraits[themeKey];
            }
        }
    } catch (error) {
        localStorage.removeItem('sndeck_custom_portraits');
    }
    function saveCustomPortraits() {
        localStorage.setItem('sndeck_custom_portraits', JSON.stringify(customPortraits));
    }
    let activeTheme = localStorage.getItem('sndeck_theme') || 'omi';
    if (!themes[activeTheme]) activeTheme = 'omi';
    let coverMode = localStorage.getItem('sndeck_disc_view') || localStorage.getItem('edgerunners_cover_mode') || 'portrait';
    if (coverMode === 'omi') coverMode = 'portrait';
    if (coverMode !== 'album') coverMode = 'portrait';
    elements.themeSelect.value = activeTheme;
    document.body.dataset.theme = activeTheme;
    applyCustomThemeColors(themes[activeTheme]);
    visualizer.setTheme();
    elements.headerClanStatus.textContent = themes[activeTheme].clan;
    elements.headerClanStatus.style.color = `var(${themes[activeTheme].clanColor})`;
    const retroEnabled = localStorage.getItem('sndeck_retro_effect') !== 'off';
    document.getElementById('scanlines').classList.toggle('disabled', !retroEnabled);
    elements.btnToggleRetro.textContent = `RETRO: ${retroEnabled ? 'ON' : 'OFF'}`;
    elements.btnToggleRetro.setAttribute('aria-pressed', String(retroEnabled));
    const initialThemeColor = document.querySelector('meta[name="theme-color"]');
    if (initialThemeColor) initialThemeColor.content = getComputedStyle(document.body).getPropertyValue('--cyber-dark-bg').trim();
    elements.btnDeleteTheme.hidden = !themes[activeTheme].custom;

    function updateCoverArtDisplay() {
        const track = window.PlaylistManager.getCurrentTrack();
        elements.btnToggleCover.title = `Switch between ${themes[activeTheme].label} portrait and album cover`;
        if (coverMode === 'portrait') {
            elements.holoCoverArt.src = customPortraits[activeTheme] || themes[activeTheme].portrait;
            elements.btnToggleCover.textContent = `DISC: ${themes[activeTheme].label}`;
            if (elements.headerCoverStatus) {
                elements.headerCoverStatus.textContent = `${themes[activeTheme].label} PORTRAIT`;
                elements.headerCoverStatus.style.color = 'var(--omi-pink)';
            }
        } else {
            if (track && track.coverArt) {
                elements.holoCoverArt.src = track.coverArt;
            } else {
                elements.holoCoverArt.src = 'assets/cyber_vinyl.svg';
            }
            elements.btnToggleCover.textContent = 'DISC: ALBUM';
            if (elements.headerCoverStatus) {
                elements.headerCoverStatus.textContent = 'ALBUM COVER';
                elements.headerCoverStatus.style.color = 'var(--omi-green)';
            }
        }
    }

    elements.holoCoverArt.addEventListener('error', () => {
        if (elements.holoCoverArt.src.startsWith('data:image/')) {
            delete customPortraits[activeTheme];
            try { saveCustomPortraits(); } catch (error) { /* Keep the generic fallback available. */ }
        }
        if (!elements.holoCoverArt.src.endsWith('/assets/cyber_vinyl.svg')) {
            elements.holoCoverArt.src = defaultPortrait;
        }
    });

    window.onCoverRestored = (restoredTrack) => {
        const current = window.PlaylistManager.getCurrentTrack();
        if (current && current.id === restoredTrack.id) {
            updateCoverArtDisplay();
        }
        // Also update the track list row thumbnail if visible
        const row = document.querySelector(`.track-row[data-id="${restoredTrack.id}"] .track-thumb`);
        if (row && restoredTrack.coverArt) {
            row.src = restoredTrack.coverArt;
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

    function updateSeekDisplay(currentTime, duration) {
        const percent = duration > 0 ? Math.max(0, Math.min(100, (currentTime / duration) * 100)) : 0;
        elements.seekBarProgress.style.width = `${percent}%`;
        elements.seekBarWrapper.setAttribute('aria-valuenow', String(Math.round(percent)));
        elements.seekBarWrapper.setAttribute('aria-valuetext', `${formatTime(currentTime)} of ${formatTime(duration)}`);
        elements.currentTimeDisplay.textContent = formatTime(currentTime);
    }

    function setTurntableSpinRate(rate) {
        const spinAnimation = elements.holoTurntable.getAnimations()
            .find(animation => animation.animationName === 'rotate-turntable');
        if (spinAnimation) spinAnimation.playbackRate = rate;
    }

    function animateSpinBoost(now) {
        if (spinBoostSources.size === 0) return;
        const ramp = Math.min(1, (now - spinBoostStartedAt) / 2000);
        setTurntableSpinRate(1 + ramp);
        if (ramp < 1) spinBoostFrame = requestAnimationFrame(animateSpinBoost);
    }

    function startSpinBoost(source) {
        if (spinBoostSources.has(source)) return;
        const wasIdle = spinBoostSources.size === 0;
        spinBoostSources.add(source);
        if (wasIdle) {
            spinBoostStartedAt = performance.now();
            elements.holoTurntable.classList.add('spinning');
            spinBoostFrame = requestAnimationFrame(animateSpinBoost);
        }
    }

    function stopSpinBoost(source) {
        spinBoostSources.delete(source);
        if (spinBoostSources.size > 0) return;
        if (spinBoostFrame !== null) cancelAnimationFrame(spinBoostFrame);
        spinBoostFrame = null;
        setTurntableSpinRate(1);
        if (window.AudioEngine.audio.paused) elements.holoTurntable.classList.remove('spinning');
    }

    // =========================================================================
    // AUDIO ENGINE CALLBACKS
    // =========================================================================
    window.AudioEngine.onTimeUpdate = (currentTime, duration) => {
        if (!isSeeking) {
            updateSeekDisplay(currentTime, duration);
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
        } else {
            elements.playMasterIcon.innerHTML = ICONS.play;
            elements.btnPlayMaster.setAttribute('title', 'Play (Space)');
        }
        elements.holoTurntable.classList.toggle('spinning', isPlaying || spinBoostSources.size > 0);
    }

    async function playTrack(track) {
        if (!track) return;
        window.CyberSound.playClick();
        window.PlaylistManager.setCurrentTrack(track.id);

        // Update Now Playing UI
        elements.trackLiveTitle.textContent = track.title || 'Unknown Track';
        elements.trackLiveArtist.textContent = track.artist || 'Unknown Artist';
        elements.trackLiveAlbum.textContent = `${track.album || 'SNDeck'} • ${track.year || new Date().getFullYear()}`;

        updateCoverArtDisplay();
        if (track && !track.coverArt && track.filePath && window.PlaylistManager.restoreTrackCover) {
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
                artwork: track.coverArt ? [{ src: track.coverArt, sizes: '512x512', type: 'image/jpeg' }] : [{ src: defaultPortrait, sizes: '512x512', type: 'image/svg+xml' }]
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

    // Seek bar: click, drag, touch, or keyboard.
    function seekFromClientX(clientX) {
        const rect = elements.seekBarWrapper.getBoundingClientRect();
        const duration = window.AudioEngine.audio.duration;
        if (!Number.isFinite(duration) || duration <= 0 || rect.width <= 0) return false;
        const position = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const targetTime = position * duration;
        window.AudioEngine.seek(targetTime);
        updateSeekDisplay(targetTime, duration);
        return true;
    }

    elements.seekBarWrapper.addEventListener('pointerdown', event => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        if (!seekFromClientX(event.clientX)) return;
        event.preventDefault();
        isSeeking = true;
        seekPointerId = event.pointerId;
        elements.seekBarWrapper.classList.add('seeking');
        elements.seekBarWrapper.setPointerCapture(event.pointerId);
    });
    elements.seekBarWrapper.addEventListener('pointermove', event => {
        if (isSeeking && event.pointerId === seekPointerId) seekFromClientX(event.clientX);
    });
    const finishSeeking = event => {
        if (!isSeeking || event.pointerId !== seekPointerId) return;
        seekFromClientX(event.clientX);
        isSeeking = false;
        seekPointerId = null;
        elements.seekBarWrapper.classList.remove('seeking');
        if (elements.seekBarWrapper.hasPointerCapture(event.pointerId)) {
            elements.seekBarWrapper.releasePointerCapture(event.pointerId);
        }
    };
    elements.seekBarWrapper.addEventListener('pointerup', finishSeeking);
    elements.seekBarWrapper.addEventListener('pointercancel', finishSeeking);
    elements.seekBarWrapper.addEventListener('keydown', event => {
        const duration = window.AudioEngine.audio.duration;
        if (!Number.isFinite(duration) || duration <= 0) return;
        const currentTime = window.AudioEngine.audio.currentTime || 0;
        let nextTime = null;
        if (event.key === 'ArrowRight') nextTime = currentTime + 5;
        if (event.key === 'ArrowLeft') nextTime = currentTime - 5;
        if (event.key === 'Home') nextTime = 0;
        if (event.key === 'End') nextTime = duration;
        if (nextTime === null) return;
        event.preventDefault();
        event.stopPropagation();
        nextTime = Math.max(0, Math.min(duration, nextTime));
        window.AudioEngine.seek(nextTime);
        updateSeekDisplay(nextTime, duration);
    });

    // Volume
    function saveVolume(val) {
        localStorage.setItem('sndeck_volume', String(val));
        if (val > 0) {
            prevVolume = val;
            localStorage.setItem('sndeck_prev_volume', String(val));
        }
    }

    function updateVolumeDisplay(val) {
        elements.volPercent.value = String(Math.round(val * 100));
        elements.volumeSlider.style.setProperty('--volume-level', `${Math.round(val * 100)}%`);
        if (val === 0) {
            elements.muteIconSlot.innerHTML = ICONS.mute;
            isMuted = true;
        } else {
            elements.muteIconSlot.innerHTML = ICONS.volume;
            isMuted = false;
        }
    }

    window.AudioEngine.setVolume(initialVolume);
    elements.volumeSlider.value = initialVolume;
    updateVolumeDisplay(initialVolume);

    elements.volumeSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        window.AudioEngine.setVolume(val);
        saveVolume(val);
        updateVolumeDisplay(val);
    });

    function commitVolumePercent() {
        if (elements.volPercent.value.trim() === '') {
            updateVolumeDisplay(window.AudioEngine.getVolume());
            return;
        }
        const percent = Number(elements.volPercent.value);
        if (!Number.isFinite(percent)) {
            updateVolumeDisplay(window.AudioEngine.getVolume());
            return;
        }
        const val = Math.max(0, Math.min(100, percent)) / 100;
        window.AudioEngine.setVolume(val);
        elements.volumeSlider.value = val;
        saveVolume(val);
        updateVolumeDisplay(val);
    }

    elements.volPercent.addEventListener('change', commitVolumePercent);
    elements.volPercent.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commitVolumePercent();
            elements.volPercent.blur();
        }
    });

    elements.btnMute.addEventListener('click', () => {
        window.CyberSound.playClick();
        if (isMuted) {
            window.AudioEngine.setVolume(prevVolume);
            elements.volumeSlider.value = prevVolume;
            saveVolume(prevVolume);
            updateVolumeDisplay(prevVolume);
        } else {
            prevVolume = window.AudioEngine.getVolume() || 0.8;
            window.AudioEngine.setVolume(0);
            elements.volumeSlider.value = 0;
            saveVolume(0);
            updateVolumeDisplay(0);
        }
    });

    function cycleCoverMode() {
        window.CyberSound.playClick();
        coverMode = coverMode === 'portrait' ? 'album' : 'portrait';
        localStorage.setItem('sndeck_disc_view', coverMode);
        updateCoverArtDisplay();
        const track = window.PlaylistManager.getCurrentTrack();
        if (track && !track.coverArt && track.filePath && window.PlaylistManager.restoreTrackCover) {
            window.PlaylistManager.restoreTrackCover(track).then(() => {
                updateCoverArtDisplay();
            });
        }
    }

    elements.btnToggleCover.addEventListener('click', cycleCoverMode);
    elements.holoTurntable.addEventListener('pointerdown', event => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        recordPointerDownAt = performance.now();
        startSpinBoost('record-pointer');
        elements.holoTurntable.setPointerCapture(event.pointerId);
    });
    const stopRecordPointerBoost = event => {
        if (recordPointerDownAt === null) return;
        const heldFor = performance.now() - recordPointerDownAt;
        recordPointerDownAt = null;
        stopSpinBoost('record-pointer');
        if (event.type === 'pointerup' && heldFor >= 250) suppressTurntableClick = true;
    };
    elements.holoTurntable.addEventListener('pointerup', stopRecordPointerBoost);
    elements.holoTurntable.addEventListener('pointercancel', stopRecordPointerBoost);
    elements.holoTurntable.addEventListener('click', event => {
        if (suppressTurntableClick) {
            suppressTurntableClick = false;
            event.preventDefault();
            return;
        }
        cycleCoverMode();
    });
    window.addEventListener('blur', () => {
        stopSpinBoost('record-pointer');
        recordPointerDownAt = null;
        if (pKeyDownAt !== null) {
            stopSpinBoost('keyboard-p');
            pKeyDownAt = null;
        }
    });
    elements.btnCreateTheme.addEventListener('click', () => {
        elements.customThemeForm.reset();
        elements.customThemeName.value = '';
        elements.themeDialog.showModal();
        elements.customThemeName.focus();
    });
    elements.btnCloseThemeDialog.addEventListener('click', () => elements.themeDialog.close());
    elements.customThemeForm.addEventListener('submit', event => {
        event.preventDefault();
        const label = elements.customThemeName.value.trim();
        if (!label) return;
        if (customThemes.some(theme => theme.label.toLowerCase() === label.toLowerCase())) {
            alert('A theme with this name already exists.');
            return;
        }
        if (customThemes.length >= 16) {
            alert('You can save up to 16 custom themes.');
            return;
        }
        const customTheme = {
            id: `custom-${Date.now().toString(36)}`,
            label,
            colors: {
                green: elements.customThemePrimary.value,
                blue: elements.customThemeSecondary.value,
                pink: elements.customThemeAccent.value,
                purple: elements.customThemeHighlight.value
            }
        };
        customThemes.push(customTheme);
        try {
            saveCustomThemes();
        } catch (error) {
            customThemes.pop();
            alert('There is not enough browser storage to save another theme.');
            return;
        }
        themes[customTheme.id] = {
            label: label.toUpperCase(), clan: label.toUpperCase(), clanColor: '--omi-green',
            portrait: defaultPortrait, custom: true, colors: customTheme.colors
        };
        const option = document.createElement('option');
        option.value = customTheme.id;
        option.textContent = label.toUpperCase();
        elements.themeSelect.appendChild(option);
        elements.themeDialog.close();
        elements.themeSelect.value = customTheme.id;
        elements.themeSelect.dispatchEvent(new Event('change'));
    });
    elements.btnDeleteTheme.addEventListener('click', () => {
        const theme = themes[activeTheme];
        if (!theme || !theme.custom) return;
        if (!confirm(`Delete the custom theme “${theme.label}”?`)) return;
        const oldThemes = [...customThemes];
        const oldPortraits = { ...customPortraits };
        const deletedKey = activeTheme;
        const deletedIndex = customThemes.findIndex(item => item.id === deletedKey);
        if (deletedIndex >= 0) customThemes.splice(deletedIndex, 1);
        delete customPortraits[deletedKey];
        try {
            saveCustomThemes();
            saveCustomPortraits();
        } catch (error) {
            customThemes.splice(0, customThemes.length, ...oldThemes);
            customPortraits = oldPortraits;
            alert('Could not delete the theme because browser storage is unavailable.');
            return;
        }
        elements.themeSelect.querySelector(`option[value="${deletedKey}"]`)?.remove();
        delete themes[deletedKey];
        elements.themeSelect.value = 'omi';
        elements.themeSelect.dispatchEvent(new Event('change'));
    });
    elements.btnPortraitSettings.addEventListener('click', () => {
        elements.portraitThemeName.textContent = themes[activeTheme].label;
        elements.portraitDialog.showModal();
    });
    elements.btnClosePortraitDialog.addEventListener('click', () => elements.portraitDialog.close());
    elements.btnChoosePortrait.addEventListener('click', () => elements.portraitFileInput.click());
    elements.btnResetPortrait.addEventListener('click', () => {
        delete customPortraits[activeTheme];
        saveCustomPortraits();
        updateCoverArtDisplay();
        elements.portraitDialog.close();
    });
    elements.portraitFileInput.addEventListener('change', async (event) => {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert('Choose an image file.');
            event.target.value = '';
            return;
        }
        if (file.size > 20 * 1024 * 1024) {
            alert('Choose an image smaller than 20 MB.');
            event.target.value = '';
            return;
        }
        let bitmap;
        try {
            bitmap = await createImageBitmap(file);
            const maxSize = 640;
            const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(bitmap.width * scale));
            canvas.height = Math.max(1, Math.round(bitmap.height * scale));
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Image conversion is unavailable.');
            context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            const previousPortraits = { ...customPortraits };
            customPortraits[activeTheme] = canvas.toDataURL('image/webp', 0.86);
            try {
                saveCustomPortraits();
            } catch (storageError) {
                customPortraits = previousPortraits;
                throw new Error('There is not enough browser storage for this portrait.');
            }
            updateCoverArtDisplay();
            elements.portraitDialog.close();
        } catch (error) {
            alert(error.message || 'Could not load this image.');
        } finally {
            if (bitmap) bitmap.close();
            event.target.value = '';
        }
    });
    elements.themeSelect.addEventListener('change', (e) => {
        activeTheme = e.target.value;
        localStorage.setItem('sndeck_theme', activeTheme);
        document.body.dataset.theme = activeTheme;
        applyCustomThemeColors(themes[activeTheme]);
        visualizer.setTheme();
        elements.headerClanStatus.textContent = themes[activeTheme].clan;
        elements.headerClanStatus.style.color = `var(${themes[activeTheme].clanColor})`;
        elements.btnDeleteTheme.hidden = !themes[activeTheme].custom;
        const themeColor = document.querySelector('meta[name="theme-color"]');
        if (themeColor) themeColor.content = getComputedStyle(document.body).getPropertyValue('--cyber-dark-bg').trim();
        updateCoverArtDisplay();
    });
    elements.btnToggleRetro.addEventListener('click', () => {
        const enabled = elements.btnToggleRetro.getAttribute('aria-pressed') !== 'true';
        document.getElementById('scanlines').classList.toggle('disabled', !enabled);
        elements.btnToggleRetro.textContent = `RETRO: ${enabled ? 'ON' : 'OFF'}`;
        elements.btnToggleRetro.setAttribute('aria-pressed', String(enabled));
        localStorage.setItem('sndeck_retro_effect', enabled ? 'on' : 'off');
    });

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





    // =========================================================================
    // DRAG & DROP
    // =========================================================================
    window.addEventListener('dragover', (e) => {
        const types = Array.from(e.dataTransfer?.types || []);
        const internalDrag = types.includes('application/x-sndeck-track') || types.includes('application/x-sndeck-playlist');
        if (internalDrag) {
            e.preventDefault();
            return;
        }
        if (types.includes('Files')) {
            e.preventDefault();
            elements.dropZoneOverlay.classList.add('active');
        }
    });

    window.addEventListener('dragleave', (e) => {
        if (e.clientX <= 0 || e.clientY <= 0) {
            elements.dropZoneOverlay.classList.remove('active');
        }
    });

    window.addEventListener('drop', async (e) => {
        const types = Array.from(e.dataTransfer?.types || []);
        if (types.includes('application/x-sndeck-track') || types.includes('application/x-sndeck-playlist')) {
            e.preventDefault();
            return;
        }
        e.preventDefault();
        elements.dropZoneOverlay.classList.remove('active');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            await handleAddedFiles(e.dataTransfer.files);
        }
    });

    // =========================================================================
    // PLAYLISTS MANAGEMENT
    // =========================================================================
    let draggedPlaylistId = null;
    let draggedTrackId = null;
    let draggedTrackIds = [];
    let draggedTrackSourcePlaylistId = null;
    const selectedTrackIds = new Set();

    function renderPlaylists() {
        elements.playlistsContainer.innerHTML = '';
        const pls = window.PlaylistManager.playlists;
        const allPlaylists = Object.values(pls);
        const favoriteDirectories = allPlaylists.filter(pl => !pl.system && pl.favorite);
        const systemDirectories = ['recent', 'favorites', 'all'].map(id => pls[id]).filter(Boolean);
        const otherDirectories = allPlaylists.filter(pl => !pl.system && !pl.favorite);

        [...favoriteDirectories, ...systemDirectories, ...otherDirectories].forEach(pl => {
            const item = document.createElement('div');
            item.className = `playlist-item ${pl.id === window.PlaylistManager.activePlaylistId ? 'active' : ''}`;
            if (!pl.system) {
                item.draggable = true;
                item.addEventListener('dragstart', (e) => {
                    draggedPlaylistId = pl.id;
                    draggedTrackId = null;
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('application/x-sndeck-playlist', pl.id);
                    e.dataTransfer.setData('text/plain', `playlist:${pl.id}`);
                    item.classList.add('dragging');
                });
                item.addEventListener('dragend', () => {
                    draggedPlaylistId = null;
                    item.classList.remove('dragging');
                    document.querySelectorAll('.playlist-item.drag-target').forEach(el => el.classList.remove('drag-target'));
                });
                item.addEventListener('dragover', (e) => {
                    if ((draggedPlaylistId && draggedPlaylistId !== pl.id) || draggedTrackId) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        item.classList.add('drag-target');
                    }
                });
                item.addEventListener('dragleave', () => item.classList.remove('drag-target'));
                item.addEventListener('drop', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    item.classList.remove('drag-target');
                    const manager = window.PlaylistManager;
                    if (draggedTrackId) {
                        const idsToMove = draggedTrackIds.length ? draggedTrackIds : [draggedTrackId];
                        const source = manager.playlists[draggedTrackSourcePlaylistId];
                        idsToMove.forEach(id => {
                            manager.addTrackToPlaylist(pl.id, id);
                            if (source && !source.system && source.id !== pl.id) {
                                manager.removeTrackFromPlaylist(source.id, id);
                            }
                        });
                        draggedTrackId = null;
                        draggedTrackIds = [];
                        draggedTrackSourcePlaylistId = null;
                        window.CyberSound.playSuccess();
                        renderPlaylists();
                        renderTracks();
                        return;
                    }
                    if (draggedPlaylistId && draggedPlaylistId !== pl.id) {
                        const ids = Object.values(manager.playlists).filter(list => !list.system).map(list => list.id);
                        const from = ids.indexOf(draggedPlaylistId);
                        const target = ids.indexOf(pl.id);
                        if (from >= 0 && target >= 0) {
                            const [moved] = ids.splice(from, 1);
                            const rect = item.getBoundingClientRect();
                            let insertion = target + (e.clientY > rect.top + rect.height / 2 ? 1 : 0);
                            if (from < insertion) insertion--;
                            ids.splice(insertion, 0, moved);
                            manager.reorderCustomPlaylists(ids);
                            renderPlaylists();
                        }
                        draggedPlaylistId = null;
                    }
                });
            }

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
                const favoriteBtn = document.createElement('button');
                favoriteBtn.className = `btn-favorite-playlist ${pl.favorite ? 'is-favorite' : ''}`;
                favoriteBtn.type = 'button';
                favoriteBtn.textContent = pl.favorite ? '★' : '☆';
                favoriteBtn.title = pl.favorite ? 'Unpin favorite directory' : 'Pin favorite directory';
                favoriteBtn.setAttribute('aria-label', favoriteBtn.title);
                favoriteBtn.setAttribute('aria-pressed', String(!!pl.favorite));
                favoriteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    window.CyberSound.playClick();
                    window.PlaylistManager.togglePlaylistFavorite(pl.id);
                    renderPlaylists();
                });
                rightWrap.appendChild(favoriteBtn);

                const delBtn = document.createElement('button');
                delBtn.className = 'btn-del-playlist';
                delBtn.innerHTML = '&times;';
                delBtn.setAttribute('title', 'Delete playlist');
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`Delete playlist "${pl.name}"?`)) {
                        window.PlaylistManager.deletePlaylist(pl.id);
                        elements.activePlaylistTitle.textContent = window.PlaylistManager.playlists[window.PlaylistManager.activePlaylistId].name;
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

    elements.playlistNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            elements.btnConfirmPlaylist.click();
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

        const nativeEvents = window.__TAURI__ && window.__TAURI__.event;
        if (nativeEvents && typeof nativeEvents.listen === 'function') {
            nativeEvents.listen('sndeck-ripper-status', event => {
                const status = event && event.payload;
                if (!status || typeof status.message !== 'string') return;
                window.CyberRipperEngine.log(status.message, status.kind || 'info');
                if (Number.isFinite(status.progress)) {
                    window.CyberRipperEngine.setProgress(status.progress);
                }
            }).catch(error => console.warn('Could not subscribe to native ripper updates:', error));
        }
    }

    if (elements.btnExecuteRip) {
        elements.btnExecuteRip.addEventListener('click', async () => {
            const url = elements.ripperUrlInput.value.trim();
            if (!url) {
                alert('Please paste a valid Spotify, YouTube, or audio stream link.');
                return;
            }

            window.CyberSound.playSandevistan();
            if (elements.ripperConsoleLog) elements.ripperConsoleLog.replaceChildren();
            if (elements.ripperProgressFill) elements.ripperProgressFill.style.width = '0%';
            elements.btnExecuteRip.disabled = true;
            elements.btnExecuteRip.textContent = 'RIPPING STREAM...';
            if (elements.ripperStatusDot) elements.ripperStatusDot.style.background = 'var(--omi-pink)';

            try {
                const quality = elements.ripperQuality.value;
                const ripResult = await window.CyberRipperEngine.ripStream(url, quality);
                const rippedTracks = Array.isArray(ripResult) ? ripResult : [ripResult];
                const targetPlId = elements.ripperTargetPlaylist.value || 'all';
                let tracksToPlay = rippedTracks;
                if (isTauri && rippedTracks.some(track => track.filePath)) {
                    const paths = rippedTracks.filter(track => track.filePath).map(track => track.filePath);
                    const normalizedPaths = new Set(paths.map(path => path.toLowerCase().replace(/\\/g, '/')));
                    const rippedMetadataByPath = new Map(rippedTracks
                        .filter(track => track.filePath)
                        .map(track => [track.filePath.toLowerCase().replace(/\\/g, '/'), track]));
                    await window.PlaylistManager.addFilesFromPaths(paths, rippedMetadataByPath);
                    tracksToPlay = Array.from(window.PlaylistManager.tracks.values()).filter(track =>
                        track.filePath && normalizedPaths.has(track.filePath.toLowerCase().replace(/\\/g, '/'))
                    );
                    if (targetPlId !== 'all') tracksToPlay.forEach(track => window.PlaylistManager.addTrackToPlaylist(targetPlId, track.id));
                } else {
                    rippedTracks.forEach(track => {
                        window.PlaylistManager.addCustomTrack(track);
                        if (targetPlId !== 'all') window.PlaylistManager.addTrackToPlaylist(targetPlId, track.id);
                    });
                }
                window.CyberSound.playSuccess();
                renderPlaylists();
                renderTracks();
                if (tracksToPlay.length) playTrack(tracksToPlay[0]);

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
        const activePlaylist = window.PlaylistManager.playlists[window.PlaylistManager.activePlaylistId];
        const canRemoveFromActivePlaylist = !!(activePlaylist && !activePlaylist.system);
        const canDeleteFromLibrary = !!(activePlaylist && activePlaylist.id === 'all');
        const visibleTrackIds = new Set(activeTracks.map(track => track.id));
        Array.from(selectedTrackIds).forEach(id => { if (!visibleTrackIds.has(id)) selectedTrackIds.delete(id); });
        elements.bulkSelectionBar.hidden = selectedTrackIds.size === 0;
        elements.selectedTrackCount.textContent = `${selectedTrackIds.size} SELECTED`;
        elements.btnMoveSelected.disabled = selectedTrackIds.size === 0;
        elements.btnRemoveSelected.hidden = !canRemoveFromActivePlaylist;
        elements.btnRemoveSelected.disabled = selectedTrackIds.size === 0;
        elements.btnDeleteSelected.hidden = !canDeleteFromLibrary;
        elements.btnDeleteSelected.disabled = selectedTrackIds.size === 0;
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
                <div style="font-size: 11px;">Drag & drop audio files here or click + ADD AUDIO FILES</div>
            `;
            elements.trackScrollList.appendChild(emptyNotice);
            return;
        }

        activeTracks.forEach((track, index) => {
            const isCurrent = track.id === window.PlaylistManager.currentTrackId;
            const isFav = window.PlaylistManager.isFavorite(track.id);

            const row = document.createElement('div');
            row.className = `track-row ${isCurrent ? 'active' : ''}`;
            row.classList.toggle('multi-selected', selectedTrackIds.has(track.id));
            row.draggable = true;
            row.addEventListener('dragstart', (e) => {
                if (e.target.closest('button')) { e.preventDefault(); return; }
                draggedTrackId = track.id;
                draggedTrackIds = selectedTrackIds.has(track.id) ? Array.from(selectedTrackIds) : [track.id];
                draggedTrackSourcePlaylistId = window.PlaylistManager.activePlaylistId;
                draggedPlaylistId = null;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('application/x-sndeck-track', track.id);
                e.dataTransfer.setData('text/plain', `track:${track.id}`);
            });
            row.addEventListener('dragend', () => {
                draggedTrackId = null;
                draggedTrackIds = [];
                draggedTrackSourcePlaylistId = null;
                document.querySelectorAll('.playlist-item.drag-target').forEach(el => el.classList.remove('drag-target'));
            });

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
            const canMoveTrack = activePlaylist && !activePlaylist.system && activePlaylist.trackIds.includes(track.id);
            addPlBtn.innerHTML = canMoveTrack ? `<span>→</span> <span>PL</span>` : `<span>+</span> <span>PL</span>`;
            addPlBtn.setAttribute('title', canMoveTrack ? 'Move to another playlist' : 'Add to Playlist');
            addPlBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                promptAddToPlaylist(track);
            });

            let removeBtn = null;
            if (canMoveTrack) {
                removeBtn = document.createElement('button');
                removeBtn.className = 'btn-track-action btn-track-remove';
                removeBtn.type = 'button';
                removeBtn.title = `Remove ${track.title} from ${activePlaylist.name}`;
                removeBtn.setAttribute('aria-label', removeBtn.title);
                removeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3"/></svg>';
                removeBtn.addEventListener('click', event => {
                    event.stopPropagation();
                    window.CyberSound.playClick();
                    window.PlaylistManager.removeTracksFromPlaylist(activePlaylist.id, [track.id]);
                    selectedTrackIds.delete(track.id);
                    renderPlaylists();
                    renderTracks();
                });
            }

            let deleteBtn = null;
            if (canDeleteFromLibrary) {
                deleteBtn = document.createElement('button');
                deleteBtn.className = 'btn-track-action btn-track-delete';
                deleteBtn.type = 'button';
                deleteBtn.title = `Remove ${track.title} from the SNDeck library`;
                deleteBtn.setAttribute('aria-label', deleteBtn.title);
                deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3"/></svg>';
                deleteBtn.addEventListener('click', event => {
                    event.stopPropagation();
                    deleteTracksFromLibrary([track.id]);
                });
            }

            row.appendChild(numEl);
            row.appendChild(detailsEl);
            row.appendChild(durEl);
            row.appendChild(favBtn);
            row.appendChild(addPlBtn);
            if (removeBtn) row.appendChild(removeBtn);
            if (deleteBtn) row.appendChild(deleteBtn);

            row.addEventListener('click', (e) => {
                if (e.ctrlKey || e.metaKey) {
                    if (selectedTrackIds.has(track.id)) selectedTrackIds.delete(track.id);
                    else selectedTrackIds.add(track.id);
                    renderTracks();
                    return;
                }
                if (selectedTrackIds.size) {
                    selectedTrackIds.clear();
                    renderTracks();
                }
                playTrack(track);
            });

            elements.trackScrollList.appendChild(row);
        });
    }

    function openPlaylistPicker(trackIds, isMove, title) {
        const manager = window.PlaylistManager;
        const source = manager.playlists[manager.activePlaylistId];
        const destinations = Object.values(manager.playlists)
            .filter(playlist => !playlist.system && (!isMove || playlist.id !== source.id));
        if (!destinations.length) {
            alert("No other custom playlists found. Click '+ NEW' in the left panel to create one.");
            return;
        }

        elements.playlistPickerTitle.textContent = title;
        elements.playlistPickerHint.textContent = `${trackIds.length} TRACK${trackIds.length === 1 ? '' : 'S'} · SELECT DESTINATION`;
        elements.playlistPickerList.innerHTML = '';
        destinations.forEach(playlist => {
            const button = document.createElement('button');
            button.className = 'playlist-picker-option';
            button.type = 'button';
            button.innerHTML = `<span class="playlist-picker-option-name"></span><span class="playlist-picker-option-count">${playlist.trackIds.length} TRACKS</span><span class="playlist-picker-arrow">›</span>`;
            button.querySelector('.playlist-picker-option-name').textContent = playlist.name;
            button.addEventListener('click', () => {
                trackIds.forEach(id => {
                    manager.addTrackToPlaylist(playlist.id, id);
                    if (isMove) manager.removeTrackFromPlaylist(source.id, id);
                });
                selectedTrackIds.clear();
                elements.playlistPickerModal.classList.remove('open');
                window.CyberSound.playSuccess();
                renderPlaylists();
                renderTracks();
            });
            elements.playlistPickerList.appendChild(button);
        });
        elements.playlistPickerModal.classList.add('open');
    }

    function moveSelectedTracksToPlaylist() {
        const source = window.PlaylistManager.playlists[window.PlaylistManager.activePlaylistId];
        openPlaylistPicker(Array.from(selectedTrackIds), !!(source && !source.system), 'MOVE TRACKS // SNDECK');
    }

    function deleteTracksFromLibrary(trackIds) {
        const manager = window.PlaylistManager;
        const uniqueIds = Array.from(new Set(trackIds)).filter(id => manager.tracks.has(id));
        if (uniqueIds.length === 0) return;
        const count = uniqueIds.length;
        const label = count === 1 ? 'this track' : `${count} tracks`;
        if (!confirm(`Remove ${label} from the SNDeck library? The audio file${count === 1 ? '' : 's'} will stay on your computer.`)) return;

        const removesCurrentTrack = uniqueIds.includes(manager.currentTrackId);
        if (removesCurrentTrack) {
            window.AudioEngine.pause();
            window.AudioEngine.audio.removeAttribute('src');
            window.AudioEngine.audio.load();
        }

        const removedCount = manager.deleteTracksFromLibrary(uniqueIds);
        selectedTrackIds.clear();
        if (removesCurrentTrack) {
            elements.trackLiveTitle.textContent = 'SNDECK // READY TO PLAY';
            elements.trackLiveArtist.textContent = '';
            elements.trackLiveAlbum.textContent = '';
            elements.currentTimeDisplay.textContent = '0:00';
            elements.durationDisplay.textContent = '0:00';
            elements.seekBarProgress.style.width = '0%';
            elements.seekBarWrapper.setAttribute('aria-valuenow', '0');
            elements.seekBarWrapper.setAttribute('aria-valuetext', '0:00');
            updateCoverArtDisplay();
        }
        if (removedCount > 0) window.CyberSound.playSuccess();
        renderPlaylists();
        renderTracks();
    }

    elements.btnMoveSelected.addEventListener('click', moveSelectedTracksToPlaylist);
    elements.btnRemoveSelected.addEventListener('click', () => {
        const manager = window.PlaylistManager;
        const source = manager.playlists[manager.activePlaylistId];
        if (!source || source.system || selectedTrackIds.size === 0) return;
        const removedCount = manager.removeTracksFromPlaylist(source.id, Array.from(selectedTrackIds));
        selectedTrackIds.clear();
        if (removedCount > 0) window.CyberSound.playSuccess();
        renderPlaylists();
        renderTracks();
    });
    elements.btnDeleteSelected.addEventListener('click', () => {
        deleteTracksFromLibrary(Array.from(selectedTrackIds));
    });
    elements.btnCancelPlaylistPicker.addEventListener('click', () => elements.playlistPickerModal.classList.remove('open'));
    elements.playlistPickerModal.addEventListener('click', (e) => {
        if (e.target === elements.playlistPickerModal) elements.playlistPickerModal.classList.remove('open');
    });
    elements.btnClearSelection.addEventListener('click', () => {
        selectedTrackIds.clear();
        renderTracks();
    });

    function promptAddToPlaylist(track) {
        const manager = window.PlaylistManager;
        const source = manager.playlists[manager.activePlaylistId];
        const isMove = source && !source.system && source.trackIds.includes(track.id);
        const destinations = Object.values(manager.playlists)
            .filter(playlist => !playlist.system && (!isMove || playlist.id !== source.id));

        if (destinations.length === 0) {
            alert("No other custom playlists found. Click '+ NEW' in the left panel to create one.");
            return;
        }

        openPlaylistPicker([track.id], isMove, `${isMove ? 'MOVE' : 'ADD'} TRACK // SNDECK`);
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

        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyA') {
            e.preventDefault();
            window.PlaylistManager.getActiveTracks().forEach(track => selectedTrackIds.add(track.id));
            renderTracks();
            return;
        }

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
                saveVolume(newVolUp);
                updateVolumeDisplay(newVolUp);
                break;
            case 'ArrowDown':
                e.preventDefault();
                const newVolDown = Math.max(0, window.AudioEngine.getVolume() - 0.05);
                window.AudioEngine.setVolume(newVolDown);
                elements.volumeSlider.value = newVolDown;
                saveVolume(newVolDown);
                updateVolumeDisplay(newVolDown);
                break;
            case 'KeyN':
                playNextTrack();
                break;
            case 'KeyP':
                if (pKeyDownAt === null) {
                    pKeyDownAt = performance.now();
                    startSpinBoost('keyboard-p');
                }
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

    window.addEventListener('keyup', event => {
        if (event.code !== 'KeyP' || pKeyDownAt === null) return;
        const heldFor = performance.now() - pKeyDownAt;
        stopSpinBoost('keyboard-p');
        pKeyDownAt = null;
        if (heldFor < 250) playPrevTrack();
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

