from pathlib import Path

def replace(path, old, new):
    p=Path(path);s=p.read_text();assert s.count(old)==1,(path,old[:100]);p.write_text(s.replace(old,new))

replace('packages/renderer/shading.js', 'const COMMON = `\n', '''const COMMON = `
vec4 snapClip(vec4 p,vec2 size){
 if(abs(p.w)<0.000001){return p;}
 vec2 pixel=vec2((p.x/p.w*0.5+0.5)*size.x,(0.5-p.y/p.w*0.5)*size.y);
 pixel=floor(pixel*16.0+vec2(0.5))/16.0;
 return vec4((pixel.x/size.x*2.0-1.0)*p.w,(1.0-pixel.y/size.y*2.0)*p.w,p.z,p.w);
}
''')
replace('packages/renderer/shading.js', 'o.pos=scene.matrix*vec4<f32>(p,1.0);', 'o.pos=snapClip(scene.matrix*vec4<f32>(p,1.0),scene.params.zw);')
replace('packages/renderer/shading.js', 'export const SCENE_GLSL=', '''export const SCENE_VERTEX_GLSL=`#version 300 es\\nprecision highp float;\\n${COMMON}
layout(location=0)in vec3 p;layout(location=1)in vec3 c;uniform mat4 matrix;uniform vec2 viewport;out vec3 color;out vec3 world;
void main(){gl_Position=snapClip(matrix*vec4(p,1.0),viewport);color=c;world=p;}`;
export const SNAP_WGSL=wgsl(COMMON);
export const SCENE_GLSL=''')
replace('packages/renderer/shading.js', 'gl_Position=vec4(p.xy+q/conditions.zw*p.w,0.0,1.0);', 'gl_Position=snapClip(vec4(p.xy+q/conditions.zw*p.w,0.0,1.0),conditions.zw);')
replace('packages/renderer/index.js', 'SCENE_WGSL, SKY_WGSL, SCENE_GLSL, SKY_GLSL, SNOW_WGSL, SNOW_GLSL', 'SCENE_WGSL, SKY_WGSL, SCENE_GLSL, SKY_GLSL, SNOW_WGSL, SNOW_GLSL, SCENE_VERTEX_GLSL, SNAP_WGSL')
replace('packages/renderer/index.js', 'const GPU_SNOW_DRAW = `', 'const GPU_SNOW_DRAW = SNAP_WGSL+`')
replace('packages/renderer/index.js', 'return vec4<f32>(p.xy+q[vi]*vec2<f32>(1.0/weather.width,1.0/weather.height)*p.w,0,1);', 'return snapClip(vec4<f32>(p.xy+q[vi]*vec2<f32>(1.0/weather.width,1.0/weather.height)*p.w,0,1),vec2<f32>(weather.width,weather.height));')
replace('packages/renderer/index.js', 'const vs = `#version 300 es\\nprecision highp float;layout(location=0)in vec3 p;layout(location=1)in vec3 c;uniform mat4 matrix;out vec3 color;out vec3 world;void main(){gl_Position=matrix*vec4(p,1);color=c;world=p;}`;', 'const vs = SCENE_VERTEX_GLSL;')
replace('packages/renderer/index.js', 'this.gl = gl;\n', 'this.gl = gl;\n        gl.disable(gl.DITHER); // Our explicit ordered palette handles dithering.\n')
replace('packages/renderer/raster.js', 'for(let k=0;k<4;k++)v[j+k]=matrix[k]*x+matrix[4+k]*y+matrix[8+k]*z+matrix[12+k];', '''for(let k=0;k<4;k++)v[j+k]=matrix[k]*x+matrix[4+k]*y+matrix[8+k]*z+matrix[12+k];
                // Match both native vertex stages on a deliberate 1/16-pixel grid.
                const cw=v[j+3];if(Math.abs(cw)>=.000001){
                    const px=Math.floor((v[j]/cw*.5+.5)*w*16+.5)/16;
                    const py=Math.floor((.5-v[j+1]/cw*.5)*h*16+.5)/16;
                    v[j]=(px/w*2-1)*cw;v[j+1]=(1-py/h*2)*cw;
                }''')
replace('packages/renderer/raster.js', 'for(let y=Math.max(0,Math.ceil(cy-half-.5));y<Math.min(h,Math.ceil(cy+half-.5));y++)\n                for(let x=Math.max(0,Math.ceil(cx-half-.5));x<Math.min(w,Math.ceil(cx+half-.5));x++){', '''const snap=n=>Math.floor(n*16+.5)/16;
            for(let y=Math.max(0,Math.ceil(snap(cy-half)-.5));y<Math.min(h,Math.ceil(snap(cy+half)-.5));y++)
                for(let x=Math.max(0,Math.ceil(snap(cx-half)-.5));x<Math.min(w,Math.ceil(snap(cx+half)-.5));x++){''')
print('Applied matching native/software vertex subpixel grids')
replace('packages/renderer/shading.js', 'gl_Position=snapClip(matrix*vec4(p,1.0),viewport);color=c;', 'gl_Position=snapClip(matrix*vec4(p,1.0),viewport);gl_Position.y=-gl_Position.y;color=c;')
replace('packages/renderer/shading.js', 'gl_Position=snapClip(vec4(p.xy+q/conditions.zw*p.w,0.0,1.0),conditions.zw);', 'gl_Position=snapClip(vec4(p.xy+q/conditions.zw*p.w,0.0,1.0),conditions.zw);gl_Position.y=-gl_Position.y;')
p=Path('packages/renderer/shading.js');s=p.read_text();assert s.count('floor(viewport.y-gl_FragCoord.y)')==2;p.write_text(s.replace('floor(viewport.y-gl_FragCoord.y)', 'floor(gl_FragCoord.y)'))
replace('packages/renderer/index.js', 'this.gl = gl;\n', '''this.gl = gl;
        // Render in a top-left logical framebuffer, matching WebGPU edge inclusion.
        // The compositor reverses storage orientation without an extra readback/copy.
        this.canvas.style.transform = 'scaleY(-1)';
''')
replace('packages/renderer/index.js', 'for(let y=0;y<height;y++)pixels.set(data.subarray((height-y-1)*width*4,(height-y)*width*4),y*width*4);', 'pixels.set(data); // GL storage was rendered in top-left logical orientation.')
print('Normalized OpenGL raster edge convention before coverage, not after readback')
