import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let checked = 0;
for (const name of fs.readdirSync(path.join(root, 'packages'))) {
    const dir = path.join(root, 'packages', name), p = JSON.parse(fs.readFileSync(path.join(dir, 'package.json')));
    for (const file of ['index.js', 'index.d.ts', 'README.md', 'LICENSE'])
        if (!fs.existsSync(path.join(dir, file)))
            throw Error(`${p.name}: missing ${file}`);
    if (p.version !== '0.1.0' || p.type !== 'module')
        throw Error(`Invalid package ${p.name}`);
    const r = spawnSync(process.execPath, ['--check', path.join(dir, 'index.js')], { stdio: 'inherit' });
    if (r.status)
        process.exit(r.status);
    checked++;
}
for (const file of ['app/main.js', ...fs.readdirSync(path.join(root, 'tools')).filter(f => f.endsWith('.mjs')).map(f => 'tools/' + f)]) {
    const r = spawnSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'inherit' });
    if (r.status)
        process.exit(r.status);
}
console.log(`Checked ${checked} package manifests, publication files and all JavaScript syntax.`);
