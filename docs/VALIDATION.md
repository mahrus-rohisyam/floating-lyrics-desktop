# Validation — 0.1.0 implementation

Environment: Windows 11 x64, Node 24.21, Rust 1.99, WebView2, local C++ Build Tools. Session dated 5 October 2026 (Asia/Jakarta); JSON artifacts use UTC. This report separates executed checks from planned checks.

## Executed successfully

| Check | Result / scope |
| --- | --- |
| `npm run build` | TypeScript and production Vite bundle pass |
| `npm test` | 11 tests pass: LRC timestamps/offsets/Unicode, active-line boundaries, storage recovery and constrained geometry |
| Playwright browser suite | **39/39 pass**, 13 each in Chromium, Firefox, WebKit on Windows |
| Accessibility | No serious/critical axe violations in default demo layout in all three engines; not a full accessibility certification |
| `cargo check` | Windows native code compiles |
| `cargo test --lib` | 2 FFT tests pass: silence and known-frequency band selection |
| Native debug build | Tauri executable built and launched successfully |
| Native WebView2 E2E | 6 checks pass; details in `artifacts/native-test-results.json` |
| Unpacked Chrome extension E2E | 5 checks pass; details in `artifacts/extension-test-results.json` |
| Visual inspection | Desktop/mobile demo captures and native Island screenshot reviewed |

Browser scenarios cover real sample playback, pause/stop/seek, track changes/Unicode, preferences/presets/reload, drag and four-corner resize, lock/reset, Island hover/idle/keyboard/Escape, real spectrum where Web Audio exists, safe LRC import and per-track offset, failed audio request recovery, corrupt/disabled storage, mobile layout, reduced-motion setting, help dialog, download route, and accessibility scan.

Native E2E uses the actual executable, WebView2, Rust commands and authenticated loopback server. It verifies rejected unauthenticated/foreign-origin requests, source discovery, acknowledged playback commands, stale-title protection, disabled unsupported stop, separate overlay, shared selected source/imported LRC, Island expansion, and session expiry. One native Windows overlay-creation deadlock was found and fixed by creating the window from an asynchronous command.

Extension E2E loads the actual unpacked extension in Chromium. A local HTML fixture provides a YouTube Music-shaped player bar and real WAV media element. Commands cross native IPC → Rust HTTP bridge → extension worker → content script → HTML media element, with acknowledgements back. It verifies play, pause, next, previous, metadata refresh and expiry. **This is not a live youtube.com compatibility test.** Windows WASAPI loopback delivered nonzero FFT bands during this test; no audio recording was saved.

The app also successfully discovered a real existing Windows media session and retrieved synchronized lyric status in a read-only smoke check. Its playback controls were not exercised to avoid changing the user's music.

## Known limits and release gates

- macOS adapter/entitlements and build configuration exist, but no Mac build or runtime test has run. macOS system-audio spectrum capture is not implemented; the app reports that explicitly.
- Live Spotify and Apple Music on both OSes, and live YouTube Music in Chrome on both OSes, are required before calling version one complete. Fixture tests do not establish this matrix.
- Real Windows overlay dragging/resizing, click-through recovery, tray operations, multi-monitor/DPI, fullscreen/Spaces, sleep/wake and reconnect need OS-level manual acceptance. Browser geometry checks do not substitute for those checks.
- Rounded native window hit-testing, monitor-aware snap/position restoration, global shortcuts, automatic hiding, full font/spacing/shadow/radius controls, romanization and automatic artwork themes from the broader plan are still pending.
- Overlay settings, selected source and imported lyrics share local storage. The desktop **Demo samples** option previews samples in the main window; it does not broadcast demo audio playback to the separate native overlay.
- Spectrum is whole-system on Windows, explicitly opt-in. Without capture, on errors, reduced motion, or unsupported engines it uses a static indicator. WebKit's Windows test engine has no AudioContext; playback/lyrics work with a native URL audio-loader fallback. This does not establish Safari-on-macOS behavior.
- Stop is shown disabled where a source lacks native stop semantics (including YouTube Music and Spotify's macOS scripting adapter).
- No code signing/notarization, update service, clean-machine installer acceptance or public deployment completed. Download-page buttons deliberately do not claim public release availability.
- Two latest native-only refinements after the 39-test browser pass synchronize manual lyric choices between windows and allow choosing a single non-exact search result. Production build includes them; native smoke is rerun on the final binary.

## Architecture decisions

- Demo and desktop reuse React rendering, timing, preferences and LRC code. Tauri invokes Rust only in the native environment.
- Windows uses GSMTC metadata/timeline/control APIs. macOS uses allowlisted Spotify/Music automation and JSON-encoded arguments, not arbitrary shell commands.
- The implemented companion transport is authenticated **HTTP loopback**, a change from the initial native-messaging proposal. It binds only `127.0.0.1`, uses an ephemeral token, checks Origin, limits input and expiry, and waits for command acknowledgement. Packaging native messaging remains an optional future replacement.
- Lyrics use LRCLIB exact lookup then candidate search; exact normalized title/artist and duration are required for automatic choice. Users can select a candidate or import LRC/TXT. Provider availability/coverage does not guarantee a correct lyric version.
- CI jobs exist for Windows browser checks and Windows/macOS Rust checks. Their presence is not evidence of a remote CI run.
