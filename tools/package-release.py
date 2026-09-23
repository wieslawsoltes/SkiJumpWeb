"""Build portable release ZIPs using only Python's standard library."""
from pathlib import Path
import hashlib
import json
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "release"
OUT.mkdir(exist_ok=True)
EXCLUDED = {".git", "node_modules", ".venv", "__pycache__", "_site", "release"}

def archive(destination, files):
    with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for file, name in sorted(files, key=lambda pair: pair[1]):
            info = zipfile.ZipInfo(name, date_time=(2026, 9, 22, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            z.writestr(info, file.read_bytes())

sources = [(p, "SkiJumpWeb/" + p.relative_to(ROOT).as_posix())
           for p in ROOT.rglob("*")
           if p.is_file() and not any(part in EXCLUDED for part in p.relative_to(ROOT).parts)
           and p.suffix != ".log" and p.name != ".DS_Store"]
archive(OUT / "SkiJumpWeb-source.zip", sources)
archive(OUT / "SkiJumpWeb-static.zip", [(p, p.relative_to(ROOT / "dist").as_posix())
        for p in (ROOT / "dist").rglob("*") if p.is_file()])
packages = sorted((ROOT / "artifacts").glob("*.tgz"))
if len(packages) != 10:
    raise RuntimeError(f"Expected 10 npm packages; found {len(packages)}")
archive(OUT / "SkiJumpWeb-npm-packages.zip", [(p, p.name) for p in packages])
(OUT / "SkiJumpWeb.html").write_bytes((ROOT / "SkiJumpWeb.html").read_bytes())
try:
    commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
except (OSError, subprocess.CalledProcessError):
    commit = None
manifest = {"name": "SkiJumpWeb", "version": json.loads((ROOT / "package.json").read_text())["version"], "commit": commit,
            "files": {p.name: {"bytes": p.stat().st_size,
                               "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}
                      for p in sorted(OUT.iterdir()) if p.suffix in {".zip", ".html"}}}
(OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(json.dumps(manifest, indent=2))
