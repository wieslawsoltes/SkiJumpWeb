"""Apply the independently validated source update without replacing publication metadata."""
from pathlib import Path
import hashlib, json, lzma, subprocess

def git_hash(path):
    return subprocess.check_output(['git', 'hash-object', str(path)], text=True).strip()

data = b''.join(Path(f'.maintenance/delta.{i}').read_bytes() for i in range(5))
assert hashlib.sha256(data).hexdigest() == 'e8beac9d476110b02f3ff572f85c81384c617a6db8c93aa3411f3a92dec8b654', 'Transfer checksum mismatch'
manifest = json.loads(lzma.decompress(data))
assert manifest['format'] == 'ski-source-delta' and manifest['version'] == 1
publication_files = {'README.md': '719b600a9c70482ed0544b7d33c8ebc50ddcc772', 'package.json': '65da3f8f15124916b9d855f24fddeec4907187ca'}
mismatches = []
for entry in manifest['files']:
    path = Path(entry['path'])
    assert not path.is_absolute() and '..' not in path.parts and path.parts[0] not in {'.git', '.github'}, 'Unsafe source path'
    if str(path) in publication_files:
        assert git_hash(path) == publication_files[str(path)], f'Publication metadata changed: {path}'
    elif entry['before'] is None:
        if path.exists(): mismatches.append(str(path))
    elif not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest() != entry['before']:
        mismatches.append(str(path))
assert not mismatches, f'Source bases differ: {mismatches}'
outputs, seen = [], set()
for entry in manifest['files']:
    path = Path(entry['path'])
    assert str(path) not in seen, 'Duplicate source path'
    seen.add(str(path))
    if str(path) in publication_files: continue
    text = path.read_bytes().decode('utf-8') if path.exists() else ''
    cursor, result = 0, []
    for offset, length, insert in entry['edits']:
        assert cursor <= offset <= offset + length <= len(text), f'Invalid edit: {path}'
        result.extend([text[cursor:offset], insert]); cursor = offset + length
    result.append(text[cursor:])
    output = ''.join(result).encode('utf-8')
    assert hashlib.sha256(output).hexdigest() == entry['after'], f'Output checksum mismatch: {path}'
    outputs.append((path, output))
package = Path('package.json')
pkg = json.loads(package.read_text())
pkg['version'] = '0.2.0'
pkg['scripts']['verify:packages'] = 'node tools/verify-packages.mjs'
outputs.append((package, (json.dumps(pkg, indent=2)+'\n').encode()))
release = Path('tools/package-release.py')
assert git_hash(release) == 'c29ce8eff95b8bd64c98b70f4ed5e2feb31615ef'
text = release.read_text()
old = '"version": "0.1.0", "commit": commit'
assert text.count(old) == 1
outputs.append((release, text.replace(old, '"version": json.loads((ROOT / "package.json").read_text())["version"], "commit": commit').encode()))
for path, output in outputs:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(output)
print(f'Applied {len(outputs)} verified source files; preserved published README for separate merge')
