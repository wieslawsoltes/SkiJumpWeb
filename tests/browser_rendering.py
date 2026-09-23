"""All-hill cross-backend pixel regression. This does NOT assert DSJ2 equivalence.

Default: secure localhost modules, requiring WebGPU + WebGL2 + software. The
--software-offline mode exercises the same fixtures through the standalone bundle
without navigation, records its narrower scope, and never reports backend parity.
"""
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw
import argparse, base64, hashlib, json, os, threading

ROOT=Path(__file__).resolve().parents[1]
NAMES=['core','hills','physics','competition','replay','renderer','audio','input','storage','ui']
PROGRAM=r'''
const {SkiRenderer}=MODULE('renderer');
const {HILLS}=MODULE('hills');
const {JumpSimulation,CPUController}=MODULE('physics');
window.hills=HILLS.map(h=>({id:h.id,name:h.name,k:h.k}));
const backends=SOFTWARE_ONLY?['software']:['webgpu','webgl2','software'];
const renderers=[];
for(const kind of backends){
 const host=document.createElement('div');host.style.cssText='width:320px;height:200px';document.body.append(host);
 const renderer=new SkiRenderer(host,{renderer:kind==='webgpu'?'auto':kind==='webgl2'?'webgl':'software',presentation:'classic'});
 await renderer.ready;if(renderer.kind!==kind)throw new Error('Required '+kind+' unavailable: '+JSON.stringify(renderer.diagnostics()));
 renderers.push(renderer);
}
window.adapter=renderers[0].adapterInfo||null;
function encoded(a){let s='';for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(s);}
function compare(a,b){let sum=0,square=0,max=0,different=0;for(let i=0;i<a.length;i+=4){let delta=0;for(let c=0;c<3;c++){const d=Math.abs(a[i+c]-b[i+c]);sum+=d;square+=d*d;max=Math.max(max,d);delta=Math.max(delta,d);}if(delta>8)different++;}return {mean:sum/(a.length*.75),rms:Math.sqrt(square/(a.length*.75)),max,fractionOver8:different/(a.length/4)};}
window.captureHill=async id=>{
 const sim=new JumpSimulation(id,{seed:42,rules:'dsj210'}),cpu=new CPUController(42,.98),states={gate:{...sim.state}};
 for(let i=0;i<18000&&sim.state.phase!=='finished';i++){
  cpu.update(sim);sim.step();const s=sim.state;
  if(!states.board&&s.phase==='inrun'&&s.x>-2)states.board={...s};
  if(!states.flight&&s.phase==='flight'&&s.flightTime>.9)states.flight={...s};
  if(!states.landing&&['runout'].includes(s.phase))states.landing={...s};
 }
 for(const phase of ['gate','board','flight','landing'])if(!states[phase])throw new Error(id+' never reached required '+phase+' pose');
 const fixtures=Object.entries(states).map(([phase,state])=>({phase,state,weather:'clear',size:[320,200]}));
 for(const weather of ['snow','dusk','night'])fixtures.push({phase:'flight',state:states.flight,weather,size:[320,200]});
 for(const size of [[320,568],[432,200]])fixtures.push({phase:'flight',state:states.flight,weather:'snow',size});
 for(const camera of ['close','wide','chase'])fixtures.push({phase:'flight',state:states.flight,weather:'clear',size:[320,200],camera});
 const comparisons=[],images=[],checks=[],errors=[];
 for(const r of renderers){r.setHill(id);if(r.device)r.device.pushErrorScope('validation');}
 for(const fixture of fixtures){
  const frames=[];const key=id+'-'+fixture.phase+'-'+fixture.weather+'-'+fixture.size.join('x')+(fixture.camera?'-'+fixture.camera:'');
  for(const r of renderers){
   r.host.style.width=fixture.size[0]+'px';r.host.style.height=fixture.size[1]+'px';r.setOptions({weather:fixture.weather,camera:fixture.camera||'classic'});
   r.render(fixture.state,{},1/60);const frame=await r.captureFrame();frames.push(frame);
   if(fixture.weather==='snow'){
    r.render({...fixture.state,time:100}, {},1/120);
    r.render(fixture.state,{},1/30);
    const repeated=await r.captureFrame();
    if(frame.pixels.some((v,i)=>v!==repeated.pixels[i]))throw new Error('Replay-time snow/camera history changed pixels '+key+' '+r.kind);
   }
   if(frame.width!==fixture.size[0]||frame.height!==fixture.size[1])throw new Error('Incorrect fixture size '+key);
   if(fixture.weather==='clear'||id==='fin')images.push({key,backend:r.kind,width:frame.width,height:frame.height,rgba:encoded(frame.pixels)});
   if(r.gl&&r.gl.getError()!==r.gl.NO_ERROR)throw new Error('WebGL error at '+key);
   if(r.lastError)throw new Error(r.lastError);
  }
  if(!SOFTWARE_ONLY){
   const hardware=compare(frames[0].pixels,frames[1].pixels),software=compare(frames[0].pixels,frames[2].pixels);
   comparisons.push({fixture:key,hardware,software});
   // Explicit numerical regression budgets, not a declaration of pixel identity.
   if(hardware.mean>.15||hardware.fractionOver8>.001)errors.push('WebGPU/WebGL2 pixel mismatch '+key+': '+JSON.stringify(hardware));
   if(software.mean>1.5||software.fractionOver8>.01)errors.push('Software pixel mismatch '+key+': '+JSON.stringify(software));
  }
  checks.push(key);
 }
 for(const r of renderers)if(r.device){await r.device.queue.onSubmittedWorkDone();const e=await r.device.popErrorScope();if(e)errors.push(e.message);}
 return {id,comparisons,images,checks,errors,diagnostics:renderers.map(r=>r.diagnostics())};
};
window.cleanup=()=>renderers.forEach(r=>r.dispose());
window.ready=true;
'''

