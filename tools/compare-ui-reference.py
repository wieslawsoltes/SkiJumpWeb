"""Compare externally captured original UI frames, without cropping or aligning them.

python tools/compare-ui-reference.py manifest.json --require-all --output ui-reference.json
This opt-in tool requires Pillow. Original assets are never bundled or downloaded.
"""
from pathlib import Path
import argparse
import hashlib
import json

SCREENS = ('main', 'hills', 'records', 'replay-library', 'replay-detail', 'sound',
           'world-cup', 'team-cup', 'result', 'standings')

def validate_manifest(data):
    if data.get('format') != 'ski-ui-reference' or data.get('version') != 1:
        raise ValueError('Expected ski-ui-reference version 1')
    frames = data.get('frames')
    if not isinstance(frames, list) or not 1 <= len(frames) <= len(SCREENS):
        raise ValueError('Provide a nonempty bounded UI reference list')
    seen = set()
    for frame in frames:
        screen = frame.get('screen')
        if screen not in SCREENS or screen in seen:
            raise ValueError('Unknown or duplicate UI screen')
        seen.add(screen)
        if frame.get('stateVerified') is not True or not isinstance(frame.get('source'),str) or not frame['source'].strip():
            raise ValueError('Provide source provenance and explicitly match language, focus, data and state')
        for name in ('reference','actual'):
            if not isinstance(frame.get(name),str) or not frame[name].strip():
                raise ValueError('Provide both local image paths')
    return frames

def compare(path, require_all=False):
    path=Path(path).resolve();frames=validate_manifest(json.loads(path.read_text()))
    from PIL import Image, ImageChops, ImageStat
    results=[]
    for frame in frames:
        reference=(path.parent/frame['reference']).resolve();actual=(path.parent/frame['actual']).resolve()
        if reference==actual: raise ValueError('A reference cannot be its own implementation capture')
        with Image.open(reference) as a, Image.open(actual) as b:
            if a.size!=(320,200) or b.size!=(320,200):
                raise ValueError('Supply native 320x200 frames; no implicit scaling/cropping is permitted')
            diff=ImageChops.difference(a.convert('RGB'),b.convert('RGB'));stats=ImageStat.Stat(diff)
            results.append({'screen':frame['screen'],'source':frame['source'],
                'referenceSha256':hashlib.sha256(reference.read_bytes()).hexdigest(),
                'actualSha256':hashlib.sha256(actual.read_bytes()).hexdigest(),
                'meanAbsoluteRGB':sum(stats.mean)/3,'pixelIdentical':diff.getbbox() is None})
    missing=sorted(set(SCREENS)-{r['screen'] for r in results})
    matched=all(r['pixelIdentical'] for r in results) and (not require_all or not missing)
    return {'status':'matched-submitted-frames' if matched else 'different-or-incomplete',
        'scope':'Submitted native UI captures only; not complete game certification',
        'allRequiredScreensMatch':not missing and all(r['pixelIdentical'] for r in results),
        'missing':missing,'frames':results,'exitCode':0 if matched else 1}

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('manifest');parser.add_argument('--require-all',action='store_true');parser.add_argument('--output',default='ui-reference.json');args=parser.parse_args()
    report=compare(args.manifest,args.require_all);Path(args.output).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2));return report['exitCode']
if __name__=='__main__':raise SystemExit(main())
