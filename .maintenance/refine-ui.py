from pathlib import Path


def replace(path, old, new):
    p = Path(path)
    text = p.read_text()
    assert text.count(old) == 1, (path, 'Source changed')
    p.write_text(text.replace(old, new))


replace('packages/ui/classic.js',
"    hostAction(action){if(action==='back')this.options.back?.();else if(action==='activate')(this.controls().find(el=>el===this.document.activeElement)||this.controls()[0])?.click();else this.move(action);}",
"""    hostAction(action) {
        if(!this.active||this.disposed||this.root.hidden)return;
        if(action==='back'){
            const select=this.closeSelect();if(select)select.focus();else this.options.back?.();
        }else if(action==='activate'){
            const controls=this.controls(),target=controls.find(el=>el===this.document.activeElement)||controls[0];
            if(target?.tagName==='SELECT')this.openSelect(target);else target?.click();
        }else this.move(action);
    }""")
replace('tests/browser_ui.py',
"    mobile.locator('[data-action=hill][data-id=fin]').tap();",
"""    mobile.evaluate('__SKI_DEBUG__.showOptions()');mobile.locator('[data-setting=weather]').focus()
    mobile.locator('[data-host-command=activate]').tap()
    check(mobile.locator('.classic-select-popup').is_visible(),'touch OK opens the focused native select through the pixel popup')
    mobile.locator('[data-host-command=back]').tap()
    check(mobile.evaluate('__SKI_DEBUG__.view')=='options' and mobile.locator('.classic-select-popup').count()==0,'touch Back closes a select before navigating away')
    mobile.locator('[data-host-command=back]').tap()
    check(mobile.evaluate('__SKI_DEBUG__.view')=='main','second touch Back returns to main after closing the popup')
    mobile.evaluate('__SKI_DEBUG__.showHills()')
    mobile.locator('[data-action=hill][data-id=fin]').tap();""")
replace('packages/ui/classic.js',
"if(this.popup&&!this.popup.contains(e.target)&&e.target!==this.popupSelect)this.closeSelect();",
"if(this.popup&&!this.popup.contains(e.target)&&e.target!==this.popupSelect&&!e.target.closest('[data-host-command],[data-ui-host]'))this.closeSelect();")
