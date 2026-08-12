import os
import io
import re
import uuid
import shutil
import base64
import zipfile
import tempfile
import subprocess
from concurrent.futures import ThreadPoolExecutor
import requests
import urllib3
from PIL import Image, ImageDraw, ImageFont
from flask import Flask, render_template, request, jsonify, send_file, send_from_directory, Response

# Disable insecure HTTPS warnings for fallback requests
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = Flask(__name__, template_folder='templates', static_folder='static')

# User-Agent headers to bypass hotlinking and scraping blocks
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Referer': 'https://www.tiktok.com/'
}

def is_valid_tiktok_url(url):
    """Check if the provided string is a valid TikTok URL."""
    if not url or not isinstance(url, str):
        return False
    url = url.strip()
    pattern = r'https?://(www\.|vt\.|vm\.|mobile\.|m\.)?tiktok\.com/.*'
    return bool(re.match(pattern, url, re.IGNORECASE))

def ensure_absolute_url(url, base="https://www.tikwm.com"):
    """
    Ensure relative URLs (e.g., /video/music/... or /video/media/...)
    are converted to full absolute https:// URLs.
    """
    if not url or not isinstance(url, str):
        return ""
    url = url.strip()
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if url.startswith("//"):
        return "https:" + url
    if url.startswith("/"):
        return base.rstrip("/") + url
    return f"{base.rstrip('/')}/{url}"

def fetch_ssstik_audio(url):
    """
    Extract direct TikTok music/sound CDN MP3 link via SSSTik API.
    Handles tikcdn.io base64 encoded URLs.
    """
    ssstik_headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Origin': 'https://ssstik.io',
        'Referer': 'https://ssstik.io/id'
    }
    try:
        r = requests.get('https://ssstik.io/id', headers=ssstik_headers, timeout=6)
        tt_match = re.search(r's_tt\s*=\s*[\"\']([^\"\']+)[\"\']', r.text) or re.search(r'name=\"tt\"\s*value=\"([^\"]+)\"', r.text)
        tt = tt_match.group(1) if tt_match else ''

        r2 = requests.post('https://ssstik.io/abc?url=dl', data={'id': url, 'locale': 'id', 'tt': tt}, headers=ssstik_headers, timeout=8)
        if r2.status_code == 200:
            links = re.findall(r'href=\"([^\"]+)\"', r2.text)
            for l in links:
                if 'tikcdn.io/ssstik/m/' in l:
                    try:
                        b64_str = l.split('/ssstik/m/')[-1]
                        decoded_url = base64.b64decode(b64_str).decode('utf-8', errors='ignore')
                        if decoded_url.startswith('http'):
                            return decoded_url
                    except Exception:
                        pass
                elif ('tiktokcdn' in l or '.mp3' in l) and not 'ssstik.io' in l:
                    return l
            for l in links:
                if 'tikcdn.io' in l:
                    return l
    except Exception as e:
        print(f"SSSTik audio fetch error: {e}")
    return None

def fetch_music_post_count(clean_url):
    """
    Try to resolve how many posts use a given TikTok sound, via TikWM's
    music-info endpoint. Returns None if it can't be determined.
    """
    try:
        resp = requests.post(
            'https://www.tikwm.com/api/music/info',
            data={'url': clean_url},
            headers=HEADERS,
            timeout=8
        )
        if resp.status_code == 200:
            res_json = resp.json()
            if res_json.get('code') == 0:
                count = res_json.get('data', {}).get('video_count')
                if isinstance(count, int):
                    return count
    except Exception as e:
        print(f"Error fetching music post count: {e}")
    return None

