import { sceneRGB, skyRGB, snowParticle } from './shading.js';
const topLeft=(x0,y0,x1,y1)=>y1<y0||(y1===y0&&x1>x0);
const clipDistance=(v,i,plane)=>v[i+3]+(plane%2===0?1:-1)*v[i+(plane>>1)];

/** Shared-topology correctness fallback: homogeneous frustum clipping, perspective
 * interpolation, top-left fill, per-fragment depth/fog and deterministic weather.
 * Buffers and clipping scratch are reused. No painter sort or reduced-detail mesh.
 */
export class SoftwareRasterizer {
    constructor(){
        this.width=0;this.height=0;this.depth=null;this.image=null;this.vertices=new Float64Array(0);
        this.clipA=new Float64Array(120);this.clipB=new Float64Array(120);
    }
    resize(width,height){
        if(width===this.width&&height===this.height)return;
        if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>4000000)throw new RangeError('Invalid raster surface');
        this.width=width;this.height=height;this.depth=new Float32Array(width*height);this.image=new ImageData(width,height);
    }
    triangle(v,ai,bi,ci,eye,weather){
        const w=this.width,h=this.height,pixels=this.image.data,depth=this.depth;
        const aw=1/v[ai+3];let bw=1/v[bi+3],cw=1/v[ci+3];
        const screenX=(i,inv)=>Math.round((v[i]*inv*.5+.5)*w*256)/256;
        const screenY=(i,inv)=>Math.round((.5-v[i+1]*inv*.5)*h*256)/256;
        const ax=screenX(ai,aw),ay=screenY(ai,aw),az=v[ai+2]*aw*.5+.5;
        let bx=screenX(bi,bw),by=screenY(bi,bw),bz=v[bi+2]*bw*.5+.5,cx=screenX(ci,cw),cy=screenY(ci,cw),cz=v[ci+2]*cw*.5+.5;
        let area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
        if(!Number.isFinite(area)||Math.abs(area)<1e-9)return;
        if(area<0){[bx,cx]=[cx,bx];[by,cy]=[cy,by];[bz,cz]=[cz,bz];[bw,cw]=[cw,bw];[bi,ci]=[ci,bi];area=-area;}
        const xmin=Math.max(0,Math.ceil(Math.min(ax,bx,cx)-.5)),xmax=Math.min(w-1,Math.floor(Math.max(ax,bx,cx)-.5));
        const ymin=Math.max(0,Math.ceil(Math.min(ay,by,cy)-.5)),ymax=Math.min(h-1,Math.floor(Math.max(ay,by,cy)-.5));
        if(xmin>xmax||ymin>ymax)return;
        const ta=topLeft(bx,by,cx,cy),tb=topLeft(cx,cy,ax,ay),tc=topLeft(ax,ay,bx,by),inv=1/area;
        for(let y=ymin;y<=ymax;y++){
            const py=y+.5;
            let ea=(cx-bx)*(py-by)-(cy-by)*(xmin+.5-bx),eb=(ax-cx)*(py-cy)-(ay-cy)*(xmin+.5-cx),ec=(bx-ax)*(py-ay)-(by-ay)*(xmin+.5-ax);
            for(let x=xmin;x<=xmax;x++,ea-=cy-by,eb-=ay-cy,ec-=by-ay){
                if(ea<0||eb<0||ec<0||(ea===0&&!ta)||(eb===0&&!tb)||(ec===0&&!tc))continue;
                let a=ea*inv,b=eb*inv,c=ec*inv;const z=Math.fround(a*az+b*bz+c*cz),index=y*w+x;
                if(z<0||z>1||z>depth[index])continue;depth[index]=z;
                const denominator=a*aw+b*bw+c*cw;a=a*aw/denominator;b=b*bw/denominator;c=c*cw/denominator;
                const wx=a*v[ai+4]+b*v[bi+4]+c*v[ci+4],wy=a*v[ai+5]+b*v[bi+5]+c*v[ci+5],wz=a*v[ai+6]+b*v[bi+6]+c*v[ci+6];
                const r=a*v[ai+7]+b*v[bi+7]+c*v[ci+7],g=a*v[ai+8]+b*v[bi+8]+c*v[ci+8],blue=a*v[ai+9]+b*v[bi+9]+c*v[ci+9];
                sceneRGB(r,g,blue,wx,wy,wz,eye,weather,x,y,pixels,index*4);
            }
        }
    }
    render(ctx,matrix,streams,eye,weather,time,wind,skyOffset=0){
        const w=this.width,h=this.height,pixels=this.image.data;this.depth.fill(Infinity);
        for(let y=0;y<h;y++)for(let x=0;x<w;x++)skyRGB(x,y,w,h,weather,skyOffset,pixels,(y*w+x)*4);
        for(const data of streams){
            if(!data)continue;
            const length=data.length/6*4;if(this.vertices.length<length)this.vertices=new Float64Array(length);
            const v=this.vertices;
            for(let i=0,j=0;i<data.length;i+=6,j+=4){
                const x=data[i],y=data[i+1],z=data[i+2];
                for(let k=0;k<4;k++)v[j+k]=matrix[k]*x+matrix[4+k]*y+matrix[8+k]*z+matrix[12+k];
                // Match both native vertex stages on a deliberate 1/16-pixel grid.
                const cw=v[j+3];if(Math.abs(cw)>=.000001){
                    const px=Math.floor((v[j]/cw*.5+.5)*w*16+.5)/16;
                    const py=Math.floor((.5-v[j+1]/cw*.5)*h*16+.5)/16;
                    v[j]=(px/w*2-1)*cw;v[j+1]=(1-py/h*2)*cw;
                }
            }
            for(let i=0,j=0;i<data.length;i+=18,j+=12){
                let a=this.clipA,b=this.clipB,n=3,mask=0,rejected=false;
                for(let vertex=0;vertex<3;vertex++){
                    const offset=vertex*10,clip=j+vertex*4,raw=i+vertex*6;
                    for(let k=0;k<4;k++)a[offset+k]=v[clip+k];
                    for(let k=0;k<6;k++)a[offset+4+k]=data[raw+k];
                }
                for(let plane=0;plane<6;plane++){
                    let outside=0;for(let k=0;k<3;k++)if(clipDistance(a,k*10,plane)<0)outside++;
                    if(outside===3){rejected=true;break;}if(outside)mask|=1<<plane;
                }
                if(rejected)continue;
                for(let plane=0;plane<6&&n;plane++)if(mask&(1<<plane)){
                    let count=0,previous=(n-1)*10,dp=clipDistance(a,previous,plane);
                    for(let k=0;k<n;k++){
                        const current=k*10,dc=clipDistance(a,current,plane);
                        if((dp<0)!==(dc<0)){
                            const t=dp/(dp-dc);for(let c=0;c<10;c++)b[count*10+c]=a[previous+c]+(a[current+c]-a[previous+c])*t;count++;
                        }
                        if(dc>=0){for(let c=0;c<10;c++)b[count*10+c]=a[current+c];count++;}
                        previous=current;dp=dc;
                    }
                    [a,b]=[b,a];n=count;
                }
                for(let k=1;k+1<n;k++)this.triangle(a,0,k*10,(k+1)*10,eye,weather);
            }
        }
        if(weather===1)for(let i=0;i<384;i++){
            const p=snowParticle(i,time,wind),cx=(p[0]*.5+.5)*w,cy=(.5-p[1]*.5)*h,half=p[3]*.5;
            const snap=n=>Math.floor(n*16+.5)/16;
            for(let y=Math.max(0,Math.ceil(snap(cy-half)-.5));y<Math.min(h,Math.ceil(snap(cy+half)-.5));y++)
                for(let x=Math.max(0,Math.ceil(snap(cx-half)-.5));x<Math.min(w,Math.ceil(snap(cx+half)-.5));x++){
                    const at=(y*w+x)*4;pixels[at]=Math.round(.94*255*.75+pixels[at]*.25);pixels[at+1]=Math.round(.96*255*.75+pixels[at+1]*.25);pixels[at+2]=Math.round(255*.75+pixels[at+2]*.25);
                }
        }
        ctx.putImageData(this.image,0,0);
    }
}
