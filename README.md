# Floating Lyrics

Synced lyrics that float above your desktop, plus a Dynamic-Island-style **Focus Island** for Spotify, Apple Music and YouTube Music. Windows/macOS desktop app (Tauri + Rust) with a Vercel-ready landing page and interactive web demo (React + TypeScript).

> **Alpha.** `0.1.0-alpha.1` is the first public preview, not a finished release. See the [changelog](CHANGELOG.md) for known limitations and [validation and remaining gates](docs/VALIDATION.md).

## Download

Grab the latest installer from [Releases](https://github.com/mahrus-rohisyam/floating-lyrics-desktop/releases): `*_x64-setup.exe` for Windows 10/11, `*_universal.dmg` for macOS 13+. Builds are unsigned: on Windows choose **More info → Run anyway** in SmartScreen; on macOS right-click the app and choose **Open** the first time.

The newest changes in this workspace are packaged as a local, unsigned Windows preview at `artifacts/Floating-Lyrics-Preview-0.1.0-alpha.1-Windows-x64.exe`; see `artifacts/build-manifest.json` for its checksum. It has not replaced the existing GitHub release. Close any running Floating Lyrics Preview instance before installing this build.

| Shortcut | Action |
| --- | --- |
| **Alt+Shift+C** | Customize the lyrics in place (move, resize, scroll for size, style toolbar). Alt+Shift+C, Escape or ← to finish. |
| **Alt+Shift+F** | Focus mode: hide everything until the track changes. |

Both are global shortcuts. The full three-key chord is captured while the app runs; ordinary uppercase C/F remains available in other apps. Quit from the tray icon to release the shortcuts.

## Run the website

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:1420/** for the landing page, which explains the features, listening modes and setup steps. The landing page uses GSAP entrance and scroll transitions and respects reduced motion. Open `/demo` for the interactive playground. A four-step first-run tour points out the preview, playback, customization and Focus Island; **Skip tour** dismisses it and **Quick tour** reopens it. The demo plays three original instrumental samples with original timed example words. It does not connect to your music accounts. Caption is the default: only the words have a background, and the active line scrolls smoothly while nearby lines blur slightly. Settings, imported lyrics and per-track offsets are stored locally.

Vercel can import this repository as a Vite project: use `npm run build` as the build command and `dist` as the output directory. `vercel.json` keeps `/demo` and the legacy `/download` URL on the SPA; `/download` now shows the landing page. The website links to GitHub Releases for desktop builds. No Vercel deployment has been made from this workspace.

## Run the desktop app

Prerequisites: Node 24, stable Rust, Windows C++ Build Tools + Windows SDK + WebView2, or macOS Xcode command-line tools. On this Windows workspace, a portable Rust installation and C++ Build Tools were provisioned under `.tools/`; the Windows SDK installer also uses its normal shared system location. These are ignored build prerequisites, not application files.

```sh
npm run desktop:dev
npm run desktop:build -- --debug --no-bundle
# Windows installer (defaults to NSIS and an isolated output directory):
npm run desktop:build
# On a Mac with the prerequisites:
npm run desktop:build -- --bundles dmg
```

The helper detects `.tools/cargo/bin` in this workspace; other machines use their normal Rust installation. On Windows, `desktop:build` uses `.tools/release-target/` by default, so a running older executable under `src-tauri/target/` cannot lock the new build. The NSIS installer is emitted under `.tools/release-target/release/bundle/nsis/`; set `CARGO_TARGET_DIR` explicitly if another output location is needed. macOS must be built and tested on a Mac; no macOS artifact has been produced here.

1. Start music in your player, then open the desktop app. The Caption overlay opens automatically. The main window is now Studio: it contains the live preview and customization controls only. Follow or skip the first-run tour; reopen it with **Quick tour**.
2. Open **Behavior → Playback & connections** to choose **Desktop media sessions**, then **Automatic** or a specific player. The same section contains pairing and startup options.
3. Select/import lyrics if the exact version is not found. Positive offset displays lines earlier.
4. The separate transparent window stays above normal windows. Use **Show overlay** in the Studio header to reopen it if hidden. **Open overlay at startup** in Playback & connections controls whether it opens automatically next time.
5. Select **Focus Island** for artwork/spectrum; hover or keyboard focus reveals controls. Unsupported player actions are disabled.
6. In Windows, **Visualize system audio** starts enabled when a track plays in Island/Focus mode. It includes other apps, is analyzed locally, and is not recorded. Turn the option off to keep the spectrum static. macOS system capture remains unfinished.
7. The tray menu provides Settings, Show/Hide overlay, Customize overlay and Quit. Closing the main window hides it; use Quit to exit.
8. The lyric overlay is click-through: hovering it fades the lyrics out so you can keep working behind them. Press **Alt+Shift+C** to customize it in place (drag, resize from the corners, scroll for font size, plus color/font/size/lines toolbar); press Alt+Shift+C, Escape or ← to finish.
9. **Alt+Shift+F** toggles Focus mode: the overlay becomes an island that stays hidden and only slides in briefly when the track changes.
10. Focus Island is pinned to the top center. Switching back to lyrics restores the overlay's last position and size.

Alt+Shift+C and Alt+Shift+F are registered as global shortcuts. Alt+Shift alone remains available to the operating system, while the three-key chords open the app controls.

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

Windows native E2E requires a debug app built with `--config src-tauri/tauri.test.conf.json` and launched with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223` and `FLOATING_LYRICS_TEST_BRIDGE_PORT=49272`. Then run `node scripts/native-smoke.mjs` and `node scripts/extension-smoke.mjs`. The test config and port let a release instance stay open. Quit the debug app afterward; do not enable the debugging port in a distributed app. The scripts use synthetic sessions and a locally served music-page fixture, without controlling the user's actual music session. The extension test briefly enables local system spectrum capture. Results are in `artifacts/`; browser traces/report are in ignored `test-results/` and `playwright-report/`.

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