def fetch_tiktok_data(url):
    """
    Fetch TikTok metadata using TikWM API, TikTok oEmbed, and SSSTik fallback.
    Supports Videos, Music/Audio posts, and Photo Slides.
    """
    resolved_url = url
    try:
        # Resolve short URLs (e.g. vt.tiktok.com, vm.tiktok.com)
        head_resp = requests.get(url, headers=HEADERS, allow_redirects=True, timeout=8)
        if head_resp.url:
            resolved_url = head_resp.url.split('?')[0]
    except Exception as e:
        print(f"Error resolving URL redirect: {e}")

    clean_url = resolved_url.split('?')[0]
    is_music_link = '/music/' in clean_url.lower() or 'share_music_id' in clean_url.lower() or 'music_id' in clean_url.lower()

    # If it's explicitly a TikTok Music / Sound link
    if is_music_link:
        try:
            oembed_url = f"https://www.tiktok.com/oembed?url={requests.utils.quote(clean_url)}"
            oembed_resp = requests.get(oembed_url, headers=HEADERS, timeout=8)
            
            title = "TikTok Original Sound"
            author_name = "TikTok Creator"
            
            if oembed_resp.status_code == 200:
                oembed_data = oembed_resp.json()
                title = oembed_data.get('title') or title
                author_name = oembed_data.get('author_name') or author_name

            # Get direct audio link via SSSTik
            audio_url = fetch_ssstik_audio(clean_url) or fetch_ssstik_audio(url)
            
            if audio_url:
                post_count = fetch_music_post_count(clean_url)
                return {
                    'status': 'success',
                    'type': 'audio',
                    'author': {
                        'nickname': author_name,
                        'username': author_name.lower().replace(' ', '_'),
                        'avatar': ''
                    },
                    'title': title,
                    'cover': '',
                    'audio': {
                        'url': audio_url,
                        'title': title,
                        'author': author_name,
                        'post_count': post_count
                    }
                }
        except Exception as e:
            print(f"Error processing music link: {e}")

    # Primary API: TikWM for Video and Photo Slides
    try:
        tikwm_url = "https://www.tikwm.com/api/"
        response = requests.post(tikwm_url, data={'url': resolved_url, 'count': 12, 'cursor': 0, 'web': 1}, headers=HEADERS, timeout=12)
        if response.status_code == 200:
            res_json = response.json()
            if res_json.get('code') == 0 and 'data' in res_json:
                data = res_json['data']
                
                # Check author
                author = data.get('author', {})
                nickname = author.get('nickname') or author.get('unique_id') or "TikTok User"
                username = author.get('unique_id') or "tiktok"
                avatar = ensure_absolute_url(author.get('avatar') or "")
                
                title = data.get('title') or f"TikTok Post by @{username}"
                cover = ensure_absolute_url(data.get('cover') or data.get('origin_cover') or "")

                # Engagement stats (views / comments / shares)
                stats = {
                    'views': data.get('play_count', 0) or 0,
                    'comments': data.get('comment_count', 0) or 0,
                    'shares': data.get('share_count', 0) or 0
                }
                
                # Audio info
                music_info = data.get('music_info', {})
                audio_raw = data.get('music') or music_info.get('play') or ""
                audio_url = ensure_absolute_url(audio_raw)
                audio_title = music_info.get('title') or "Original Sound"
                audio_author = music_info.get('author') or nickname

                # Check if TikWM audio URL needs SSSTik resolution fallback
                if not audio_url or 'tikwm.com/video/music' in audio_url:
                    ssstik_audio = fetch_ssstik_audio(resolved_url) or fetch_ssstik_audio(url)
                    if ssstik_audio:
                        audio_url = ssstik_audio

                # Check if it's Photo Slides
                raw_images = data.get('images', [])
                images = [ensure_absolute_url(img) for img in raw_images if img]
                
                if images and len(images) > 0:
                    return {
                        'status': 'success',
                        'type': 'slides',
                        'author': {
                            'nickname': nickname,
                            'username': username,
                            'avatar': avatar
                        },
                        'title': title,
                        'cover': cover or (images[0] if images else ""),
                        'slides': images,
                        'stats': stats,
                        'audio': {
                            'url': audio_url,
                            'title': audio_title,
                            'author': audio_author
                        }
                    }
                else:
                    # Video post
                    play_url = ensure_absolute_url(data.get('play') or data.get('hdplay') or "")
                    hd_url = ensure_absolute_url(data.get('hdplay') or play_url)
                    wm_url = ensure_absolute_url(data.get('wmplay') or play_url)

                    return {
                        'status': 'success',
                        'type': 'video',
                        'author': {
                            'nickname': nickname,
                            'username': username,
                            'avatar': avatar
                        },
                        'title': title,
                        'cover': cover,
                        'stats': stats,
                        'video': {
                            'no_watermark': play_url,
                            'hd': hd_url,
                            'watermark': wm_url
                        },
                        'audio': {
                            'url': audio_url,
                            'title': audio_title,
                            'author': audio_author
                        }
                    }
    except Exception as e:
        print(f"Error fetching from TikWM: {e}")

    # Fallback SSSTik for Music or Videos
    try:
        ssstik_audio = fetch_ssstik_audio(resolved_url) or fetch_ssstik_audio(url)
        if ssstik_audio:
            return {
                'status': 'success',
                'type': 'audio',
                'author': {
                    'nickname': 'TikTok User',
                    'username': 'tiktok',
                    'avatar': ''
                },
                'title': 'TikTok Audio / Musik',
                'cover': '',
                'audio': {
                    'url': ssstik_audio,
                    'title': 'Original Sound',
                    'author': 'TikTok Creator'
                }
            }
    except Exception as e:
        print(f"Fallback SSSTik error: {e}")

    return {
        'status': 'error',
        'message': 'Gagal mengambil data TikTok. Pastikan URL valid, publik, dan tidak terhapus.'
    }

