# Validation — 0.1.0 implementation

Environment: Windows 11 x64, Node 24.21, Rust 1.99, WebView2, local C++ Build Tools. Session dated 5 October 2026 (Asia/Jakarta); JSON artifacts use UTC. This report separates executed checks from planned checks.

## Executed successfully

| Check | Result / scope |
| --- | --- |
| `npm run build` | TypeScript and production Vite bundle pass |
| `npm test` | 11 tests pass: LRC timestamps/offsets/Unicode, active-line boundaries, storage recovery and constrained geometry |
| Playwright browser suite | Current update: **18/18 Edge and 18/18 Chromium pass**. First-run tour also passes in WebKit. Firefox fails while Playwright creates the browser page. Three WebKit audio-playback scenarios time out because the sample never becomes ready; an isolated check showed this WebKit runtime reports `MEDIA_ERR_SRC_NOT_SUPPORTED` for both a direct WAV URL and a blob URL. The previous preview passed 51/51 across Chromium, Firefox and WebKit. |
| Accessibility | No serious/critical axe violations in the current Edge, Chromium and WebKit default demo runs; Firefox was covered by the previous preview, not this update. This is not a full accessibility certification. |
| `cargo check` | Windows native code compiles |
| `cargo test --lib` | 2 FFT tests pass: silence and known-frequency band selection |
| Native debug build | Tauri executable built and launched successfully using an isolated test profile |
| Windows installer | Updated local NSIS preview built; SHA-256 recorded in `artifacts/build-manifest.json`. Existing running release was left open, so this is not a clean-machine installation test |
| Native startup smoke | Current isolated debug build launched and exposed two visible windows (main and overlay) without clicking Open overlay. WebView2 CDP did not listen on the test port, so the 6-check fixture in `artifacts/native-test-results.json` remains evidence from the previous preview only. |
| Unpacked Chrome extension E2E | 6 checks pass; details in `artifacts/extension-test-results.json` |
| Visual inspection | New onboarding capture reviewed at `artifacts/onboarding-tour.png`; prior desktop/mobile demo and native Island captures remain available |

Browser scenarios cover first-run tour skip/replay/completion, real sample playback, pause/stop/seek, track changes/Unicode, caption background limited to words, smoothly scrolling and blurred adjacent lyrics, preferences/presets/reload, drag and four-corner resize, Alt+Shift shortcuts, fixed Island placement/hover/keyboard/Escape, real spectrum where Web Audio exists, safe LRC import and per-track offset, failed audio request recovery, corrupt/disabled storage, mobile layout, reduced-motion setting, help dialog, download route, and accessibility scan.

The previous native E2E used the actual executable, WebView2, Rust commands and authenticated loopback server. It verified rejected unauthenticated/foreign-origin requests, source discovery, acknowledged playback commands, stale-title protection, disabled unsupported stop, separate overlay, shared selected source/imported LRC, Island expansion, and session expiry. For this update, a fresh debug executable launched the main window plus a second visible overlay window at startup. WebView2 did not expose its configured CDP port, so the deeper fixture could not be rerun. One native Windows overlay-creation deadlock was previously fixed by creating the window from an asynchronous command.

Extension E2E loads the actual unpacked extension in Chromium. A local HTML fixture provides a YouTube Music-shaped player bar and real WAV media element. Commands cross native IPC → Rust HTTP bridge → extension worker → content script → HTML media element, with acknowledgements back. It verifies play, pause, next, previous, metadata refresh and expiry. **This is not a live youtube.com compatibility test.** Windows WASAPI loopback delivered nonzero FFT bands and the Island UI rendered moving bars during this test; no audio recording was saved.

The app also successfully discovered a real existing Windows media session and retrieved synchronized lyric status in a read-only smoke check. Its playback controls were not exercised to avoid changing the user's music.

## Known limits and release gates

- macOS adapter/entitlements and build configuration exist, but no Mac build or runtime test has run. macOS system-audio spectrum capture is not implemented; the app reports that explicitly.
- Live Spotify and Apple Music on both OSes, and live YouTube Music in Chrome on both OSes, are required before calling version one complete. Fixture tests do not establish this matrix.
- Real Windows overlay dragging/resizing, click-through recovery, tray operations, multi-monitor/DPI, fullscreen/Spaces, sleep/wake and reconnect need OS-level manual acceptance. Browser geometry checks do not substitute for those checks.
- Rounded native window hit-testing, monitor-aware snap, full font/spacing/shadow/radius controls, romanization and automatic artwork themes from the broader plan are still pending. Alt+Shift+C/F global shortcuts are implemented; cross-OS manual shortcut testing remains.
- Overlay settings, selected source and imported lyrics share local storage. The desktop **Demo samples** option previews samples in the main window; it does not broadcast demo audio playback to the separate native overlay.
- Spectrum is whole-system on Windows and starts automatically for a playing track in Island/Focus mode; users can turn it off in Desktop connection. On errors, reduced motion, or unsupported engines it uses a static indicator. WebKit's Windows test engine has no AudioContext; playback/lyrics work with a native URL audio-loader fallback. This does not establish Safari-on-macOS behavior.
- Stop is shown disabled where a source lacks native stop semantics (including YouTube Music and Spotify's macOS scripting adapter).
- No code signing/notarization, update service, clean-machine installer acceptance or public deployment completed. Download-page buttons deliberately do not claim public release availability.
- Native E2E used an isolated test profile and bridge port so an existing release process could stay open. Production keeps the fixed default port; the override only exists in debug builds.

## Architecture decisions

- Demo and desktop reuse React rendering, timing, preferences and LRC code. Tauri invokes Rust only in the native environment.
- Windows uses GSMTC metadata/timeline/control APIs. macOS uses allowlisted Spotify/Music automation and JSON-encoded arguments, not arbitrary shell commands.
- The implemented companion transport is authenticated **HTTP loopback**, a change from the initial native-messaging proposal. It binds only `127.0.0.1`, uses an ephemeral token, checks Origin, limits input and expiry, and waits for command acknowledgement. Packaging native messaging remains an optional future replacement.
- Lyrics use LRCLIB exact lookup then candidate search; exact normalized title/artist and duration are required for automatic choice. Users can select a candidate or import LRC/TXT. Provider availability/coverage does not guarantee a correct lyric version.
- CI jobs exist for Windows browser checks and Windows/macOS Rust checks. Their presence is not evidence of a remote CI run.
