# ⚡ CYBERDECK // SNAKE NATION [NOMAD AUDIO DECK]
> Ultra-lightweight, cross-platform audio player & visualizer themed around **Omi (Snake Nation Nomad)** from *Cyberpunk: Edgerunners (Season 2)*.

[![Platform - Windows](https://img.shields.io/badge/Platform-Windows%2011-0088FF?style=for-the-badge&logo=windows)](https://github.com)
[![Platform - Linux](https://img.shields.io/badge/Platform-Debian%20%2F%20Linux-A81D33?style=for-the-badge&logo=debian)](https://github.com)
[![Platform - Android](https://img.shields.io/badge/Platform-Android%20APK-3DDC84?style=for-the-badge&logo=android)](https://github.com)
[![Tech - Tauri 2.0](https://img.shields.io/badge/Engine-Tauri%202.0%20(Rust)-FFC135?style=for-the-badge&logo=rust)](https://tauri.app)
[![Tech - Web Audio](https://img.shields.io/badge/Audio-Web%20Audio%20DSP-00FF88?style=for-the-badge)](https://developer.mozilla.org)

---

## 📸 FEATURES AT A GLANCE

* **Snake Nation Aesthetic:** Designed with Omi's signature Nomad palette:
  * Toxic Emerald green wolf-cut hair (`#00FF88`)
  * Snake Nation deep royal purple (`#B026FF`)
  * Signature hot pink harness / tattoo (`#FF1A75`)
  * Cobalt body vest (`#0088FF`)
* **Zero Cheesy Emojis:** 100% minimalist vector SVGs, crisp typography, and Night City HUD readouts.
* **4 Reactive Canvas Visualizer Modes:**
  * **Snake Coil:** Symmetrical 360° radial reactive energy halo around the spinning vinyl / Omi's portrait.
  * **Gorilla Bars:** Full-width 48-band logarithmic equalizer with peak tracking and dynamic headroom.
  * **Nomad Laser:** Dual-beam chromatic aberration oscilloscope.
  * **Badlands 3D:** Horizon wireframe desert mountains, rushing perspective grid, and retro synthwave sliced sun.
* **Disc View Switcher (`DISC VIEW: OMI PORTRAIT / ALBUM COVER`):**
  * Instant toggle between Omi's Nomad portrait, the MP3's embedded album art, or the cyber-vinyl record.
* **Ergonomic Control Deck:**
  * Volume slider & mute on the far left.
  * Shuffle (`SHUF`) and Repeat (`LOOP ALL / LOOP 1 / LOOP OFF`) next to volume.
  * Center transport controls (`PREV`, `PLAY/PAUSE`, `NEXT`).
  * Right telemetry HUD with DAC bitrate (`48kHz • 24-BIT`) and dynamic signal meter.
* **Built-in 5-Band DSP Equalizer:**
  * Precise bands: 60Hz, 250Hz, 1kHz, 4kHz, 12kHz.
  * Instant presets: `FLAT`, `BASS BOOST`, `VOCAL`, `ELECTRONIC`, `ROCK`.
* **ID3v2 & ID3v1 Tag Parser:**
  * Pure client-side parsing of Title, Artist, Album, Year, and embedded album artwork (APIC) from local MP3 files.
* **Pixel Art Icon Support:**
  * Drop your custom 16x16 or 24x24 px Aseprite pixel art icons into `assets/custom-icons/`.

---

## 📥 DOWNLOAD & INSTALLATION

### 1. Download Pre-Built Binaries (GitHub Releases)
Head over to the [**Releases**](https://github.com) section to download ready-to-run packages:
* **Windows 11:** `Cyberdeck-Setup-1.0.0.exe` (or `.msi`)
* **Linux Debian / Ubuntu:** `cyberdeck-player_1.0.0_amd64.deb`
* **Android:** `cyberdeck-player-release.apk`

### 2. Instant PWA Install (No Compilation Needed)
1. Open the project in any Chromium-based browser (Chrome, Edge, Brave).
2. Click **Install CYBERDECK** in the browser URL bar.
3. The app installs as a native, borderless window with its own Taskbar / Desktop shortcut.
4. On **Android**, tap `⋮ -> Install app` to run full-screen directly on your phone.

---

## ⚡ STREAM RIPPER (SPOTIFY, YOUTUBE, SOUNDCLOUD)

To download real 320 kbps MP3 files with complete ID3 tags and high-resolution cover art:
1. Double-click **`Download_From_Spotify_and_YT.bat`** on Windows (or use the built-in desktop Tauri engine).
2. Paste any **Spotify**, **YouTube**, or **SoundCloud** link.
3. The track is downloaded at 320 kbps directly into `Downloaded_Music/`.
4. Drag & drop the `.mp3` file onto the deck, or click **`+ ADD MP3 FILES`**!

---

## 🛠️ BUILDING FROM SOURCE (TAURI 2.0)

### Prerequisites:
* [Rust](https://rustup.rs/) (v1.75+)
* Node.js (v22+) or standalone Rust compiler

```bash
# 1. Install Tauri CLI
cargo install tauri-cli --version "^2.0"

# 2. Build Desktop Binaries (Windows / Debian)
cargo tauri build

# 3. Build Android APK
cargo tauri android build --apk
```

---

## 📜 LICENSE
MIT License. Inspired by CD PROJEKT RED's *Cyberpunk 2077* & Studio Trigger's *Cyberpunk: Edgerunners*.