def fetch_story_data(url):
    """
    Fetch TikTok Story data specifically.
    Stories typically have a different URL structure: /story/ or /@username/story/
    """
    try:
        # Resolve short URLs
        resolved_url = url
        try:
            head_resp = requests.get(url, headers=HEADERS, allow_redirects=True, timeout=8)
            if head_resp.url:
                resolved_url = head_resp.url.split('?')[0]
        except Exception:
            pass

        clean_url = resolved_url.split('?')[0]
        
        # Use TikWM API to fetch story data
        tikwm_url = "https://www.tikwm.com/api/"
        response = requests.post(tikwm_url, data={'url': clean_url, 'count': 12, 'cursor': 0, 'web': 1}, headers=HEADERS, timeout=12)
        
        if response.status_code == 200:
            res_json = response.json()
            if res_json.get('code') == 0 and 'data' in res_json:
                data = res_json['data']
                
                author = data.get('author', {})
                nickname = author.get('nickname') or author.get('unique_id') or "TikTok User"
                username = author.get('unique_id') or "tiktok"
                avatar = ensure_absolute_url(author.get('avatar') or "")
                
                # Story title/description (desc preferred; fallback to title, lalu tempat-temp)
                title = (data.get('desc') or data.get('title') or 'Story TikTok').strip()
                
                cover = ensure_absolute_url(data.get('cover') or data.get('origin_cover') or "")
                
                stats = {
                    'views': data.get('play_count', 0) or 0,
                    'comments': data.get('comment_count', 0) or 0,
                    'shares': data.get('share_count', 0) or 0
                }
                
                # Audio info
                music_info = data.get('music_info', {})
                audio_raw = data.get('music') or music_info.get('play') or ""
                audio_url = ensure_absolute_url(audio_raw)
                audio_title = music_info.get('title') or "Original Sound"
                audio_author = music_info.get('author') or nickname
                
                # Check if audio URL needs SSSTik resolution
                if not audio_url or 'tikwm.com/video/music' in audio_url:
                    ssstik_audio = fetch_ssstik_audio(clean_url) or fetch_ssstik_audio(url)
                    if ssstik_audio:
                        audio_url = ssstik_audio
                
                # Story video URL
                play_url = ensure_absolute_url(data.get('play') or data.get('hdplay') or "")
                hd_url = ensure_absolute_url(data.get('hdplay') or play_url)
                wm_url = ensure_absolute_url(data.get('wmplay') or play_url)
                
                return {
                    'status': 'success',
                    'type': 'video',
                    'author': {
                        'nickname': nickname,
                        'username': username,
                        'avatar': avatar
                    },
                    'title': title,
                    'cover': cover,
                    'stats': stats,
                    'video': {
                        'no_watermark': play_url,
                        'hd': hd_url,
                        'watermark': wm_url
                    },
                    'audio': {
                        'url': audio_url,
                        'title': audio_title,
                        'author': audio_author
                    }
                }
    except Exception as e:
        print(f"Error fetching story data: {e}")
    
    return None
    
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/assets/<path:filename>')
def assets(filename):
    """Serve the project's assets folder (e.g. images/favicon/logo)."""
    return send_from_directory('assets', filename)

