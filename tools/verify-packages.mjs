/** Install actual packed artifacts in an isolated offline consumer, never workspace links. */
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync, existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const names = readdirSync(path.join(root, 'packages')).sort();
const tarballs = readdirSync(path.join(root, 'artifacts')).filter(f => f.endsWith('.tgz')).sort();
const expected = names.map(n => `wieslawsoltes-ski-${n}-${version}.tgz`).sort();
if (JSON.stringify(tarballs) !== JSON.stringify(expected)) throw new Error('Unexpected or stale packed package set');
const dir = mkdtempSync(path.join(tmpdir(), 'ski-consumer-'));
function run(command, args) {
    const p = spawnSync(command, args, { cwd: dir, stdio: 'inherit' });
    if (p.error) throw p.error;
    if (p.status !== 0) throw new Error(`${command} exited with ${p.status}`);
}
try {
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
    run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install','--offline','--ignore-scripts','--no-audit','--no-fund',...tarballs.map(n => path.join(root,'artifacts',n))]);
    for (const name of names) {
        const location = path.join(dir,'node_modules','@wieslawsoltes',`ski-${name}`);
        if (!realpathSync(location).startsWith(dir + path.sep)) throw new Error('Consumer resolves to workspace links');
        const manifest = JSON.parse(readFileSync(path.join(location,'package.json'),'utf8'));
        if (manifest.version !== version) throw new Error('Installed package version mismatch');
        for (const file of ['index.js','index.d.ts','LICENSE','README.md'])
            if (!existsSync(path.join(location,file))) throw new Error(`Missing publication file ${name}/${file}`);
    }
    writeFileSync(path.join(dir,'smoke.mjs'), names.map(n=>`await import('@wieslawsoltes/ski-${n}');`).join('\n')+`\nconsole.log('Imported ${names.length} independently installed packages ${version}');`);
    run(process.execPath,['smoke.mjs']);
    writeFileSync(path.join(dir,'consumer.mts'), readFileSync(path.join(root,'tests/types/consumer.mts')));
    if (process.argv.includes('--types')) {
        run(process.env.TSC || (process.platform==='win32'?'tsc.cmd':'tsc'), ['--noEmit','--strict','--target','ES2022','--module','NodeNext','--moduleResolution','NodeNext','--lib','ES2022,DOM','consumer.mts']);
        console.log('Strict TypeScript consumer passed');
    }
} finally { rmSync(dir, { recursive: true, force: true }); }
