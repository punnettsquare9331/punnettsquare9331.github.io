(() => {
  const canvas = document.querySelector('#portrait-canvas');
  const fallback = document.querySelector('#portrait-fallback');
  if (!(canvas instanceof HTMLCanvasElement) || !canvas.dataset.portraitSrc) return;

  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  let lastView;
  let image;
  let aspect = 701 / 1043;
  let resources;
  let lost = false;
  const gl = canvas.getContext('webgl', {
    alpha: true, antialias: true, premultipliedAlpha: true,
    depth: false, stencil: false, powerPreference: 'low-power'
  });

  const vertexSource = `
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
  `;
  const fragmentSource = `
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
  `;

  const syncFallback = (view) => {
    if (!(fallback instanceof HTMLImageElement)) return;
    const height = view.portraitHeight;
    fallback.style.width = `${height * aspect}px`;
    fallback.style.height = `${height}px`;
    fallback.style.opacity = String(view.visibility);
    fallback.style.transform = `translate3d(${view.centerX - height * aspect / 2}px, ${view.centerY - height / 2}px, 0) perspective(${height / 0.35}px) rotateY(${view.yaw}rad) rotateX(${-view.pitch}rad)`;
  };
  const showFallback = () => {
    canvas.dataset.rendered = 'false';
    if (fallback instanceof HTMLImageElement) fallback.hidden = false;
  };

  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      throw new Error('Portrait shader unavailable');
    }
    return shader;
  };
  const texture = (source, unit) => {
    const result = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, result);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    return result;
  };

  const initialize = () => {
    if (!gl || !image || lost) return;
    try {
      const vertex = compile(gl.VERTEX_SHADER, vertexSource);
      const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
      const program = gl.createProgram();
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Portrait program unavailable');
      gl.useProgram(program);

      // This is a shallow relief of the original photograph, not a reconstructed
      // body. Alpha and luminance provide modest surface variation for parallax.
      const sample = document.createElement('canvas');
      sample.width = 140;
      sample.height = Math.round(sample.width / aspect);
      const context = sample.getContext('2d', {willReadFrequently: true});
      if (!context) throw new Error('Portrait sampling unavailable');
      context.drawImage(image, 0, 0, sample.width, sample.height);
      const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
      const columns = 64, rows = 96;
      const vertices = new Float32Array((columns + 1) * (rows + 1) * 5);
      let offset = 0;
      for (let row = 0; row <= rows; row++) {
        for (let column = 0; column <= columns; column++) {
          const u = column / columns, v = row / rows;
          const x = Math.min(sample.width - 1, Math.round(u * (sample.width - 1)));
          const y = Math.min(sample.height - 1, Math.round(v * (sample.height - 1)));
          const pixel = (y * sample.width + x) * 4;
          const alpha = pixels[pixel + 3] / 255;
          const light = (pixels[pixel] * 0.2126 + pixels[pixel + 1] * 0.7152 + pixels[pixel + 2] * 0.0722) / 255;
          const roundness = Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.5) / 0.5, 2)));
          const face = Math.exp(-Math.pow((u - 0.514) / 0.075, 2) - Math.pow((v - 0.096) / 0.075, 2));
          const depth = alpha * (0.025 + 0.035 * roundness + 0.012 * light + 0.014 * face);
          vertices.set([(u - 0.5) * aspect, 0.5 - v, depth, u, v], offset);
          offset += 5;
        }
      }
      const indices = new Uint16Array(columns * rows * 6);
      offset = 0;
      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          const a = row * (columns + 1) + column, b = a + columns + 1;
          indices.set([a, b, a + 1, a + 1, b, b + 1], offset);
          offset += 6;
        }
      }
      const vertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
      const indexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'aPosition');
      const uv = gl.getAttribLocation(program, 'aUV');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 20, 0);
      gl.enableVertexAttribArray(uv);
      gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 20, 12);

      const atlas = document.createElement('canvas');
      atlas.width = 256;
      atlas.height = 32;
      const glyphs = atlas.getContext('2d');
      if (!glyphs) throw new Error('Portrait glyphs unavailable');
      glyphs.fillStyle = '#fff';
      glyphs.font = '30px monospace';
      glyphs.textAlign = 'center';
      glyphs.textBaseline = 'middle';
      '.:-=+*#@'.split('').forEach((glyph, index) => glyphs.fillText(glyph, index * 32 + 16, 16));
      texture(image, 0);
      texture(atlas, 1);
      const uniform = (name) => gl.getUniformLocation(program, name);
      resources = {
        program, count: indices.length, validated: false,
        viewport: uniform('uViewport'), center: uniform('uCenter'), height: uniform('uHeight'),
        rotation: uniform('uRotation'), visibility: uniform('uVisibility'), ascii: uniform('uAsciiMix'),
        grid: uniform('uGrid')
      };
      gl.uniform1i(uniform('uPortrait'), 0);
      gl.uniform1i(uniform('uGlyphs'), 1);
      gl.uniform2f(uniform('uImageSize'), image.naturalWidth, image.naturalHeight);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.DEPTH_TEST);
      gl.clearColor(0, 0, 0, 0);
      if (lastView) draw(lastView);
    } catch {
      resources = null;
      showFallback();
    }
  };

  const draw = (view) => {
    syncFallback(view);
    if (!gl || !resources || lost) return;
    const dpr = clamp(view.dpr || 1, 1, 2);
    const width = Math.max(1, Math.round(view.width * dpr));
    const height = Math.max(1, Math.round(view.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(resources.program);
    gl.uniform2f(resources.viewport, view.width, view.height);
    gl.uniform2f(resources.center, view.centerX, view.centerY);
    gl.uniform1f(resources.height, view.portraitHeight);
    gl.uniform2f(resources.rotation, view.yaw, view.pitch);
    gl.uniform1f(resources.visibility, clamp(view.visibility, 0, 1));
    gl.uniform1f(resources.ascii, clamp(view.asciiMix, 0, 1));
    gl.uniform2f(resources.grid, Math.max(1, view.portraitHeight * aspect / 7), Math.max(1, view.portraitHeight / 11));
    gl.drawElements(gl.TRIANGLES, resources.count, gl.UNSIGNED_SHORT, 0);
    if (gl.isContextLost()) {
      showFallback();
      return;
    }
    if (!resources.validated) {
      if (gl.getError() !== gl.NO_ERROR) {
        resources = null;
        showFallback();
        return;
      }
      resources.validated = true;
    }
    canvas.dataset.rendered = 'true';
    if (fallback instanceof HTMLImageElement) fallback.hidden = true;
  };

  document.addEventListener('portfolio-view', (event) => {
    const view = event.detail;
    if (!view || !['width', 'height', 'centerX', 'centerY', 'portraitHeight', 'yaw', 'pitch', 'visibility', 'asciiMix'].every((key) => Number.isFinite(view[key]))) return;
    if (view.width <= 0 || view.height <= 0 || view.portraitHeight <= 0) return;
    lastView = view;
    draw(view);
  });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    lost = true;
    resources = null;
    showFallback();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false;
    initialize();
  });

  showFallback();
  image = new Image();
  image.decoding = 'async';
  image.onload = () => {
    aspect = image.naturalWidth / image.naturalHeight;
    if (lastView) syncFallback(lastView);
    initialize();
  };
  image.onerror = showFallback;
  image.src = canvas.dataset.portraitSrc;
})();
