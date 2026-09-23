/** DSJ2 screenshot-informed scene construction. No original meshes or textures.
 * The sampled HillProfile remains the single source of surface/contact geometry.
 * Scene parameters are reconstructions unless a field's provenance says otherwise.
 */
import { clamp, lerp, Random } from '@wieslawsoltes/ski-core';
import { HillProfile, getHillVisual } from '@wieslawsoltes/ski-hills';
import { MeshBuilder, shade } from './mesh.js';

function surface(m, a, b, wa, wb, color, height = 0) {
    m.quad([a.x,a.y+height,-wa],[b.x,b.y+height,-wb],[b.x,b.y+height,wb],[a.x,a.y+height,wa],color,false);
}
function wall(m, a, b, za, zb, width, height, color) {
    // Broad flat side panels, a light cap and dark reverse, as seen in the reference.
    m.quad([a.x,a.y,za],[b.x,b.y,zb],[b.x,b.y+height,zb],[a.x,a.y+height,za],shade(color,.68),false);
    m.quad([a.x,a.y+height,za],[b.x,b.y+height,zb],[b.x,b.y+height,zb+width],[a.x,a.y+height,za+width],shade(color,1.13),false);
    m.quad([a.x,a.y,za+width],[a.x,a.y+height,za+width],[b.x,b.y+height,zb+width],[b.x,b.y,zb+width],shade(color,.9),false);
}
function rampFascia(m,a,b,z,side,spec){
    const depth=spec.inrunDepth, bands=spec.inrunBands;
    for(let i=0;i<bands.length;i++){
        const top=-depth*i/bands.length,bottom=-depth*(i+1)/bands.length,zz=z+side*i*.055;
        m.quad([a.x,a.y+bottom,zz],[b.x,b.y+bottom,zz],[b.x,b.y+top,zz],[a.x,a.y+top,zz],bands[i],false);
    }
    wall(m,a,b,z,z,side*.22,.38,shade(spec.railColor,.48));
}
function support(m,x,y,z,height,radius){
    for(let i=0;i<12;i++){
        const a=i*Math.PI/6,b=(i+1)*Math.PI/6;
        const ax=x+Math.cos(a)*radius,az=z+Math.sin(a)*radius*.8,bx=x+Math.cos(b)*radius,bz=z+Math.sin(b)*radius*.8;
        m.quad([ax,y,az],[bx,y,bz],[bx,y+height,bz],[ax,y+height,az],shade([.35,.37,.39],.58+.42*Math.abs(Math.cos((a+b)*.5))),false);
    }
}
function pine(m,x,y,z,height,seed) {
    const rng=new Random(seed), trunk=[.26,.20,.12];
    m.box(x-.08,y,z-.08,.16,height*.89,.16,trunk);
    // Sparse individual branch fans, rather than the previous three snow cones.
    // All branch endpoints are generated at the same seed at every resolution.
    for(let layer=0;layer<11;layer++) {
        const t=layer/11, yy=y+height*(.20+.72*t), span=height*(1-t)*.29;
        const rot=rng.range(0,Math.PI*2);
        for(let branch=0;branch<5;branch++) {
            const angle=rot+branch*Math.PI*.4, len=span*rng.range(.60,1), dx=Math.cos(angle), dz=Math.sin(angle);
            const a=[x+dx*len,yy-height*.045,z+dz*len], b=[x,yy+height*.07,z], w=len*.19;
            const c=[x+dx*len*.46-dz*w,yy-height*.025,z+dz*len*.46+dx*w];
            const d=[x+dx*len*.46+dz*w,yy-height*.025,z+dz*len*.46-dx*w];
            const green=[.035,.19+.04*rng.next(),.105];
            if(branch%2===0){
                // Partition the facet instead of overlaying an intersecting snow
                // triangle. Opaque coverage is shared without coplanar depth races.
                const ab=b.map((v,i)=>v+(a[i]-v)*.36),cb=b.map((v,i)=>v+(c[i]-v)*.36);
                m.quad(a,ab,cb,c,green,false);
                m.tri(b,cb,ab,[.75,.77,.77],false);
            }else m.tri(a,b,c,green,false);
            m.tri(a,d,b,[.025,.15,.08],false);
        }
    }
}

