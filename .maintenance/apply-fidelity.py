"""Apply a checked source-only update. Every preimage is validated before writes."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import lzma

ROOT = Path.cwd().resolve()
data = b''.join((ROOT / '.maintenance' / f'fidelity.{i}').read_bytes() for i in range(5))
if hashlib.sha256(data).hexdigest() != 'f151386e7652303d12469c41e6fd17a5dbc63a88a15d2ae540609c9553aa17ab':
    raise RuntimeError('Source transfer checksum mismatch')
manifest = json.loads(lzma.decompress(data))
if manifest.get('format') != 'ski-reference-delta' or manifest.get('version') != 1:
    raise RuntimeError('Unsupported source update')
if manifest.get('base') != '3475d4d1704feeb8c642dc049e5a81780a773edf':
    raise RuntimeError('Unexpected source baseline')
outputs, seen = [], set()
for entry in manifest['files']:
    name = entry['path']
    relative = PurePosixPath(name)
    if (not name or relative.is_absolute() or '..' in relative.parts or '\\' in name
            or relative.parts[0] in {'.git', '.github', '.maintenance'} or name in seen):
        raise RuntimeError(f'Unsafe or duplicate path: {name}')
    seen.add(name)
    path = ROOT / name
    if not path.resolve().is_relative_to(ROOT) or any(p.is_symlink() for p in [path, *path.parents] if p != ROOT.parent):
        raise RuntimeError(f'Symlink or escaped path: {name}')
    exists = path.exists()
    raw = path.read_bytes() if exists else b''
    if entry['before'] is None:
        if exists:
            raise RuntimeError(f'Unexpected existing file: {name}')
    elif not exists or hashlib.sha256(raw).hexdigest() != entry['before']:
        raise RuntimeError(f'Source changed: {name}')
    text, cursor, fragments = raw.decode('utf-8'), 0, []
    for offset, length, insert in entry['edits']:
        if not (isinstance(offset, int) and isinstance(length, int) and isinstance(insert, str)
                and cursor <= offset <= offset + length <= len(text)):
            raise RuntimeError(f'Invalid source edit: {name}')
        fragments.extend([text[cursor:offset], insert])
        cursor = offset + length
    fragments.append(text[cursor:])
    output = ''.join(fragments).encode('utf-8')
    if hashlib.sha256(output).hexdigest() != entry['after']:
        raise RuntimeError(f'Output checksum mismatch: {name}')
    outputs.append((path, output))
if len(outputs) != 47:
    raise RuntimeError('Unexpected source file count')
for path, output in outputs:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(output)
print(f'Applied {len(outputs)} preimage- and output-verified source files')
