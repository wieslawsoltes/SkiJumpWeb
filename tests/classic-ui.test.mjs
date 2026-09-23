import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSIC_MENU_LAYOUT, classicViewport, navigationIndex, ClassicMenuSkin, drawMenuBackdrop, drawClassicLogo } from '../packages/ui/index.js';

for (const [width,height,scale] of [[320,200,1],[640,400,2],[1280,800,4],[800,600,2],[390,844,1],[844,390,1],[1920,1080,5],[240,180,.75]]) {
    test(`classic menu letterboxes ${width}x${height} without altering the logical grid`,()=>{
        const v=classicViewport(width,height);assert.equal(v.scale,scale);assert.equal(v.width,320);assert.equal(v.height,200);
        assert.ok(v.left>=0&&v.top>=0);assert.ok(v.left+320*v.scale<=width);assert.ok(v.top+200*v.scale<=height);assert.ok(Object.isFrozen(v));
    });
}
for (const size of [0,-1,NaN,Infinity,-Infinity]) {
    test(`invalid classic viewport width ${size} is rejected`,()=>assert.throws(()=>classicViewport(size,200),RangeError));
    test(`invalid classic viewport height ${size} is rejected`,()=>assert.throws(()=>classicViewport(320,size),RangeError));
}
test('fitted mode remains aspect-preserving and explicitly fractional',()=>{const v=classicViewport(390,844,true);assert.equal(v.scale,390/320);assert.equal(v.left,0);});
test('measured menu constants are immutable',()=>{assert.equal(CLASSIC_MENU_LAYOUT.menuX,48);assert.equal(CLASSIC_MENU_LAYOUT.rowHeight,12);assert.ok(Object.isFrozen(CLASSIC_MENU_LAYOUT));});
const rows=Array.from({length:16},(_,i)=>({x:10,y:i*12,height:12}));
for(const [from,key,to] of [[0,'ArrowUp',15],[15,'ArrowDown',0],[-1,'ArrowDown',0],[-1,'ArrowUp',15],[3,'Home',0],[2,'End',15],[0,'PageDown',8],[14,'PageDown',15],[15,'PageUp',7],[2,'PageUp',0]])test(`menu ${key} ${from} -> ${to}`,()=>assert.equal(navigationIndex(rows,from,key),to));
test('horizontal navigation selects an adjacent grid item, not the next vertical row',()=>{const grid=[{x:0,y:0,height:12},{x:40,y:0,height:12},{x:0,y:12,height:12},{x:40,y:12,height:12}];assert.equal(navigationIndex(grid,0,'ArrowRight'),1);assert.equal(navigationIndex(grid,3,'ArrowLeft'),2);assert.equal(navigationIndex(grid,0,'ArrowLeft'),0);});
test('empty menus are inert',()=>assert.equal(navigationIndex([],0,'ArrowDown'),-1));
test('DOM-less import is safe, invalid skin roots fail explicitly',()=>assert.throws(()=>new ClassicMenuSkin(null),TypeError));
function canvas(){let hash=0;const push=(...args)=>{for(const c of JSON.stringify(args))hash=(Math.imul(hash,31)+c.charCodeAt(0))>>>0;};const ctx=new Proxy({getImageData:()=>({data:new Uint8ClampedArray(320*200*4)}),putImageData:i=>push(Array.from(i.data.slice(0,200))),createLinearGradient:()=>({addColorStop:push})},{get:(t,k)=>t[k]||((...a)=>push(k,...a)),set:(t,k,v)=>(push(k,v),t[k]=v,true)});return {width:0,height:0,getContext:()=>ctx,hash:()=>hash};}
test('authored backdrop is stable for the same seed and independent of game state',()=>{const a=canvas(),b=canvas();drawMenuBackdrop(a,210);drawMenuBackdrop(b,210);assert.equal(a.hash(),b.hash());assert.equal(a.width,320);assert.equal(a.height,200);});
test('backdrop seed changes authored vegetation/grain, not logical dimensions',()=>{const a=canvas(),b=canvas();drawMenuBackdrop(a,210);drawMenuBackdrop(b,211);assert.notEqual(a.hash(),b.hash());assert.equal(a.width,b.width);});
test('classic logo is drawn using the package bitmap pipeline at its native size',()=>{const c=canvas();drawClassicLogo(c);assert.equal(c.width,122);assert.equal(c.height,27);assert.ok(c.hash());});
