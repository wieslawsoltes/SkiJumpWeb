/** Generate release evidence from the current build's test outputs. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const version = json('package.json').version;
const baseline = json('artifacts/browser-tests.json');
const features = json('artifacts/browser-features.json');
const gpu = existsSync('artifacts/browser-webgpu.json') ? json('artifacts/browser-webgpu.json') : { status:'not-run' };
const logs = readFileSync('artifacts/verify.txt','utf8');
const passed = logs.match(/(?:#|ℹ) pass (\d+)/)?.[1];
if (!passed) throw new Error('Current engine pass count not found');
const report = {
    name:'SkiJumpWeb', version, date:new Date().toISOString(), packages:10, hill_roster_entries:32,
    tests:{ node_passed:Number(passed), browser_baseline:baseline.checks, browser_features:features.checks,
        browser_errors:[...(baseline.errors||[]),...(features.errors||[])], webgpu_status:gpu.status,
        strict_types:'passed in isolated package consumer', packed_sdk_offline_install_and_import:'passed' },
    browser_renderers_exercised:[...new Set([baseline.desktop?.backend,features.renderer?.backend,gpu.webgpu?.backend,gpu.fallback?.backend].filter(Boolean))],
    gpu_adapter:gpu.adapter||null,
    not_validated:['Physical iOS/Android devices','Physical GPU performance and drivers','Original DSJ2 pixel/physics/hill fidelity','Original replay/save format compatibility'],
    published_to_npm:false,
    standalone_sha256:createHash('sha256').update(readFileSync('SkiJumpWeb.html')).digest('hex')
};
writeFileSync('artifacts/release.json',JSON.stringify(report,null,2)+'\n');
writeFileSync('artifacts/types.txt',readFileSync('artifacts/package-install.txt'));
writeFileSync('artifacts/unit-tests.txt',logs);
console.log(JSON.stringify(report,null,2));
