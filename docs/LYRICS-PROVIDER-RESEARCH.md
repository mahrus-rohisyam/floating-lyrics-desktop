# Riset sumber lirik dan fallback otomatis

Ditinjau: 6 Oktober 2026; implementasi awal ditambahkan 7 Oktober 2026. Provider LRCLIB, lrcmux, dan lyrics.ovh kini dicoba otomatis di aplikasi desktop. Validasi layanan langsung dan pemeriksaan hak lirik untuk distribusi publik masih terbuka.

## Temuan sebelum implementasi

`src-tauri/src/lib.rs::find_lyrics` hanya mencoba satu `GET /api/get` LRCLIB bila durasi tersedia, lalu satu `GET /api/search`. Kegagalan jaringan atau respons selain 404 pada permintaan pertama menghentikan pencarian. `src/useNativePlayer.ts` hanya memilih otomatis jika **tepat satu** hasil cocok sama persis pada judul, artis, dan durasi ±2 detik. Akibatnya, hasil yang benar masih bisa meminta pilihan manual ketika durasi player kosong/tidak akurat, metadata album berbeda, atau ada beberapa entri untuk lagu yang sama. Hasil pencarian belum dipilih berdasarkan mutu sinkronisasi maupun kecocokan album.

## Kandidat API gratis

| Sumber | Kemampuan dan akses | Kegunaan | Catatan sebelum integrasi |
| --- | --- | --- | --- |
| [LRCLIB](https://lrclib.net/docs), [kode server](https://github.com/tranxuanthang/lrclib) | Gratis, tanpa kunci; `/api/get` dan `/api/search`; lirik LRC tersinkron, teks biasa, dan penanda instrumental | Utama. Coba pencocokan metadata lengkap, lalu pencarian dan penilaian kandidat | Identifikasi aplikasi lewat User-Agent. Tidak semua lagu/versi ada. Album dan durasi tidak boleh diabaikan ketika memilih versi sinkron. |
| [lrcmux](https://lrcmux.dev/), [kode](https://github.com/f1nniboy/lrcmux) | API publik tanpa akun/kunci/biaya; menggabungkan sejumlah sumber, memilih hasil terbaik, dan menyediakan tingkat sync kata/baris/tidak ada | Fallback sinkron setelah LRCLIB gagal atau hanya punya teks biasa | Layanan menggabungkan sumber lain, jadi bukan katalog sepenuhnya independen dari LRCLIB. Kontrak `/get` dan respons `meta.level`/`lines` perlu diuji dengan fixture sebelum diaktifkan. Terapkan batas permintaan dan tangani 429/503. Hak lirik dari tiap sumber tetap perlu ditinjau. |
| [lyrics.ovh](https://github.com/NTag/lyrics.ovh) | `GET https://api.lyrics.ovh/v1/{artist}/{title}` tanpa kunci; mengembalikan teks biasa atau 404 | Fallback terakhir untuk teks **tidak tersinkron** | Tidak menerima durasi/album untuk memverifikasi versi; jangan beri label synced atau membuat timestamp palsu. Servernya mengambil teks dari beberapa situs pihak ketiga. Lisensi MIT untuk kode server **tidak** memberi hak redistribusi lirik. Tinjau syarat sumber dan uji stabilitas sebelum distribusi publik. |
| [Lyrica](https://github.com/Wilooper/Lyrica) | Server terbuka yang bisa dijalankan sendiri; agregasi lirik biasa dan beberapa tingkat sync | Opsi riset/self-host bila layanan publik tidak cukup | Bukan endpoint publik gratis yang sederhana: konfigurasi dapat memerlukan token, cookies, atau sumber pihak ketiga. Biaya operasional serta hak data perlu ditinjau. Jangan jadikan fallback default saat ini. |
| [ChartLyrics](http://www.chartlyrics.com/api.aspx) | API lama dengan lirik biasa | Referensi cadangan saja | Dokumentasi dan contoh integrasi memakai HTTP tanpa TLS. Tidak layak menjadi default aplikasi desktop yang memakai HTTPS. |

Genius API tidak dimasukkan sebagai sumber lirik penuh otomatis: pencarian metadata/tautan lagu tidak sama dengan izin dan endpoint untuk mengambil seluruh teks. Scraping situs atau endpoint privat layanan streaming juga tidak menjadi rute default.

## Urutan fallback yang disarankan

1. Gunakan impor lokal yang tersimpan untuk identitas rekaman yang sama; jangan hapus pilihan pengguna ketika pencarian jaringan berjalan.
2. LRCLIB `/api/get` dengan judul, artis, album, durasi jika metadata cukup. Jika 404 atau hasil tanpa lirik, lanjutkan ke `/api/search`. Jangan berhenti pada timeout/5xx satu provider.
3. Normalisasi metadata secukupnya untuk pencarian kedua (kapitalisasi, spasi, label `feat.`), tetapi pertahankan penanda versi seperti `live`, `remix`, `acoustic`, dan `radio edit` untuk penilaian. Terima LRC otomatis hanya jika judul, artis, dan versi cocok serta selisih durasi dalam batas aman. Jika durasi tidak tersedia, pilih otomatis hanya jika kandidat jelas tunggal dan metadata kuat.
4. Coba lrcmux bila belum ada LRC yang dapat dipercaya. Bandingkan metadata jika disediakan. LRC tersinkron yang cocok mengalahkan teks biasa; teks biasa yang cocok mengalahkan status tidak tersedia.
5. Coba lyrics.ovh untuk teks biasa bila belum ada hasil. Tandai `Tidak tersinkron`, tampilkan seluruh teks sebagai teks biasa, dan jangan menggerakkannya mengikuti waktu playback.
6. Jika provider menyatakan instrumental dengan kecocokan kuat, tampilkan status `Instrumental` dan info lagu. Bila semua sumber kosong/gagal, tampilkan info lagu dan `Lirik belum tersedia`, serta tetap sediakan impor LRC/TXT. Jangan mengarang lirik untuk membuat semua lagu tampak memiliki teks.

Di setiap langkah: beri timeout per provider, backoff untuk 429/503, cache hasil positif dan negatif berumur pendek, batasi panggilan per track, dan abaikan respons lama setelah lagu berubah. Simpan `provider`, `synced/plain/instrumental`, serta identitas versi pada hasil agar UI bisa memberi label yang benar dan pilihan manual tetap tersedia.

## Batas tujuan dan gerbang sebelum rilis

**Setiap lagu bisa memunculkan tampilan otomatis** berupa lirik tersinkron, lirik biasa, status instrumental, atau status belum tersedia bersama judul/artis. **Setiap lagu pasti memiliki teks lirik tersinkron tidak dapat dijamin** oleh gabungan API gratis: ada lagu instrumental, katalog kosong, perbedaan versi rekaman, pembatasan hak, dan provider yang sedang tidak tersedia.

Sebelum mengaktifkan fallback publik, verifikasi syarat penggunaan dan atribusi tiap layanan/sumber, uji respons aktual serta rate limit, dan jalankan matriks lagu populer, lokal/Indonesia, live/remix, instrumental, metadata tanpa durasi, judul sama dengan artis berbeda, serta provider timeout/429/503. Ukur akurasi versi dan cakupan secara terpisah; jangan menaikkan cakupan dengan memilih lirik lagu yang keliru.