def document(offline):
    if offline:
        bundle=(ROOT/'dist/app.js').read_text().replace("require('app');",'globalThis.__modules=require;')
        module="const MODULE=n=>__modules('@wieslawsoltes/ski-'+n);"
        scripts='<script>'+bundle+'</script>'
    else:
        imports={f'@wieslawsoltes/ski-{n}':f'/SkiJumpWeb/packages/{n}/index.js' for n in NAMES}
        scripts='<script type="importmap">'+json.dumps({'imports':imports})+'</script>'
        module="const modules={};for(const n of ['renderer','physics','hills'])modules[n]=await import('@wieslawsoltes/ski-'+n);const MODULE=n=>modules[n];"
    return '<!doctype html><meta charset="utf-8"><style>html,body{margin:0}canvas{width:100%;height:100%}</style>'+scripts+'<script type="module">const SOFTWARE_ONLY='+str(offline).lower()+';'+module+'try{'+PROGRAM+'}catch(e){window.failure=e.stack||String(e);}</script>'

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT),**kwargs)
    def do_GET(self):
        if self.path=='/SkiJumpWeb/rendering.html':
            data=document(False).encode();self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers();self.wfile.write(data)
        elif self.path.startswith('/SkiJumpWeb/'):
            self.path=self.path[len('/SkiJumpWeb'):];super().do_GET()
        else:self.send_error(404)
    def log_message(self,*args):pass

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--software-offline',action='store_true');args=parser.parse_args()
    out=ROOT/'artifacts/rendering';out.mkdir(parents=True,exist_ok=True)
    report={'schema':2,'bundleSha256':hashlib.sha256((ROOT/'dist/app.js').read_bytes()).hexdigest(),'status':'running','scope':'software-only' if args.software_offline else 'cross-backend',
            'originalParity':'unverified','originalMatchedFrames':0,'hills':[],'errors':[],
            'budgets':{'gpuGlMean':.15,'gpuGlFractionOver8':.001,'gpuSoftwareMean':1.5,'gpuSoftwareFractionOver8':.01}}
    server=None;thread=None
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--enable-unsafe-webgpu','--enable-unsafe-swiftshader','--use-angle=swiftshader','--use-vulkan=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface'])
            page=browser.new_page(viewport={'width':1000,'height':1000});page.on('pageerror',lambda e:report['errors'].append(str(e)))
            if args.software_offline:page.set_content(document(True))
            else:
                server=ThreadingHTTPServer(('127.0.0.1',0),Handler);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
                page.goto(f'http://127.0.0.1:{server.server_port}/SkiJumpWeb/rendering.html')
            page.wait_for_function('window.ready||window.failure',timeout=60000)
            failure=page.evaluate('window.failure');assert not failure,failure
            for hill in page.evaluate('window.hills'):
                data=page.evaluate('id=>window.captureHill(id)',hill['id'])
                for shot in data.pop('images'):
                    image=Image.frombytes('RGBA',(shot['width'],shot['height']),base64.b64decode(shot['rgba']))
                    image.save(out/(shot['key']+'-'+shot['backend']+'.png'))
                data['name']=hill['name'];data['k']=hill['k'];report['hills'].append(data);report['errors'].extend(data['errors'])
                print(hill['id'],len(data['checks']),'frames per backend',len(data['errors']),'errors',flush=True)
            page.evaluate('window.cleanup()');browser.close()
        report['status']='failed' if report['errors'] else 'passed'
        report['framesPerBackend']=sum(len(h['checks']) for h in report['hills'])
        report['backends']=['software'] if args.software_offline else ['webgpu','webgl2','software']
        # One consistent flight pose per hill, rendered rather than fabricated thumbnails.
        sheet=Image.new('RGB',(1280,8*224));draw=ImageDraw.Draw(sheet)
        for i,h in enumerate(report['hills']):
            x=(i%4)*320;y=(i//4)*224
            sheet.paste(Image.open(out/(h['id']+'-flight-clear-320x200-'+report['backends'][0]+'.png')).convert('RGB'),(x,y+24))
            draw.text((x+8,y+5),h['id'].upper()+' / independent reconstruction',fill='white')
        sheet.save(out/'all-hills.png')
    except Exception as e:report['status']='failed';report['errors'].append(str(e))
    finally:
        if server:server.shutdown();server.server_close();thread.join()
        (ROOT/'artifacts/browser-rendering.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='hills'},indent=2),flush=True)
    return 0 if report['status']=='passed' else 1
if __name__=='__main__':raise SystemExit(main())
