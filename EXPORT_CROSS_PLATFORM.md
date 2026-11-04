# SNDeck // BUILD STATUS AND WINDOWS GUIDE

SNDeck is currently being prepared for Windows. Linux and Android packaging will be added after the Windows version is complete.

## Windows desktop build

### Prerequisites
- Rust (install with [rustup](https://rustup.rs/))
- Tauri CLI 2.x (`cargo install tauri-cli --version "^2.0"`)
- Microsoft WebView2 runtime (included with current Windows 11 installations)

Build from the project root:

```bash
cargo tauri build
```

The GitHub Actions release workflow currently builds Windows installers (`.msi` and `.exe`) only.

## YouTube ripper

In the Windows app, open **RIPPER**, paste a YouTube video or playlist URL, choose a target playlist, and execute. On first use SNDeck downloads the Deno runtime required by yt-dlp. It then downloads all supported playlist items into `Music/SNDeck` and adds them to the selected playlist. Spotify playlist links are not supported by the native downloader.
