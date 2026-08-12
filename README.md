# TikTok Downloader Web Application (Flask Backend)

Aplikasi berbasis web untuk mengunduh Video TikTok Tanpa Watermark, Audio MP3, dan Slide Foto HD dengan opsi Konversi Otomatis Slide Foto ke Video MP4.

## Fitur Utama
1. **Desain Modern & Minimalis (Dark Grey Theme)**:
   - Menggunakan Bootstrap 5, Bootstrap Icons, dan CSS kustom responsif untuk tampilan desktop dan seluler.
2. **Analisis Link TikTok**:
   - Mendukung input URL TikTok (`vt.tiktok.com`, `tiktok.com/@user/video/...`, `tiktok.com/music/...`).
   - Tombol Tempel (Clipboard) dan Hapus instan.
   - Indikator loading spinner saat analisis berlangsung.
   - Toast notification kustom untuk pesan validasi dan pemberitahuan.
3. **Mendukung 3 Tipe Konten**:
   - **Video TikTok**: Menampilkan foto & nama pengguna, judul postingan, serta opsi *Download Video (Tanpa Watermark)*, *Download Video (HD)*, dan *Download Audio MP3*.
   - **Audio TikTok**: Menampilkan judul audio, pemutar audio, serta opsi *Download Audio MP3*.
   - **Slide Foto TikTok**:
     - Pemutar Carousel slide interaktif yang dapat digeser / discroll ke kiri dan kanan beserta indikator slide.
     - Opsi checkbox per foto slide dan checkbox *Pilih Semua*.
     - Opsi *Download ZIP* untuk batch unduhan foto slide terpilih.
     - Opsi *Download Sebagai Video MP4*: Mengonversi slide foto terpilih menjadi video MP4 dengan efek transisi *Slide Right* (geser kanan) atau fade, beserta musik backsound.
     - Opsi *Download Audio / Musik Backsound* di bagian bawah.

## Persyaratan Sistem
- Python 3.10+
- FFmpeg (Diperlukan untuk konversi slide foto ke video MP4)

## Cara Menjalankan Aplikasi
1. Install dependensi Python:
   ```bash
   pip install -r requirements.txt
   ```
2. Jalankan server Flask:
   ```bash
   python app.py
   ```
3. Buka browser di alamat `http://localhost:3000`.

## Deployment ke Render
Aplikasi sudah dilengkapi `render.yaml` agar mudah di-deploy ke Render (https://render.com).

1. Push repository ini ke GitHub.
2. Di Render: **New → Blueprint** lalu pilih `render.yaml`.
3. Render akan otomatis membuat Web Service dengan perintah:
   - Build: `pip install -r requirements.txt`
   - Start: `gunicorn app:app --workers 1 --threads 16 --timeout 180`
4. Binary FFmpeg disediakan otomatis oleh `imageio-ffmpeg` sehingga fitur konversi Slide Foto ke Video MP4 berfungsi di server (tanpa install FFmpeg manual).

> Catatan: Jalankan lokal juga bisa dengan `gunicorn app:app --threads 8 --timeout 180` jika ingin mensimulasikan environment produksi.
