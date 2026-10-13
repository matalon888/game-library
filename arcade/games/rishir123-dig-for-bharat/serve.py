#!/usr/bin/env python3
"""Dev server for Dig for Bharat.

Plain static files, but with caching turned off so an edit to game.js
shows up on a normal reload instead of a hard one.

    python3 serve.py [port]     default port 5173
"""
import http.server, socketserver, sys, os, webbrowser, threading

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("  %s\n" % (fmt % args))


class Server(socketserver.TCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    url = "http://localhost:%d/" % PORT
    with Server(("127.0.0.1", PORT), Handler) as httpd:
        print("\n  Dig for Bharat — trench open at %s" % url)
        print("  Ctrl-C to backfill.\n")
        if "--no-open" not in sys.argv:
            threading.Timer(0.6, lambda: webbrowser.open(url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  Trench closed.\n")
