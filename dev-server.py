#!/usr/bin/env python3
"""Static dev server with caching disabled, so ES module edits show on reload."""
import functools
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8137
ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()


http.server.ThreadingHTTPServer(
    ('', PORT), functools.partial(Handler, directory=ROOT)
).serve_forever()
