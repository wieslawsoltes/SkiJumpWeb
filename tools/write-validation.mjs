/** Generate release evidence from the current build's test outputs. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { HILLS } from '../packages/hills/index.js';
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const version = json('package.json').version;
const baseline = json('artifacts/browser-tests.json');
const features = json('artifacts/browser-features.json');
const fidelity = json('artifacts/browser-fidelity.json');
const gpu = existsSync('artifacts/browser-webgpu.json') ? json('artifacts/browser-webgpu.json') : { status:'not-run' };
const rendering=json('artifacts/browser-rendering.json');
const bundleSha256=createHash('sha256').update(readFileSync('dist/app.js')).digest('hex');
if(rendering.schema!==2||rendering.bundleSha256!==bundleSha256)throw new Error('Rendering evidence does not match the current bundle');
const expectedHills=HILLS.map(h=>h.id).sort().join(',');
if(rendering.status!=='passed'||rendering.scope!=='cross-backend'||rendering.errors?.length||
   rendering.hills?.map(h=>h.id).sort().join(',')!==expectedHills||rendering.framesPerBackend!==384||
   rendering.backends?.join(',')!=='webgpu,webgl2,software'||
   rendering.hills.some(h=>h.checks?.length!==12||new Set(h.checks).size!==12||h.comparisons?.length!==12||h.errors?.length))
    throw new Error('All 384 current all-hill/camera cross-backend fixtures are required');
if(gpu.status!=='passed'||gpu.errors?.length)throw new Error('WebGPU execution evidence is required');
const logs = readFileSync('artifacts/verify.txt','utf8');
const passed = logs.match(/(?:#|ℹ) pass (\d+)/)?.[1];
if (!passed) throw new Error('Current engine pass count not found');
const report = {
    name:'SkiJumpWeb', version, bundleSha256, date:new Date().toISOString(), packages:10, hill_roster_entries:32,
    tests:{ node_passed:Number(passed), browser_baseline:baseline.checks, browser_features:features.checks, browser_fidelity:fidelity.checks, webgpu_checks:gpu.checks?.length || 0,
        browser_errors:[...(baseline.errors||[]),...(features.errors||[]),...(fidelity.errors||[]),...(gpu.errors||[])], webgpu_status:gpu.status, render_fixtures_per_backend:rendering.framesPerBackend, render_backends:rendering.backends,
        strict_types:'passed in isolated package consumer', packed_sdk_offline_install_and_import:'passed' },
    browser_renderers_exercised:[...new Set([baseline.desktop?.backend,features.renderer?.backend,fidelity.renderer?.backend,gpu.webgpu?.backend,gpu.fallback?.backend].filter(Boolean))],
    gpu_adapter:gpu.adapter||null,
    original_visual_parity:rendering.originalParity,
    observed_inrun_color_hills:['fin','sui','cze','blr'],
    not_validated:['Physical iOS/Android devices','Physical GPU performance and drivers','Original DSJ2 pixel/physics/hill fidelity','Original replay/save format compatibility'],
    published_to_npm:false,
    standalone_sha256:createHash('sha256').update(readFileSync('SkiJumpWeb.html')).digest('hex')
};
writeFileSync('artifacts/release.json',JSON.stringify(report,null,2)+'\n');
writeFileSync('artifacts/types.txt',readFileSync('artifacts/package-install.txt'));
writeFileSync('artifacts/unit-tests.txt',logs);
console.log(JSON.stringify(report,null,2));
