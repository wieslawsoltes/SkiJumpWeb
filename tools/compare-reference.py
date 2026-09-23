"""Compare externally supplied original-reference frames without bundling game assets.

Usage: python tools/compare-reference.py manifest.json [--require-all-hills]
Install Pillow to read PNGs. Paths resolve relative to the manifest. No cropping,
rescaling, registration, masks or automatic camera alignment are applied. Exact
matching of submitted frames is not a proof of all possible gameplay trajectories.
"""
from pathlib import Path
import argparse, hashlib, json

HILLS = 'fin sui cze blr aut usa lat pol jpn bel isl eng ger est nor aus irl ukr hun swe ita den svk can ltu kaz chn fra ned rus kor slo'.split()
PHASES = ['gate','board','flight','landing']

def compare(path, require_all=False):
    from PIL import Image, ImageChops, ImageStat
    path=Path(path).resolve(); data=json.loads(path.read_text()); seen=set(); rows=[]
    if data.get('format')!='ski-reference-frames' or data.get('version')!=1:
        raise ValueError('Expected ski-reference-frames version 1')
    frames=data.get('frames')
    if not isinstance(frames,list) or len(frames)>2048:raise ValueError('Invalid frame list')
    for entry in frames:
        key=(entry['hill'],entry['phase'])
        if key[0] not in HILLS or key[1] not in PHASES or key in seen:raise ValueError('Unknown or duplicate hill/phase')
        if entry.get('poseVerified') is not True or not entry.get('source'):raise ValueError('Provide source provenance and explicitly verify matching camera/state')
        seen.add(key)
        ref=(path.parent/entry['reference']).resolve();actual=(path.parent/entry['actual']).resolve()
        with Image.open(ref) as a,Image.open(actual) as b:
            if a.size!=(320,200) or a.size!=b.size:raise ValueError('Expected matching native 320x200 frames; rescaling is not a fidelity check')
            delta=ImageChops.difference(a.convert('RGB'),b.convert('RGB'));stats=ImageStat.Stat(delta)
            rows.append({'hill':key[0],'phase':key[1],'source':entry['source'],
                'referenceSha256':hashlib.sha256(ref.read_bytes()).hexdigest(),
                'actualSha256':hashlib.sha256(actual.read_bytes()).hexdigest(),
                'meanAbsoluteRGB':sum(stats.mean)/3,'maximumChannelError':max(x[1] for x in stats.extrema),
                'pixelIdentical':delta.getbbox() is None})
    missing=[{'hill':h,'phase':p} for h in HILLS for p in PHASES if (h,p) not in seen]
    complete=not missing and all(r['pixelIdentical'] for r in rows)
    return {'status':'matched' if complete else 'incomplete-or-different','scope':'submitted native reference frames, not whole-game certification',
            'allRequiredFramesMatch':complete,'requiredFrames':128,'submittedFrames':len(rows),'missing':missing,'frames':rows,
            'exitCode':1 if require_all and not complete else 0}

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('manifest');parser.add_argument('--require-all-hills',action='store_true');parser.add_argument('--output',default='original-frame-comparison.json');args=parser.parse_args()
    report=compare(args.manifest,args.require_all_hills);Path(args.output).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2));return report['exitCode']
if __name__=='__main__':raise SystemExit(main())
