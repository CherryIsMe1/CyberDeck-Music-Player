# SNDeck

SNDeck is a desktop music player for local audio libraries. It includes playlists, playback controls, an equalizer, visualizers, and a Windows audio downloader.

## Features

- Import audio files or folders and organize tracks into playlists.
- Search, sort, favorite, shuffle, and repeat tracks.
- Use four themes: SN, ER, Basic, and Blossom.
- Create local custom themes with your own name and accent colors, then choose a separate portrait for each one. Custom themes and artwork stay on the device.
- Choose a separate custom portrait for each theme from the `ART` control. Images are resized and saved locally in the app; they are not uploaded or copied into the repository.
- Download audio from YouTube videos and playlists in the Windows build. Downloads are saved to `Music/SNDeck` and added to the selected playlist.

## Windows build

Install Rust and the [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/), then install the Tauri CLI and build from the repository root:

```sh
cargo install tauri-cli --version "^2.0"
cargo tauri build
```

The source version is `1.3.6`. The GitHub Actions workflow creates Windows installers from tags beginning with `v`, such as `v1.3.6`. Windows is the only packaged target at this time. The downloader provisions `yt-dlp` and Deno on first use and requires an internet connection.

The root frontend files are used for browser preview. Tauri packages the matching files in `www/`.

## License and artwork

The source code and original project assets in this repository are licensed under MIT; see [LICENSE](LICENSE). The license does not cover third-party names, marks, music, or artwork. SNDeck does not include character portraits. Custom artwork stays on the user's device and is not part of the repository or release package.

