"""Verify a deployed Pages release, including SHA-256 and subpath-safe assets.

Usage: python3 tools/verify-pages.py https://owner.github.io/SkiJumpWeb/ [COMMIT]
Uses the standard library only; intended to run after actions/deploy-pages.
"""
from __future__ import annotations

import hashlib
import io
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile

FILES = {"SkiJumpWeb-source.zip", "SkiJumpWeb-static.zip",
         "SkiJumpWeb-npm-packages.zip", "SkiJumpWeb.html"}
PACKAGES = {"audio", "competition", "core", "hills", "input", "physics",
            "renderer", "replay", "storage", "ui"}
MAX_BYTES = 64 * 1024 * 1024


def verify(base: str, expected_commit: str | None = None) -> dict:
    base = base.rstrip("/") + "/"
    parsed = urllib.parse.urlsplit(base)
    if parsed.scheme not in {"https", "http"} or not parsed.netloc or parsed.query or parsed.fragment:
        raise ValueError("Expected an absolute HTTP(S) site URL without a query or fragment")
    if parsed.scheme != "https" and parsed.hostname not in {"localhost", "127.0.0.1", "::1"}:
        raise ValueError("Public deployments must use HTTPS")

    def get(relative: str) -> bytes:
        url = urllib.parse.urljoin(base, relative)
        if not url.startswith(base):
            raise ValueError(f"Resource escapes the project URL: {relative}")
        request = urllib.request.Request(url, headers={"Cache-Control": "no-cache", "User-Agent": "SkiJumpWeb-release-verifier/1"})
        with urllib.request.urlopen(request, timeout=30) as response:
            if response.status != 200 or not response.url.startswith(base):
                raise ValueError(f"Unexpected response for {relative}: {response.status} {response.url}")
            data = response.read(MAX_BYTES + 1)
            if len(data) > MAX_BYTES:
                raise ValueError(f"Resource exceeds verification size limit: {relative}")
            return data

    manifest = json.loads(get("downloads/manifest.json"))
    if manifest.get("name") != "SkiJumpWeb" or set(manifest.get("files", {})) != FILES:
        raise ValueError("Unexpected release manifest or file set")
    if expected_commit and manifest.get("commit") != expected_commit:
        raise ValueError(f"CDN serves commit {manifest.get('commit')}; expected {expected_commit}")
    downloads = {}
    for name in sorted(FILES):
        data = get("downloads/" + name)
        entry = manifest["files"][name]
        if len(data) != entry["bytes"] or hashlib.sha256(data).hexdigest() != entry["sha256"]:
            raise ValueError(f"Release checksum mismatch: {name}")
        downloads[name] = data

    with zipfile.ZipFile(io.BytesIO(downloads["SkiJumpWeb-static.zip"])) as archive:
        if archive.testzip() is not None:
            raise ValueError("Corrupt static archive")
        for name in ("index.html", "app.js", "style.css", "sw.js", "manifest.webmanifest", "icon.svg"):
            if get(name) != archive.read(name):
                raise ValueError(f"Published asset does not match static release: {name}")
        index = archive.read("index.html").decode("utf-8")
        if './app.js' not in index or './style.css' not in index:
            raise ValueError("Game assets must resolve relative to the Pages project subpath")
        pwa = json.loads(archive.read("manifest.webmanifest"))
        if pwa.get("scope") != "./" or pwa.get("start_url") != "./":
            raise ValueError("PWA scope and start URL must be relative to the project")
        if get("") != archive.read("index.html"):
            raise ValueError("Project root does not serve the release index")

    with zipfile.ZipFile(io.BytesIO(downloads["SkiJumpWeb-source.zip"])) as archive:
        if archive.testzip() is not None:
            raise ValueError("Corrupt source archive")
        required = {"app/main.js", "app/index.html", "app/style.css", "tests/core.test.mjs",
                    "tests/browser_full.py", "tools/build.mjs", "tools/package-release.py",
                    ".github/workflows/ci.yml", ".github/workflows/pages.yml"}
        required |= {f"packages/{name}/{file}" for name in PACKAGES
                     for file in ("index.js", "index.d.ts", "package.json", "README.md", "LICENSE")}
        missing = {"SkiJumpWeb/" + name for name in required} - set(archive.namelist())
        if missing:
            raise ValueError(f"Source archive is incomplete: {sorted(missing)}")
        if archive.read("SkiJumpWeb/SkiJumpWeb.html") != downloads["SkiJumpWeb.html"]:
            raise ValueError("Standalone game differs between source and download")

    with zipfile.ZipFile(io.BytesIO(downloads["SkiJumpWeb-npm-packages.zip"])) as archive:
        expected = {f"wieslawsoltes-ski-{name}-{manifest['version']}.tgz" for name in PACKAGES}
        if set(archive.namelist()) != expected or archive.testzip() is not None:
            raise ValueError("npm archive must contain all ten valid package tarballs")
    if get("SkiJumpWeb.html") != downloads["SkiJumpWeb.html"]:
        raise ValueError("Standalone site link differs from the release")
    return {"url": base, "commit": manifest.get("commit"), "downloads": len(FILES),
            "packages": len(PACKAGES), "status": "verified"}


def main() -> int:
    if not 2 <= len(sys.argv) <= 3:
        print(__doc__, file=sys.stderr)
        return 2
    for attempt in range(1, 9):
        try:
            result = verify(sys.argv[1], sys.argv[2] if len(sys.argv) == 3 else None)
            print(json.dumps(result, indent=2))
            return 0
        except (OSError, ValueError, KeyError, zipfile.BadZipFile) as error:
            print(f"Verification attempt {attempt}/8: {error}", file=sys.stderr, flush=True)
            if attempt < 8:
                time.sleep(5)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
