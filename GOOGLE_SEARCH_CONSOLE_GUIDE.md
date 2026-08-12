# Panduan Mendaftarkan Domain ke Google Search Console & Submit Sitemap

## Langkah 1: Akses Google Search Console

1. Buka [Google Search Console](https://search.google.com/search-console)
2. Login dengan akun Google Anda (disarankan menggunakan akun yang sama dengan Google Analytics jika ada)

## Langkah 2: Tambahkan Property (Website)

### Opsi A: Domain Property (Recommended)
- Klik **"Add Property"** → Pilih **"Domain"**
- Masukkan domain utama: `tiktok-dl-mu-ten.vercel.app`
- **Verifikasi via DNS:**
  1. Copy TXT record yang diberikan Google
  2. Login ke dashboard Vercel Anda
  3. Jika menggunakan custom domain, tambahkan TXT record di DNS settings
  4. Jika menggunakan subdomain vercel.app, gunakan opsi URL Prefix di bawah

### Opsi B: URL Prefix Property (Lebih Mudah untuk Vercel)
- Klik **"Add Property"** → Pilih **"URL prefix"**
- Masukkan URL lengkap: `https://tiktok-dl-mu-ten.vercel.app/`
- **Metode Verifikasi yang Tersedia:**

#### Metode 1: HTML Tag (Paling Mudah)
1. Pilih metode **"HTML tag"**
2. Copy meta tag yang diberikan, contoh:
   ```html
   <meta name="google-site-verification" content="XXXXXXXXXXXXXXXXXXXXX" />
   ```
3. Tambahkan meta tag ini ke file `templates/index.html` di bagian `<head>`:
   ```html
   <!-- Google Site Verification -->
   <meta name="google-site-verification" content="XXXXXXXXXXXXXXXXXXXXX" />
   ```
4. Klik **"Verify"** di Google Search Console

#### Metode 2: HTML File Upload
1. Pilih metode **"HTML file upload"**
2. Download file HTML verifikasi dari Google
3. Upload file ke folder `/workspace/static/` 
4. Pastikan file bisa diakses di: `https://tiktok-dl-mu-ten.vercel.app/googleXXXXXXXX.html`
5. Klik **"Verify"**

#### Metode 3: Google Analytics (Jika Sudah Ada)
- Jika website sudah menggunakan Google Analytics
- Pilih metode **"Google Analytics"**
- Pastikan Anda memiliki akses "Edit" ke property GA tersebut

## Langkah 3: Submit Sitemap.xml

Setelah website terverifikasi:

1. **Buka Property** Anda di Google Search Console
2. Di menu sebelah kiri, klik **"Sitemaps"** (di bawah section "Indexing")
3. Di bagian **"Add a new sitemap"**:
   - Masukkan: `sitemap.xml` di kolom input
   - Atau masukkan URL lengkap: `https://tiktok-dl-mu-ten.vercel.app/sitemap.xml`
4. Klik **"SUBMIT"**

### Status Submit:
- ✅ **Success** (Hijau): Sitemap berhasil diproses
- ⚠️ **Has errors** (Merah): Ada masalah dengan sitemap
- 🔄 **Pending**: Masih dalam proses crawling

## Langkah 4: Pantau Performa SEO

### Dashboard Utama GSC:
1. **Overview**: Ringkasan performa pencarian
2. **Performance**: 
   - Total clicks, impressions, CTR, average position
   - Query pencarian yang menampilkan website Anda
   - Halaman dengan performa terbaik
3. **Indexing → Pages**: 
   - Status indexing halaman
   - Error yang perlu diperbaiki
4. **Enhancements**:
   - Core Web Vitals
   - Mobile Usability
   - Structured Data (JSON-LD)

## Tips Optimasi SEO Tambahan

### 1. Update Sitemap Secara Berkala
```bash
# Edit file static/sitemap.xml
# Update tanggal lastmod setiap ada perubahan konten
<lastmod>2026-01-15</lastmod>
```

### 2. Monitor Core Web Vitals
- LCP (Largest Contentful Paint): < 2.5 detik
- FID (First Input Delay): < 100 ms
- CLS (Cumulative Layout Shift): < 0.1

### 3. Periksa Structured Data
- Gunakan [Rich Results Test](https://search.google.com/test/rich-results)
- Validasi JSON-LD yang sudah ditambahkan
- Pastikan tidak ada error pada WebApplication & FAQ schema

### 4. Request Indexing Manual (Jika Perlu)
1. Masuk ke **"URL Inspection"** di GSC
2. Masukkan URL halaman yang ingin di-index
3. Klik **"Request Indexing"**

### 5. Integrasi dengan Google Analytics 4
- Hubungkan GSC dengan GA4 untuk data lebih lengkap
- Menu: Settings → Connections → Google Analytics

## Troubleshooting Umum

### ❌ Sitemap Tidak Terbaca
- Pastikan URL sitemap dapat diakses: `https://tiktok-dl-mu-ten.vercel.app/sitemap.xml`
- Cek format XML valid
- Pastikan robots.txt mengizinkan crawling sitemap

### ❌ Verifikasi Gagal
- Clear cache browser
- Pastikan meta tag/file HTML sudah ter-deploy ke Vercel
- Tunggu beberapa menit setelah deploy ulang

### ❌ Halaman Tidak Ter-Index
- Periksa robots.txt tidak memblokir halaman
- Pastikan ada internal linking yang baik
- Submit URL manual via URL Inspection tool

## Checklist Setelah Setup

- [ ] Property terdaftar di Google Search Console
- [ ] Verifikasi berhasil (salah satu metode)
- [ ] Sitemap.xml submitted dan status Success
- [ ] robots.txt dapat diakses
- [ ] Structured data valid (test via Rich Results Test)
- [ ] Meta tags SEO lengkap (title, description, OG, Twitter)
- [ ] Canonical URL sudah benar
- [ ] Mobile-friendly test passed
- [ ] Core Web Vitals dalam range baik

## Link Penting

- [Google Search Console](https://search.google.com/search-console)
- [Rich Results Test](https://search.google.com/test/rich-results)
- [Mobile-Friendly Test](https://search.google.com/test/mobile-friendly)
- [PageSpeed Insights](https://pagespeed.web.dev/)
- [Sitemap Validator](https://www.xml-sitemaps.com/validate.php)

---

**Catatan:** Proses indexing oleh Google bisa memakan waktu beberapa hari hingga beberapa minggu. Terus monitor performa dan update konten secara berkala untuk hasil optimal.
