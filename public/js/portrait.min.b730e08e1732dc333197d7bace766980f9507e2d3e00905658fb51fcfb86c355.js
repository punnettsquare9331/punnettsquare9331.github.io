(()=>{const s=document.querySelector("#portrait-canvas"),o=document.querySelector("#portrait-fallback");if(!(s instanceof HTMLCanvasElement)||!s.dataset.portraitSrc)return;const l=(e,t,n)=>Math.max(t,Math.min(n,e));let r,n,a=701/1043,t,c=!1;const e=s.getContext("webgl",{alpha:!0,antialias:!0,premultipliedAlpha:!0,depth:!1,stencil:!1,powerPreference:"low-power"}),g=`
    attribute vec3 aPosition;
    attribute vec2 aUV;
    uniform vec2 uViewport;
    uniform vec2 uCenter;
    uniform float uHeight;
    uniform vec2 uRotation;
    varying mediump vec2 vUV;
    void main() {
      float cp = cos(uRotation.y), sp = sin(uRotation.y);
      float cy = cos(uRotation.x), sy = sin(uRotation.x);
      vec3 p = vec3(aPosition.x,
        aPosition.y * cp - aPosition.z * sp,
        aPosition.y * sp + aPosition.z * cp);
      p = vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);
      float perspective = 1.0 / (1.0 - p.z * 0.35);
      vec2 screen = uCenter + vec2(p.x, -p.y) * uHeight * perspective;
      gl_Position = vec4(screen.x / uViewport.x * 2.0 - 1.0,
        1.0 - screen.y / uViewport.y * 2.0, 0.0, 1.0);
      vUV = aUV;
    }
  `,p=`
    precision mediump float;
    uniform sampler2D uPortrait;
    uniform sampler2D uGlyphs;
    uniform vec2 uImageSize;
    uniform vec2 uGrid;
    uniform float uVisibility;
    uniform float uAsciiMix;
    varying mediump vec2 vUV;
    float luminance(vec3 color) {
      return dot(color, vec3(0.2126, 0.7152, 0.0722));
    }
    void main() {
      vec4 photo = texture2D(uPortrait, vUV);
      if (photo.a < 0.004) discard;
      float gray = pow(clamp(luminance(photo.rgb) * 1.12, 0.0, 1.0), 0.91);
      vec3 photoColor = gray * vec3(0.97, 1.0, 0.92);
      vec2 cell = floor(vUV * uGrid);
      vec2 cellUV = (cell + 0.5) / uGrid;
      vec4 sampleColor = texture2D(uPortrait, cellUV);
      float value = luminance(sampleColor.rgb);
      float character = min(7.0, floor(value * 8.0));
      vec2 glyphUV = vec2((character + fract(vUV.x * uGrid.x)) / 8.0,
        fract(vUV.y * uGrid.y));
      float coverage = texture2D(uGlyphs, glyphUV).a;
      vec2 edgeStep = vec2(5.0) / uImageSize;
      float interior = min(min(texture2D(uPortrait, vUV + vec2(edgeStep.x, 0.0)).a,
        texture2D(uPortrait, vUV - vec2(edgeStep.x, 0.0)).a),
        min(texture2D(uPortrait, vUV + vec2(0.0, edgeStep.y)).a,
        texture2D(uPortrait, vUV - vec2(0.0, edgeStep.y)).a));
      float face = 1.0 - smoothstep(0.65, 1.5,
        length((vUV - vec2(0.514, 0.096)) / vec2(0.075, 0.075)));
      float amount = clamp(uAsciiMix + (1.0 - interior) * 0.22, 0.0, 0.94);
      amount *= 1.0 - face * 0.86;
      float photoAlpha = photo.a * (1.0 - amount);
      float glyphAlpha = photo.a * coverage * amount;
      float alpha = photoAlpha + glyphAlpha;
      vec3 glyphColor = vec3(0.79, 0.87, 0.65) * (0.4 + value * 0.8);
      vec3 color = (photoColor * photoAlpha + glyphColor * glyphAlpha) / max(alpha, 0.001);
      float opacity = alpha * uVisibility;
      gl_FragColor = vec4(color * opacity, opacity);
    }
  `,d=e=>{if(!(o instanceof HTMLImageElement))return;const t=e.portraitHeight;o.style.width=`${t*a}px`,o.style.height=`${t}px`,o.style.opacity=String(e.visibility),o.style.transform=`translate3d(${e.centerX-t*a/2}px, ${e.centerY-t/2}px, 0) perspective(${t/.35}px) rotateY(${e.yaw}rad) rotateX(${-e.pitch}rad)`},i=()=>{s.dataset.rendered="false",o instanceof HTMLImageElement&&(o.hidden=!1)},u=(t,n)=>{const s=e.createShader(t);if(e.shaderSource(s,n),e.compileShader(s),!e.getShaderParameter(s,e.COMPILE_STATUS))throw e.deleteShader(s),new Error("Portrait shader unavailable");return s},h=(t,n)=>{const s=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,s),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!1),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,t),s},m=()=>{if(!e||!n||c)return;try{const x=u(e.VERTEX_SHADER,g),C=u(e.FRAGMENT_SHADER,p),i=e.createProgram();if(e.attachShader(i,x),e.attachShader(i,C),e.linkProgram(i),e.deleteShader(x),e.deleteShader(C),!e.getProgramParameter(i,e.LINK_STATUS))throw new Error("Portrait program unavailable");e.useProgram(i);const s=document.createElement("canvas");s.width=140,s.height=Math.round(s.width/a);const j=s.getContext("2d",{willReadFrequently:!0});if(!j)throw new Error("Portrait sampling unavailable");j.drawImage(n,0,0,s.width,s.height);const b=j.getImageData(0,0,s.width,s.height).data,c=64,d=96,_=new Float32Array((c+1)*(d+1)*5);let m=0;for(let e=0;e<=d;e++)for(let i=0;i<=c;i++){const t=i/c,n=e/d,r=Math.min(s.width-1,Math.round(t*(s.width-1))),l=Math.min(s.height-1,Math.round(n*(s.height-1))),o=(l*s.width+r)*4,u=b[o+3]/255,h=(b[o]*.2126+b[o+1]*.7152+b[o+2]*.0722)/255,f=Math.sqrt(Math.max(0,1-((t-.5)/.5)**2)),p=Math.exp(-(((t-.514)/.075)**2)-((n-.096)/.075)**2),g=u*(.025+.035*f+.012*h+.014*p);_.set([(t-.5)*a,.5-n,g,t,n],m),m+=5}const y=new Uint16Array(c*d*6);m=0;for(let e=0;e<d;e++)for(let n=0;n<c;n++){const t=e*(c+1)+n,s=t+c+1;y.set([t,s,t+1,t+1,s,s+1],m),m+=6}const k=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,k),e.bufferData(e.ARRAY_BUFFER,_,e.STATIC_DRAW);const E=e.createBuffer();e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,E),e.bufferData(e.ELEMENT_ARRAY_BUFFER,y,e.STATIC_DRAW);const w=e.getAttribLocation(i,"aPosition"),O=e.getAttribLocation(i,"aUV");e.enableVertexAttribArray(w),e.vertexAttribPointer(w,3,e.FLOAT,!1,20,0),e.enableVertexAttribArray(O),e.vertexAttribPointer(O,2,e.FLOAT,!1,20,12);const v=document.createElement("canvas");v.width=256,v.height=32;const l=v.getContext("2d");if(!l)throw new Error("Portrait glyphs unavailable");l.fillStyle="#fff",l.font="30px monospace",l.textAlign="center",l.textBaseline="middle",".:-=+*#@".split("").forEach((e,t)=>l.fillText(e,t*32+16,16)),h(n,0),h(v,1);const o=t=>e.getUniformLocation(i,t);t={program:i,count:y.length,validated:!1,viewport:o("uViewport"),center:o("uCenter"),height:o("uHeight"),rotation:o("uRotation"),visibility:o("uVisibility"),ascii:o("uAsciiMix"),grid:o("uGrid")},e.uniform1i(o("uPortrait"),0),e.uniform1i(o("uGlyphs"),1),e.uniform2f(o("uImageSize"),n.naturalWidth,n.naturalHeight),e.enable(e.BLEND),e.blendFunc(e.ONE,e.ONE_MINUS_SRC_ALPHA),e.disable(e.DEPTH_TEST),e.clearColor(0,0,0,0),r&&f(r)}catch{t=null,i()}},f=n=>{if(d(n),!e||!t||c)return;const h=l(n.dpr||1,1,2),r=Math.max(1,Math.round(n.width*h)),u=Math.max(1,Math.round(n.height*h));if((s.width!==r||s.height!==u)&&(s.width=r,s.height=u,e.viewport(0,0,r,u)),e.clear(e.COLOR_BUFFER_BIT),e.useProgram(t.program),e.uniform2f(t.viewport,n.width,n.height),e.uniform2f(t.center,n.centerX,n.centerY),e.uniform1f(t.height,n.portraitHeight),e.uniform2f(t.rotation,n.yaw,n.pitch),e.uniform1f(t.visibility,l(n.visibility,0,1)),e.uniform1f(t.ascii,l(n.asciiMix,0,1)),e.uniform2f(t.grid,Math.max(1,n.portraitHeight*a/7),Math.max(1,n.portraitHeight/11)),e.drawElements(e.TRIANGLES,t.count,e.UNSIGNED_SHORT,0),e.isContextLost()){i();return}if(!t.validated){if(e.getError()!==e.NO_ERROR){t=null,i();return}t.validated=!0}s.dataset.rendered="true",o instanceof HTMLImageElement&&(o.hidden=!0)};document.addEventListener("portfolio-view",e=>{const t=e.detail;if(!t||!["width","height","centerX","centerY","portraitHeight","yaw","pitch","visibility","asciiMix"].every(e=>Number.isFinite(t[e])))return;if(t.width<=0||t.height<=0||t.portraitHeight<=0)return;r=t,f(t)}),s.addEventListener("webglcontextlost",e=>{e.preventDefault(),c=!0,t=null,i()}),s.addEventListener("webglcontextrestored",()=>{c=!1,m()}),i(),n=new Image,n.decoding="async",n.onload=()=>{a=n.naturalWidth/n.naturalHeight,r&&d(r),m()},n.onerror=i,n.src=s.dataset.portraitSrc})()