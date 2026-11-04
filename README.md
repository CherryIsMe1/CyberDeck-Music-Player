# SNDeck

SNDeck is a Windows music player for local audio libraries. It includes playlists, playback controls, an equalizer, visualizers, and audio downloads from YouTube.

## Download

Download the latest Windows installer from [GitHub Releases](https://github.com/CherryIsMe1/CyberDeck-Music-Player/releases).

## Features

- Import audio files or folders and organize tracks into playlists.
- Play, search, sort, shuffle, repeat, and favorite tracks.
- Adjust playback with a five-band equalizer and visualizer modes.
- Download audio from YouTube videos or playlists in the Windows app. Files are saved in `Music/SNDeck` and added to the selected playlist.

## Build for Windows

Install Rust and the [Tauri CLI 2 prerequisites](https://v2.tauri.app/start/prerequisites/). Install the CLI and build from the repository root:

```sh
cargo tauri build
```

Install the CLI with `cargo install tauri-cli --version "^2.0"` if needed.

The release workflow builds Windows installers when a `v*` tag is pushed. Windows is the only packaged target currently supported. The YouTube downloader needs an internet connection; SNDeck provisions `yt-dlp` and Deno on first use. Spotify links are not supported by the native downloader.

The root frontend files are used for browser preview. The matching files in `www/` are bundled by Tauri.