@app.route('/api/analyze', methods=['POST'])
def analyze():
    data = request.get_json() or {}
    url = data.get('url', '').strip()

    if not url:
        return jsonify({
            'status': 'error',
            'message': 'URL TikTok belum dimasukkan. Silakan tempelkan link terlebih dahulu.'
        }), 400

    if not is_valid_tiktok_url(url):
        return jsonify({
            'status': 'error',
            'message': 'Format URL TikTok tidak valid. Gunakan format seperti https://vt.tiktok.com/... atau https://www.tiktok.com/@user/video/...'
        }), 400

    # Detect TikTok Story links (vt/... often redirects to /story/<id>)
    resolved_url = url
    try:
        head_resp = requests.get(url, headers=HEADERS, allow_redirects=True, timeout=8)
        if head_resp.url:
            resolved_url = head_resp.url.split('?')[0]
    except Exception as e:
        print(f"Error resolving URL for story detection: {e}")

    is_story_url = bool(
        re.search(r'/story(?:/|\?|$)', resolved_url, re.IGNORECASE)
        or re.search(r'/story(?:/|\?|$)', url, re.IGNORECASE)
    )

    result = fetch_story_data(resolved_url) if is_story_url else None
    if not result:
        result = fetch_tiktok_data(url)

    if result.get('status') == 'error':
        return jsonify(result), 404

    return jsonify(result)

@app.route('/api/placeholder-image')
def placeholder_image():
    """
    Generate a server-side initials avatar/thumbnail placeholder with PIL.
    Used as a reliable fallback when the real image/avatar cannot be loaded,
    so the UI never shows a broken image.
    """
    name = (request.args.get('name') or 'TikTok').strip()
    try:
        size = min(max(int(request.args.get('size', 256)), 64), 512)
    except (TypeError, ValueError):
        size = 256

    return Response(make_placeholder_image(name, size), content_type='image/png')

def make_placeholder_image(name='TikTok', size=256):
    """Build a square PNG placeholder with the entity initials (no dependencias externas)."""
    initials = ''.join([w[0] for w in re.split(r'[\s_\-\.@#]+', name) if w])[:2].upper() or "TT"

    palette = [
        (37, 99, 235), (16, 185, 129), (245, 158, 11), (236, 72, 153),
        (139, 92, 246), (14, 165, 233), (239, 68, 68), (34, 197, 94),
        (217, 70, 239), (59, 130, 246),
    ]
    color = palette[sum(ord(c) for c in (name or 'TikTok')) % len(palette)]

    img = Image.new('RGB', (size, size), color)
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.load_default(size=int(size * 0.42))
    except (TypeError, AttributeError):
        font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), initials, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(
        ((size - tw) / 2 - bbox[0], (size - th) / 2 - bbox[1]),
        initials, fill=(255, 255, 255), font=font
    )

    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()

def looks_like_image(data):
    """Detect real image bytes by magic number so we never serve HTML as an image."""
    if len(data) < 16:
        return None
    if data[:3] == b'\xff\xd8\xff':
        return 'image/jpeg'
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return 'image/png'
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return 'image/webp'
    if data[:6] in (b'GIF87a', b'GIF89a'):
        return 'image/gif'
    if data[4:8] == b'ftyp' and data[8:12] in (b'avif', b'heic', b'heix', b'mif1', b'msf1'):
        return 'image/avif'
    if data[4:8] == b'ftyp' and data[8:12] in (b'isom', b'mp42', b'mp41'):
        return 'image/mp4'
    return None

