# Implementation Plan — Floating Lyrics Desktop

Tanggal: 5 Oktober 2026  
Status: prototype demo dan native Windows telah diimplementasikan dan diuji; rilis lintas platform belum selesai. Lihat [README](README.md) dan [bukti pengujian serta batasannya](docs/VALIDATION.md).  
Target: aplikasi desktop Windows dan macOS yang sederhana, akurat mengikuti lagu, dan mudah dikustomisasi, dengan mode Focus Island serta demo web interaktif untuk mencoba sebelum download.

## 1. Arah produk

Pengguna memutar musik di aplikasi yang didukung, membuka Floating Lyrics, lalu melihat lirik mengikuti lagu di atas aplikasi lain. Pengguna dapat memindahkan overlay, mengubah ukuran dari keempat sudut, mengatur tampilannya, dan mengunci overlay agar klik diteruskan ke aplikasi di belakangnya.

Referensi fungsional: [Floating Lyrics by Necra](https://necra.itch.io/floating-lyrics). Halaman tersebut menyebut synced lyrics, romanization, dynamic theme, always-on-top, click-through, auto-hide, dan pengaturan posisi/lebar/font. Produk referensi saat ini tercantum untuk Windows. Daftar tersebut merupakan klaim halaman produk; interoperabilitasnya belum diuji. Desain dan aset aplikasi baru dibuat sendiri.

Referensi tambahan yang diminta pengguna: [halaman demo/download](https://floating-lyrics.vercel.app/download). HTML, CSS, dan JavaScript publik berhasil dibaca pada 5 Oktober 2026, meskipun alat web utama gagal mengaksesnya. Temuan berbasis source: area preview lirik dan informasi lagu, mini-player draggable dengan play/pause/prev/next/volume, progress playback, playlist sembilan contoh, kontrol ukuran/weight font serta posisi/display mode, latar mengikuti artwork, kartu fitur, layout mobile khusus, dan tombol download menuju itch.io. Sample player memakai audio browser serta renderer lirik bersama; halaman menonaktifkan pembaruan now-playing melalui WebSocket. Ini demo berbasis sampel, bukan bukti pembacaan player desktop dari browser. Tampilan hasil render, kualitas audio, dan interaksi runtime belum diuji langsung. Rujukan pemeriksaan: [sample player](https://floating-lyrics.vercel.app/download/download-songs.js), [interaksi halaman](https://floating-lyrics.vercel.app/download/download-tour.js), dan [layout](https://floating-lyrics.vercel.app/download/download-tour.css).

Asumsi kerja dan cakupan yang dikonfirmasi:

- Cakupan yang dikonfirmasi pengguna: **Spotify desktop, Apple Music/Music desktop, dan YouTube Music browser wajib sejak versi pertama di kedua OS**. Metode integrasi dapat berbeda per OS; dukungan tidak boleh hanya berupa deteksi judul tanpa sinkronisasi.
- Kebutuhan tambahan yang dikonfirmasi pengguna: **tersedia demo web interaktif seperti referensi**. Demo dan halaman download masuk deliverable rilis pertama; prototype demo dibuat lebih awal untuk menilai interaksi sebelum integrasi desktop selesai.
- Kebutuhan tambahan yang dikonfirmasi pengguna: **mode Focus Island terinspirasi bentuk Dynamic Island iPhone** untuk fokus bekerja. Saat idle tampil artwork single/album dan spektrum; saat hover tampil judul lagu serta kontrol playback. Mode ini masuk aplikasi dan demo versi pertama.
- Browser baseline YouTube Music: Google Chrome pada Windows dan macOS. Edge/Safari/Firefox menjadi perluasan setelah baseline; pemilihan Chrome adalah asumsi teknis awal yang harus dinyatakan dalam dokumentasi dukungan.
- “Draggable pada tiap sudut” berarti resize melalui empat sudut jendela, drag untuk pindah posisi, serta preset penempatan di empat sudut layar.
- Akurasi berarti lagu/versi yang tepat dan sinkronisasi per baris; bukan transkripsi suara langsung.
- Tanpa akun aplikasi baru. Pengaturan dan cache disimpan lokal. Jaringan dipakai untuk pencarian lirik dan fitur online yang diaktifkan.
- Distribusi awal berupa installer langsung. Target pengujian awal Windows 11 x64 dan macOS 13+ Apple Silicon/Intel; versi minimum final ditetapkan setelah spike dan verifikasi dependensi. Windows ARM dan Linux di luar versi awal.
- Dokumen ini berbahasa Indonesia; bahasa antarmuka dapat diputuskan ketika membuat prototype.

## 2. Pengalaman pengguna dan cakupan

### Wajib pada MVP

| Area | Perilaku yang direncanakan |
| --- | --- |
| Overlay | Jendela tanpa frame, selalu di atas jendela biasa, latar transparan atau panel solid/translusen |
| Move & resize | Drag area kosong/header; resize NW, NE, SW, SE dan tepi; cursor sesuai arah; batas ukuran minimum |
| Penempatan | Snap opsional ke tepi/sudut, pindah monitor, reset posisi; posisi dan ukuran diingat |
| Mode Edit | Border, handle sudut, tombol pengaturan, dan preview terlihat; click-through mati |
| Mode Terkunci | Handle hilang; posisi tidak berubah; click-through dapat dinyalakan |
| Focus Island | Pill ringkas berisi artwork + spektrum saat idle; hover/fokus/klik membuka judul, artis, previous, next/skip, play/pause, stop; kembali ringkas setelah interaksi berakhir |
| Pemulihan kontrol | Tray/menu bar selalu menyediakan Unlock, Settings, Show/Hide, Reset Position, Quit; shortcut global opsional dan bisa diubah |
| Lirik | Mode 1 baris, 2 baris, atau 3 baris; baris aktif jelas; baris berikutnya lebih redup; wrap tanpa memotong karakter |
| Deteksi lagu | Judul, artis, album jika tersedia, durasi, posisi, status playback; pilihan sumber manual saat beberapa player aktif |
| Sumber MVP | Spotify desktop, Apple Music/Music desktop, YouTube Music di Chrome; extension pendamping disertakan bila dibutuhkan untuk timeline yang akurat |
| Sinkronisasi | Mengikuti play/pause, seek, ganti lagu, repeat, pergantian sumber, dan sleep/wake |
| Koreksi | Cari/pilih versi lirik, impor LRC/TXT lokal, offset per lagu dengan langkah 100 ms dan reset |
| Kustomisasi | Font, ukuran, weight, warna aktif/nonaktif, alignment, jarak baris, outline/shadow, opacity latar, padding, radius |
| Preset | Minimal, Subtitle, dan Card; simpan preset pengguna, live preview, reset default |
| Status | Menunggu lagu, mencari lirik, instrumental, lirik tidak tersedia, offline, izin ditolak, sumber tidak didukung |
| Persistensi | Simpan preset, bounds, sumber pilihan, offset, serta pilihan versi lirik; tahan terhadap file pengaturan rusak |
| Demo web & download | Coba sample audio/lirik, drag/resize, dan kustomisasi tanpa instalasi; pilihan installer Windows/macOS dan informasi kompatibilitas |

Default rancangan: overlay sekitar 560 × 150 logical px, minimal 260 × 80, ditempatkan di tengah bawah dengan margin 32 px dari work area. Dua baris, font sistem sekitar 28 px, latar gelap translusen, teks terang dengan outline. Nilai ini adalah titik awal prototype, bukan batas yang sudah teruji. Ukuran font tidak ikut berubah otomatis saat jendela di-resize; teks melakukan wrap dan layout disesuaikan.

Alur pertama: jalankan aplikasi → tampilkan overlay contoh dalam mode Edit → deteksi player atau pilih sumber → minta izin OS hanya saat diperlukan → tampilkan lirik → pengguna mengatur posisi/tampilan → Lock. Tutorial singkat menjelaskan cara membuka kembali lewat tray/menu bar sebelum click-through pertama kali aktif.

Settings menggunakan empat kelompok: Tampilan, Posisi & Perilaku, Sumber Musik & Lirik, dan Shortcut. Sediakan input posisi/ukuran dan preset lokasi agar drag bukan satu-satunya cara pengaturan. Semua kontrol memiliki label, fokus keyboard terlihat, serta dukungan reduced motion. Preset bawaan menargetkan kontras teks 4.5:1; karena wallpaper bebas berubah, sediakan panel solid/outline untuk keterbacaan. Jangan mengirim setiap pergantian baris sebagai pengumuman screen reader secara default.

### Focus Island — mode fokus bekerja, wajib versi pertama

Sediakan pilihan **Lyrics / Focus Island** di settings dan tray/menu bar. Focus Island menggantikan overlay lirik dengan pill kecil berujung bulat; tidak menampilkan dua overlay yang saling berebut fokus. Posisi dan ukuran tiap mode disimpan terpisah. Lirik tetap disiapkan di belakang layar agar kembali ke mode Lyrics tidak memulai pencarian dari awal.

| State | Tampilan dan perilaku |
| --- | --- |
| Compact / playing | Hanya artwork single/album di kiri dan 5–7 bar spektrum di kanan; tanpa judul, lirik, marquee, atau tombol permanen |
| Expanded | Artwork, judul dan artis, tombol Previous, Next/Skip, Play/Pause, Stop; akses kembali ke Lyrics/settings; judul panjang dibatasi dengan akses teks lengkap saat fokus |
| Compact / paused atau stopped | Artwork tetap terlihat; spektrum berhenti/merata; status pause/stop disampaikan lewat accessible label dan ketika expanded |
| Tidak ada player/lagu | Artwork placeholder dengan bar statis; expanded menjelaskan kondisi dan pilihan sumber; tidak mengarang data lagu |
| Edit posisi/ukuran | Pill tetap expanded, handle empat sudut/tepi terlihat; auto-collapse ditahan hingga drag/resize selesai |

Dimensi awal prototype: compact sekitar 160 × 48 logical px, expanded sekitar 360 × 136. Preset Small/Medium/Large; resize manual dalam mode Edit memiliki batas minimum dan menjaga artwork tidak terdistorsi. Simpan ukuran compact dan expanded masing-masing. Default posisi tengah atas dalam work area dengan margin 12 px; tetap bisa dipindahkan ke tepi/sudut lain. Perhitungkan menu bar, taskbar, safe area/notch dan monitor berbeda DPI; tidak menimpa area kamera/menu sistem. Ukuran ini usulan, divalidasi saat prototype.

Aturan intent/interaksi:

1. Hover stabil sekitar 150 ms membuka Island, menghindari ekspansi ketika pointer hanya melintas. Klik/tap atau fokus keyboard membuka langsung. “Intent” ditentukan oleh event lokal tersebut, bukan pemantauan aktivitas kerja pengguna.
2. Pertahankan expanded selama pointer berada di pill/panel, fokus keyboard berada pada kontrol, pointer sedang ditekan/drag, menu terbuka, atau perintah playback masih pending.
3. Mulai timer collapse setelah seluruh kondisi tersebut berakhir. Default 2 detik; pilihan 0,5/1/2/3/5 detik. Timer dibatalkan bila ada interaksi baru. Hover tanpa bergerak tetap dianggap interaksi.
4. Escape menutup menu terlebih dahulu, lalu collapse dan mengembalikan fokus ke pemicu ringkas. Klik di luar menutup bila tidak ada operasi drag/pending. Collapse tidak boleh menyembunyikan kontrol yang sedang memiliki fokus keyboard.
5. Pergantian lagu saat compact memperbarui artwork/spektrum tanpa membuka panel, membunyikan notifikasi, atau mencuri fokus dari aplikasi kerja.
6. Animasi buka/tutup sekitar 180–240 ms, halus dan dapat dibalik saat hover cepat; reduced motion memakai pergantian singkat tanpa morph. Anchor posisi tetap agar pembesaran tidak menggeser pill secara mengejutkan atau memicu hover keluar-masuk berulang.

**Hit testing dan click-through:** mode Lock pada Island berarti posisi terkunci, tetapi pill tetap menerima hover/klik. Jangan menerapkan ignore-cursor pada seluruh Island yang harus responsif terhadap hover. Click-through penuh tetap pilihan overlay Lyrics; memasuki Island menyimpan preferensi itu dan mengaktifkan interaksi pada pill. Area di luar pill/panel harus meneruskan input, termasuk sudut transparan dan bekas ruang expanded. Buktikan native hit region atau window bounds yang sesuai pada kedua OS di spike; CSS pointer-events saja bukan bukti click-through ke aplikasi lain. Tray/menu bar dan shortcut tetap menyediakan Show/Hide, pindah mode, serta Reset.

**Makna kontrol playback:** Next dan Skip berarti pindah ke lagu berikutnya; tidak dibuat sebagai dua tombol duplikat. Previous disediakan sebagai pasangan. Pause menahan posisi; Play melanjutkan. Stop mencoba menghentikan session pada player, bukan menutup app atau sekadar menyembunyikan Island. Jika adapter hanya mendukung pause + seek ke awal, tampilkan aksi terpisah berlabel “Jeda & kembali ke awal”; jangan menyamarkannya sebagai native Stop. Bila stop tidak didukung, tombol Stop disabled dengan alasan yang dapat dibaca. Matriks dukungan harus menyatakan batas ini dan menyelesaikan gap pada spike; kelengkapan Stop pada ketiga sumber belum dianggap terbukti.

Perintah dikirim hanya ke `sourceId/sessionId` yang terlihat di Island. Sertakan requestId dan snapshot generation, abaikan balasan session lama, cegah klik berulang saat pending, serta tunjukkan kegagalan/timeout tanpa mengubah state sukses secara palsu. Setelah command, konfirmasi dengan snapshot aktual. Pause/next/stop dari Island dan kontrol asli player harus menghasilkan state yang sama. Jangan mengirim media key global yang berpotensi mengendalikan player lain.

**Spektrum:** targetnya visualisasi frekuensi dari audio aktual, bukan bar acak. Sample audio → FFT → ringkasan 5–7 band dengan smoothing → renderer maksimal sekitar 20–30 fps. Hentikan capture/animasi ketika tidak diperlukan, paused, stopped, atau Island disembunyikan; reduced motion menyediakan bar statis. Tidak memakai mikrofon. Audio dianalisis sementara di memori, tidak disimpan atau diunggah.

Kandidat Windows adalah capture loopback berbasis WASAPI; upayakan isolasi proses player. Kandidat macOS adalah capture audio dengan ScreenCaptureKit; cek dukungan OS, pemilihan aplikasi dan izin pada mesin asli. Ini memerlukan jalur terpisah dari metadata/timeline. Bila hanya seluruh system output yang dapat diambil, pengguna harus memilihnya secara eksplisit dan UI menyebut “Audio sistem”, karena suara aplikasi lain dapat ikut terukur. Sumber teknis: [Microsoft loopback recording](https://learn.microsoft.com/en-us/windows/win32/coreaudio/loopback-recording), [Microsoft process loopback sample](https://github.com/microsoft/Windows-classic-samples/blob/main/Samples/ApplicationLoopback/README.md), [Apple ScreenCaptureKit](https://developer.apple.com/documentation/screencapturekit).

Saat izin ditolak, audio terlindungi/tidak tersedia, output device berubah, atau isolasi player gagal: tampilkan indikator statis serta penjelasan pada expanded/settings. Jangan mengganti dengan spektrum palsu tanpa label. Fallback menjaga kontrol tetap berguna, tetapi bukan bukti bahwa gate spektrum aktual lulus. Perubahan ke animasi dekoratif sebagai baseline membutuhkan keputusan cakupan tersendiri. Mode spektrum asli dapat dimatikan tanpa kehilangan Island atau lirik.

Kriteria penerimaan Island:

- Compact menampilkan artwork + bar saja; expand/collapse, fokus keyboard, Escape, touch, Edit, pergantian lagu, dan pointer melintas sesuai aturan di atas.
- Tidak collapse saat tombol digunakan, menu terbuka, atau fokus keyboard masih di dalam; tidak mencuri fokus aplikasi kerja saat hover.
- Area di luar pill/expanded panel meneruskan input ke aplikasi di belakang pada Windows dan macOS; uji area yang baru saja ditinggalkan saat collapse.
- Previous/Next/Play/Pause/Stop diuji per sumber dan OS, termasuk unsupported/timeout/pergantian session; tidak mengendalikan sumber yang salah. Gap Stop diselesaikan atau dicatat sebagai keputusan cakupan sebelum klaim rilis.
- Audio sine/silence fixture menghasilkan respons band yang benar; pause menghentikan bar; spektrum tidak tetap bergerak saat audio tidak tersedia. Verifikasi capture aktual untuk tiga sumber, izin ditolak/dicabut, headphone/Bluetooth berganti, dan suara aplikasi lain.
- Ukur tambahan CPU/memori saat spektrum aktif; target resource produk tetap berlaku sampai hasil profiling mendasari revisi. Capture otomatis berhenti saat fitur nonaktif.

### Setelah MVP

- Tema mengikuti artwork, dengan pengaman kontras dan opsi menonaktifkannya.
- Romanisasi Jepang/Korea/Mandarin sebagai baris tambahan; selalu bisa kembali ke teks asli dan tandai bahwa hasil dapat kurang tepat.
- Auto-hide dengan delay yang dapat diatur; bedakan pause singkat, player tertutup, dan instrumental.
- Ekspor/impor preset dan signed auto-update.
- Word-by-word highlight hanya bila tersedia timestamp per kata; LRC per baris tidak dijanjikan sebagai karaoke per kata.

Di luar versi awal: pemutar musik umum, unduhan audio, pengenalan lagu melalui mikrofon, transkripsi AI, terjemahan otomatis, sinkronisasi akun/cloud, dan dukungan universal semua aplikasi. Mini-player untuk audio contoh pada demo web termasuk cakupan, terbatas untuk mendemonstrasikan produk.

### Demo web interaktif dan halaman download — wajib rilis pertama

Tujuan: pengguna memahami bentuk overlay dan mencoba pengaturannya dalam sekitar satu menit tanpa memasang aplikasi atau menghubungkan akun musik. Ambil pola pengalaman referensi; jangan menyalin branding, source code, artwork, atau audio/liriknya.

Alur: buka `/download` → klik Coba demo/Play → dengarkan sample dan lihat baris lirik mengikuti audio → geser/resize overlay → ubah preset/tampilan → pilih installer. `/demo` menyediakan playground yang sama dalam area lebih luas. Komponen dan state demo dipakai bersama pada kedua route agar perilakunya konsisten.

| Bagian | Spesifikasi demo kita |
| --- | --- |
| Desktop playground | Kanvas menyerupai ruang desktop dengan pilihan latar terang/gelap; overlay dibatasi dalam kanvas; preset posisi Windows/macOS berupa ilustrasi buatan sendiri |
| Audio contoh | Minimal tiga klip 30–60 detik beserta artwork dan LRC yang dibuat sendiri atau berizin untuk web; contoh teks panjang dan non-Latin; tanpa mengambil aset referensi |
| Playback | Play/pause, previous/next, pemilih sample, seek slider, waktu/durasi, volume/mute; audio mulai setelah aksi pengguna |
| Lirik | Highlight per baris mengikuti `audio.currentTime`; pause/seek dan pergantian sample memindahkan baris dengan benar; tidak memakai timer bebas sebagai posisi audio |
| Drag & resize | Geser overlay, resize keempat sudut dan tepi, snap opsional, batas minimum, reset posisi; mini-player boleh digeser di desktop tetapi tetap mudah dijangkau |
| Kustomisasi langsung | Preset Minimal/Subtitle/Card, font/size/weight, warna, latar/opacity, alignment, jumlah baris, outline/shadow, offset; perubahan terlihat tanpa reload |
| Edit/Lock | Simulasi click-through hanya di kanvas; kontrol Unlock/Reset permanen di luar overlay agar demo tidak terkunci |
| Focus Island | Toggle Lyrics/Island, compact artwork + spektrum, hover/tap/fokus untuk expanded, auto-collapse, previous/next/play/pause/stop; seluruhnya mengendalikan sample demo |
| Konten produk | Penjelasan ringkas, matriks dukungan tiga sumber di kedua OS, cara instalasi, dan batas demo; hanya fitur yang sudah tersedia dipromosikan sebagai siap pakai |
| Download | Pilihan Windows x64, macOS Apple Silicon/Intel sesuai artefak; rekomendasi OS tidak menyembunyikan pilihan lainnya; tampilkan versi, minimum OS, ukuran, release notes dan checksum |
| Mobile | Preview dan kontrol disusun vertikal; pointer/touch pada handle tidak menghalangi scroll halaman; posisi/ukuran bisa diatur lewat input/preset; CTA menjelaskan aplikasi untuk desktop |

Teks produk yang perlu terlihat: “Demo dengan lagu contoh. Instal aplikasi untuk mengikuti musik dari Spotify, Apple Music, dan YouTube Music.” Browser demo tidak menjanjikan overlay di atas aplikasi lain, click-through tingkat OS, tray, atau global shortcut. Simulasi native diberi label dan link ke penjelasan perilaku desktop.

Tema otomatis dan romanisasi tetap setelah MVP; demo awal tidak menampilkan keduanya sebagai kemampuan produksi. Contoh non-Latin menguji rendering teks asli. Jika nanti ada preview fitur mendatang, beri label eksplisit dan pisahkan dari daftar fitur yang tersedia untuk download.

Spektrum Island pada demo dihitung dari audio contoh melalui audio analyser browser; tidak memerlukan capture audio sistem. Stop demo melakukan pause dan reset posisi sample ke awal, dengan penjelasan bahwa dukungan Stop desktop mengikuti player. Prototype awal boleh memakai fixture spektrum berlabel simulasi, tetapi gate demo rilis memakai data audio aktual. Sertakan skenario demo sumber tidak mendukung Stop/audio tidak tersedia agar pengguna memahami kondisi fallback. Shared Island renderer menerima spectrum bands dari adapter, tanpa mengasumsikan browser dan desktop punya sumber audio yang sama.

Keandalan demo: audio gagal memuat menampilkan Retry/pilih sample lain; pergantian sample membatalkan respons lama; pindah route menghentikan audio lama; tab background kembali selaras dengan posisi audio; bila storage tidak tersedia, kontrol tetap berfungsi dalam memori. Simpan hanya preferensi demo di storage browser, dengan namespace/schema terpisah dari aplikasi desktop dan tombol Reset demo. Sample tidak perlu lookup provider atau login sehingga demo tetap dapat dipakai saat provider lirik bermasalah.

Kriteria penerimaan khusus:

- Play/pause, seek, next/previous, volume, drag, keempat handle resize, Edit/Lock/Unlock, preset, dan reset berjalan pada Chrome, Edge, Firefox, dan Safari versi stabil yang dicatat saat pengujian.
- Ada uji keyboard untuk kontrol playback, settings, posisi/ukuran, fokus terlihat, reduced motion, serta layout 360 px sampai desktop tanpa kontrol terpotong.
- Lirik contoh yang diketahui timestamp-nya benar memenuhi target p95 error terhadap audio ≤150 ms pada tab aktif; sesudah seek baris pulih ≤300 ms setelah event seek selesai.
- Konten awal dapat digunakan sebelum seluruh sample selesai diunduh; audio dimuat saat dipilih, artwork dikompresi, dan animasi dihentikan ketika tidak diperlukan. Target awal shell JavaScript demo ≤250 KB gzip, aset media dihitung terpisah; verifikasi melalui production build.
- Tautan installer berasal dari manifest rilis tervalidasi. Sebelum artefak tersedia, tombol menyatakan Belum tersedia; tidak ada tombol download palsu atau link ke installer produk referensi.
- Smoke test sebelum publikasi memastikan route langsung/reload berfungsi, semua aset demo dapat dimuat, dan installer cocok dengan label OS/arsitektur/versinya.

## 3. Keputusan teknis yang diusulkan

Rekomendasi awal: **Tauri 2 + Rust + React/TypeScript**. Ini usulan stack untuk workspace baru, belum keputusan yang dibuktikan benchmark. Rust menangani state playback, integrasi OS, penyimpanan, dan pencarian lirik; React menangani overlay dan settings. Gunakan CSS variables untuk tema, JSON berversi untuk settings, serta SQLite untuk cache dan pemetaan lagu. Tidak perlu backend sendiri pada MVP.

Pisahkan dua window: overlay dan settings. Menutup settings tidak menghentikan overlay; Quit melalui tray/menu bar menghentikan proses. Aktivitas overlay tidak mengambil fokus saat pengguna bekerja di aplikasi lain.

Tambahan untuk demo: pisahkan `apps/desktop`, `apps/web`, `packages/lyrics-ui`, `packages/contracts`, dan `packages/demo-fixtures`. Web memakai React/TypeScript dengan Vite sebagai kandidat build statis. Bagikan renderer lirik, komponen settings, design tokens, dan schema preferences; jangan mengimpor Tauri/native API dari komponen bersama. Native window controller dan DOM playground controller memakai interface terpisah. Demo audio adapter menghasilkan snapshot dengan kontrak yang sama seperti desktop. Mesin Rust dan adapter browser diverifikasi memakai fixture timing bersama agar demo tidak mengesankan perilaku yang berbeda dari produk.

Hosting demo berupa static hosting/CDN; provider belum dikunci. Tidak perlu backend baru untuk sample player. Rilis web memakai preview build sebelum publikasi, dan manifest download berversi menunjuk artefak desktop yang sudah diverifikasi. Demo web tidak membutuhkan extension; extension YouTube Music, jika diperlukan, khusus menghubungkan player browser ke aplikasi desktop.

Tauri menyediakan operasi drag, resize, dan pengabaian cursor events; izin capability perlu diberikan hanya untuk operasi yang dipakai. Perilaku nyata tetap diuji di kedua OS. [Tauri Window API](https://v2.tauri.app/reference/javascript/api/namespacewindow/)

Transparansi macOS pada jalur Tauri yang didokumentasikan memerlukan konfigurasi private API, yang tidak cocok untuk distribusi Mac App Store. Baseline rencana adalah distribusi langsung; spike harus membandingkan jalur ini dengan overlay native AppKit bila kompatibilitas menuntutnya. Jika Mac App Store menjadi kebutuhan, tinjau ulang sebelum mengunci arsitektur. [Tauri configuration](https://v2.tauri.app/reference/config/)

### Komponen dan alur data

```text
Windows media adapter / macOS player adapters / YouTube Music browser adapter
    -> PlaybackSnapshot + pemilihan sumber aktif
    -> Pencocokan lagu -> cache -> penyedia lirik
    -> Parser timestamp + mesin sinkronisasi
    -> Overlay renderer

Settings + tray/menu bar -> window controller + preferences
Pilihan lirik + offset per lagu -> penyimpanan lokal
```

Kontrak `PlaybackSnapshot`: sourceId, sessionId, trackId bila tersedia, title, artist, album, artwork, durationMs, positionMs, playbackRate, playbackState, sampledAtMonotonic, dan capability flags. Capability harus membedakan metadata-only, timeline tersedia, dan timeline tidak andal. Identitas lagu tidak boleh hanya berdasarkan judul.

Tambahkan `PlaybackCommandAdapter` dengan kemampuan previous/next/play/pause/stop/seek yang dilaporkan per session, dan `SpectrumAdapter` dengan availability, captureScope, sourceId, timestamp serta band amplitudes. Pada Windows, media-session API menyediakan metode untuk mencoba mengirim next/stop; hasilnya tetap harus dicek. [Microsoft media-session commands](https://microsoft.github.io/windows-docs-rs/doc/windows/Media/Control/struct.GlobalSystemMediaTransportControlsSession.html). Implementasi macOS dan browser companion harus menguji perintah yang tersedia pada masing-masing player. State machine Island serta renderer dibagi dengan web; perintah desktop tetap melalui adapter native, sementara demo mengendalikan audio contoh.

### Strategi integrasi player

| Sumber | Windows | macOS | Gate sebelum dinyatakan didukung |
| --- | --- | --- | --- |
| Spotify desktop | Uji Windows Global System Media Transport Controls (GSMTC) | Uji dictionary automation player melalui Apple Events/Scripting Bridge | Metadata, posisi, pause/seek, pindah track stabil pada versi player yang dicatat |
| Apple Music/Music desktop | Uji apakah aplikasi mengekspos metadata dan timeline GSMTC | Uji automation Music app dan izin pengguna | Lagu streaming dan lokal; versi lagu/durasi tidak tertukar |
| YouTube Music di Chrome | Uji media session OS; gunakan extension jika timeline tidak memadai | Buktikan browser adapter/extension | Timeline setelah seek, iklan, beberapa tab, pergantian track; wajib lulus sebelum MVP rilis |

Microsoft mendokumentasikan API pengambilan timeline session media Windows. Itu menjadi kandidat sumber posisi, bukan bukti bahwa semua player mempublikasikan timeline lengkap. [Microsoft GetTimelineProperties](https://learn.microsoft.com/en-us/uwp/api/windows.media.control.globalsystemmediatransportcontrolssession.gettimelineproperties)

Scripting Bridge mendukung komunikasi dengan aplikasi yang scriptable; kelengkapan data bergantung pada dictionary masing-masing aplikasi. Karena itu dukungan Spotify/Music macOS masih berupa hipotesis integrasi yang wajib dibuktikan. Jangan mengandalkan pembacaan universal melalui private MediaRemote sebagai fondasi MVP. [Apple Scripting Bridge guide](https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/ScriptingBridgeConcepts/Introduction/Introduction.html)

Untuk automation macOS, rencanakan penjelasan izin dan entitlement yang sesuai; penolakan izin harus menghasilkan panduan pemulihan tanpa prompt berulang. [Apple automation entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.automation.apple-events)

Jika browser extension diperlukan: permission hanya untuk domain player yang didukung, kirim metadata/timeline minimum melalui native messaging dengan pemeriksaan identitas extension. Rancangan dan dokumentasi browser API diverifikasi pada fase tersebut. Tidak membaca semua tab atau riwayat browsing. Sertakan deteksi extension terpasang/terhubung, panduan pemasangan, reconnect, dan penanganan extension dinonaktifkan. Jika sumber sementara tidak menyediakan timeline, tampilkan lirik statis dengan status yang jujur; fallback ini tidak memenuhi gate dukungan tersinkron untuk tiga sumber wajib. Distribusi extension dan registrasi native messaging host termasuk pekerjaan installer MVP; waktu review toko extension menjadi dependensi eksternal.

## 4. Akurasi pencarian dan sinkronisasi

### Pencarian lirik

1. Periksa pilihan lirik/import pengguna dan cache untuk identitas lagu serta versi yang sama.
2. Normalisasi spasi, Unicode, dan tanda baca judul/artis secara konservatif. Pertahankan pembeda live, acoustic, remix, remaster, dan clean/explicit dalam scoring.
3. Cari kecocokan metadata lengkap, termasuk durasi dan album bila tersedia. LRCLIB menjadi kandidat provider awal; dokumentasinya menyediakan plain/synced lyrics dan pencocokan durasi. [LRCLIB docs](https://lrclib.net/docs)
4. Bila tidak ada kecocokan kuat, cari kandidat dan hitung confidence berdasarkan artis, judul, versi, album, dan selisih durasi. Ambang ditentukan dari dataset uji, bukan angka tebakan permanen.
5. Jangan otomatis memilih hasil meragukan. Tampilkan pilihan kandidat beserta versi dan durasinya.
6. Fallback berurutan: synced lyrics → plain lyrics berlabel tidak tersinkron → impor manual → status tidak tersedia. Instrumental tidak diperlakukan sebagai network error.

Gunakan provider interface agar penyedia bisa diganti. Terapkan timeout, backoff, cancellation, pembatasan concurrency, dan negative-cache singkat. Respons lagu sebelumnya tidak boleh menimpa track yang sedang aktif. Verifikasi syarat penggunaan, caching, dan atribusi provider sebelum distribusi; ketersediaan API tidak berarti hak redistribusi semua lirik sudah terpenuhi. Data lirik diperlakukan sebagai teks, bukan HTML.

### Sinkronisasi

- Parse LRC dengan timestamp jamak, Unicode, baris kosong, timestamp duplikat, dan offset metadata; simpan waktu dalam milidetik.
- Hitung posisi dari sample playback terakhir dan monotonic clock saat playing, dengan playbackRate; berhenti saat pause. Jangan mengandalkan timer bertambah tanpa koreksi.
- Pada event baru, koreksi terhadap posisi player; setelah seek/lompatan besar, pilih ulang baris aktif langsung. Jika hanya polling tersedia, tentukan interval berdasarkan pengukuran freshness dan CPU.
- Untuk offset pengguna, definisi eksplisit: nilai positif menampilkan lirik lebih awal (`lyricTime = playerTime + offset`). Simpan per identitas versi lagu; pisahkan offset file LRC agar tidak diterapkan dua kali.
- Buang snapshot lama saat ganti track/sumber. Setelah sleep/wake ambil snapshot baru sebelum melanjutkan interpolasi.
- Jika posisi stale atau tidak andal, berhenti mengklaim sinkronisasi otomatis dan tampilkan kondisi tersebut.

Bedakan tiga ukuran: ketepatan versi lagu, cakupan ketersediaan lirik, dan error timing renderer. Timestamp provider yang salah tidak dapat disembuhkan oleh renderer saja. Tidak menjanjikan lirik akurat 100% untuk semua katalog.

## 5. Iteration plan dan exit gates

### Progress implementasi 5 Oktober 2026

- **1D prototype demo:** tersedia dan lolos 51 skenario browser (17 × Chromium/Firefox/WebKit), termasuk audio nyata, caption bawaan dengan lirik bergulir/blur, sinkronisasi fixture, empat sudut, Island dan aksesibilitas dasar.
- **0/0I/1:** jalur Windows, dua window, tray, GSMTC, loopback companion, dan WASAPI/FFT sudah dibangun. Native smoke dan extension fixture E2E lolos. Gate macOS, multi-monitor dan OS hit testing belum terpenuhi.
- **2/3:** adapter, LRCLIB, parser, impor dan offset tersedia. Fixture sinkronisasi lolos; matriks tiga layanan × dua OS dan pengukuran drift live masih terbuka.
- **3I/4:** compact/expanded Island, kontrol sesuai capability, pengaturan visual dasar, persistensi dan reduced motion tersedia. Capture macOS dan kustomisasi lanjutan belum selesai.
- **4D/5:** halaman demo/download dan workflow CI tersedia. Artefak lokal tidak sama dengan rilis publik; signing/notarization, install/uninstall bersih dan seluruh gate kompatibilitas masih diperlukan.

Cakupan tiga sumber di kedua OS tetap wajib; status di atas bukan pengurangan cakupan. Bukti yang benar-benar dijalankan dan detail keterbatasan ada di [VALIDATION.md](docs/VALIDATION.md).

### Estimasi dan gate awal

Estimasi kerja satu developer berpengalaman dengan akses Windows dan Mac: **sekitar 11–17 minggu untuk MVP dengan ketiga sumber, Focus Island dan spektrum aktual, serta demo web/download**. Baseline desktop 8–12 minggu; demo menambah sekitar 5–9 hari, dan Island/command adapters/audio capture sekitar 8–15 hari termasuk spike tambahan. Ini bukan komitmen tanggal dan dikalibrasi ulang setelah Iteration 0. Waktu tunggu sertifikat, review toko extension, atau pengadaan aset sample berizin di luar estimasi kerja aktif.

| Iteration | Estimasi | Deliverables | Exit gate |
| --- | --- | --- | --- |
| 0 — Pembuktian teknis | 5–7 hari | Prototype overlay kedua OS; uji tiga sumber termasuk browser; matriks capability; keputusan stack/distribusi; baseline resource | Drag, resize empat sudut, always-on-top, click-through + unlock bekerja pada kedua OS; bukti jalur metadata dan timeline untuk ketiga sumber pada kedua OS; gap teknis diselesaikan atau jadwal direvisi sebelum implementasi penuh |
| 0I — Pembuktian Island/audio | 2–4 hari | Hit region pill, hover tanpa mencuri fokus, command capability per player, capture/FFT aktual Windows/macOS | Jalur capture dan izin terbukti; scope audio diketahui; next/pause/stop diuji; gap fungsi atau kompatibilitas diselesaikan sebelum klaim dukungan |
| 1 — Fondasi & interaksi | 4–6 hari | Struktur app, dua window, tray/menu bar, Edit/Lock, bounds, multi-monitor, settings dasar, CI build kedua OS | Tidak kehilangan akses overlay; reset posisi berhasil setelah monitor dilepas; settings pulih setelah restart; keyboard dapat mengatur posisi/ukuran |
| 1D — Prototype demo web | 3–5 hari | Renderer bersama, sample berizin, mini-player, playground drag/resize, preview settings, route `/demo` dan `/download` awal | Demo bisa dicoba tanpa desktop/login; pause/seek sinkron; resize empat sudut dan Unlock/Reset berfungsi; build preview dapat direview |
| 2 — Lagu & lirik | 10–15 hari | Adapter Spotify/Music, YouTube Music + extension jika perlu, pemilihan sumber, provider interface, cache, matching, parser, impor LRC/TXT, state gagal | Ketiga sumber pada kedua OS lulus matriks deteksi dan timeline; browser reconnect/iklan/multitab lulus; salah versi tidak dipilih paksa; offline-cache dan pergantian track cepat tidak menampilkan hasil usang |
| 3 — Sinkronisasi | 4–6 hari | Playback clock, pause/seek/repeat/sleep recovery, offset per lagu, alat ukur timing | Target timing fixture di bawah terpenuhi; tidak drift berkelanjutan; pause dan sleep tidak meneruskan progress palsu |
| 3I — Focus Island lengkap | 6–11 hari | State compact/expanded/edit, playback commands, spectrum adapters, native hit testing, keyboard/touch, integrasi demo | Seluruh kriteria Island lulus pada dua OS dan demo; unsupported/izin ditolak pulih dengan benar; tidak ada command salah sumber atau spektrum palsu |
| 4 — Kustomisasi & polish | 4–6 hari | Preset, font/warna/latar, live preview, layout multibaris, shortcut, aksesibilitas | Perubahan tampil langsung dan tersimpan; teks panjang/Unicode tidak terpotong; reduced motion dan navigasi keyboard lulus |
| 4D — Demo & download siap rilis | 2–4 hari | Paritas UI MVP, halaman download lengkap, mobile, aksesibilitas, manifest installer, optimasi aset | Seluruh kriteria demo lulus; fitur preview sesuai desktop; link installer terverifikasi saat gate rilis Iteration 5 |
| 5 — Stabilitas & distribusi | 7–10 hari | Profiling, smoke test tiga sumber lintas OS, installer + browser companion bila perlu, signing/notarization, dokumentasi dukungan dan known issues | Seluruh gate rilis lulus pada mesin asli; fresh install/uninstall desktop dan companion berhasil; artefak rilis dapat diverifikasi |
| 6 — Setelah MVP | 1–3 minggu tambahan, dikalibrasi ulang | Dynamic theme, romanisasi, auto-hide lanjutan, signed updater, perluasan browser | Setiap fitur punya uji integrasi tersendiri; tidak mengurangi keandalan baseline |

Dependensi utama untuk satu developer: Iteration 0 → 0I → 1 → 1D → 2 → 3 → 3I → 4 → 4D → 5. Prototype demo dibuat setelah fondasi UI, termasuk bentuk compact/expanded Island, sehingga dapat direview sebelum semua adapter desktop selesai. Gate rilis Iteration 5 mencakup smoke test web, Island, dan artefak download. Integrasi YouTube Music, Focus Island serta demo web termasuk MVP, bukan fitur opsional setelah rilis. Jika satu sumber wajib gagal di spike, tentukan adapter alternatif dan perkiraan tambahan; perubahan cakupan membutuhkan keputusan pengguna, bukan pengurangan diam-diam.

## 6. Target kualitas dan cara mengukurnya

Semua angka berikut adalah target awal, belum hasil pengukuran.

| Aspek | Target/gate |
| --- | --- |
| Timing internal | Pada fixture dengan clock dan timestamp diketahui benar: p95 error pergantian baris ≤150 ms |
| Seek recovery | Baris kembali benar ≤500 ms setelah snapshot posisi baru diterima; ukur keterlambatan player→snapshot secara terpisah |
| Pengalaman end-to-end | Sampel lagu dengan LRC yang sudah dikurasi: target p95 selisih terlihat terhadap playback ≤300 ms; laporkan hasil per adapter |
| Matching | Dataset minimal 50 track beragam bahasa/versi; ≥95% kandidat auto-match yang diterima benar; laporkan abstain dan coverage terpisah |
| Cache | Lirik tersimpan tampil ≤300 ms setelah identitas track diterima pada mesin baseline |
| Resource | Target awal total proses app termasuk webview ≤150 MB steady-state; CPU idle <1% dan playback <3% pada mesin baseline, dengan metode pengukuran dicatat |
| Stabilitas | Sesi playback 2 jam per OS tanpa crash, pertumbuhan memori terus-menerus, atau akumulasi drift |
| Geometri | Resize empat sudut tidak menggeser sudut lawan secara tak terduga; monitor dengan DPI berbeda dan negative coordinates aman |
| Pemulihan | Unlock tetap tersedia jika shortcut bentrok/gagal; settings rusak dapat dipulihkan; overlay yang berada di luar layar bisa dikembalikan |

Uji unit terfokus pada parser, clock, matching versi, offset, dan invalidasi respons usang. Integration test memakai adapter/provider palsu untuk pause/seek, 404/429, timeout, offline, dan pergantian lagu cepat. Gunakan lirik sintetis atau fixture berizin. UI test mencakup settings dan state, sedangkan transparansi, focus, click-through, Spaces/fullscreen, DPI, serta tray harus diverifikasi native pada mesin Windows dan Mac.

Matriks manual minimum: Spotify, Apple Music/Music, dan YouTube Music di kedua OS; browser dengan beberapa tab, iklan, extension terputus/dinonaktifkan; dua player aktif, izin ditolak lalu diberikan, beberapa monitor, scaling Windows 100/150/200%, Retina/non-Retina bila tersedia, hot-plug monitor, sleep/wake, lagu live/remix, non-Latin, intro panjang, track tanpa lirik, dan jaringan terputus. Always-on-top pada desktop biasa adalah baseline; fullscreen eksklusif/Spaces harus dicatat hasilnya sebelum dijanjikan.

## 7. Risiko dan keputusan rilis

| Risiko | Penanganan |
| --- | --- |
| Timeline player tidak tersedia atau lambat | Spike per versi player; capability flags; adapter khusus bila layak; mode statis berlabel |
| macOS berbeda dari Windows | Validasi native sejak Iteration 0, termasuk izin, focus, fullscreen dan virtual desktop |
| Lirik salah versi/tidak tersedia | Metadata + durasi + confidence, manual selection, LRC lokal, offset |
| Click-through membuat app sulit diakses | Tray/menu bar sebagai kontrol utama pemulihan; shortcut tambahan dan reset bounds |
| Island tidak menerima hover atau menghalangi kerja | Pisahkan Lock posisi dari full click-through; uji native hit region, focus, dan collapse bounds |
| Spektrum tidak mendapat audio player | Uji capture per aplikasi, izin dan output device sejak spike; fallback statis berlabel; system mix hanya bila dipilih pengguna |
| Stop atau command tidak tersedia | Capability per session, hasil command diverifikasi, aksi alternatif diberi nama yang tepat; jangan mengklaim keberhasilan palsu |
| Resource melebihi target | Ukur total proses; event-driven updates; hentikan animasi saat hidden/paused; profil sebelum menambah fitur |
| Provider berubah/gagal | Cache, timeout/backoff, provider interface, fallback manual; review ketentuan sebelum rilis |
| Installer sulit dijalankan pengguna | Windows signing dan macOS Developer ID/notarization untuk distribusi publik; perlukan akun/sertifikat serta Mac runner |

Rilis macOS melalui DMG dan Windows melalui installer EXE; dukungan Intel/Apple Silicon divalidasi sebagai artefak terpisah atau universal. Signing/notarization diuji pada instalasi bersih, bukan hanya mesin developer. [Tauri macOS signing](https://v2.tauri.app/distribute/sign/macos/)

Simpan credential signing di secret CI. Dokumentasikan uninstall, lokasi cache/settings, reset app, daftar player dan versi yang benar-benar diuji, serta langkah izin macOS. Telemetri default off; log diagnostik tidak menyimpan teks lirik atau riwayat dengar secara default. Informasikan bahwa pencarian online mengirim metadata lagu ke provider.

## 8. Backlog pertama yang siap dikerjakan

- [ ] FL-001: Bootstrap kandidat stack dan build hello-overlay di Windows/macOS.
- [ ] FL-002: Buktikan native drag/resize empat sudut, transparansi, click-through, tray unlock, focus, dan multi-monitor.
- [ ] FL-003: Buktikan snapshot Spotify/Apple Music/YouTube Music per OS; uji kebutuhan extension dan simpan matriks metadata/timeline/event beserta versi player/browser.
- [ ] FL-004: Uji lookup provider dengan sampel lagu dan versi berbeda; catat coverage, confidence, syarat cache/atribusi.
- [ ] FL-005: Buat prototype UX Edit/Lock, settings preview, preset posisi, dan alur recovery.
- [ ] FL-006: Tetapkan keputusan stack, jalur integrasi ketiga sumber MVP, minimum OS, baseline hardware, dan estimasi revisi berdasarkan FL-001 sampai FL-005.
- [ ] FL-007: Pisahkan shared lyrics UI/contracts dari native APIs dan buat adapter snapshot untuk audio demo.
- [ ] FL-008: Siapkan minimal tiga sample audio/artwork/LRC beserta bukti izin penggunaan atau kepemilikan.
- [ ] FL-009: Bangun playground `/demo` dengan playback, seek, drag/resize empat sudut, live customization, serta Edit/Lock/Reset.
- [ ] FL-010: Bangun `/download` yang memakai demo bersama, pilihan OS/arsitektur, manifest rilis, panduan instalasi dan batas kemampuan demo.
- [ ] FL-011: Verifikasi timing, keyboard/touch, mobile, lintas browser, pemuatan aset, serta link download; siapkan preview web sebelum publikasi.
- [ ] FL-012: Prototype Focus Island compact/expanded/edit, intent timers, posisi terpisah, hover/focus/touch dan aturan auto-collapse.
- [ ] FL-013: Buktikan hit region Island, pemulihan tray, dan hover tanpa mencuri fokus di kedua OS.
- [ ] FL-014: Implementasikan command adapter previous/next/play/pause/stop dengan capability, timeout dan konfirmasi session yang benar untuk ketiga sumber.
- [ ] FL-015: Spike lalu implementasikan capture audio/FFT Windows/macOS, scope audio, izin, output-device recovery, fallback statis dan profiling.
- [ ] FL-016: Tambahkan Island dan analyser sample audio ke demo; uji paritas interaksi, aksesibilitas, failure states dan kriteria spektrum.

Definition of done dokumen perencanaan: kebutuhan utama desktop dan demo web, asumsi, arsitektur kandidat, risiko integrasi, backlog, fase, dan kriteria penerimaan tersedia. Definition of done produk: seluruh exit gate desktop, demo, dan download MVP lulus dengan bukti hasil uji; status tersebut belum tercapai pada dokumen ini.
