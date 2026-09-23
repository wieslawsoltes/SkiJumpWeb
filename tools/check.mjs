import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version;
let checked = 0;
for (const name of fs.readdirSync(path.join(root, 'packages'))) {
    const dir = path.join(root, 'packages', name), p = JSON.parse(fs.readFileSync(path.join(dir, 'package.json')));
    for (const file of ['index.js', 'index.d.ts', 'README.md', 'LICENSE'])
        if (!fs.existsSync(path.join(dir, file)))
            throw Error(`${p.name}: missing ${file}`);
    if (p.version !== version || p.type !== 'module')
        throw Error(`Invalid package ${p.name}`);
    for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.js'))) {
        const r=spawnSync(process.execPath,['--check',path.join(dir,file)],{stdio:'inherit'});
        if(r.status)process.exit(r.status);
    }
    checked++;
}
for (const file of ['app/main.js', ...fs.readdirSync(path.join(root, 'tools')).filter(f => f.endsWith('.mjs')).map(f => 'tools/' + f)]) {
    const r = spawnSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'inherit' });
    if (r.status)
        process.exit(r.status);
}
console.log(`Checked ${checked} package manifests, publication files and all JavaScript syntax.`);
