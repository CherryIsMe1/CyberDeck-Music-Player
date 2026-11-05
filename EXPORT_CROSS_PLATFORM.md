# Platform status

SNDeck development is on `main`. A GitHub Release will contain the Windows installers and an Android APK built from the same version tag. Linux `.deb` packaging can be added to the same release workflow later.

See [README.md](README.md) for Windows build, release, and downloader details.

## Android build

The Android port adds a portrait-first mobile layout, touch-sized controls, a quick add-music action, and audio import into app-private storage. The Android folder button uses the WebView directory input instead of Tauri's unsupported mobile folder dialog; folder selection depends on the Android System WebView version and should be checked on-device.

Pushing to `main` or manually starting **SNDeck Android Build** in the Actions tab builds an arm64 debug APK and uploads it as the `SNDeck-android-arm64-debug` artifact for 14 days. For a tagged release (`v*`), the cross-platform release workflow builds the Windows installers and attaches the same kind of Android APK to that GitHub Release. The release APK is debug-signed for sideload testing; production releases and seamless upgrades need a persistent Android signing key configured as GitHub secrets. Tauri requires APKs to be signed before distribution ([Android signing guide](https://v2.tauri.app/distribute/sign/android/)).

The Android ripper uses short, parallel requests to current Piped/Invidious public instances, rather than the Windows `yt-dlp`/Deno pipeline. Public instances can still be unavailable, and background playback needs native Android verification before claiming full feature parity.

After installing the Android prerequisites from the [Tauri setup guide](https://v2.tauri.app/start/prerequisites/), initialize and run the Android host with:

```sh
cargo tauri android init
cargo tauri android dev
```

Build an APK locally with:

```sh
cargo tauri android build --apk
```

Create a release from a version tag (for example `v1.5.6`). A future Linux job can attach a `.deb` asset to the same release.
