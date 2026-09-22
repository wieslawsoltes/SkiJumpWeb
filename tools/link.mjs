import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), dir = path.join(root, 'node_modules/@wieslawsoltes');
fs.mkdirSync(dir, { recursive: true });
for (const name of fs.readdirSync(path.join(root, 'packages'))) {
    const target = path.join(root, 'packages', name), link = path.join(dir, 'ski-' + name);
    if (!fs.existsSync(link))
        fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
}
