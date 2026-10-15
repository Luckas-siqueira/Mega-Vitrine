"""Atualiza hashes CSP após editar scripts das páginas públicas."""
import base64
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def policy(html):
    scripts = re.findall(r'<script\b[^>]*>([\s\S]*?)</script>', html, re.I)
    hashes = ["'sha256-" + base64.b64encode(hashlib.sha256(s.encode()).digest()).decode() + "'" for s in scripts]
    return "; ".join([
        "default-src 'self'",
        "script-src " + (" ".join(hashes) if hashes else "'none'"),
        "script-src-attr 'none'", "style-src 'self' 'unsafe-inline'",
        "img-src 'self' https:", "font-src 'self'", "connect-src 'self'",
        "object-src 'none'", "base-uri 'none'", "form-action 'self'",
        "frame-src 'none'", "worker-src 'none'", "media-src 'none'",
        "upgrade-insecure-requests",
    ])

if __name__ == '__main__':
    for path in ROOT.glob('*.html'):
        html = path.read_text()
        html = re.sub(r'<meta\s+http-equiv="Content-Security-Policy"[^>]*>\s*', '', html, flags=re.I)
        html = re.sub(r'<meta\s+name="referrer"[^>]*>\s*', '', html, flags=re.I)
        tags = '<meta http-equiv="Content-Security-Policy" content="' + policy(html) + '">\n<meta name="referrer" content="no-referrer">\n'
        html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n' + tags, 1)
        path.write_text(html)
        print('Política atualizada:', path.name)
