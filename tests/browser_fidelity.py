"""Documented DSJ2.10 behavior + touch equivalence. Original binary/assets are not required.

The reference facts are in docs/REFERENCE-DSJ210.md. Physics calibration is not
claimed by these regression tests. Run after npm run build.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, os, re
ROOT=Path(__file__).resolve().parents[1]
HTML=re.sub(r"if\s*\(\s*new URLSearchParams\(location\.search\)\.has\(['\"]debug['\"]\)\s*\)", 'if (true)', (ROOT/'SkiJumpWeb.html').read_text())
HTML=HTML.replace("require('app');", "globalThis.__TEST_MODULES__=require;require('app');")
SHOTS=ROOT/'artifacts/screenshots'; SHOTS.mkdir(parents=True,exist_ok=True)
CHECKS=[];ERRORS=[]
def check(value,name):
    assert value,name
    CHECKS.append(name);print('PASS',name,flush=True)
def stop(p):p.evaluate('cancelAnimationFrame(__SKI_DEBUG__.frameId)')
def prepare(p):
    p.evaluate("()=>{const a=__SKI_DEBUG__;a.seed=42;a.settings.windBase=1;a.settings.windStrength=0;a.startPractice('fin',true);cancelAnimationFrame(a.frameId);}")
def advance(p,n):p.evaluate("n=>{const a=__SKI_DEBUG__;for(let i=0;i<n;i++){a.sim.step();a.recorder.capture();}}",n)
def fly(p):
    p.evaluate("()=>{const a=__SKI_DEBUG__,s=a.sim;while(s.state.x < -.9){s.step();a.recorder.capture();}}")
    p.mouse.down(button='left');p.mouse.down(button='right');p.mouse.up(button='right');p.mouse.up(button='left')
    p.evaluate("()=>{const a=__SKI_DEBUG__;while(a.sim.state.phase!=='flight'||a.sim.state.flightTime<.5){a.sim.step();a.recorder.capture();}}")
def render(p):
    p.evaluate("()=>{const a=__SKI_DEBUG__;a.renderer.render(a.sim.state,a.player,1/60,false);a.hud.canvas.width=a.renderer.width;a.hud.canvas.height=a.renderer.height;a.hud.render(a.sim.state,a.hill,a.player,a.settings,{mode:'PRACTICE',result:a.sim.result,backend:a.renderer.kind});}")
def boot(browser,mobile=False):
    c=browser.new_context(viewport={'width':390,'height':844} if mobile else {'width':1280,'height':800},is_mobile=mobile,has_touch=mobile)
    p=c.new_page();p.on('pageerror',lambda e:ERRORS.append(str(e)));p.set_content(HTML)
    p.wait_for_function("!!globalThis.__SKI_DEBUG__&&SkiJumpWeb.diagnostics().backend!=='initializing'")
    stop(p);return p
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=os.getenv('CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--enable-unsafe-webgpu','--enable-unsafe-swiftshader','--use-angle=swiftshader','--use-gl=angle','--ignore-gpu-blocklist'])
    p=boot(browser)
    check(p.evaluate("__SKI_DEBUG__.settings.rules==='dsj210'&&__SKI_DEBUG__.settings.control==='classic'&&__SKI_DEBUG__.settings.presentation==='classic'"),'fresh game selects documented rules and compact presentation')
    check(p.locator('.main-menu [data-action]').evaluate_all("items=>items.map(i=>i.dataset.action)")==['world','team','practice','records','replays','sound','quit'],'observed main-menu order is retained with browser extensions separate')
    p.screenshot(path=str(SHOTS/'classic-main-menu.png'))
    p.locator('[data-action=sound]').click();p.locator('[data-setting=volume]').fill('0.3');p.locator('[data-action=sound-test]').click()
    check(p.evaluate('__SKI_DEBUG__.settings.volume')==.3,'sound setup changes the actual procedural mixer volume')
    p.locator('[data-action=main]').click();p.locator('[data-action=records]').click()
    check(p.locator('.classic-record').count()==8,'original record screen shows eight hills per page')
    p.screenshot(path=str(SHOTS/'classic-record-pages.png'))
    for _ in range(3):p.locator('[data-action=records-next]').click()
    check(p.locator('.classic-record').last.get_attribute('data-id')=='slo','fourth record page reaches the final original hill')
    p.locator('[data-action=records-next]').click()
    check(p.locator('.record-page').get_attribute('data-pixel')=='PAGE 1/4','record paging wraps without losing roster order')
    p.locator('[data-action=records-reset]').click();p.locator('[data-action=records]').click()
    check(p.evaluate("__SKI_DEBUG__.view==='records'"),'record reset is guarded by an explicit cancelable confirmation')
    p.locator('[data-action=main]').click();p.locator('[data-action=quit]').click()
    check('SESSION SAVED' in p.locator('#menu-content').inner_text(),'quit saves the local session instead of attempting an unauthorized tab close')
    p.locator('[data-action=main]').click()
    prepare(p);check(p.evaluate("__SKI_DEBUG__.sim.options.rules==='dsj210'"),'practice actually uses selected rules')
    p.mouse.move(480,300);p.mouse.click(480,300,button='right');check(p.evaluate("__SKI_DEBUG__.sim.state.phase==='gate'"),'right mouse button alone does not start original-profile jump')
    advance(p,600);render(p);p.screenshot(path=str(SHOTS/'classic-start-signal.png'))
    check(abs(p.evaluate('__SKI_DEBUG__.sim.state.startRemaining')-10)<.001,'green start signal reaches ten seconds remaining')
    p.keyboard.press('KeyP');stop(p);before=p.evaluate('__SKI_DEBUG__.sim.state.time');p.wait_for_timeout(100)
    check(p.evaluate('__SKI_DEBUG__.sim.state.time')==before,'pausing preserves the running start clock')
    p.get_by_role('button',name='CONTINUE JUMP',exact=True).click();stop(p);advance(p,1200)
    p.evaluate('__SKI_DEBUG__.finishJump()')
    check('DISQUALIFIED' in p.locator('#menu-content').inner_text(),'gate timeout shows an explicit disqualification result')
    check(p.evaluate('__SKI_DEBUG__.lastResult.total===0&&Object.keys(__SKI_DEBUG__.store.records()).length===0'),'disqualified jump scores zero and never becomes a hill record')
    check(p.evaluate('__SKI_DEBUG__.store.stats().landings')==0,'disqualification is not counted as a successful landing')
    p.locator('[data-action=last-replay]').click();stop(p)
    check(p.evaluate('__SKI_DEBUG__.playback.replay.version')==2,'new replay schema records the gate and timed stance')
    p.evaluate('__SKI_DEBUG__.playback.seek(15)')
    check(p.evaluate('__SKI_DEBUG__.playback.sample(15).disqualified'),'replay retains disqualification at its terminal frame')
    prepare(p);p.mouse.click(480,300);check(p.evaluate("__SKI_DEBUG__.sim.state.phase==='inrun'"),'left mouse click starts sliding')
    p.mouse.click(480,300);check(p.evaluate('!__SKI_DEBUG__.sim.state.takeoff'),'one mouse button does not take off in classic mode')
    fly(p);check(p.evaluate('__SKI_DEBUG__.sim.state.takeoff'),'two-button chord performs takeoff')
    p.mouse.down(button='right');check(p.evaluate('__SKI_DEBUG__.sim.state.rightLandingTime>=0&&__SKI_DEBUG__.sim.state.leftLandingTime<0'),'first landing press deploys only the selected foot')
    advance(p,24);p.mouse.down(button='left');p.mouse.up(button='left');p.mouse.up(button='right')
    check(p.evaluate("__SKI_DEBUG__.sim.state.landing==='telemark'&&__SKI_DEBUG__.sim.state.telemarkWidth>.49"),'sequential right/left presses produce timed telemark instead of parallel landing')
    render(p);p.screenshot(path=str(SHOTS/'classic-flight-telemark.png'))
    prepare(p);p.mouse.click(480,300);fly(p);p.mouse.down(button='left');p.mouse.down(button='right');p.mouse.up(button='left');p.mouse.up(button='right')
    check(p.evaluate("__SKI_DEBUG__.sim.state.landing==='parallel'&&__SKI_DEBUG__.sim.state.telemarkWidth===0"),'same-tick two-button landing is parallel')
    # Produce a complete valid jump to exercise judge HUD and separate record board.
    prepare(p);p.evaluate("()=>{const a=__SKI_DEBUG__,{CPUController}=__TEST_MODULES__('@wieslawsoltes/ski-physics'),cpu=new CPUController(42,.98);while(a.sim.state.phase!=='runout'){cpu.update(a.sim);a.sim.step();a.recorder.capture();}}")
    render(p);p.screenshot(path=str(SHOTS/'classic-judges.png'))
    check(p.evaluate("()=>{const c=__SKI_DEBUG__.hud.ctx;return c.getImageData(291,58,1,1).data[3]===255}"),'judge plaques are drawn at the original reference-space location')
    check(p.evaluate("()=>{const c=__SKI_DEBUG__.hud.ctx;return c.getImageData(0,187,1,1).data[3]===255&&c.getImageData(5,5,1,1).data[3]===0}"),'classic HUD is sparse with a thirteen-pixel bottom band')
    p.evaluate("()=>{const a=__SKI_DEBUG__;while(a.sim.state.phase!=='finished'){a.sim.step();a.recorder.capture();}a.finishJump();}")
    check(p.evaluate("Object.keys(__SKI_DEBUG__.store.records()).every(k=>k.includes('.dsj210'))"),'new records are stored in the DSJ 2.10 rules partition')
    p.evaluate('__SKI_DEBUG__.showOptions()');p.locator('[data-setting=rules]').select_option('legacy');p.locator('[data-setting=presentation]').select_option('enhanced');p.locator('[data-action=original-profile]').click()
    check(p.evaluate("__SKI_DEBUG__.settings.rules==='dsj210'&&!__SKI_DEBUG__.settings.guide"),'original-profile preset restores two-button controls and disables enhanced guides')
    m=boot(browser,True);prepare(m)
    check(m.locator('[data-mouse=left]').is_visible() and m.locator('[data-mouse=right]').is_visible(),'portrait provides separate virtual left and right mouse buttons')
    m.locator('[data-mouse=right]').tap();check(m.evaluate("__SKI_DEBUG__.sim.state.phase==='gate'"),'virtual right button alone cannot start')
    m.locator('[data-mouse=left]').tap();check(m.evaluate("__SKI_DEBUG__.sim.state.phase==='inrun'"),'virtual left button starts in portrait')
    m.evaluate("()=>{const a=__SKI_DEBUG__;while(a.sim.state.x<-.9){a.sim.step();a.recorder.capture();}}")
    # Real multi-touch contacts via CDP, not direct calls to gameAction.
    cdp=m.context.new_cdp_session(m)
    def point(selector,i):
        r=m.locator(selector).bounding_box();return {'id':i,'x':r['x']+r['width']/2,'y':r['y']+r['height']/2,'radiusX':3,'radiusY':3,'force':1}
    left=point('[data-mouse=left]',1);right=point('[data-mouse=right]',2)
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[left]});cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[left,right]});cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    check(m.evaluate('__SKI_DEBUG__.sim.state.takeoff'),'actual two-contact touch chord takes off')
    m.evaluate("()=>{const a=__SKI_DEBUG__;while(a.sim.state.phase!=='flight'||a.sim.state.flightTime<.5){a.sim.step();a.recorder.capture();}}")
    m.locator('[data-mouse=left]').tap();advance(m,24);m.locator('[data-mouse=right]').tap()
    check(m.evaluate("__SKI_DEBUG__.sim.state.landing==='telemark'"),'touch pads reproduce left-then-right telemark timing')
    render(m);m.screenshot(path=str(SHOTS/'classic-mobile-portrait.png'))
    elapsed=m.evaluate('__SKI_DEBUG__.sim.state.time');m.set_viewport_size({'width':844,'height':390});m.wait_for_timeout(60);render(m)
    check(m.evaluate('__SKI_DEBUG__.sim.state.time')==elapsed,'rotation preserves simulation and timed landing state')
    check(m.locator('[data-mouse=right]').is_visible(),'landscape keeps virtual mouse controls reachable')
    m.screenshot(path=str(SHOTS/'classic-mobile-landscape.png'))
    check(not ERRORS,'original-profile desktop and touch paths produce no JavaScript exceptions')
    report={'version':json.loads((ROOT/'package.json').read_text())['version'],'checks':len(CHECKS),'passed':CHECKS,'errors':ERRORS,'renderer':p.evaluate('SkiJumpWeb.diagnostics()'),'scope':'Behavioral reference tests and Chromium touch emulation, not pixel/physics equivalence or physical-device certification.'}
    (ROOT/'artifacts/browser-fidelity.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2));browser.close()
