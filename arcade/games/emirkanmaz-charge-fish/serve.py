#!/usr/bin/env python3
"""Yerel HTTPS sunucu. mkcert ile üretilmiş cert.pem + key.pem ister.

Kullanım:
    python3 serve.py            # 0.0.0.0:8443
    python3 serve.py 9000       # özel port
"""
import http.server
import socketserver
import ssl
import sys
from pathlib import Path

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8443
CERT = Path(__file__).parent / "cert.pem"
KEY = Path(__file__).parent / "key.pem"

if not CERT.exists() or not KEY.exists():
    sys.exit(
        "cert.pem / key.pem missing.\n"
        "Generate with: openssl req -x509 -newkey rsa:2048 -keyout key.pem "
        "-out cert.pem -days 365 -nodes -subj /CN=<your-ip>"
    )


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ctx.load_cert_chain(certfile=str(CERT), keyfile=str(KEY))

with socketserver.TCPServer(("0.0.0.0", PORT), NoCacheHandler) as httpd:
    httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
    print(f"https://localhost:{PORT}")
    print(f"https://192.168.1.196:{PORT}  ← telefondan aç")
    print("Durdurmak için Ctrl+C")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