/** Full-detail independent scene, identical topology on WebGPU/WebGL/software. */
export function createClassicHillScene(profile, record=0) {
    const p=profile instanceof HillProfile?profile:new HillProfile(profile);
    const spec=getHillVisual(p.hill.id), m=new MeshBuilder(), sections=[];
    const section=(name,fn)=>{const first=m.data.length/6;fn();sections.push({name,first,count:m.data.length/6-first});};
    const halfWidth=s=>spec.landingWidth/2+Math.max(0,s)*spec.landingFlare;
    const x0=p.startX-80,x1=p.end.x+100;
    // Narrow cells along the actual profile prevent the terrain penetrating a finer
    // landing mesh. Corridor and surrounding snow share exactly the same samples.
    const rings=[{x:x0,y:p.atX(x0).y,s:0},...Array.from({length:Math.ceil((p.startX-x0)/4)+1},(_,i)=>{
        const x=Math.min(0,x0+i*4);return {x,y:p.atX(x).y,s:0};
    }),...Array.from({length:Math.ceil(-p.startX/2)},(_,i)=>{
        const x=p.startX+i*2;return {x,y:p.atX(x).y,s:0};
    }),...p.points.filter((_,i)=>i%4===0),p.end,{x:x1,y:p.end.y,s:p.end.s+x1-p.end.x}]
    .sort((a,b)=>a.x-b.x).filter((q,i,a)=>i===0||q.x>a[i-1].x+.001);
    section('snow',()=>{
        for(let i=0;i<rings.length-1;i++) {
            const a=rings[i],b=rings[i+1],wa=halfWidth(a.s),wb=halfWidth(b.s);
            // Suppress the random per-quad checkerboard of the previous renderer.
            const brightness=.64+.14*clamp((a.angle||.4)/.7,0,1);
            const c=[brightness,brightness,brightness+.022];
            surface(m,a,b,wa,wb,c,.015);
            for(const side of [-1,1]) {
                const zbands=[0,6,20,48,100,220,420];
                for(let j=0;j<zbands.length-1;j++) {
                    const z0=zbands[j],z1=zbands[j+1];
                    const point=(q,w,z)=>[q.x,q.y+(side<0?Math.min(12,z*.08):-Math.min(28,z*.12))+Math.sin(q.x*.011+z*.018)*Math.min(2,z*.025),side*(w+z)];
                    const color=shade([.73,.74,.77],1+Math.min(.14,z0*.001));
                    m.quad(point(a,wa,z0),point(b,wb,z0),point(b,wb,z1),point(a,wa,z1),color,false);
                }
            }
        }
    });
    section('landing-walls',()=>{
        const end=p.end.s;
        for(let s=0;s<end;s+=2) {
            const a=p.atDistance(s),b=p.atDistance(Math.min(end,s+2));
            for(const side of [-1,1]) wall(m,a,b,side*halfWidth(s),side*halfWidth(b.s),side*.27,.72,spec.railColor);
        }
        for(let s=4;s<end;s+=10) {
            const q=p.atDistance(s);
            for(const side of [-1,1]) m.box(q.x-.13,q.y-.04,side*halfWidth(s)-.16,.26,.85,.32,shade(spec.railColor,.38));
        }
    });
    section('distance-lines',()=>{
        // Narrow green reference lines; K line remains red. No invented blue HS line.
        const distances=[];
        for(let s=Math.ceil(p.k*.65/10)*10;s<=p.k*1.25;s+=10) distances.push(s);
        if(!distances.includes(p.k))distances.push(p.k);
        for(const s of distances) {
            const a=p.atDistance(s-.045),b=p.atDistance(s+.045);
            surface(m,a,b,halfWidth(a.s),halfWidth(b.s),s===p.k?[.72,.10,.12]:[.10,.32,.13],.032);
        }
        if(Number.isFinite(record)&&record>0&&record<=p.end.s) surface(m,p.atDistance(record-.035),p.atDistance(record+.035),halfWidth(record),halfWidth(record),[.8,.55,.12],.04);
    });
    section('inrun',()=>{
        const points=[];
        for(let x=p.startX;x<0;x+=.8)points.push({x,y:p.inrunY(x)});
        points.push({x:0,y:p.inrunY(0)});
        const width=spec.inrunWidth/2;
        for(let i=0;i<points.length-1;i++) {
            const a=points[i],b=points[i+1];
            surface(m,a,b,width,width,[.73,.76,.79]);
            for(const z of [-.26,.26]) m.quad([a.x,a.y+.008,z-.045],[b.x,b.y+.008,z-.045],[b.x,b.y+.008,z+.045],[a.x,a.y+.008,z+.045],[.34,.38,.39],false);
            for(const side of [-1,1])rampFascia(m,a,b,side*(width+.22),side,spec);
        }
        const length=spec.platformLength,depth=spec.inrunDepth;
        const a={x:p.startX-length,y:p.startY},b={x:p.startX,y:p.startY};
        surface(m,a,b,width,width,[.73,.76,.79]);
        for(const side of [-1,1])rampFascia(m,a,b,side*(width+.22),side,spec);
        for(let x=p.startX-5;x<-.5;x+=Math.max(12,p.inrunLength*.32)){
            const top=x<p.startX?p.startY:p.inrunY(x),bottom=p.atX(x).y;
            support(m,x,bottom,0,Math.max(.1,top-bottom-depth),spec.supportRadius);
        }
        // Visible board end and dark underside.
        m.box(-.12,-depth,-width-.3,.12,depth,2*width+.6,spec.inrunBands[3]);
    });
    const trees=[];
    section('trees',()=>{
        const rng=new Random(spec.treeSeed);
        for(let i=0;i<spec.treeCount;i++) {
            const x=rng.range(x0,x1), q=p.atX(x), side=rng.next()<.94?-1:1;
            const offset=rng.range(4,140), z=side*(halfWidth(q.s)+offset);
            // Match the snow mesh's linear interpolation instead of floating trees.
            let lo=0,hi=rings.length-1;
            while(hi-lo>1){const mid=(lo+hi)>>1;if(rings[mid].x<x)lo=mid;else hi=mid;}
            const a=rings[lo],b=rings[hi],f=(x-a.x)/(b.x-a.x);
            const zs=[0,6,20,48,100,220,420];let zi=0;while(zs[zi+1]<offset)zi++;
            const lift=z=>(side<0?Math.min(12,z*.08):-Math.min(28,z*.12))+Math.sin(x*.011+z*.018)*Math.min(2,z*.025);
            const y=lerp(a.y,b.y,f)+lerp(lift(zs[zi]),lift(zs[zi+1]),(offset-zs[zi])/(zs[zi+1]-zs[zi]));
            const height=rng.range(2.5,14),seed=(spec.treeSeed+i*7919)>>>0;
            trees.push({x,y,z,height,seed}); pine(m,x,y,z,height,seed);
        }
    });
    return {vertices:m.finish(),sections,trees,visual:spec,surface:'HillProfile',version:1};
}

/** Project the real articulated mesh on the landing surface, not an oval blob.
 * Bisection solves the light-ray/sampled-surface contact for every mesh vertex.
 */
export function createProjectedShadow(vertices, profile, state) {
    if(['gate','inrun'].includes(state.phase)) return new Float32Array(0);
    const data=new Float32Array(vertices.length),light=[.48,-1,.30];
    for(let i=0;i<vertices.length;i+=6) {
        const x=vertices[i],y=vertices[i+1],z=vertices[i+2];let lo=0,hi=Math.max(1,(y-profile.atX(x).y)*2+8);
        const gap=t=>y+light[1]*t-profile.atX(x+light[0]*t).y;
        for(let n=0;n<5&&gap(hi)>0;n++)hi*=2;
        for(let n=0;n<18;n++){const t=(lo+hi)*.5;if(gap(t)>0)lo=t;else hi=t;}
        const xx=x+light[0]*hi;
        data.set([xx,profile.atX(xx).y+.023,z+light[2]*hi,.38,.39,.42],i);
    }
    return data;
}
