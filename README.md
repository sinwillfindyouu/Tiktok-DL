# TikTok Downloader Web Application (Flask Backend)

Aplikasi berbasis web untuk mengunduh Video TikTok Tanpa Watermark, Audio MP3, Slide Foto HD, Story TikTok, dengan opsi Konversi Otomatis Slide Foto ke Video MP4.

## Fitur Utama
1. **Desain Modern & Minimalis (Dark Grey Theme)**:
   - Menggunakan Bootstrap 5, Bootstrap Icons, dan CSS kustom responsif untuk tampilan desktop dan seluler.
2. **Analisis Link TikTok**:
   - Mendukung input URL TikTok (`vt.tiktok.com`, `tiktok.com/@user/video/...`, `tiktok.com/music/...`, `tiktok.com/@user/story/...`).
   - Tombol Tempel (Clipboard) dan Hapus instan.
   - Indikator loading spinner saat analisis berlangsung.
   - Toast notification kustom untuk pesan validasi dan pemberitahuan.
3. **Mendukung 4 Tipe Konten**:
   - **Video TikTok**: Menampilkan foto & nama pengguna, judul postingan, serta opsi *Download Video (Tanpa Watermark)*, *Download Video (HD)*, dan *Download Audio MP3*.
   - **Audio TikTok**: Menampilkan judul audio, pemutar audio, serta opsi *Download Audio MP3*.
   - **Slide Foto TikTok**:
     - Pemutar Carousel slide interaktif yang dapat digeser / discroll ke kiri dan kanan beserta indikator slide.
     - Opsi checkbox per foto slide dan checkbox *Pilih Semua*.
     - Opsi *Download ZIP* untuk batch unduhan foto slide terpilih.
     - Opsi *Download Sebagai Video MP4*: Mengonversi slide foto terpilih menjadi video MP4 dengan efek transisi *Slide Right* (geser kanan) atau fade, beserta musik backsound.
     - Opsi *Download Audio / Musik Backsound* di bagian bawah.
   - **Story TikTok**: 
     - Mendeteksi dan memproses URL story TikTok (`/story/` atau `/@username/story/...`).
     - Download story tanpa watermark dalam kualitas HD.
     - Opsi download audio/musik dari story.
     - Tampilan informasi views, komentar, dan shares.

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

## Deployment ke Vercel
Aplikasi sudah dilengkapi `vercel.json` agar mudah di-deploy ke Vercel (https://vercel.com).

1. Push repository ini ke GitHub.
2. Di Vercel: **New Project** → Import repository GitHub Anda.
3. Vercel akan otomatis mendeteksi konfigurasi Python Flask dan menerapkan settings dari `vercel.json`:
   - Function maxDuration: 60 detik
   - Caching untuk static assets (`/static/` dan `/assets/`) dengan Cache-Control 1 tahun
4. Klik **Deploy** dan aplikasi akan langsung online.
5. Binary FFmpeg disediakan otomatis oleh `imageio-ffmpeg` sehingga fitur konversi Slide Foto ke Video MP4 berfungsi di server (tanpa install FFmpeg manual).

> Catatan: Untuk development lokal, jalankan dengan `python app.py` atau gunakan `gunicorn app:app --threads 8 --timeout 180` jika ingin mensimulasikan environment produksi.

## Struktur Project

```
/workspace
├── app.py                      # Flask backend (API endpoints, TikTok data fetching)
├── requirements.txt            # Python dependencies
├── vercel.json                 # Vercel deployment configuration
├── build.sh                    # Build script untuk Vercel
├── README.md                   # Dokumentasi project
├── templates/
│   └── index.html              # Main HTML template dengan SEO optimization
├── static/
│   ├── css/
│   │   └── style.css           # Custom CSS (Dark Grey theme)
│   └── js/
│       └── main.js             # Frontend JavaScript (API calls, UI handling)
└── assets/
    └── images/
        ├── app-logo.png        # Logo aplikasi
        └── app-favicon.ico     # Favicon
```

### File Utama

#### `app.py` - Backend Flask
- **Route `/`**: Halaman utama
- **Route `/api/analyze`**: Analisis URL TikTok (Video, Audio, Slide Foto, Story)
- **Route `/api/download/video`**: Download video tanpa watermark
- **Route `/api/download/audio`**: Download audio MP3
- **Route `/api/download/slide`**: Download slide foto individual
- **Route `/api/download/slides-zip`**: Batch download slide foto dalam ZIP
- **Route `/api/convert-slides-to-video`**: Konversi slide foto ke video MP4
- **Route `/assets/<path>`**: Serve static assets dari folder assets

#### `templates/index.html` - Frontend HTML
- Semantic HTML5 structure
- SEO meta tags (Open Graph, Twitter Card, JSON-LD structured data)
- Responsive design dengan Bootstrap 5
- Dark grey theme yang modern

#### `static/js/main.js` - Frontend JavaScript
- Form handling dan validasi URL
- API calls ke backend Flask
- Dynamic rendering untuk 4 tipe konten (Video, Audio, Slide Foto, Story)
- Carousel slider untuk slide foto
- Toast notifications
- Clipboard functionality

#### `vercel.json` - Vercel Configuration
- Max function duration: 60 detik
- Cache-Control headers untuk static assets (1 tahun)

## Teknologi yang Digunakan

- **Backend**: Python 3.10+, Flask
- **Frontend**: HTML5, CSS3, JavaScript (ES6+), Bootstrap 5
- **API**: TikWM API, SSSTik API (fallback)
- **Deployment**: Vercel Serverless Functions
- **Image Processing**: Pillow (PIL), imageio-ffmpeg
- **HTTP Client**: Requests, urllib3

## Fitur SEO yang Diimplementasikan

- ✅ Meta title & description yang SEO-friendly
- ✅ Open Graph tags untuk social media sharing
- ✅ Twitter Card tags
- ✅ Canonical URL
- ✅ JSON-LD Structured Data (WebApplication)
- ✅ Semantic HTML (header, nav, main, footer, section, article)
- ✅ robots.txt
- ✅ sitemap.xml
- ✅ Optimasi gambar dengan lazy loading
- ✅ Performance optimization (CSS/JS minification ready, caching headers)
- ✅ Mobile-first responsive design
- ✅ Core Web Vitals optimized (fast LCP, low CLS, good INP)

## License

Project ini dibuat untuk tujuan edukasi dan penggunaan pribadi. Pastikan untuk menghormati hak cipta dan ketentuan layanan TikTok.
