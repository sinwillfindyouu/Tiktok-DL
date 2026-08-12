"""Vercel serverless entry point (WSGI wrapper) untuk aplikasi Flask.

Vercel Python runtime menjalankan file di folder `api/` sebagai serverless
function dan menginstal `requirements.txt` (root) secara otomatis.
Garis besarnya:
    - `app.py` di root tetap menjadi aplikasi Flask utama.
    - File ini cukup mengimpor objek Flask dan mengeksposnya sebagai `application`.
"""

import os
import sys

# Pastikan direktori root project (tempat `app.py` berada) dapat di-import.
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from app import app as application  # noqa: E402

# Beberapa konfigurasi runtime Vercel/WSGI lama mengharapkan variabel bernama `app`.
app = application  # type: ignore[attr-defined]