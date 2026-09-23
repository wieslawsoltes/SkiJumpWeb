/** One shading source emitted to WGSL and GLSL. Pixel coordinates are top-left.
 * The software rasterizer below uses the identical documented scalar equations.
 * Quantization is a reconstructed six-bit DAC look, not the original 256-color table.
 */
const COMMON = `
vec4 snapClip(vec4 p,vec2 size){
 if(abs(p.w)<0.000001){return p;}
 vec2 pixel=vec2((p.x/p.w*0.5+0.5)*size.x,(0.5-p.y/p.w*0.5)*size.y);
 pixel=floor(pixel*16.0+vec2(0.5))/16.0;
 return vec4((pixel.x/size.x*2.0-1.0)*p.w,(1.0-pixel.y/size.y*2.0)*p.w,p.z,p.w);
}
float wrap(float x,float period){return x-floor(x/period)*period;}
float ordered(float x,float y){
 float a=wrap(floor(x),2.0);float b=wrap(floor(y),2.0);
 float c=wrap(floor(x/2.0),2.0);float d=wrap(floor(y/2.0),2.0);
 return (8.0*abs(a-b)+4.0*b+2.0*abs(c-d)+d+0.5)/16.0-0.5;
}
vec3 palette(vec3 color,float x,float y){
 return floor(clamp(color+vec3(ordered(x,y)/63.0),vec3(0.0),vec3(1.0))*63.0+vec3(0.5))/63.0;
}
vec3 shadeScene(vec3 color,vec3 world,vec3 eye,float weather,float x,float y){
 float fog=smoothstep(180.0,500.0,distance(world,eye))*0.32;
 vec3 c=mix(color,vec3(0.80,0.81,0.86),fog);
 if(weather>2.5){c=c*vec3(0.35,0.43,0.65);}
 else if(weather>1.5){c=c*vec3(1.0,0.84,0.80);}
 return palette(c,x,y);
}
vec3 shadeSky(float x,float y,float width,float height,float weather,float offset){
 float u=(x+0.5)/width;float v=(y+0.5)/height;
 vec3 top=vec3(0.35,0.34,0.76);vec3 bottom=vec3(0.88,0.86,0.92);
 if(weather>2.5){top=vec3(0.035,0.045,0.13);bottom=vec3(0.22,0.27,0.41);}
 else if(weather>1.5){top=vec3(0.30,0.29,0.51);bottom=vec3(0.89,0.68,0.57);}
 vec3 c=mix(top,bottom,smoothstep(0.0,0.18,v));
 float ridge=0.115+0.025*sin(u*9.0+offset)+0.01*sin(u*29.0+offset*0.3);
 if(v>ridge){c=bottom*0.98;}
 if(v>ridge+0.055){c=bottom*0.955;}
 if(v>ridge+0.12){c=bottom*0.93;}
 if(weather>2.5 && v<ridge && wrap(floor(x)*13.0+floor(y)*127.0,997.0)>995.0){c=vec3(0.82,0.85,0.93);}
 return palette(c,x,y);
}
vec4 snowAt(float index,float time,float wind){
 float bx=wrap(index*73.0+17.0,389.0)/389.0*2.06;
 float by=wrap(index*151.0+31.0,397.0)/397.0*2.06;
 float speed=0.12+wrap(index*19.0+7.0,101.0)/101.0*0.25;
 float size=0.65+wrap(index*37.0+3.0,103.0)/103.0*0.95;
 return vec4(wrap(bx+time*(wind*0.024+0.025),2.06)-1.03,wrap(by-time*speed,2.06)-1.03,speed,size);
}
`;
function wgsl(source) {
    const type=t=>t==='float'?'f32':t+'<f32>';
    return source.replace(/\b(float|vec[234])\s+(\w+)\(([^)]*)\)\s*\{/g,(_,t,name,args)=>
        `fn ${name}(${args.split(',').filter(Boolean).map(a=>{const [t,n]=a.trim().split(/\s+/);return n+':'+type(t);}).join(',')})->${type(t)}{`)
        .replace(/\b(float|vec[234])\s+(\w+)\s*=/g,(_,t,n)=>`var ${n}:${type(t)}=`)
        .replace(/\b(vec[234])\(/g,'$1<f32>(');
}
const UNIFORM=`struct Scene { matrix:mat4x4<f32>, fog:vec4<f32>, params:vec4<f32>, camera:vec4<f32> };
@group(0) @binding(0) var<uniform> scene:Scene;`;
export const SCENE_WGSL=UNIFORM+wgsl(COMMON)+`
struct Out { @builtin(position) pos:vec4<f32>, @location(0) color:vec3<f32>, @location(1) world:vec3<f32> };
@vertex fn vs(@location(0) p:vec3<f32>,@location(1) c:vec3<f32>)->Out{
 var o:Out;o.pos=snapClip(scene.matrix*vec4<f32>(p,1.0),scene.params.zw);o.color=c;o.world=p;return o;
}
@fragment fn fs(o:Out)->@location(0) vec4<f32>{return vec4<f32>(shadeScene(o.color,o.world,scene.camera.xyz,scene.params.x,floor(o.pos.x),floor(o.pos.y)),1.0);}`;
export const SKY_WGSL=UNIFORM+wgsl(COMMON)+`
@vertex fn vs(@builtin(vertex_index) i:u32)->@builtin(position) vec4<f32>{
 let p=array<vec2<f32>,3>(vec2<f32>(-1,-1),vec2<f32>(3,-1),vec2<f32>(-1,3));return vec4<f32>(p[i],0.999,1.0);
}
@fragment fn fs(@builtin(position) p:vec4<f32>)->@location(0) vec4<f32>{return vec4<f32>(shadeSky(floor(p.x),floor(p.y),scene.params.z,scene.params.w,scene.params.x,scene.fog.w),1.0);}`;
export const SCENE_VERTEX_GLSL=`#version 300 es\nprecision highp float;\n${COMMON}
layout(location=0)in vec3 p;layout(location=1)in vec3 c;uniform mat4 matrix;uniform vec2 viewport;out vec3 color;out vec3 world;
void main(){gl_Position=snapClip(matrix*vec4(p,1.0),viewport);gl_Position.y=-gl_Position.y;color=c;world=p;}`;
export const SNAP_WGSL=wgsl(COMMON);
export const SCENE_GLSL=`#version 300 es\nprecision highp float;\n${COMMON}
in vec3 color;in vec3 world;uniform vec3 eye;uniform float weather;uniform vec2 viewport;out vec4 outColor;
void main(){outColor=vec4(shadeScene(color,world,eye,weather,floor(gl_FragCoord.x),floor(gl_FragCoord.y)),1.0);}`;
export const SKY_GLSL=`#version 300 es\nprecision highp float;\n${COMMON}
uniform float weather;uniform vec2 viewport;uniform float skyOffset;out vec4 outColor;
void main(){outColor=vec4(shadeSky(floor(gl_FragCoord.x),floor(gl_FragCoord.y),viewport.x,viewport.y,weather,skyOffset),1.0);}`;
export const SNOW_WGSL=wgsl(COMMON)+`
struct Weather {wind:f32,time:f32,width:f32,height:f32};
@group(0) @binding(0) var<storage,read_write> particles:array<vec4<f32>>;
@group(0) @binding(1) var<uniform> weather:Weather;
@compute @workgroup_size(64) fn update(@builtin(global_invocation_id) id:vec3<u32>){if(id.x<384u){particles[id.x]=snowAt(f32(id.x),weather.time,weather.wind);}}`;
export const SNOW_GLSL=`#version 300 es\nprecision highp float;\n${COMMON}
uniform vec4 conditions;
void main(){
 vec4 p=snowAt(float(gl_InstanceID),conditions.y,conditions.x);
 int i=gl_VertexID;vec2 q=vec2((i==1||i==2||i==4)?1.0:-1.0,(i==2||i==4||i==5)?1.0:-1.0);
 gl_Position=snapClip(vec4(p.xy+q/conditions.zw*p.w,0.0,1.0),conditions.zw);gl_Position.y=-gl_Position.y;
}`;
const wrap=(x,p)=>x-Math.floor(x/p)*p;
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function orderedDither(x,y) {
    const a=wrap(Math.floor(x),2),b=wrap(Math.floor(y),2),c=wrap(Math.floor(x/2),2),d=wrap(Math.floor(y/2),2);
    return (8*Math.abs(a-b)+4*b+2*Math.abs(c-d)+d+.5)/16-.5;
}
export function paletteChannel(c,n) {return Math.round(Math.floor(Math.max(0,Math.min(1,c+n/63))*63+.5)/63*255);}
export function sceneRGB(r,g,b,x,y,z,eye,weather,px,py,out,offset) {
    const f=smooth(180,500,Math.hypot(x-eye[0],y-eye[1],z-eye[2]))*.32,n=orderedDither(px,py);
    r=r+(0.80-r)*f;g=g+(0.81-g)*f;b=b+(0.86-b)*f;
    if(weather===3){r*=.35;g*=.43;b*=.65;}else if(weather===2){g*=.84;b*=.8;}
    out[offset]=paletteChannel(r,n);out[offset+1]=paletteChannel(g,n);out[offset+2]=paletteChannel(b,n);out[offset+3]=255;
}
export function skyRGB(x,y,w,h,weather,offset,out,pos) {
    const u=(x+.5)/w,v=(y+.5)/h,n=orderedDither(x,y),t=smooth(0,.18,v);
    const top=weather===3?[.035,.045,.13]:weather===2?[.30,.29,.51]:[.35,.34,.76];
    const bottom=weather===3?[.22,.27,.41]:weather===2?[.89,.68,.57]:[.88,.86,.92];
    const ridge=.115+.025*Math.sin(u*9+offset)+.01*Math.sin(u*29+offset*.3);
    const factor=v>ridge+.12?.93:v>ridge+.055?.955:v>ridge?.98:0;
    const star=weather===3&&v<ridge&&wrap(Math.floor(x)*13+Math.floor(y)*127,997)>995;
    for(let j=0;j<3;j++)out[pos+j]=paletteChannel(star?[.82,.85,.93][j]:factor?bottom[j]*factor:top[j]+(bottom[j]-top[j])*t,n);
    out[pos+3]=255;
}
export function snowParticle(index,time,wind) {
    const bx=wrap(index*73+17,389)/389*2.06,by=wrap(index*151+31,397)/397*2.06;
    return [wrap(bx+time*(wind*.024+.025),2.06)-1.03,wrap(by-time*(.12+wrap(index*19+7,101)/101*.25),2.06)-1.03,.12+wrap(index*19+7,101)/101*.25,.65+wrap(index*37+3,103)/103*.95];
}
