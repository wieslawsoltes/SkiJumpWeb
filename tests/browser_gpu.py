"""Secure-origin WebGPU render/compute validation on an available browser adapter.

Run on a normal local/CI host with Chromium + Playwright. --require-webgpu fails
rather than skips when no adapter exists. SwiftShader validates the WebGPU API,
not physical GPU performance. No browser security policies are modified.
"""
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright
import functools, json, os, sys, threading

ROOT = Path(__file__).resolve().parents[1]
NAMES = ['core','hills','physics','competition','replay','renderer','audio','input','storage','ui']
IMPORTS = {f'@wieslawsoltes/ski-{name}':f'/SkiJumpWeb/packages/{name}/index.js' for name in NAMES}
HARNESS = '''<!doctype html><meta charset="utf-8"><title>WebGPU validation</title>
<style>html,body{margin:0}#host{width:800px;height:500px}canvas{width:100%;height:100%}</style><div id="host"></div>
<script type="importmap">'''+json.dumps({'imports':IMPORTS})+'''</script>
<script type="module">
import { SkiRenderer } from '@wieslawsoltes/ski-renderer';
import { HILLS } from '@wieslawsoltes/ski-hills';
import { JumpSimulation, CPUController } from '@wieslawsoltes/ski-physics';
const report={status:'running',checks:[],errors:[],scope:'Browser WebGPU API; adapter identity recorded. Not physical-device certification.'};
window.report=report;
function check(value,name){if(!value)throw new Error(name);report.checks.push(name);}
try {
 check(isSecureContext,'secure-origin test harness');
 const adapter=await navigator.gpu?.requestAdapter();
 if(!adapter){report.status='skipped';report.reason='No WebGPU adapter';}
 else {
  const info=adapter.info;
  report.adapter=info?{vendor:info.vendor,architecture:info.architecture,device:info.device,description:info.description,isFallbackAdapter:info.isFallbackAdapter}:null;
  const renderer=new SkiRenderer(document.getElementById('host'),{renderer:'auto'});window.renderer=renderer;await renderer.ready;
  check(renderer.kind==='webgpu','renderer uses WebGPU, not a hidden fallback: '+renderer.fallbackReason);
  const device=renderer.device;device.pushErrorScope('validation');
  const staging=renderer.dynamicData, uniforms=renderer.uniformData;
  for(const hill of HILLS){
   const sim=new JumpSimulation(hill,{seed:42,rules:'dsj210'});const cpu=new CPUController(42,.98);
   renderer.setHill(hill);
   for(let i=0;i<1800 && sim.state.phase!=='flight';i++){cpu.update(sim);sim.step();}
   for(const weather of ['clear','snow','dusk','night']){
    renderer.setOptions({weather});renderer.render(sim.state,{},1/60,false,sim.state);
   }
   await device.queue.onSubmittedWorkDone();
   check(renderer.vertexCount>0&&renderer.vertexCount%3===0,'render hill '+hill.id+' in four weather modes');
  }
  check(renderer.dynamicData===staging&&renderer.uniformData===uniforms,'reused dynamic/uniform staging storage');
  const sim=new JumpSimulation('fin',{seed:42,rules:'dsj210'}); const cpu=new CPUController(42,.98);
  renderer.setHill('fin');
  for(let i=0;i<14400&&sim.state.phase!=='finished';i++){
   cpu.update(sim);sim.step();if(i%24===0)renderer.render(sim.state,{},1/60);
  }
  check(sim.state.phase==='finished','full simulation renders through landing');
  for(const size of [[390,844],[844,390]]){
   const host=document.getElementById('host');host.style.width=size[0]+'px';host.style.height=size[1]+'px';
   renderer.setOptions({resolution:'sharp'});renderer.render(sim.state,{},1/60);
   check(renderer.width>0&&renderer.height>0,'WebGPU resize '+size.join('x'));
  }
  await device.queue.onSubmittedWorkDone();
  const error=await device.popErrorScope();check(!error,'no render/compute validation errors: '+error?.message);
  check(!renderer.lastError,'no uncaptured WebGPU errors');
  report.webgpu=renderer.diagnostics();
  device.destroy();await device.lost;await new Promise(resolve=>setTimeout(resolve,50));await renderer.ready;
  check(['webgl2','software'].includes(renderer.kind),'device loss recovers to a usable fallback');
  check(renderer.losses===1,'device loss counted once');
  renderer.render(sim.state,{},1/60);report.fallback=renderer.diagnostics();
  renderer.dispose();check(!document.querySelector('#host canvas'),'dispose removes render surface');
  report.status='passed';
 }
}catch(error){report.status='failed';report.errors.push(error.stack||String(error));}
window.done=true;
</script>'''

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(ROOT),**kwargs)
    def do_GET(self):
        if self.path.split('?')[0]=='/SkiJumpWeb/harness.html':
            data=HARNESS.encode();self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers();self.wfile.write(data);return
        if self.path.startswith('/SkiJumpWeb/'):
            self.path=self.path[len('/SkiJumpWeb'):]
            return super().do_GET()
        self.send_error(404)
    def log_message(self,*args): pass

def main():
    server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    report={'status':'failed','checks':[],'errors':[]}
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),headless=True,args=[
                '--no-sandbox','--enable-unsafe-webgpu','--enable-unsafe-swiftshader','--use-angle=swiftshader','--use-vulkan=swiftshader',
                '--enable-features=Vulkan','--disable-vulkan-surface'])
            page=browser.new_page(viewport={'width':900,'height':900})
            errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(f'http://127.0.0.1:{server.server_port}/SkiJumpWeb/harness.html')
            page.wait_for_function('window.done===true',timeout=120000)
            report=page.evaluate('window.report');report['errors'].extend(errors)
            if errors:report['status']='failed'
            browser.close()
    except Exception as error: report['errors'].append(str(error))
    finally:
        server.shutdown();server.server_close();thread.join()
        out=ROOT/'artifacts/browser-webgpu.json';out.parent.mkdir(exist_ok=True)
        out.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2),flush=True)
    return 0 if report['status']=='passed' or (report['status']=='skipped' and '--require-webgpu' not in sys.argv) else 1

if __name__=='__main__':raise SystemExit(main())
