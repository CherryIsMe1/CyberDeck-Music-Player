# SNDeck

SNDeck is a cross-platform music player for local audio libraries. It includes playlists, playback controls, an equalizer, and visualizers. The built-in Ripper runs on desktop; Windows provisions its tools automatically, while Linux YouTube support needs Deno 2.3+ installed.

## Features

- Import audio files or folders and organize tracks into playlists.
- Search, sort, favorite, shuffle, and repeat tracks.
- Drag the playback bar to seek. Hold the record or `P` to spin it up to 5×; a quick `P` press skips to the previous track.
- Remove a track from the library to hide it throughout SNDeck; its audio file stays on the computer.
- Use four themes: SN, ER, Basic, and Blossom.
- Create local custom themes with your own name, four accent colors, background, panel, main and muted text, and border colors, then choose a separate portrait for each one. Custom themes and artwork stay on the device.
- Choose a separate custom portrait for each theme from the `ART` control. Images are resized and saved locally in the app; they are not uploaded or copied into the repository.
- Download audio from YouTube videos and playlists in the desktop builds. Windows provisions its tools automatically; Linux YouTube support needs Deno 2.3+ installed. Downloads are saved to `Music/SNDeck` and added to the selected playlist.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Space` | Play or pause |
| `Left` / `Right` | Seek 5 seconds backward or forward |
| `Home` / `End` (playback bar focused) | Jump to the beginning or end |
| `Up` / `Down` | Raise or lower volume by 5% |
| `N` | Play the next track |
| `P` | Play the previous track; hold to ramp the record up to 5× |
| `S` / `C` | Switch between the theme portrait and album cover |
| `M` | Mute or unmute |
| `Ctrl+A` | Select all visible tracks |

## Windows build

Install Rust and the [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/), then install the Tauri CLI and build from the repository root:

```sh
cargo install tauri-cli --version "^2.0"
cargo tauri build
```

The source version is `1.6.2`. Pushing a version tag beginning with `v` starts one GitHub Actions release workflow; it builds Windows installers, an Android APK, and a Linux `.deb` from the same commit and attaches all three to the release. Ordinary pushes to `main` do not start a release build. The Android APK is debug-signed for sideload testing. Add a persistent Android signing key in GitHub Actions secrets before using it for production distribution or seamless app updates.

## Linux build

The `.deb` release is built on Ubuntu 22.04 to support Debian-based systems with WebKitGTK 4.1. The package declares `curl` for the Ripper's first-use `yt-dlp` download. For a local build on Ubuntu or Debian, install the [Tauri Linux prerequisites](https://v2.tauri.app/start/prerequisites/), then run:

```sh
cargo install tauri-cli --version "^2.0"
cargo tauri build --bundles deb
```

## Platform features

- **Windows:** The built-in Ripper uses `yt-dlp` and Deno to download audio. It provisions these tools on first use and requires an internet connection. Folder import is supported.
- **Linux:** The built-in Ripper needs Deno 2.3+ available on `PATH` for YouTube support; SNDeck can provision `yt-dlp` on first use. Folder import is supported.
- **Android:** The built-in Ripper is not available. Use an external downloader, then import downloaded audio with **ADD MUSIC**. **ADD FOLDER** uses Android's system folder picker, scans nested folders, and copies supported audio into SNDeck storage.

If Windows still shows an old taskbar icon after an update, unpin the existing shortcut and pin the newly installed SNDeck shortcut.

The root frontend files are used for browser preview. Tauri packages the matching files in `www/`.

## License and artwork

The source code and original project assets in this repository are licensed under MIT; see [LICENSE](LICENSE). The license does not cover third-party names, marks, music, or artwork. SNDeck does not include character portraits. Custom artwork stays on the user's device and is not part of the repository or release package.
