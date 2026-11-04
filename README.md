# SNDeck

SNDeck is a desktop music player for local audio libraries. It includes playlists, playback controls, an equalizer, visualizers, and a Windows audio downloader.

## Features

- Import audio files or folders and organize tracks into playlists.
- Search, sort, favorite, shuffle, and repeat tracks.
- Drag the playback bar to seek. Hold the record or `P` to spin it up to 5×; a quick `P` press skips to the previous track.
- Remove a track from the library to hide it throughout SNDeck; its audio file stays on the computer.
- Use four themes: SN, ER, Basic, and Blossom.
- Create local custom themes with your own name and accent colors, then choose a separate portrait for each one. Custom themes and artwork stay on the device.
- Choose a separate custom portrait for each theme from the `ART` control. Images are resized and saved locally in the app; they are not uploaded or copied into the repository.
- Download audio from YouTube videos and playlists in the Windows build. Downloads are saved to `Music/SNDeck` and added to the selected playlist.

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

The source version is `1.4.0`. The GitHub Actions workflow creates Windows installers from tags beginning with `v`, such as `v1.4.0`. Windows is the only packaged target at this time. The downloader provisions `yt-dlp` and Deno on first use and requires an internet connection.

If Windows still shows an old taskbar icon after an update, unpin the existing shortcut and pin the newly installed SNDeck shortcut.

The root frontend files are used for browser preview. Tauri packages the matching files in `www/`.

## License and artwork

The source code and original project assets in this repository are licensed under MIT; see [LICENSE](LICENSE). The license does not cover third-party names, marks, music, or artwork. SNDeck does not include character portraits. Custom artwork stays on the user's device and is not part of the repository or release package.