@app.route('/api/proxy-image')
def proxy_image():
    """
    Proxy image and user avatar requests to bypass hotlinking, CORS,
    and 502/SSL issues, with an internal placeholder fallback.
    """
    img_url = request.args.get('url', '').strip()
    if not img_url:
        return placeholder_fallback()

    img_url = ensure_absolute_url(img_url)

    # Try a variety of header/referer combos in case CDNs are picky
    attempts = [
        dict(HEADERS),
        {'User-Agent': HEADERS['User-Agent']},
        {'User-Agent': HEADERS['User-Agent'], 'Referer': img_url},
    ]
    for headers in attempts:
        try:
            req = requests.get(img_url, headers=headers, timeout=10, verify=False)
            if req.status_code == 200:
                mime = looks_like_image(req.content)
                if mime:
                    return Response(req.content, content_type=mime)
        except Exception as e:
            print(f"Proxy image error for {img_url}: {e}")

    return placeholder_fallback()

def placeholder_fallback():
    """Return the internal initials placeholder so the UI never shows a broken image."""
    return Response(make_placeholder_image('TikTok', 256), content_type='image/png')

@app.route('/api/proxy-download')
def proxy_download():
    """
    Proxy media stream (video, audio, image) to bypass CORS, hotlinking,
    and Cloudflare blocks. Validates file size to prevent saving small HTML error pages.
    """
    media_url = request.args.get('url', '').strip()
    filename = request.args.get('filename', 'tiktok_media').strip()
    ext = request.args.get('ext', 'mp4').strip()

    if not media_url:
        return "Missing media URL", 400

    media_url = ensure_absolute_url(media_url)
    full_filename = f"{filename}.{ext}" if not filename.endswith(f".{ext}") else filename

    download_headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://www.tiktok.com/'
    }

    try:
        req = requests.get(media_url, headers=download_headers, stream=True, timeout=20, verify=False, allow_redirects=True)
        
        # If TikWM returns 403 or non-200 or small HTML error page
        if req.status_code != 200 or ('text/html' in req.headers.get('Content-Type', '') and ext in ['mp3', 'mp4']):
            # Retry with clean headers or alternative stream
            req = requests.get(media_url, headers={'User-Agent': download_headers['User-Agent']}, stream=True, timeout=20, verify=False, allow_redirects=True)

        content_type = req.headers.get('Content-Type')
        if not content_type or 'text/html' in content_type:
            if ext == 'mp3':
                content_type = 'audio/mpeg'
            elif ext in ['jpg', 'jpeg']:
                content_type = 'image/jpeg'
            elif ext == 'png':
                content_type = 'image/png'
            else:
                content_type = 'video/mp4'

        def generate():
            for chunk in req.iter_content(chunk_size=65536):
                if chunk:
                    yield chunk

        response = Response(generate(), content_type=content_type)
        response.headers['Content-Disposition'] = f'attachment; filename="{full_filename}"'
        return response
    except Exception as e:
        return f"Gagal mendownload file: {str(e)}", 500

@app.route('/api/download-slides-zip', methods=['POST'])
def download_slides_zip():
    """
    Download selected slide images and package them into a ZIP archive.
    """
    data = request.get_json() or {}
    images = data.get('images', [])
    title = data.get('title', 'tiktok_slides')
    
    if not images:
        return jsonify({'status': 'error', 'message': 'Tidak ada gambar yang dipilih untuk didownload.'}), 400

    clean_title = re.sub(r'[^\w\s-]', '', title).strip().replace(' ', '_')[:30] or 'tiktok_slides'
    zip_filename = f"{clean_title}_slides.zip"

    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        for idx, img_url in enumerate(images, 1):
            try:
                full_img_url = ensure_absolute_url(img_url)
                resp = requests.get(full_img_url, headers=HEADERS, timeout=12, verify=False)
                if resp.status_code == 200:
                    img_ext = 'jpg'
                    if 'png' in resp.headers.get('Content-Type', '').lower():
                        img_ext = 'png'
                    zf.writestr(f"slide_{idx:02d}.{img_ext}", resp.content)
            except Exception as e:
                print(f"Failed to fetch image {img_url}: {e}")

    memory_file.seek(0)
    return send_file(
        memory_file,
        mimetype='application/zip',
        as_attachment=True,
        download_name=zip_filename
    )

