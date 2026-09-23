import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const names = ['core', 'hills', 'physics', 'competition', 'replay', 'renderer', 'audio', 'input', 'storage', 'ui'];
const out = path.join(root, 'dist');
fs.mkdirSync(out, { recursive: true });
// This deliberately small bundler accepts only the static, named ESM imports used
// by this workspace. There is no eval, runtime fetching, or external dependency.
const compiled = new Map();
function compile(id, file) {
    if(compiled.has(id))return;
    // Mark before walking dependencies; definitions are registered before require.
    compiled.set(id, '');
    let source=fs.readFileSync(file,'utf8');
    const exports=[...source.matchAll(/\bexport\s+(?:const|let|class|function)\s+(\w+)/g)].map(m=>m[1]);
    source=source.replace(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g,(_,what,from)=>{
        let target=from;
        if(from.startsWith('.')){
            const resolved=path.resolve(path.dirname(file),from);
            const packageDir=path.join(root,'packages',id.replace('@wieslawsoltes/ski-','').split('/')[0]);
            if(!resolved.startsWith(packageDir+path.sep)||path.extname(resolved)!=='.js')throw new Error('Unsafe relative module '+from);
            target=id.split('/').slice(0,2).join('/')+'/'+path.relative(packageDir,resolved).split(path.sep).join('/');
            compile(target,resolved);
        }
        return `const {${what.replace(/\s+as\s+/g,':')}}=require(${JSON.stringify(target)});`;
    }).replace(/\bexport\s*\{([^}]+)\};?/g,(_,names)=>{
        for(const name of names.split(',').map(s=>s.trim())){
            if(!/^[A-Za-z_$][\w$]*$/.test(name))throw new Error('Unsupported re-export '+name);
            exports.push(name);
        }
        return '';
    }).replace(/\bexport\s+(?=const|let|class|function)/g,'');
    if(/(^|\n)\s*(?:import|export)\s/.test(source))throw new Error('Unsupported import/export in '+file);
    compiled.set(id,`define(${JSON.stringify(id)},function(require){\n${source}\nreturn {${[...new Set(exports)].join(',')}};\n});\n`);
}
let js = `/*! SkiJumpWeb ${version} - independent recreation, MIT. See README for scope. */\n(function(){'use strict';\nconst modules=new Map(),cache=new Map();\nfunction define(id,factory){modules.set(id,factory)}\nfunction require(id){if(cache.has(id))return cache.get(id);const factory=modules.get(id);if(!factory)throw new Error('Missing module '+id);const exports=factory(require);cache.set(id,exports);return exports}\n`;
for (const name of names)
    compile('@wieslawsoltes/ski-' + name, path.join(root, 'packages', name, 'index.js'));
compile('app', path.join(root, 'app/main.js'));
js += [...compiled.values()].join('') + `require('app');\n})();\n`;
const css = fs.readFileSync(path.join(root, 'app/style.css'), 'utf8');
let html = fs.readFileSync(path.join(root, 'app/index.html'), 'utf8');
fs.writeFileSync(path.join(out, 'app.js'), js);
fs.writeFileSync(path.join(out, 'style.css'), css);
fs.writeFileSync(path.join(out, 'index.html'), html);
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="20" fill="#222428"/><path d="M10 104 113 68M18 113 120 77" fill="none" stroke="#eeee43" stroke-width="7"/><circle cx="78" cy="28" r="10" fill="#eeee43"/><path d="m69 40-22 25 30 13m-29-14 47-17M46 66l-18 19" fill="none" stroke="#eee" stroke-width="9" stroke-linecap="square"/></svg>`;
fs.writeFileSync(path.join(out, 'icon.svg'), icon);
fs.writeFileSync(path.join(out, 'manifest.webmanifest'), JSON.stringify({ id: './', name: 'SkiJumpWeb', short_name: 'SkiJumpWeb', description: 'Classic ski jumping. 32 hills, local cups and replays.', start_url: './', scope: './', display: 'fullscreen', background_color: '#17181b', theme_color: '#202124', icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }] }, null, 2));
const stamp = (await import('node:crypto')).createHash('sha256').update(js + css + html).digest('hex').slice(0, 12);
fs.writeFileSync(path.join(out, 'sw.js'), `const CACHE='ski-jump-web-${stamp}';\nself.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['./','./index.html','./style.css','./app.js','./icon.svg','./manifest.webmanifest'])).then(()=>self.skipWaiting())));\nself.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ski-jump-web-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));\nself.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(fetch(e.request).catch(()=>caches.match(e.request).then(r=>r||(e.request.mode==='navigate'?caches.match('./index.html'):Response.error()))))});\n`);
// The standalone build has no imports, assets, fonts or network dependencies.
html = html.replace(/<link[^>]+rel="manifest"[^>]*>/g, '').replace(/<link[^>]+rel="icon"[^>]*>/g, '').replace(/<link[^>]+href="\.\/style.css"[^>]*>/, () => `<style>${css}</style>`).replace(/<script src="\.\/app.js" defer><\/script>/, () => `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>`);
fs.writeFileSync(path.join(root, 'SkiJumpWeb.html'), html);
console.log(`Built dist/ and SkiJumpWeb.html (${(Buffer.byteLength(html) / 1024).toFixed(1)} KiB, no runtime dependencies).`);
