"""Standard-library regression tests for deployed-release verification."""
from __future__ import annotations

import hashlib
import importlib.util
import io
import json
from pathlib import Path
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import zipfile

SPEC = importlib.util.spec_from_file_location("verify_pages", Path(__file__).resolve().parents[1] / "tools/verify-pages.py")
verifier = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(verifier)
COMMIT = "a" * 40


def zipped(files):
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, data in files.items():
            archive.writestr(name, data)
    return out.getvalue()


class PagesVerificationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                data = cls.resources.get(self.path)
                self.send_response(200 if data is not None else 404)
                self.end_headers()
                self.wfile.write(data if data is not None else b"Not found")

            def log_message(self, *_args):
                pass
        cls.resources = {}
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.server.server_port}/SkiJumpWeb/"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self):
        self.static = {"index.html": b'<script src="./app.js"></script><link href="./style.css">',
                       "app.js": b"game()", "style.css": b"body{}", "sw.js": b"cache()",
                       "icon.svg": b"<svg/>", "manifest.webmanifest": b'{"scope":"./","start_url":"./"}'}
        self.source = {"SkiJumpWeb/" + name: b"source" for name in (
            "app/main.js", "app/index.html", "app/style.css", "tests/core.test.mjs",
            "tests/browser_full.py", "tools/build.mjs", "tools/package-release.py",
            ".github/workflows/ci.yml", ".github/workflows/pages.yml")}
        self.source.update({f"SkiJumpWeb/packages/{name}/{file}": b"package source"
                            for name in verifier.PACKAGES
                            for file in ("index.js", "index.d.ts", "package.json", "README.md", "LICENSE")})
        self.source["SkiJumpWeb/SkiJumpWeb.html"] = b"standalone game"
        self.packages = {f"wieslawsoltes-ski-{name}-0.1.0.tgz": b"tarball" for name in verifier.PACKAGES}
        self.publish()

    def publish(self):
        downloads = {"SkiJumpWeb-static.zip": zipped(self.static),
                     "SkiJumpWeb-source.zip": zipped(self.source),
                     "SkiJumpWeb-npm-packages.zip": zipped(self.packages),
                     "SkiJumpWeb.html": b"standalone game"}
        manifest = {"name": "SkiJumpWeb", "version": "0.1.0", "commit": COMMIT,
                    "files": {name: {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
                              for name, data in downloads.items()}}
        resources = {"/SkiJumpWeb/" + name: data for name, data in self.static.items()}
        resources["/SkiJumpWeb/"] = self.static["index.html"]
        resources["/SkiJumpWeb/SkiJumpWeb.html"] = b"standalone game"
        resources.update({"/SkiJumpWeb/downloads/" + name: data for name, data in downloads.items()})
        resources["/SkiJumpWeb/downloads/manifest.json"] = json.dumps(manifest).encode()
        type(self).resources = resources

    def test_complete_release_at_project_subpath(self):
        result = verifier.verify(self.base, COMMIT)
        self.assertEqual(result["status"], "verified")
        self.assertEqual(result["packages"], 10)
        self.assertEqual(result["downloads"], 4)

    def test_stale_commit_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "CDN serves commit"):
            verifier.verify(self.base, "b" * 40)

    def test_corrupt_download_is_rejected(self):
        self.resources["/SkiJumpWeb/downloads/SkiJumpWeb.html"] += b"corruption"
        with self.assertRaisesRegex(ValueError, "checksum mismatch"):
            verifier.verify(self.base, COMMIT)

    def test_stale_live_javascript_is_rejected(self):
        self.resources["/SkiJumpWeb/app.js"] = b"old game()"
        with self.assertRaisesRegex(ValueError, "Published asset"):
            verifier.verify(self.base, COMMIT)

    def test_origin_root_pwa_scope_is_rejected(self):
        self.static["manifest.webmanifest"] = b'{"scope":"/","start_url":"/"}'
        self.publish()
        with self.assertRaisesRegex(ValueError, "PWA scope"):
            verifier.verify(self.base, COMMIT)

    def test_missing_source_module_is_rejected(self):
        del self.source["SkiJumpWeb/packages/physics/index.js"]
        self.publish()
        with self.assertRaisesRegex(ValueError, "Source archive is incomplete"):
            verifier.verify(self.base, COMMIT)

    def test_missing_npm_package_is_rejected(self):
        self.packages.pop(next(iter(self.packages)))
        self.publish()
        with self.assertRaisesRegex(ValueError, "all ten"):
            verifier.verify(self.base, COMMIT)

    def test_mismatched_standalone_link_is_rejected(self):
        self.resources["/SkiJumpWeb/SkiJumpWeb.html"] = b"older game"
        with self.assertRaisesRegex(ValueError, "Standalone site link"):
            verifier.verify(self.base, COMMIT)

    def test_insecure_public_url_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "must use HTTPS"):
            verifier.verify("http://example.com/SkiJumpWeb/")


if __name__ == "__main__":
    unittest.main()
