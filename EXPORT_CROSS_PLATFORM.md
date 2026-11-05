# Cross-platform build and release

SNDeck development is on `main`. A version tag (`v*`) starts one release workflow: it builds Windows installers, then an Android arm64 debug APK, and attaches both to the same GitHub Release. The workflow does not run on ordinary `main` pushes, which avoids duplicate builds when a release tag is pushed.

The Android APK is debug-signed for sideload testing; production releases and seamless upgrades need a persistent Android signing key configured as GitHub secrets. See the [Tauri Android signing guide](https://v2.tauri.app/distribute/sign/android/).

## Platform differences

- **Windows:** Supports folder import and the built-in `yt-dlp`/Deno Ripper.
- **Android:** Imports one or more selected audio files into app-private storage. The current Tauri Android picker does not support folder selection, and the built-in Ripper is Windows-only. Use an external downloader, then import its audio files with **ADD MUSIC**.

Linux `.deb` packaging can be added to this release workflow later. See [README.md](README.md) for features and prerequisites.

After installing the Android prerequisites from the [Tauri setup guide](https://v2.tauri.app/start/prerequisites/), initialize and run the Android host with:

```sh
cargo tauri android init
cargo tauri android dev
```

Build an APK locally with:

```sh
cargo tauri android build --apk
```

Create a release from a version tag (for example `v1.6.0`). A future Linux job can attach a `.deb` asset to the same release.
