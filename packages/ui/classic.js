import { GLYPHS, drawText, textWidth, plainASCII } from './bitmap.js';
import { CLASSIC_MENU_CSS } from './classic-style.js';

/** Observed main/records/replay screen coordinates; graphics are independently authored. */
export const CLASSIC_MENU_LAYOUT = Object.freeze({ width: 320, height: 200,
    headingX: 9, headingY: 44, ruleY: 38, menuX: 48, menuY: 78, rowHeight: 12,
    recordsX: 48, recordsY: 63, recordRowHeight: 10, footerY: 173 });

/** Integer letterboxing; only sub-native windows use fractional downscaling. */
export function classicViewport(width, height, fit = false) {
    if (![width, height].every(n => Number.isFinite(n) && n > 0)) throw new RangeError('Viewport dimensions must be finite and positive');
    const available = Math.min(width / 320, height / 200);
    const scale = fit || available < 1 ? available : Math.floor(available);
    return Object.freeze({ width: 320, height: 200, scale,
        left: Math.floor((width - 320 * scale) / 2), top: Math.floor((height - 200 * scale) / 2) });
}

/** Pure keyboard navigation, shared by keyboard and large mobile host controls. */
export function navigationIndex(items, current, key) {
    if (!items.length) return -1;
    if (key === 'Home') return 0;
    if (key === 'End') return items.length - 1;
    if (current < 0 || current >= items.length) return key === 'ArrowUp' ? items.length - 1 : 0;
    if (key === 'PageDown' || key === 'PageUp') return Math.max(0, Math.min(items.length - 1, current + (key === 'PageDown' ? 8 : -8)));
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
        const origin = items[current], sign = key === 'ArrowLeft' ? -1 : 1;
        let nearest = -1, score = Infinity;
        items.forEach((r, i) => {
            const dx = (r.x - origin.x) * sign, dy = Math.abs(r.y - origin.y);
            if (i !== current && dx > .5 && dy < Math.max(r.height, origin.height) * .75) {
                const distance = dx + dy * 3;
                if (distance < score) { nearest = i; score = distance; }
            }
        });
        return nearest < 0 ? current : nearest;
    }
    return (current + (key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
}

// Bold 5x7 menu alphabet, authored independently; HUD retains its existing glyphs.
const MENU_GLYPHS = {...GLYPHS};
const bold={A:'01110 11011 11011 11111 11011 11011 11011',B:'11110 11011 11011 11110 11011 11011 11110',C:'01111 11000 11000 11000 11000 11000 01111',D:'11110 11011 11011 11011 11011 11011 11110',E:'11111 11000 11000 11110 11000 11000 11111',F:'11111 11000 11000 11110 11000 11000 11000',G:'01111 11000 11000 11011 11011 11011 01111',H:'11011 11011 11011 11111 11011 11011 11011',J:'00111 00011 00011 00011 11011 11011 01110',K:'11011 11010 11100 11100 11110 11011 11011',L:'11000 11000 11000 11000 11000 11000 11111',M:'10001 11011 11111 11111 11011 11011 11011',N:'11001 11101 11101 11111 11011 11011 11011',O:'01110 11011 11011 11011 11011 11011 01110',P:'11110 11011 11011 11110 11000 11000 11000',Q:'01110 11011 11011 11011 11011 01110 00011',R:'11110 11011 11011 11110 11100 11011 11011',S:'01111 11000 11000 01110 00011 00011 11110',T:'11111 00110 00110 00110 00110 00110 00110',U:'11011 11011 11011 11011 11011 11011 01110',V:'11011 11011 11011 11011 11011 01110 00100',W:'11011 11011 11011 11111 11111 11011 10001',X:'11011 11011 01110 00100 01110 11011 11011',Y:'11011 11011 11011 01110 00110 00110 00110',Z:'11111 00011 00110 00100 01100 11000 11111', '&':'01100 10010 10100 01000 10101 10010 01101','|':'1 1 1 1 1 1 1','[':'111 100 100 100 100 100 111',']':'111 001 001 001 001 001 111'};
for(const [key,rows] of Object.entries(bold))MENU_GLYPHS[key]=rows.split(' ');
function drawMenuText(c,text,x,y,color,scale=1){c.fillStyle=color;for(const char of plainASCII(text)){const glyph=MENU_GLYPHS[char]||MENU_GLYPHS['?'];for(let j=0;j<7;j++)for(let i=0;i<glyph[j].length;i++)if(glyph[j][i]==='1')c.fillRect(x+i*scale,y+j*scale,scale,scale);x+=(glyph[0].length+1)*scale;}return x;}

const poly = (c, points, color) => { c.fillStyle = color; c.beginPath(); points.forEach(([x,y],i) => i ? c.lineTo(x,y) : c.moveTo(x,y)); c.closePath(); c.fill(); };
/** Static twin-jump composition, not the original copyrighted photograph. */
export function drawMenuBackdrop(canvas, seed = 210) {
    canvas.width = 320; canvas.height = 200;
    const c = canvas.getContext('2d');
    let n = seed >>> 0; const random = () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296);
    const sky = c.createLinearGradient(0, 0, 0, 200); sky.addColorStop(0, '#42494b'); sky.addColorStop(1, '#22292d');
    c.fillStyle = sky; c.fillRect(0, 0, 320, 200);
    function pine(x, base, h, shade) {
        c.fillStyle = shade; c.fillRect(Math.round(x), base-h, 1, h);
        for(let i=0;i<11;i++){const y=base-h+i*h/12,w=(i+1)*h*.034; poly(c,[[x,y-3],[x-w-random()*2,y+6],[x+w+random()*2,y+5]],shade);}
    }
    for(let i=0;i<180;i++){const x=random()*340-10,base=154+random()*30;pine(x,base,12+random()*30,'#172125');}
    // Far tower and curved twin inrun; broad dark structural faces.
    poly(c, [[260,175],[267,52],[280,31],[282,171]], '#242b2e');
    poly(c, [[274,171],[280,31],[288,29],[287,184]], '#191f24');
    c.lineJoin='round';
    function ramp(points, width, color) {
        c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(points[0],points[1]);
        c.bezierCurveTo(...points.slice(2,8));c.stroke();
    }
    ramp([232,151,277,150,283,35,303,25],12,'#191e23');
    ramp([230,149,272,147,281,34,300,26],6,'#586065');
    ramp([231,150,275,145,283,36,302,25],2,'#151b20');
    poly(c, [[274,190],[290,178],[307,26],[302,25]], '#323a3d');
    // Near tower with layered footings, platform and curving inrun.
    poly(c, [[199,198],[204,79],[212,65],[218,195]], '#343c40');
    poly(c, [[214,198],[213,68],[221,51],[225,200]], '#232b30');
    ramp([130,110,180,107,191,68,220,-9],20,'#171e22');
    ramp([129,106,175,104,189,67,216,-9],13,'#535c60');
    ramp([131,108,179,106,194,66,221,-9],4,'#20282c');
    poly(c, [[150,130],[158,112],[182,109],[180,200],[153,200]], '#333c40');
    poly(c, [[168,128],[173,117],[183,113],[184,200],[173,200]], '#1c252a');
    for(let y=113;y<195;y+=9) poly(c,[[146,y+1],[169,y-4],[175,y-4],[150,y+4]],'#1d282d');
    poly(c, [[21,200],[54,169],[97,144],[152,118],[163,126],[120,150],[86,172],[65,200]], '#62696a');
    poly(c, [[16,200],[47,167],[97,139],[152,115],[154,119],[99,144],[52,172],[24,200]], '#343f44');
    poly(c, [[60,200],[101,168],[149,135],[165,127],[167,132],[114,166],[73,200]], '#1e292f');
    poly(c, [[176,200],[203,179],[220,164],[240,152],[267,151],[272,157],[241,176],[224,200]], '#535e61');
    for(let i=0;i<95;i++){const x=random()*320;if(x<47||x>278)pine(x,205,14+random()*35,'#0d161d');}
    const image=c.getImageData(0,0,320,200),p=image.data;
    for(let i=0;i<p.length;i+=4){const noise=(random()-.5)*10;for(let j=0;j<3;j++)p[i+j]=Math.max(0,Math.round((p[i+j]+noise)*.72));}
    c.putImageData(image,0,0);
}
export function drawClassicLogo(canvas) {
    canvas.width = 122; canvas.height = 27; const c=canvas.getContext('2d');
    c.clearRect(0,0,122,27);
    drawMenuText(c,'D E L U X E',29,0,'#b8bd43',1);
    c.fillStyle='#aab337';c.fillRect(23,8,79,1);
    drawMenuText(c,'SKI JUMP',1,11,'#d8de43',2);
    drawMenuText(c,'2',114,19,'#bec743',1);
}