def get_ffmpeg_binary():
    """
    Locate FFmpeg binary across systems (Windows, Linux, macOS).
    Tries shutil.which, imageio_ffmpeg, and common system locations.
    """
    # 1. System PATH
    ffmpeg_path = shutil.which('ffmpeg') or shutil.which('ffmpeg.exe')
    if ffmpeg_path and os.path.exists(ffmpeg_path):
        return ffmpeg_path

    # 2. imageio_ffmpeg module binary
    try:
        import imageio_ffmpeg
        ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
        if ffmpeg_path and os.path.exists(ffmpeg_path):
            return ffmpeg_path
    except Exception as e:
        print(f"imageio_ffmpeg lookup error: {e}")

    # 3. Common fallback locations
    common_paths = [
        '/usr/bin/ffmpeg',
        '/usr/local/bin/ffmpeg',
        'C:\\ffmpeg\\bin\\ffmpeg.exe',
        'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe'
    ]
    for p in common_paths:
        if os.path.exists(p):
            return p

    return None

@app.route('/api/convert-slides-to-video', methods=['POST'])
def convert_slides_to_video():
    """
    Convert selected photo slides into an MP4 video with smooth transitions
    and optional audio background track.

    Optimized to run in a single FFmpeg pass: each slide is prepared once as a
    full-frame canvas image, then FFmpeg's `xfade` filter renders the holds and
    transitions directly - instead of pre-rendering every frame to JPEG in Python.
    """
    data = request.get_json() or {}
    images = data.get('images', [])
    audio_url = ensure_absolute_url(data.get('audio_url', ''))
    duration_per_slide = float(data.get('duration_per_slide', 2.5))  # seconds
    transition_type = data.get('transition', 'slide_left')  # slide_left, slide_right, fade

    if not images or len(images) == 0:
        return jsonify({'status': 'error', 'message': 'Minimal 1 slide foto harus dipilih untuk dikonversi menjadi video.'}), 400

    target_w, target_h = 1080, 1920  # 9:16 vertical video standard
    fps = 30
    transition_duration = 0.5 if len(images) > 1 else 0.0  # seconds

    temp_dir = tempfile.mkdtemp()
    try:
        # 1. Download + prepare each slide as a full-frame canvas image (parallel & one-time only)
        def prepare_slide(args):
            idx, img_url = args
            try:
                full_img_url = ensure_absolute_url(img_url)
                resp = requests.get(full_img_url, headers=HEADERS, timeout=12, verify=False)
                if resp.status_code != 200:
                    return None

                img = Image.open(io.BytesIO(resp.content)).convert('RGB')

                # Scale image to fit within 1080x1920 while preserving aspect ratio
                img.thumbnail((target_w, target_h), Image.Resampling.LANCZOS)

                # Create background dark canvas and center the image on it
                canvas = Image.new('RGB', (target_w, target_h), (20, 24, 30))
                canvas.paste(img, ((target_w - img.width) // 2, (target_h - img.height) // 2))

                slide_path = os.path.join(temp_dir, f"slide_{idx:03d}.jpg")
                canvas.save(slide_path, quality=92)
                return slide_path
            except Exception as e:
                print(f"Error preparing slide {idx}: {e}")
                return None

        with ThreadPoolExecutor(max_workers=min(8, len(images))) as executor:
            prepared_paths = [p for p in executor.map(prepare_slide, enumerate(images)) if p]

        if not prepared_paths:
            return jsonify({'status': 'error', 'message': 'Gagal mengunduh foto slide untuk konversi video.'}), 500

        # 2. Download audio track if provided
        audio_file_path = None
        if audio_url:
            try:
                audio_resp = requests.get(audio_url, headers=HEADERS, timeout=12, verify=False, allow_redirects=True)
                if audio_resp.status_code == 200 and len(audio_resp.content) > 10000:
                    audio_file_path = os.path.join(temp_dir, "bg_audio.mp3")
                    with open(audio_file_path, 'wb') as f:
                        f.write(audio_resp.content)
            except Exception as e:
                print(f"Error downloading audio for video conversion: {e}")

        # 3. Locate ffmpeg executable safely across Windows/Linux/Mac
        ffmpeg_bin = get_ffmpeg_binary()
        if not ffmpeg_bin:
            return jsonify({'status': 'error', 'message': 'Program FFmpeg tidak ditemukan di sistem Anda. Pastikan FFmpeg terinstall di PATH.'}), 500

        # 4. Single-pass FFmpeg: looped slide inputs + chained xfade transitions
        num_slides = len(prepared_paths)
        xfade_map = {'slide_left': 'slideleft', 'slide_right': 'slideright', 'fade': 'fade'}
        xfade_transition = xfade_map.get(transition_type, 'slideleft')

        ffmpeg_cmd = [ffmpeg_bin, '-y']
        for slide_path in prepared_paths:
            ffmpeg_cmd.extend(['-loop', '1', '-framerate', str(fps), '-t', f"{duration_per_slide:.3f}", '-i', slide_path])
        if audio_file_path:
            ffmpeg_cmd.extend(['-i', audio_file_path])

        # Build chained xfade filter graph:
        #   [0:v][1:v]xfade=...:offset=(1)*(D-T)[v0]; [v0][2:v]...;[v{k}]format=yuv420p[vout]
        filters = []
        prev = "[0:v]"
        for i in range(num_slides - 1):
            offset = (i + 1) * (duration_per_slide - transition_duration)
            out = f"[v{i}]"
            filters.append(
                f"{prev}[{i + 1}:v]xfade=transition={xfade_transition}:duration={transition_duration:.3f}:offset={offset:.3f}{out}"
            )
            prev = out
        filters.append(f"{prev}format=yuv420p[vout]")
        ffmpeg_cmd.extend(['-filter_complex', ';'.join(filters)])

        ffmpeg_cmd.extend(['-map', '[vout]'])
        if audio_file_path:
            ffmpeg_cmd.extend(['-map', f'{num_slides}:a:0?', '-c:a', 'aac'])
        ffmpeg_cmd.extend(['-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-r', str(fps)])
        if audio_file_path:
            ffmpeg_cmd.extend(['-shortest'])

        output_video_path = os.path.join(temp_dir, "slideshow_video.mp4")
        ffmpeg_cmd.append(output_video_path)

        try:
            result = subprocess.run(ffmpeg_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        except (FileNotFoundError, OSError) as err:
            print(f"FFmpeg execution error: {err}")
            return jsonify({'status': 'error', 'message': f'Gagal menjalankan program FFmpeg: {str(err)}. Silakan pastikan FFmpeg terinstall di sistem Anda.'}), 500

        if not os.path.exists(output_video_path):
            stderr_log = result.stderr.decode('utf-8', errors='ignore')
            print(f"FFmpeg process error: {stderr_log}")
            return jsonify({'status': 'error', 'message': f'Gagal memproses video MP4 dengan FFmpeg: {stderr_log[:150]}'}), 500

        # Return file as download
        with open(output_video_path, 'rb') as f:
            video_bytes = f.read()

        filename = f"tiktok_slideshow_{uuid.uuid4().hex[:6]}.mp4"
        return send_file(
            io.BytesIO(video_bytes),
            mimetype='video/mp4',
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        print(f"Error converting slides to video: {e}")
        return jsonify({'status': 'error', 'message': f'Terjadi kesalahan saat konversi video: {str(e)}'}), 500
    finally:
        # Cleanup temporary files
        try:
            shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception:
            pass


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    app.run(host='0.0.0.0', port=port, debug=True)