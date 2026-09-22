"""Optional integration suite. pip install playwright; use installed Chromium.
Tests run the completely offline HTML with set_content (no navigation required).
A working software OpenGL display, e.g. Xvfb, enables the WebGL2 checks.
These are Chromium emulations, not physical iOS/Android device certifications.
"""
from playwright.sync_api import sync_playwright
from pathlib import Path
import json, os, re
ROOT=Path(__file__).resolve().parents[1]; SHOTS=ROOT/'artifacts/screenshots'; SHOTS.mkdir(parents=True,exist_ok=True)
HTML=re.sub(r"if\s*\(\s*new URLSearchParams\(location\.search\)\.has\([\"']debug[\"']\)\s*\)", "if (true)", (ROOT/'SkiJumpWeb.html').read_text())
checks=[]; errors=[]; warnings=[]
def check(condition,name):
 assert condition,name
 checks.append(name);print('PASS',name,flush=True)
def screenshot(page,name):page.screenshot(path=str(SHOTS/(name+'.png')))
def stop(page):page.evaluate('cancelAnimationFrame(__SKI_DEBUG__.frameId)')
def render(page):
 page.evaluate('''()=>{const a=__SKI_DEBUG__;a.renderer.cameraReady=false;a.renderer.render(a.sim?.state||a.idle,a.player||a.players[0],1/60,false);if(a.sim){a.hud.canvas.width=a.renderer.width;a.hud.canvas.height=a.renderer.height;a.hud.render(a.sim.state,a.hill,a.player,a.settings,{mode:'PRACTICE',touch:a.touch,backend:a.renderer.kind});}}''')
def prepare(page,hill='fin'):
 page.evaluate('''id=>{const a=__SKI_DEBUG__;a.settings.windBase=1;a.settings.windStrength=0;a.settings.assist=false;a.seed=42;a.startPractice(id,true);cancelAnimationFrame(a.frameId);}''',hill)
def advance(page,condition,auto=False):
 return page.evaluate('''({condition,auto})=>{const a=__SKI_DEBUG__,s=a.sim;let count=0;const stop=new Function('s','return '+condition);while(!stop(s.state)&&count++<10000){if(auto){if(s.state.phase==='inrun'&&!s.state.takeoff&&s.state.x>=-.85)s.takeoff();if(s.state.phase==='flight'){s.control((-.065-s.state.lean)*.065);const g=s.profile.atX(s.state.x),closing=Math.max(.1,-s.state.vy-s.state.vx*Math.tan(g.angle));if(s.state.flightTime>.4&&s.state.height/closing<.24)s.land('telemark');}}s.step();a.recorder.capture();}a.refreshTouch();return{count,state:s.snapshot()};}''',{'condition':condition,'auto':auto})
