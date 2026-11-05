# Cross-platform build and release

SNDeck development is on `main`. A version tag (`v*`) starts one release workflow: it builds Windows installers, then builds an Android arm64 debug APK and a Linux `.deb` in parallel. All packages are attached to the same GitHub Release. The workflow does not run on ordinary `main` pushes, which avoids duplicate builds when a release tag is pushed.

The Android APK is debug-signed for sideload testing; production releases and seamless upgrades need a persistent Android signing key configured as GitHub secrets. See the [Tauri Android signing guide](https://v2.tauri.app/distribute/sign/android/).

## Platform differences

- **Windows:** Supports folder import and the built-in `yt-dlp`/Deno Ripper.
- **Linux:** Ships as a Debian package built on Ubuntu 22.04. The built-in Ripper provisions Deno and `yt-dlp` on first use. Tauri's Debian package declares WebKitGTK 4.1 and GTK 3 runtime dependencies.
- **Android:** Imports selected audio files into app-private storage. **ADD FOLDER** uses the Android Storage Access Framework to select and scan a folder tree, including subfolders. The built-in Ripper is unavailable on Android; use an external downloader, then import its audio files with **ADD MUSIC**.

See [README.md](README.md) for features and prerequisites.

After installing the Android prerequisites from the [Tauri setup guide](https://v2.tauri.app/start/prerequisites/), initialize and run the Android host with:

```sh
cargo tauri android init
cargo tauri icon src-tauri/icons/icon.png
cargo tauri android dev
```

Build an APK locally with:

```sh
cargo tauri android build --apk
```

Create a release from a version tag (for example `v1.6.6`). The release workflow attaches Windows installers, the Android APK, and `SNDeck-linux-amd64.deb` to that one release.
