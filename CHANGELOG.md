# Changelog

## 0.1.0-alpha.1 — 2026-10-05

First public alpha. Expect rough edges; settings may be reset between alpha builds.

### Added
- Floating lyrics overlay: transparent, always on top, click-through. Hovering the lyrics fades them out so you can keep working behind them.
- Smooth line transitions with a staggered ease and soft blur on inactive lines; 1, 2 or 3 visible lines.
- In-place customization with **Shift+C**: drag, resize from the corners, scroll to change font size, and a toolbar for color, font, size/weight, lines/alignment/style, background opacity and song info.
- Song info (artwork, title, artist, album) at the bottom right, or lyrics only.
- Focus Island pinned to the top center: artwork and spectrum when compact, title and playback controls on hover.
- Focus mode with **Shift+F**: nothing on screen until the track changes, then a short pill slides in and out.
- The lyric window returns to its last position and size after using the island.
- Desktop sources: Windows media sessions (GSMTC), macOS Spotify/Music automation, YouTube Music through a Chrome companion extension. Lyrics from LRCLIB, or import your own LRC/TXT with per-track timing offset.
- Optional Windows system-audio spectrum (analyzed locally, never recorded).
- Interactive web demo with original sample audio.

### Known limitations
- **Shift+C and Shift+F are global shortcuts**: while the app runs, uppercase C and F cannot be typed in other apps.
- Installers are unsigned. Windows SmartScreen and macOS Gatekeeper will warn on first launch.
- macOS builds are produced by CI but have not been tested on a real Mac yet.
- The full player × OS compatibility matrix is still being validated; see `docs/VALIDATION.md`.
