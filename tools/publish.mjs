// Explicit opt-in only: requires ownership/access to the package namespace.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const names = ['core', 'hills', 'physics', 'competition', 'replay', 'renderer', 'audio', 'input', 'storage', 'ui'];
if (!process.argv.includes('--confirm')) {
    console.log('No packages published. Review names, versions, licenses and registry credentials, then run node tools/publish.mjs --confirm');
    process.exit(0);
}
for (const name of names) {
    const cwd = path.join(root, 'packages', name);
    if (!fs.existsSync(path.join(cwd, 'README.md')))
        throw Error('Incomplete package ' + name);
    const r = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['publish', '--access', 'public'], { cwd, stdio: 'inherit' });
    if (r.status)
        process.exit(r.status);
}
