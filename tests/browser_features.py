"""Offline browser regressions for v0.2 workflows; uses no third-party assets.
Run after npm run build. Chromium touch emulation is not physical-device certification.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, os, re

ROOT = Path(__file__).resolve().parents[1]
HTML = re.sub(r"if\s*\(\s*new URLSearchParams\(location\.search\)\.has\(['\"]debug['\"]\)\s*\)", 'if (true)', (ROOT / 'SkiJumpWeb.html').read_text())
HTML = HTML.replace("require('app');", "globalThis.__TEST_MODULES__=require;require('app');")
CHECKS, ERRORS = [], []
SHOTS = ROOT / 'artifacts/screenshots'; SHOTS.mkdir(parents=True, exist_ok=True)

def check(value, name):
    assert value, name
    CHECKS.append(name); print('PASS', name, flush=True)

def stop(page):
    page.evaluate('cancelAnimationFrame(__SKI_DEBUG__.frameId)')

def finished_jump(page):
    page.evaluate('''() => {
        const a=__SKI_DEBUG__, {CPUController}=__TEST_MODULES__('@wieslawsoltes/ski-physics');
        const controller=new CPUController(a.sim.options.seed,.98);
        for(let i=0;i<14400&&a.sim.state.phase!=='finished';i++){controller.update(a.sim);a.sim.step();a.recorder.capture();}
        a.finishJump();cancelAnimationFrame(a.frameId);
    }''')

def boot(browser, viewport, mobile=False):
    context=browser.new_context(viewport=viewport,is_mobile=mobile,has_touch=mobile)
    page=context.new_page();page.on('pageerror',lambda e:ERRORS.append(str(e)))
    page.on('console',lambda m:ERRORS.append(m.text) if m.type=='error' else None)
    page.set_content(HTML)
    page.wait_for_function("globalThis.__SKI_DEBUG__ && SkiJumpWeb.diagnostics().backend!=='initializing'")
    stop(page)
    return page

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.getenv('CHROMIUM','/usr/bin/chromium'),headless=True,
        args=['--no-sandbox','--enable-unsafe-webgpu','--enable-unsafe-swiftshader','--use-angle=swiftshader','--use-gl=angle','--ignore-gpu-blocklist'])
    page=boot(browser,{'width':1280,'height':800})
    page.get_by_role('button',name='WORLD CUP',exact=True).click()
    page.locator('#cup-ai').select_option('7')
    original=page.evaluate('__SKI_DEBUG__.tour.hills')
    page.get_by_role('button',name='ORDER / REPEAT',exact=True).click()
    page.locator('[data-action=tour-reverse]').click()
    check(page.evaluate('__SKI_DEBUG__.tour.hills')==list(reversed(original)),'tour editor reverses actual competition order')
    page.locator('[data-action=tour-duplicate]').first.click()
    ids=page.evaluate('__SKI_DEBUG__.tour.hills')
    check(ids[0]==ids[1] and len(ids)==len(original)+1,'tour duplicate is retained as a separate event')
    page.locator('#tour-name').fill('MOBILE TOUR');page.locator('[data-action=tour-save]').click()
    check(page.evaluate('__SKI_DEBUG__.store.tours()[0].name')=='MOBILE TOUR','named tour saves from editable UI')
    page.screenshot(path=str(SHOTS/'tour-editor.png'))
    page.locator('[data-action=tour-back]').click()
    check(page.locator('#cup-ai').input_value()=='7','CPU selection survives tour editor redraw')
    page.locator('[data-action=start-cup]').click()
    check(page.evaluate('__SKI_DEBUG__.cup.hills')==ids,'starting cup preserves edited order and repeated hills')
    check(page.evaluate('__SKI_DEBUG__.view')=='start-list','cup opens a playable start list')
    page.screenshot(path=str(SHOTS/'start-list.png'))
    page.locator('[data-action=live-results]').click();check(page.evaluate('__SKI_DEBUG__.view')=='live-results','start list opens live hill standings')
    page.locator('[data-action=start-list]').click()
    page.locator('[data-action=continue-start-list]').click()
    page.wait_for_function("__SKI_DEBUG__.view==='game'");stop(page)
    check(page.evaluate('__SKI_DEBUG__.player.human'),'CPU fast-forward stops at next human')
    finished_jump(page)
    check(page.evaluate('__SKI_DEBUG__.view')=='result','human cup jump reaches results exactly once')
    page.locator('[data-action=next-jump]').click()
    check(page.evaluate('__SKI_DEBUG__.view')=='start-list','result returns to current cup start list')
    page.locator('[data-action=main]').click();page.locator('[data-action=continue-cup]').click()
    check(page.evaluate('__SKI_DEBUG__.view')=='start-list','saved cup resumes through the start-list state')
    # Process a short full cup through the new round boundary and event/history menus.
    page.evaluate("()=>{const a=__SKI_DEBUG__;const {Competition,createField}=__TEST_MODULES__('@wieslawsoltes/ski-competition');a.cup=new Competition({hills:['eng','eng'],players:createField(a.players.slice(0,1),0)});a.mode='world';a.showStartList();}")
    for event in range(2):
        for rnd in range(2):
            page.locator('[data-action=continue-start-list]').click();page.wait_for_function("__SKI_DEBUG__.view==='game'");stop(page);finished_jump(page)
            page.locator('[data-action=next-jump]').click()
        check(page.evaluate('__SKI_DEBUG__.view')=='event',f'event {event+1} finishes after both human rounds')
        if event==0:
            page.locator('[data-action=next-event]').click()
    page.locator('[data-action=cup-table]').click();page.locator('[data-action=cup-history]').click()
    check(page.locator('[data-action=history-event]').count()==2,'history keeps both repeated-hill results')
    page.locator('[data-action=history-event]').first.click()
    check(page.locator('tbody tr').count()==1,'event-history drilldown displays the saved result')
    page.screenshot(path=str(SHOTS/'event-history.png'))
    # Team score breakdown contains four named jumpers with both round columns.
    page.evaluate("()=>{const a=__SKI_DEBUG__;const {Competition,createTeams}=__TEST_MODULES__('@wieslawsoltes/ski-competition');const teams=createTeams(a.players.slice(0,1),0);a.cup=new Competition({mode:'team',teams,players:teams.flatMap(t=>t.members)});a.mode='team';a.showTeamDetails(teams[0].id);}")
    check(page.locator('tbody tr').count()==4,'team score drilldown displays four athletes')
    # Watching and skipping CPU uses the same in-progress simulation and commits only once.
    page.evaluate("async()=>{const a=__SKI_DEBUG__;a.settings.watchCPU=true;await a.proceedTurn(false);}")
    # First group is the human; move directly to the first CPU for a controlled watch test.
    page.evaluate("async()=>{const a=__SKI_DEBUG__;if(a.cup.current().human)a.cup.submit({hillId:a.cup.hill.id,total:100,distance:100});await a.proceedTurn(false);cancelAnimationFrame(a.frameId);}")
    check(page.locator('#skip-cpu').is_visible(),'CPU watch exposes touch-friendly skip control')
    turn=page.evaluate('__SKI_DEBUG__.cup.turn')
    page.locator('#skip-cpu').click();page.wait_for_timeout(80);stop(page)
    check(page.evaluate('__SKI_DEBUG__.cup.turn')==turn+1,'skipping a watched CPU submits exactly one result')
    # Practice session, boards, replay labels and all replay navigation.
    page.evaluate("()=>{const a=__SKI_DEBUG__;a.settings.watchCPU=false;a.settings.windBase=1;a.seed=42;a.startPractice('fin',true);cancelAnimationFrame(a.frameId);}")
    finished_jump(page)
    page.locator('[data-action=session]').click()
    check(page.locator('tbody tr').count()==1,'practice session shows recorded attempt statistics')
    page.locator('[data-action=retry]').click();stop(page)
    check(page.evaluate('__SKI_DEBUG__.sim.options.seed')==42,'same-wind retry reuses the deterministic seed')
    finished_jump(page);page.locator('[data-action=save-last-replay]').click();page.locator('[data-action=last-replay]').click();stop(page)
    page.locator('[data-replay=takeoff]').click()
    check(page.evaluate('__SKI_DEBUG__.playback.time===__SKI_DEBUG__.playback.flightStart'),'FLIGHT marker seeks to recorded flight transition')
    before=page.evaluate('__SKI_DEBUG__.playback.time');page.locator('[data-replay=frame-next]').click()
    check(page.evaluate('__SKI_DEBUG__.playback.time')>before and page.evaluate('__SKI_DEBUG__.playback.paused'),'next frame pauses on the next recorded timestamp')
    page.keyboard.press('ArrowLeft');check(abs(page.evaluate('__SKI_DEBUG__.playback.time')-before)<1e-7,'keyboard previous frame returns to exact prior sample')
    page.locator('#replay-speed').select_option('-1');check(page.evaluate('__SKI_DEBUG__.playback.speed')==-1,'reverse replay speed is selectable')
    page.locator('[data-replay=flight-loop]').click();check(page.evaluate('__SKI_DEBUG__.playback.loopStart===__SKI_DEBUG__.playback.flightStart'),'flight-only loop uses recorded markers')
    page.locator('[data-replay=whole-loop]').click();check(page.evaluate('__SKI_DEBUG__.playback.loopStart===0'),'full-range replay loop restores the entire recording')
    page.locator('[data-replay=loop]').click();check(not page.evaluate('__SKI_DEBUG__.playback.loop'),'loop control can disable looping')
    page.screenshot(path=str(SHOTS/'replay-controls.png'))
    page.locator('[data-replay=back]').click();page.evaluate('__SKI_DEBUG__.showReplays()')
    if page.locator('[data-action=replay-details]').count(): page.locator('[data-action=replay-details]').first.click()
    page.locator('[data-action=rename-replay]').first.click();page.locator('#replay-name').fill('FINLAND TEST');page.locator('[data-action=confirm-rename-replay]').click()
    check('FINLAND TEST' in page.locator('.replay-info').first.inner_text(),'replay labels are editable and visible')
    page.evaluate('__SKI_DEBUG__.showRecords()');page.locator('[data-action=hill-records][data-id=fin]').click()
    check(page.locator('tbody tr').count()>=1,'per-hill board is populated by actual practice jumps')
    page.locator('[data-action=record-ghost]').click();check(page.evaluate('__SKI_DEBUG__.view')=='replay','best record opens its saved ghost replay')
    page.locator('[data-replay=back]').click();check(page.evaluate('__SKI_DEBUG__.view')=='records','record replay returns to records instead of an unrelated screen')
    if page.locator('.classic-record-tools').count(): page.locator('.classic-record-tools summary').click()
    page.locator('[data-action=personal-records]').click();check(page.locator('tbody tr').count()>=1,'personal aggregate record totals are accessible')
    # Both viewport orientations work with the newly added schedule UI.
    mobile=boot(browser,{'width':390,'height':844},True)
    mobile.get_by_role('button',name='WORLD CUP',exact=True).tap();mobile.locator('[data-action=edit-tour]').tap()
    mobile.locator('[data-action=tour-duplicate]').first.tap()
    check(mobile.evaluate('__SKI_DEBUG__.tour.hills.length')==9,'touch schedule duplication works in portrait')
    mobile.screenshot(path=str(SHOTS/'mobile-tour-editor.png'))
    mobile.set_viewport_size({'width':844,'height':390})
    check(mobile.evaluate('__SKI_DEBUG__.tour.hills.length')==9,'rotation preserves the edited tour')
    mobile.locator('[data-action=tour-back]').tap();mobile.locator('[data-action=start-cup]').tap()
    check(mobile.evaluate('__SKI_DEBUG__.view')=='start-list','landscape touch starts edited cup')
    mobile.screenshot(path=str(SHOTS/'mobile-start-list.png'))
    check(not ERRORS,'new desktop and touch workflows produce no JavaScript errors')
    report={'version':json.loads((ROOT/'package.json').read_text())['version'],'checks':len(CHECKS),'passed':CHECKS,'errors':ERRORS,'renderer':page.evaluate('SkiJumpWeb.diagnostics()'),'scope':'Offline Chromium desktop + touch emulation; physical devices and native WebGPU are separate tests.'}
    (ROOT/'artifacts/browser-features.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2));browser.close()