let nextSkinId=0;
const SELECTOR='button:not(:disabled),input:not([type=hidden]):not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]';
const nativeEdit=el=>el?.matches('input,select,textarea');
const keyOf=el=>el ? [el.id,el.dataset.action,el.dataset.id,el.dataset.index,el.dataset.setting,el.dataset.hill,el.dataset.uiHost].join('|') : '';
const visible=el=>!el.closest('[hidden],[inert]') && !!el.getClientRects().length && getComputedStyle(el).visibility!=='hidden';

/** Semantic DOM controls in a fixed pixel coordinate system. No generated font or third-party assets.
 * All events, focus, forms, IME, clipboard and screen-reader labels stay real DOM.
 * Only their visual ink is rasterized into authored bitmap glyphs.
 */
export class ClassicMenuSkin {
    constructor(root, options = {}) {
        if (!root?.ownerDocument) throw new TypeError('ClassicMenuSkin requires a DOM element');
        this.root=root;this.document=root.ownerDocument;this.options=options;this.active=false;this.disposed=false;
        this.memory=new Map();this.popup=null;this.popupSelect=null;this.view='';this.fit=false;this.pending=0;this.ink=new WeakMap();this.fields=new WeakMap();
        this.abort=new AbortController();const signal=this.abort.signal;
        this.generatedId=!root.id;if(this.generatedId)root.id='ski-classic-'+(++nextSkinId);
        this.rootId=root.id;
        this.originalStyles=['--menu-width','--menu-height','--ui-scale'].map(key=>[key,root.style.getPropertyValue(key),root.style.getPropertyPriority(key)]);
        const id=this.document.defaultView.CSS.escape(root.id),scope=`#${id}#${id}.classic-ui`;
        let css=CLASSIC_MENU_CSS.replaceAll('#arena #menu-layer.classic-ui',scope).replaceAll('#arena .classic-ui',scope);
        this.autoParts=[];
        for(const [legacy,part] of Object.entries({'menu-header':'header',logo:'logo','header-note':'note','renderer-name':'diagnostics','menu-heading':'heading','menu-content':'content'})){
            const el=root.querySelector('#'+legacy);if(el&&!el.hasAttribute('data-classic-part')){el.dataset.classicPart=part;this.autoParts.push(el);}
            css=css.replaceAll('#'+legacy,`[data-classic-part="${part}"]`);
        }
        this.style=this.document.createElement('style');this.style.textContent=css;this.document.head.append(this.style);
        this.background=this.document.createElement('canvas');this.background.className='classic-backdrop';this.background.setAttribute('aria-hidden','true');
        drawMenuBackdrop(this.background);root.prepend(this.background);
        this.observer=new MutationObserver(()=>this.schedule());
        root.addEventListener('keydown',e=>this.keydown(e),{signal,capture:true});
        root.addEventListener('pointerover',e=>this.repaint(e.target.closest('button,label,summary')||e.target),{signal});
        root.addEventListener('pointerout',e=>this.repaint(e.target.closest('button,label,summary')||e.target),{signal});
        root.addEventListener('focusin',e=>{this.repaint(e.target.closest('button,label')||e.target);this.syncField(e.target);},{signal});
        root.addEventListener('focusout',e=>{this.repaint(e.target.closest('button,label')||e.target);this.syncField(e.target);},{signal});
        for(const event of ['input','change','keyup','click','compositionupdate','compositionend']) root.addEventListener(event,e=>this.syncField(e.target),{signal});
        this.document.addEventListener('selectionchange',()=>this.syncField(this.document.activeElement),{signal});
        this.document.addEventListener('pointerdown',e=>{if(this.popup&&!this.popup.contains(e.target)&&e.target!==this.popupSelect)this.closeSelect();},{signal,capture:true});
        root.addEventListener('change',()=>this.schedule(),{signal});
        root.addEventListener('pointerdown',e=>{if(this.active&&e.target.tagName==='SELECT'){e.preventDefault();this.openSelect(e.target);}},{signal});
        root.addEventListener('click',e=>{const action=e.target.closest('[data-ui-host]')?.dataset.uiHost;if(action)this.hostAction(action);},{signal});
    }
    observe(){this.observer.observe(this.root,{childList:true,subtree:true,characterData:true});}
    remember(){const el=this.popupSelect||this.document.activeElement;if(this.root.contains(el))this.memory.set(this.view,keyOf(el));}
    setActive(active) {
        if(this.disposed)throw new Error('ClassicMenuSkin is disposed');
        if(this.active===!!active)return;
        this.active=!!active;this.root.classList.toggle('classic-ui',this.active);
        if(!this.active){this.observer.disconnect();this.closeSelect();this.restoreInk();this.restoreStyles();}
        else {this.observe();this.refresh();}
    }
    enter(view) {
        this.closeSelect();this.view=String(view);if(!this.active)return;
        this.root.dataset.classicView=this.view;this.refresh();
        const controls=this.controls(),key=this.memory.get(this.view);
        const target=controls.find(el=>keyOf(el)===key)||controls.find(el=>el.dataset.selected==='true')||controls[0];
        target?.focus({preventScroll:true});
    }
    layout(width,height) {
        const v=classicViewport(width,height,this.fit);this.viewport=v;
        if(this.active){this.root.style.setProperty('--menu-width','320px');this.root.style.setProperty('--menu-height','200px');this.root.style.setProperty('--ui-scale',String(v.scale));}
        return v;
    }
    schedule(){if(this.active&&!this.pending&&!this.disposed)this.pending=requestAnimationFrame(()=>{this.pending=0;this.refresh();});}
    refresh() {
        if(!this.active||this.disposed)return;
        this.observer.disconnect();
        try {
            for(const el of this.root.querySelectorAll('[data-pixel]')){
                const text=el.dataset.pixel||el.getAttribute('aria-label')||el.textContent;
                el.setAttribute('aria-label',text);
                if(el.dataset.classicLabel!==text||!el.querySelector('.classic-ink')){el.replaceChildren(this.label(text,false));el.dataset.classicLabel=text;}
            }
            const walk=this.document.createTreeWalker(this.root,4);const nodes=[];
            while(walk.nextNode()){
                const n=walk.currentNode,p=n.parentElement;
                if(n.textContent.trim()&&!p.closest('.classic-ink,.classic-copy,.classic-native,.classic-host,[data-pixel],script,style,canvas,select,textarea,.sr-only'))nodes.push(n);
            }
            for(const n of nodes){const f=this.document.createElement('span');f.className='classic-copy';
                const semantic=this.document.createElement('span');semantic.className='classic-semantic';semantic.textContent=n.textContent;f.append(semantic);
                for(const text of n.textContent.match(/\s*\S+\s*/g)||[]){const ink=this.label(text);ink.querySelector('.classic-semantic').remove();ink.setAttribute('aria-hidden','true');f.append(ink);}n.replaceWith(f);
            }
            for(const field of this.root.querySelectorAll('select,input:not([type=checkbox]):not([type=range]):not([type=color]):not([type=file]):not([type=hidden]),textarea'))this.prepareField(field);
            this.repaint(this.root);
        } finally {this.observe();}
    }
    label(text,wrap=true) {
        const span=this.document.createElement('span');span.className='classic-ink';
        const semantic=this.document.createElement('span');semantic.className='classic-semantic';semantic.textContent=text;
        const canvas=this.document.createElement('canvas');canvas.setAttribute('aria-hidden','true');
        const trimmed=String(text).replace(/\s/g,' ');const w=Math.max(1,textWidth(trimmed));
        canvas.width=w;canvas.height=8;canvas.style.width=w+'px';canvas.style.height='8px';
        span.append(semantic,canvas);span.dataset.text=trimmed;this.ink.set(span,trimmed);
        if(!wrap)span.style.whiteSpace='nowrap';
        return span;
    }
    repaint(root) {
        if(!this.active||!root?.querySelectorAll)return;
        const labels=[...(root.matches?.('.classic-ink')?[root]:[]),...root.querySelectorAll('.classic-ink')];
        for(const span of labels){const canvas=span.querySelector('canvas');if(!canvas)continue;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);drawMenuText(ctx,span.dataset.text,0,0,getComputedStyle(span).color,1);}
        for(const el of root.querySelectorAll('input,select,textarea'))this.syncField(el);
    }
    prepareField(field) {
        if(this.fields.has(field)){this.syncField(field);return;}
        const wrapper=this.document.createElement('span');wrapper.className='classic-native';
        field.before(wrapper);wrapper.append(field);
        const ink=this.document.createElement('canvas');ink.className='classic-value';ink.setAttribute('aria-hidden','true');wrapper.append(ink);
        this.fields.set(field,ink);this.syncField(field);
    }
    syncField(field) {
        if(!this.active)return;const canvas=this.fields.get(field);if(!canvas)return;
        const w=Math.max(8,field.clientWidth),h=Math.max(10,field.clientHeight);canvas.width=w;canvas.height=h;
        const ctx=canvas.getContext('2d');const selected=field.tagName==='SELECT';
        const raw=selected?field.selectedOptions[0]?.textContent||'':field.value;const text=plainASCII(raw);
        const focused=this.document.activeElement===field;
        const a=field.selectionStart??text.length,b=field.selectionEnd??a;
        const cursor=Math.max(0,textWidth(text.slice(0,a))+1),offset=focused&&!selected?Math.max(0,cursor-w+10):0;
        if(focused&&!selected&&a!==b){ctx.fillStyle='#285962';ctx.fillRect(3+Math.max(0,textWidth(text.slice(0,a))+1)-offset,1,Math.max(1,textWidth(text.slice(a,b))+1),h-2);}
        ctx.save();ctx.beginPath();ctx.rect(2,1,w-(selected?12:4),h-2);ctx.clip();drawMenuText(ctx,text,3-offset,Math.floor((h-7)/2),field.disabled?'#777b60':'#e4e74d',1);
        if(focused&&!selected&&a===b){ctx.fillStyle='#52d7d5';ctx.fillRect(3+cursor-offset,2,1,h-4);}ctx.restore();
        if(selected){drawMenuText(ctx,'>',w-8,Math.floor((h-7)/2),'#e4e74d',1);}
    }
    openSelect(select) {
        this.closeSelect();if(select.disabled)return;this.popupSelect=select;select.focus();
        const p=this.document.createElement('div');p.className='classic-select-popup';p.setAttribute('role','listbox');p.setAttribute('aria-label',select.getAttribute('aria-label')||'Select value');
        const scale=this.root.getBoundingClientRect().width/320,r=select.getBoundingClientRect(),base=this.root.getBoundingClientRect();
        const width=Math.max(60,Math.min(300, r.width/scale));p.style.width=width+'px';
        p.style.left=Math.max(1,Math.min(319-width,(r.left-base.left)/scale))+'px';
        const y=(r.bottom-base.top)/scale;p.style.top=Math.max(1,Math.min(196-112,y))+'px';
        for(const option of select.options){const b=this.document.createElement('button');b.type='button';b.disabled=option.disabled;b.setAttribute('role','option');b.setAttribute('aria-selected',String(option.selected));b.textContent=option.textContent;b.dataset.value=option.value;
            b.addEventListener('click',()=>{select.value=option.value;this.closeSelect();select.dispatchEvent(new Event('change',{bubbles:true}));if(select.isConnected)select.focus();});p.append(b);}
        this.popup=p;this.root.append(p);this.refresh();p.querySelector('[aria-selected=true]')?.focus();
    }
    closeSelect(){const select=this.popupSelect;this.popup?.remove();this.popup=null;this.popupSelect=null;return select;}
    controls(){return [...(this.popup||this.root).querySelectorAll(SELECTOR)].filter(visible);}
    move(key){const controls=this.controls();const current=controls.indexOf(this.document.activeElement);const boxes=controls.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,height:r.height};});const i=navigationIndex(boxes,current,key);if(i>=0){controls[i].focus({preventScroll:true});controls[i].scrollIntoView({block:'nearest',inline:'nearest'});}return controls[i];}
    keydown(e) {
        if(!this.active||this.root.hidden||e.ctrlKey||e.metaKey||e.isComposing)return;
        if(e.key==='Tab'&&this.popup){this.closeSelect()?.focus();return;}
        if(e.key==='Escape'){
            e.preventDefault();e.stopPropagation();const selected=this.closeSelect();
            if(selected)selected.focus();else this.options.back?.();return;
        }
        if(nativeEdit(e.target)){
            if(e.target.tagName==='SELECT'&&(e.key==='Enter'||e.key===' '||e.altKey&&e.key==='ArrowDown')){e.preventDefault();e.stopPropagation();this.openSelect(e.target);}return;
        }
        if(['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(e.key)){
            e.preventDefault();e.stopPropagation();this.move(e.key);this.options.feedback?.('move');return;
        }
        if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();const controls=this.controls();const target=controls.includes(this.document.activeElement)?this.document.activeElement:controls[0];target?.click();return;}
        if(e.key.length===1&&!e.altKey){
            const time=performance.now();this.search=(time-(this.searchTime||0)<700?this.search||'':'')+plainASCII(e.key);this.searchTime=time;
            const controls=this.controls(),target=controls.find(el=>plainASCII(el.getAttribute('aria-label')||el.textContent).trim().startsWith(this.search));
            if(target){e.preventDefault();e.stopPropagation();target.focus({preventScroll:true});target.scrollIntoView({block:'nearest'});}
        }
    }
    hostAction(action){if(action==='back')this.options.back?.();else if(action==='activate')(this.controls().find(el=>el===this.document.activeElement)||this.controls()[0])?.click();else this.move(action);}
    restoreInk(){for(const el of this.root.querySelectorAll('[data-classic-label]'))delete el.dataset.classicLabel;
        for(const copy of this.root.querySelectorAll('.classic-copy'))copy.replaceWith(this.document.createTextNode(copy.querySelector('.classic-semantic')?.textContent||''));
        for(const span of this.root.querySelectorAll('.classic-ink'))span.replaceWith(this.document.createTextNode(span.querySelector('.classic-semantic')?.textContent||span.dataset.text||''));
        for(const wrapper of this.root.querySelectorAll('.classic-native')){const field=wrapper.querySelector('input,select,textarea');if(field){this.fields.delete(field);wrapper.replaceWith(field);}}
    }
    restoreStyles(){for(const [key,value,priority] of this.originalStyles)if(value)this.root.style.setProperty(key,value,priority);else this.root.style.removeProperty(key);}
    dispose(){if(this.disposed)return;this.observer.disconnect();cancelAnimationFrame(this.pending);this.abort.abort();this.closeSelect();this.restoreInk();this.background.remove();this.style.remove();this.root.classList.remove('classic-ui');this.restoreStyles();this.autoParts.forEach(el=>delete el.dataset.classicPart);delete this.root.dataset.classicView;if(this.generatedId&&this.root.id===this.rootId)this.root.removeAttribute('id');this.disposed=true;this.active=false;}
}
