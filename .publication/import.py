"""One-time, integrity-checked import of the delivered SkiJumpWeb sources."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import lzma
import shutil

root = Path(__file__).resolve().parents[1]
payload = b''.join((root / '.publication' / f'{i:02d}.xzpart').read_bytes() for i in range(8))
expected = '93c4783dd0c40c32c1a5db41527b1dff8756d2e51e18e7101472ebd2857a0bb4'
if len(payload) != 69196 or hashlib.sha256(payload).hexdigest() != expected:
    raise RuntimeError('Source payload integrity check failed')
files = json.loads(lzma.decompress(payload))
if not isinstance(files, dict) or len(files) != 75:
    raise RuntimeError('Unexpected source manifest')
for name, content in files.items():
    path = PurePosixPath(name)
    if (not isinstance(content, str) or path.is_absolute() or '\\' in name
            or '..' in path.parts or not path.parts
            or any(part in {'.git', '.github', '.publication'} for part in path.parts)):
        raise RuntimeError(f'Invalid source path: {name}')
    destination = root.joinpath(*path.parts)
    if not destination.resolve().is_relative_to(root):
        raise RuntimeError(f'Source escapes repository: {name}')
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(content.encode('utf-8'))
    print(f'Imported {name}')
shutil.rmtree(root / '.publication')
print(f'Imported {len(files)} files; SHA-256 {expected}; transfer payload removed.')
