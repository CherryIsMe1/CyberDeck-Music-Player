# Platform status

SNDeck's released build is Windows-only. Initial Android port work is in the `SNDMobile` branch; it is not yet a verified Android release.

See [README.md](README.md) for Windows build, release, and downloader details.

## Android development branch

The `SNDMobile` branch adds a portrait-first mobile layout, touch-sized controls, a quick add-music action, and multi-file import into app-private storage. It also moves the Tauri entry point into a library so the Android host can call it. The Android folder picker is hidden because Tauri's Android dialog does not support directory selection; use multi-select to add a batch of tracks.

The `SNDMobile` branch includes a GitHub Actions workflow at `.github/workflows/android.yml`. Pushing to that branch or manually starting **SNDeck Android Build** in the Actions tab builds an arm64 debug APK and uploads it as the `SNDeck-android-arm64-debug` artifact for 14 days. Download it from the completed workflow run's **Artifacts** section. The workflow has not run yet, so the APK build still needs confirmation on GitHub and installation testing on a phone or emulator.

The Android ripper uses the in-app stream resolver rather than the Windows `yt-dlp`/Deno pipeline, and background playback needs native Android verification before claiming full feature parity.

After installing the Android prerequisites from the [Tauri setup guide](https://v2.tauri.app/start/prerequisites/), initialize and run the Android host with:

```sh
cargo tauri android init
cargo tauri android dev
```

Build an APK locally with:

```sh
cargo tauri android build --apk
```