def finish(page):
 advance(page,"s.phase==='finished'",True)
 page.evaluate('()=>{const a=__SKI_DEBUG__;a.finishJump();cancelAnimationFrame(a.frameId);}')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.getenv('CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--enable-unsafe-webgpu','--enable-unsafe-swiftshader','--use-angle=swiftshader','--use-gl=angle','--ignore-gpu-blocklist'])
 page=browser.new_page(viewport={'width':1280,'height':800})
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda m: errors.append(m.text) if m.type=='error' else warnings.append(m.text) if m.type=='warning' else None)
 page.set_content(HTML);page.wait_for_timeout(1200);stop(page)
 diag=page.evaluate('SkiJumpWeb.diagnostics()');check(diag['backend'] in ['webgl2','webgpu','software'],'standalone initializes without network')
 screenshot(page,'desktop-menu')
 page.get_by_role('button',name='PRACTICE',exact=True).click();check(page.locator('.hill-button').count()==32,'all 32 hills present in selector');screenshot(page,'hill-selection')
 check(page.evaluate("()=>{const a=document.querySelector('#menu-content'),b=document.querySelector('[data-id=slo]');return b.getBoundingClientRect().bottom<=a.getBoundingClientRect().bottom+1}"),'last hill visible without landscape scrolling')
 prepare(page);page.keyboard.press('Space');check(page.evaluate("__SKI_DEBUG__.sim.state.phase==='inrun'"),'Space starts jump')
 advance(page,"s.x>=-1");page.keyboard.press('Space');check(page.evaluate('__SKI_DEBUG__.sim.state.quality>.9'),'Space takeoff at lip has high quality')
 advance(page,"s.phase==='flight'&&s.x>25",True);render(page);screenshot(page,'desktop-flight')
 before=page.evaluate('__SKI_DEBUG__.sim.state.lean');page.mouse.move(500,300);page.mouse.move(500,350);check(page.evaluate('__SKI_DEBUG__.sim.state.lean')<before,'mouse down leans forward')
 page.keyboard.press('KeyP');check(page.evaluate("__SKI_DEBUG__.view==='pause'"),'keyboard pause stops gameplay');old=page.evaluate('__SKI_DEBUG__.sim.state.time');page.wait_for_timeout(100);check(page.evaluate('__SKI_DEBUG__.sim.state.time')==old,'paused simulation is frozen')
 page.get_by_role('button',name='CONTINUE JUMP',exact=True).click();stop(page);check(page.evaluate("__SKI_DEBUG__.view==='game'"),'resume restores game input')
 finish(page);check(page.evaluate('__SKI_DEBUG__.lastResult.crashed===false'),'interactive jump finishes with a successful landing');screenshot(page,'result')
 page.get_by_role('button',name='SAVE REPLAY',exact=True).click();check(page.evaluate('__SKI_DEBUG__.store.replays().length')==1,'save replay to library')
 page.get_by_role('button',name='REPLAY',exact=True).click();stop(page);check(page.evaluate("__SKI_DEBUG__.view==='replay'"),'result replay opens');page.locator('#replay-speed').select_option('.25');check(page.evaluate('__SKI_DEBUG__.playback.speed')==.25,'replay slow motion');page.locator('#replay-seek').fill('500');check(page.evaluate('__SKI_DEBUG__.playback.time/__SKI_DEBUG__.playback.duration')==.5,'replay scrub timeline')
 page.locator('[data-replay=back]').click();check(page.evaluate("__SKI_DEBUG__.view==='result'"),'replay Back restores results')
 page.evaluate("__SKI_DEBUG__.showOptions()");page.locator('[data-setting=weather]').select_option('snow');page.locator('[data-setting=resolution]').select_option('sharp');check(page.evaluate('__SKI_DEBUG__.renderer.width')==640,'resolution switch reallocates render surface');screenshot(page,'options')
 page.evaluate("__SKI_DEBUG__.showPlayers()");page.locator('#player-name').fill('TEST HUMAN');page.get_by_role('button',name='ADD',exact=True).click();check(page.evaluate('__SKI_DEBUG__.players[0].name')=='TEST HUMAN','player edits preserved while adding another player');check(page.evaluate('__SKI_DEBUG__.players.length')==2,'hot-seat player creation');screenshot(page,'players')
 page.evaluate("__SKI_DEBUG__.showSetup('world')");screenshot(page,'world-cup-setup');check(page.locator('[data-hill]').count()==32,'custom cup supports all 32 hills')
 page.evaluate("__SKI_DEBUG__.showSetup('team')");screenshot(page,'team-cup-setup');check(page.evaluate("__SKI_DEBUG__.setupMode==='team'"),'team cup setup opens')
 page.evaluate("()=>{const a=__SKI_DEBUG__;a.settings.resolution='classic';a.settings.weather='snow';a.applySettings();}")
 prepare(page,'slo');page.keyboard.press('Space');advance(page,"s.phase==='flight'&&s.x>80",True);render(page);screenshot(page,'slovenia-snow')
 check(page.evaluate("!__SKI_DEBUG__.renderer.gl||__SKI_DEBUG__.renderer.gl.getError()===0"),'WebGL2 renders without GL errors')
 check(page.evaluate('__SKI_DEBUG__.audio.ready'),'procedural audio unlocks after interaction');page.evaluate("()=>{const a=__SKI_DEBUG__.audio;for(let i=0;i<100;i++)a.play('menu');a.setVolume(.5,true)}");check(page.evaluate('__SKI_DEBUG__.audio.voices.size<=20&&__SKI_DEBUG__.audio.muted'),'audio voice budget and mute')
 # Exercise portrait touch, then rotate the same live flight into landscape.
 ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1)
 mobile=ctx.new_page();mobile.on('pageerror',lambda e:errors.append(str(e)));mobile.set_content(HTML);mobile.wait_for_timeout(700);stop(mobile);screenshot(mobile,'mobile-portrait-menu')
 mobile.get_by_role('button',name='PRACTICE',exact=True).tap();check(mobile.locator('.hill-button').count()==32,'portrait hill selection');screenshot(mobile,'mobile-hills')
 prepare(mobile,'fin');mobile.locator('#touch-main').tap();check(mobile.evaluate("__SKI_DEBUG__.sim.state.phase==='inrun'"),'touch START starts inrun')
 advance(mobile,"s.x>=-1");mobile.locator('#touch-main').tap();check(mobile.evaluate('__SKI_DEBUG__.sim.state.quality>.9'),'touch JUMP takeoff');advance(mobile,"s.phase==='flight'&&s.x>20",True);render(mobile);screenshot(mobile,'mobile-portrait-flight')
 before=mobile.evaluate('__SKI_DEBUG__.sim.state.lean');cdp=ctx.new_cdp_session(mobile)
 for kind,y in [('touchStart',330),('touchMove',370),('touchEnd',370)]:cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[] if kind=='touchEnd' else [{'x':180,'y':y}]})
 check(mobile.evaluate('__SKI_DEBUG__.sim.state.lean')<before,'touch drag steers flight')
 t=mobile.evaluate('__SKI_DEBUG__.sim.state.time');mobile.set_viewport_size({'width':844,'height':390});mobile.wait_for_timeout(100);render(mobile);check(mobile.evaluate('__SKI_DEBUG__.sim.state.time')==t,'orientation change preserves active simulation');check(mobile.evaluate("!document.querySelector('#arena').classList.contains('portrait')"),'landscape layout activates');screenshot(mobile,'mobile-landscape-flight')
 advance(mobile,"s.phase==='flight'&&s.height<5&&s.flightTime>1",True);mobile.locator('#touch-safe').tap();check(mobile.evaluate("__SKI_DEBUG__.sim.state.landing==='parallel'"),'touch TWO FEET prepares parallel landing');finish(mobile);check(mobile.evaluate("__SKI_DEBUG__.view==='result'"),'mobile jump reaches results');screenshot(mobile,'mobile-landscape-result')
 # Software fallback is deliberately tested even on a GPU-capable machine.
 sw=browser.new_page(viewport={'width':640,'height':400});sw.on('pageerror',lambda e:errors.append(str(e)));sw.set_content(re.sub(r"renderer:\s*[\"']auto[\"']", "renderer: 'software'", HTML));sw.wait_for_timeout(600);stop(sw);check(sw.evaluate("SkiJumpWeb.diagnostics().backend==='software'"),'software fallback initializes');screenshot(sw,'software-fallback')
 check(not errors,'no JavaScript or renderer console errors')
 report={'checks':len(checks),'passed':checks,'errors':errors,'warnings':warnings,'desktop':diag,'mobile':mobile.evaluate('SkiJumpWeb.diagnostics()'),'scope':'Chromium desktop + touch emulation using offline standalone HTML. WebGPU secure-context path requires separate GPU adapter verification.'}
 (ROOT/'artifacts/browser-tests.json').write_text(json.dumps(report,indent=2));browser.close()
 print(json.dumps(report,indent=2))
