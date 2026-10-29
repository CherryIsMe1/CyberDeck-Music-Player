# 🚀 CYBERDECK // CROSS-PLATFORM CONVERSION & DEPLOYMENT GUIDE

This guide details how to run, install, and compile **CYBERDECK // SNAKE NATION** as a standalone application on:
* **Windows 11** (`.exe` / `.msi`)
* **Linux Debian** (`.deb` / `.AppImage`)
* **Android** (`.apk`)

---

## ⚡ 1. INSTANT INSTALL (PWA Mode — Zero Compile Required)
Because the player is built as a Progressive Web App (PWA) with Service Worker v6:
1. Open `index.html` in **Google Chrome**, **Microsoft Edge**, or **Brave**.
2. Look at the right side of the address bar and click the **Install App** icon (or go to `Menu (⋮) -> Cast, save, and share -> Install CYBERDECK`).
3. **Result:** The player runs in its own standalone, frameless desktop window with its own icon on your Taskbar, Start Menu, and Desktop — without any browser tabs or search bar!
4. **On Android:** Open the URL in Chrome on your phone, tap `⋮ -> Add to Home screen / Install app`. It installs full-screen with offline caching!

---

## 💻 2. NATIVE DESKTOP BUILD (Windows 11 & Linux Debian via Tauri 2.0)
The repository is pre-configured with `src-tauri/` for [Tauri 2.0](https://tauri.app/).

### Prerequisites:
1. Install **Rust**:
   * **Windows:** Download & run `rustup-init.exe` from [rustup.rs](https://rustup.rs/).
   * **Debian:** Run `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
2. Install OS dependencies:
   * **Windows 11:** WebView2 is already pre-installed by default.
   * **Linux Debian:**
     ```bash
     sudo apt update && sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libayatana-appindicator3-dev librsvg2-dev
     ```

### Build Commands:
In the project root directory, run:
```bash
# 1. Install Tauri CLI (one-time)
cargo install tauri-cli --version "^2.0"

# 2. Compile Native Desktop Application
cargo tauri build
```

### Build Outputs:
* **Windows 11:**
  * Standalone Installer: `src-tauri/target/release/bundle/msi/Cyberdeck Snake Nation_1.0.0_x64_en-US.msi`
  * Executable: `src-tauri/target/release/cyberdeck-player.exe`
* **Linux Debian:**
  * Debian package: `src-tauri/target/release/bundle/deb/cyberdeck-player_1.0.0_amd64.deb`
  * Universal AppImage: `src-tauri/target/release/bundle/appimage/cyberdeck-player_1.0.0_amd64.AppImage`

Install on Debian via:
```bash
sudo dpkg -i cyberdeck-player_1.0.0_amd64.deb
```

---

## 📱 3. ANDROID BUILD (.apk)

### Option A: Via Tauri 2.0 Mobile (Recommended)
Tauri 2.0 officially supports native Android builds:
1. Install Android Studio & Android SDK / NDK.
2. Set environment variables (`ANDROID_HOME`, `NDK_HOME`).
3. Run:
   ```bash
   cargo tauri android init
   cargo tauri android build --apk
   ```
4. Output APK: `src-tauri/gen/android/app/build/outputs/apk/release/app-release.apk`

### Option B: Via Capacitor
The repository includes `capacitor.config.json`:
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npx cap copy android
npx cap open android
```
In Android Studio, click **Build -> Build Bundle(s) / APK(s) -> Build APK(s)**.

---

## ⚡ 4. HOW THE SPOTIFY & YOUTUBE RIPPER WORKS

1. In the left panel, click **`⚡ RIPPER // SPOTIFY & YT`**.
2. Paste any link:
   * **Spotify:** `https://open.spotify.com/track/...` or `playlist/...` or `album/...`
   * **YouTube:** `https://www.youtube.com/watch?v=...` or `https://youtu.be/...`
   * **Direct MP3:** `https://example.com/audio.mp3`
3. Select desired Bitrate (`320 KBPS [HIGH FIDELITY]`) and Target Playlist.
4. Click **`EXECUTE RIP`**:
   * **In Browser:** Resolves Spotify oEmbed and high-quality stream, automatically writes ID3 tags and high-res cover art, injects it into your local playlist, and spins the turntable!
   * **In Desktop (Tauri):** Calls the native `yt-dlp` + `ffmpeg` engine, saving clean 320 kbps MP3 files directly to your system's `Music/Cyberdeck` folder.
