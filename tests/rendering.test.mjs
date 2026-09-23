import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { HILLS, HILL_VISUALS, HillProfile, getHillVisual } from '@wieslawsoltes/ski-hills';
import { createClassicHillScene, MeshBuilder } from '@wieslawsoltes/ski-renderer';
import { createProjectedShadow } from '../packages/renderer/scene.js';
import { orderedDither, paletteChannel, snowParticle, SCENE_WGSL, SCENE_GLSL, SNOW_WGSL, SNOW_GLSL } from '../packages/renderer/shading.js';
import { SoftwareRasterizer } from '../packages/renderer/raster.js';
const hash = data => createHash('sha256').update(Buffer.from(data.buffer,data.byteOffset,data.byteLength)).digest('hex');
for (const hill of HILLS) test(`${hill.id}: full classic scene and explicit original-fidelity provenance`, () => {
    const profile = new HillProfile(hill), a=createClassicHillScene(profile), b=createClassicHillScene(hill.id);
    assert.equal(a.vertices.length%18,0);assert.ok(a.vertices.length>1800);assert.ok(a.vertices.every(Number.isFinite));
    assert.equal(hash(a.vertices),hash(b.vertices));assert.equal(a.surface,'HillProfile');
    assert.equal(a.visual.id,hill.id);assert.equal(a.visual.k,hill.k);assert.equal(a.visual.evidence.pixelParity,'unverified');
    assert.deepEqual(a.sections.map(s=>s.name),['snow','landing-walls','distance-lines','inrun','trees']);
    let count=0;for(const s of a.sections){assert.equal(s.first,count);assert.equal(s.count%3,0);assert.ok(s.count>0);count+=s.count;}
    assert.equal(count,a.vertices.length/6);assert.equal(a.trees.length,a.visual.treeCount);
    assert.ok(Object.isFrozen(a.visual));assert.ok(Object.isFrozen(a.visual.evidence));
});
test('32 explicit render descriptors correspond one-to-one with playable roster',()=>{
    assert.equal(HILL_VISUALS.length,32);assert.equal(new Set(HILL_VISUALS.map(x=>x.id)).size,32);
    assert.throws(()=>getHillVisual('missing'));assert.equal(getHillVisual('fin').id,'fin');
});
test('classic surface decorations never change physics profile',()=>{
    const p=new HillProfile('slo'), before=p.points.map(x=>({...x}));createClassicHillScene(p,285);
    assert.deepEqual(p.points,before);
});
test('record guide affects only its scene section',()=>{
    const a=createClassicHillScene('fin'),b=createClassicHillScene('fin',109.25);
    for(const s of a.sections.filter(s=>s.name!=='distance-lines')){
        const q=b.sections.find(x=>x.name===s.name);
        assert.equal(hash(a.vertices.subarray(s.first*6,(s.first+s.count)*6)),hash(b.vertices.subarray(q.first*6,(q.first+q.count)*6)));
    }
});
test('projected articulated shadows contact the same landing profile',()=>{
    const p=new HillProfile('fin'),v=new Float32Array([30,0,0,.5,.5,.5,31,0,0,.5,.5,.5,30,1,1,.5,.5,.5]);
    const shadow=createProjectedShadow(v,p,{phase:'flight'});
    for(let i=0;i<shadow.length;i+=6)assert.ok(Math.abs(shadow[i+1]-p.atX(shadow[i]).y-.023)<1e-4);
    assert.equal(createProjectedShadow(v,p,{phase:'gate'}).length,0);
    assert.equal(createProjectedShadow(v,p,{phase:'inrun'}).length,0);
});
test('ordered dither is a complete periodic 4x4 threshold matrix',()=>{
    const values=[];for(let y=0;y<4;y++)for(let x=0;x<4;x++){values.push(orderedDither(x,y));assert.equal(orderedDither(x,y),orderedDither(x+4,y+4));}
    assert.equal(new Set(values).size,16);assert.equal(values.reduce((a,b)=>a+b),0);
    for(const n of values){assert.equal(paletteChannel(-1,n),0);assert.equal(paletteChannel(2,n),255);}
});
test('snow depends on sample time, not rendering history or frame rate',()=>{
    for(let i=0;i<384;i++){
        const p=snowParticle(i,20.125,-3.7);snowParticle(i,200,3);
        assert.deepEqual(snowParticle(i,20.125,-3.7),p);assert.ok(p.every(Number.isFinite));
        assert.ok(p[0]>=-1.03&&p[0]<1.03&&p[1]>=-1.03&&p[1]<1.03);
    }
});
test('WGSL and GLSL emit the same shading and snow algorithm',()=>{
    for(const shader of [SCENE_WGSL,SCENE_GLSL])for(const fn of ['ordered','palette','shadeScene','shadeSky','snowAt'])assert.ok(shader.includes(fn));
    for(const shader of [SNOW_WGSL,SNOW_GLSL])assert.ok(shader.includes('snowAt('));
    assert.ok(!SCENE_WGSL.includes('float '));assert.ok(SCENE_WGSL.includes('->vec3<f32>'));
});
globalThis.ImageData ??= class {constructor(width,height){this.width=width;this.height=height;this.data=new Uint8ClampedArray(width*height*4);}};
const identity=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
function render(streams){const r=new SoftwareRasterizer();r.resize(16,16);r.render({putImageData(){}},identity,streams,[0,0,2],0,0,0);return r;}
test('software depth, not submission order, selects opaque nearest triangles',()=>{
    const a=new MeshBuilder(),b=new MeshBuilder();a.tri([-1,-1,.5],[1,-1,.5],[0,1,.5],[1,0,0],false);b.tri([-1,-1,-.5],[1,-1,-.5],[0,1,-.5],[0,1,0],false);
    const first=render([a.finish(),b.finish()]),last=render([b.finish(),a.finish()]);
    assert.deepEqual(first.image.data,last.image.data);const p=(8*16+8)*4;assert.equal(first.image.data[p],0);assert.equal(first.image.data[p+1],255);
});
test('software rasterization is winding-independent without cracks at shared edges',()=>{
    const m=new MeshBuilder();m.quad([-1,-1,0],[1,-1,0],[1,1,0],[-1,1,0],[.5,.5,.5],false);
    const r=render([m.finish()]);assert.ok(r.depth.every(Number.isFinite));
    const data=m.finish();for(let i=0;i<data.length;i+=18){const b=data.slice(i+6,i+12);data.copyWithin(i+6,i+12,i+18);data.set(b,i+12);}
    assert.deepEqual(render([data]).image.data,r.image.data);
});
test('software size-preserving renders reuse depth, projection and pixel storage',()=>{
    const m=new MeshBuilder();m.tri([-1,-1,0],[1,-1,0],[0,1,0],[1,1,1],false);const stream=m.finish(),r=render([stream]);
    const depth=r.depth,image=r.image,vertices=r.vertices;r.resize(16,16);r.render({putImageData(){}},identity,[stream],[0,0,2],0,0,0);
    assert.equal(r.depth,depth);assert.equal(r.image,image);assert.equal(r.vertices,vertices);
});
