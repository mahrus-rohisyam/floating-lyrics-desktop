# Floating Lyrics

Synced lyrics that float above your desktop, plus a Dynamic-Island-style **Focus Island** for Spotify, Apple Music and YouTube Music. Windows/macOS desktop app (Tauri + Rust) with an interactive web demo (React + TypeScript).

> **Alpha.** `0.1.0-alpha.1` is the first public preview, not a finished release. See the [changelog](CHANGELOG.md) for known limitations and [validation and remaining gates](docs/VALIDATION.md).

## Download

Grab the latest installer from [Releases](https://github.com/mahrus-rohisyam/floating-lyrics-desktop/releases): `*_x64-setup.exe` for Windows 10/11, `*_universal.dmg` for macOS 13+. Builds are unsigned: on Windows choose **More info → Run anyway** in SmartScreen; on macOS right-click the app and choose **Open** the first time.

| Shortcut | Action |
| --- | --- |
| **Shift+C** | Customize the lyrics in place (move, resize, scroll for size, style toolbar). Shift+C, Escape or ← to finish. |
| **Shift+F** | Focus mode: hide everything until the track changes. |

Both are global shortcuts, so uppercase C/F cannot be typed in other apps while Floating Lyrics runs. Quit from the tray icon to release them.

## Run the demo

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:1420/demo** (or `/download`). The demo plays three original instrumental samples with original timed example words. It does not connect to your music accounts. Press Shift+C (or **Customize**) to move, resize and style the lyrics, hover them to see through, switch to Focus Island, try Shift+F for Focus mode, and change the appearance/behavior controls. Settings, imported lyrics and per-track offsets are stored locally. Static deployment output is `dist/`; `vercel.json` includes SPA rewrites. No site has been published.

## Run the desktop app

Prerequisites: Node 24, stable Rust, Windows C++ Build Tools + Windows SDK + WebView2, or macOS Xcode command-line tools. On this Windows workspace, a portable Rust installation and C++ Build Tools were provisioned under `.tools/`; the Windows SDK installer also uses its normal shared system location. These are ignored build prerequisites, not application files.

```sh
npm run desktop:dev
npm run desktop:build -- --debug --no-bundle
# Windows installer:
npm run desktop:build -- --bundles nsis
# On a Mac with the prerequisites:
npm run desktop:build -- --bundles dmg
```

The helper detects `.tools/cargo/bin` in this workspace; other machines use their normal Rust installation. The Windows executable is under `src-tauri/target/debug/floating-lyrics.exe` (or `release/` after a release build). The NSIS installer is emitted under `src-tauri/target/release/bundle/nsis/`. macOS must be built and tested on a Mac; no macOS artifact has been produced here.

1. Start music in your player, then open the desktop app.
2. Choose **Desktop media sessions**, then **Automatic** or a specific player.
3. Select/import lyrics if the exact version is not found. Positive offset displays lines earlier.
4. Click **Open desktop overlay**. The separate transparent window stays above normal windows.
5. Select **Focus Island** for artwork/spectrum; hover or keyboard focus reveals controls. Unsupported player actions are disabled.
6. Enable **Visualize system audio (Windows)** for real system audio FFT. It includes other apps, is analyzed locally, and is not recorded. Without it the spectrum is static. macOS system capture remains unfinished.
7. The tray menu provides Settings, Show/Hide overlay, Customize overlay and Quit. Closing the main window hides it; use Quit to exit.
8. The lyric overlay is click-through: hovering it fades the lyrics out so you can keep working behind them. Press **Shift+C** to customize it in place (drag, resize from the corners, scroll for font size, plus color/font/size/lines toolbar); press Shift+C, Escape or ← to finish.
9. **Shift+F** toggles Focus mode: the overlay becomes an island that stays hidden and only slides in briefly when the track changes.
10. Focus Island is pinned to the top center. Switching back to lyrics restores the overlay's last position and size.

Shift+C and Shift+F are registered as global shortcuts, so while the app runs those two keys are captured system-wide and uppercase C/F cannot be typed in other apps.

Desktop integration paths: Windows GSMTC media sessions; macOS Spotify/Music automation; YouTube Music Chrome companion. The adapters exist, but the complete Spotify/Apple Music/YouTube Music × Windows/macOS live compatibility matrix is still a release gate. Media availability and controls depend on what each player exposes.

## YouTube Music companion

1. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, select `browser-extension/`.
2. In desktop settings, choose **Pair YouTube Music companion** and copy the code.
3. Open the extension popup, paste it, save, then open/reload `https://music.youtube.com/`.
4. Play a track and choose the `browser:<tab id>` source in desktop settings if necessary.

Pair again after restarting the desktop app. The extension can read only the YouTube Music player page and talk to `127.0.0.1:49271`. Its token is kept in extension local storage; native logs do not print it. No account credentials are collected. A second desktop instance cannot bind this port; the pairing panel reports the conflict. Safari/Firefox extension support is not implemented.

## Checks

```sh
npm test
npm run build
npm run test:e2e
# PowerShell, all browser engines:
$env:E2E_ALL_BROWSERS='1'
npx playwright install chromium firefox webkit
npm run test:e2e
# With Rust on PATH:
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml --lib
```

Windows native E2E requires a built app launched specifically for testing with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223`, followed by `node scripts/native-smoke.mjs` and `node scripts/extension-smoke.mjs`. Quit that app afterward; do not enable the debugging port in a distributed app. The scripts use synthetic sessions and a locally served music-page fixture, without controlling the user's actual music session. The extension test briefly enables local system spectrum capture. Results are in `artifacts/`; browser traces/report are in ignored `test-results/` and `playwright-report/`.

## Data and distribution

Lyrics lookup uses LRCLIB over HTTPS and sends track title, artist, album and duration. Imported LRC/TXT stays local. No telemetry or application account is configured. Fonts are bundled, and the demo audio/artwork is generated by the scripts in this repository. Rights and provider terms for public lyric distribution must be reviewed before release.

Installer signing, macOS notarization, clean-machine install/uninstall, live service compatibility and manual multi-monitor/OS accessibility checks remain gates for a stable release. Alpha builds are published as GitHub pre-releases; the web demo's download buttons stay disabled until those gates pass.

## Releasing

Bump the version in `package.json`, `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`, add a `CHANGELOG.md` entry, then push a tag:

```sh
git tag v0.1.0-alpha.2
git push origin v0.1.0-alpha.2
```

[`.github/workflows/release.yml`](.github/workflows/release.yml) builds the Windows NSIS installer and a universal macOS DMG and attaches them to a GitHub release. Tags with a pre-release suffix (`-alpha`, `-beta`) are marked as pre-releases.

## License

[MIT](LICENSE) © 2026 Mahrus Rohisyam. Demo audio and artwork are generated by `scripts/generate-samples.mjs` and ship under the same license. Lyrics fetched at runtime belong to their respective rights holders and are not part of this repository.
