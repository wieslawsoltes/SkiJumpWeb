import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), out = path.join(root, 'artifacts');
fs.mkdirSync(out, { recursive: true });
for (const file of fs.readdirSync(out)) {
    if (/^wieslawsoltes-ski-[a-z]+-[0-9][^/]*\.tgz$/.test(file)) fs.unlinkSync(path.join(out, file));
}
for (const name of fs.readdirSync(path.join(root, 'packages'))) {
    const p = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['pack', '--pack-destination', out], { cwd: path.join(root, 'packages', name), stdio: 'inherit' });
    if (p.status)
        process.exit(p.status);
}
