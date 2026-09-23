import test from 'node:test';
import assert from 'node:assert/strict';
import { HILLS, HillProfile } from '@wieslawsoltes/ski-hills';
import { createClassicHillScene, SkiRenderer } from '@wieslawsoltes/ski-renderer';

for(const hill of HILLS) test(`${hill.id}: closed inrun underside and terminal faces in every camera`,()=>{
    const p=new HillProfile(hill),scene=createClassicHillScene(p),part=scene.sections.find(s=>s.name==='inrun');
    const v=scene.vertices.subarray(part.first*6,(part.first+part.count)*6),spec=scene.visual;
    const triangles=[];
    for(let i=0;i<v.length;i+=18)triangles.push([0,6,12].map(j=>[v[i+j],v[i+j+1],v[i+j+2]]));
    for(const x of [p.startX-spec.platformLength,0]){
        const faces=triangles.filter(t=>t.every(q=>Math.abs(q[0]-x)<1e-4));
        assert.ok(faces.length>=spec.inrunBands.length*2,`Missing cap at ${x}`);
        assert.ok(faces.some(t=>Math.min(...t.map(q=>q[2]))<0&&Math.max(...t.map(q=>q[2]))>0),'Cap must span the ramp');
    }
    assert.ok(triangles.some(t=>t.every(q=>Math.abs(q[1]-(p.inrunY(q[0])-spec.inrunDepth))<1e-4)&&Math.min(...t.map(q=>q[2]))<0&&Math.max(...t.map(q=>q[2]))>0),'Missing continuous underside');
    for(const camera of ['classic','close','wide','chase'])for(const [width,height] of [[320,200],[320,568],[432,200]]){
        const r=Object.create(SkiRenderer.prototype);
        Object.assign(r,{profile:p,options:{camera,presentation:'classic'},kind:'webgpu',width,height,camera:{x:0,y:0},cameraReady:false});
        const q=p.atDistance(p.k*.7),state={x:q.x,y:q.y+5,phase:'flight'};
        const matrix=r.cameraMatrix(state,1/60);
        assert.ok(matrix.every(Number.isFinite));assert.ok(r.project(state.x,state.y,0).every(Number.isFinite));
        const expected=[...matrix];r.cameraMatrix({...state,x:state.x+100},1/30);
        assert.deepEqual([...r.cameraMatrix(state,1/120)],expected,'Classic camera must not drift with seek/frame history');
    }
});
