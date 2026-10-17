(() => {
  const canvas = document.querySelector('#landscape-canvas');
  const toggle = document.querySelector('[data-motion-toggle]');
  if (!(canvas instanceof HTMLCanvasElement) || !toggle) return;
  const context = canvas.getContext('2d');
  if (!context) return;

  const landscape = canvas.closest('.landscape');
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const label = toggle.querySelector('[data-motion-label]');
  const lossLabel = landscape.querySelector('[data-loss-value]');
  const stepLabel = landscape.querySelector('[data-loss-step]');
  const stateLabel = landscape.querySelector('[data-loss-state]');
  const restart = landscape.querySelector('[data-loss-restart]');
  const storageKey = 'puneet-background-motion';
  const accent = '#d5ff70';
  let paused = false;
  let inView = false;
  let frame = 0;
  let lastTime = 0;
  let elapsed = 2.2;
  let width = 600;
  let height = 540;
  let pointerX = 0;
  let pointerY = 0;
  let targetX = 0;
  let targetY = 0;
  let seed = 0;
  let cells, depths, columns, rows, cellWidth, cellHeight;

  try { paused = localStorage.getItem(storageKey) === 'paused'; } catch {}
  const canMove = () => !paused && !preference.matches && !document.hidden;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  // A synthetic, nonconvex objective. Both the surface and the descent use this
  // function; the readout describes this illustration, not research results.
  const loss = (x, z) => 0.12 * (x * x + 1.6 * z * z)
    + 0.32 * Math.sin(1.8 * x) * Math.cos(1.3 * z) + 0.65;
  const gradient = (x, z) => [
    0.24 * x + 0.576 * Math.cos(1.8 * x) * Math.cos(1.3 * z),
    0.384 * z - 0.416 * Math.sin(1.8 * x) * Math.sin(1.3 * z)
  ];
  const elevation = (value) => (value - 0.7) * 1.1;
  const starts = [[2.7, -2.5], [-2.7, 2.4], [2.6, 2.5], [-2.6, -2.5]];
  const makeRun = () => {
    let [x, z] = starts[seed % starts.length];
    const points = [{x, z, loss: loss(x, z), distance: 0}];
    for (let step = 0; step < 180; step++) {
      const [dx, dz] = gradient(x, z);
      if (Math.hypot(dx, dz) < 0.001) break;
      const previous = points[points.length - 1];
      // Backtracking keeps every accepted step downhill, including near saddles.
      let rate = 0.18;
      while (loss(x - rate * dx, z - rate * dz) > previous.loss && rate > 0.0001) rate *= 0.5;
      x -= rate * dx;
      z -= rate * dz;
      points.push({x, z, loss: loss(x, z), distance: previous.distance + Math.hypot(x - previous.x, z - previous.z)});
    }
    return points;
  };
  let route = makeRun();
  const mesh = [];
  const divisions = 72;
  for (let row = 0; row <= divisions; row++) {
    for (let col = 0; col <= divisions; col++) {
      const x = -3 + col * 6 / divisions;
      const z = -3 + row * 6 / divisions;
      const value = loss(x, z);
      const [dx, dz] = gradient(x, z);
      const light = clamp((0.7 - dx * 0.3 - dz * 0.5) / Math.hypot(dx, 1, dz), -0.3, 1);
      mesh.push({x, z, y: elevation(value), shade: clamp(Math.round((light + 0.3) * 4.5), 0, 5)});
    }
  }

  const render = () => {
    if (!cells) return;
    context.clearRect(0, 0, width, height);
    const scale = Math.min(width / 9.8, height / 7.5);
    const yaw = -0.48 + pointerX * 0.2;
    const pitch = 0.74 + pointerY * 0.08;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const project = (x, y, z) => {
      const depth = x * sy + z * cy;
      return {x: width * 0.5 + (x * cy - z * sy) * scale,
        y: height * 0.69 + (depth * sp - y * cp) * scale,
        depth: depth * cp + y * sp};
    };
    const surfacePoint = (point, lift = 0) => project(point.x, elevation(point.loss) + lift, point.z);

    // Quantize the surface into a screen-space character grid with depth testing.
    // This is actual ASCII geometry, not a texture over a bitmap.
    cells.fill(-1);
    depths.fill(-Infinity);
    mesh.forEach((point, index) => {
      const screen = project(point.x, point.y, point.z);
      const col = Math.round(screen.x / cellWidth);
      const row = Math.round(screen.y / cellHeight);
      if (col < 0 || col >= columns || row < 0 || row >= rows) return;
      const cell = row * columns + col;
      if (screen.depth > depths[cell]) { depths[cell] = screen.depth; cells[cell] = index; }
    });
    context.lineWidth = 0.65;
    context.strokeStyle = 'rgba(200,211,204,.11)';
    for (let row = 0; row <= divisions; row += 12) {
      context.beginPath();
      for (let col = 0; col <= divisions; col++) {
        const point = mesh[row * (divisions + 1) + col];
        const screen = project(point.x, point.y, point.z);
        if (col === 0) context.moveTo(screen.x, screen.y);
        else context.lineTo(screen.x, screen.y);
      }
      context.stroke();
    }
    const glyphs = ['.', ':', '-', '+', '*', '#'];
    const colors = ['#3e4847', '#56615d', '#717c74', '#8b9489', '#a2aa9b', '#bfc7b4'];
    context.font = `${Math.round(cellHeight * 0.87)}px "IBM Plex Mono", monospace`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (let cell = 0; cell < cells.length; cell++) {
      if (cells[cell] < 0) continue;
      const shade = mesh[cells[cell]].shade;
      context.fillStyle = colors[shade];
      context.fillText(glyphs[shade], (cell % columns) * cellWidth, Math.floor(cell / columns) * cellHeight);
    }

    const progress = 1 - Math.pow(1 - Math.min(1, elapsed / 14), 1.8);
    const distance = route[route.length - 1].distance * progress;
    let index = 0;
    while (index < route.length - 2 && route[index + 1].distance < distance) index++;
    const a = route[index], b = route[index + 1];
    const fraction = clamp((distance - a.distance) / (b.distance - a.distance || 1), 0, 1);
    const point = {x: a.x + (b.x - a.x) * fraction, z: a.z + (b.z - a.z) * fraction};
    point.loss = loss(point.x, point.z);
    const fade = elapsed > 16 ? Math.max(0, 1 - (elapsed - 16) / 0.8) : Math.min(1, elapsed / 0.6);
    context.globalAlpha = fade;

    // The trail follows the same objective as the terrain. The sphere's height
    // is evaluated on that surface, so it stays in contact while it rolls.
    context.beginPath();
    route.slice(0, index + 1).forEach((point, i) => {
      const screen = surfacePoint(point, 0.025);
      if (i === 0) context.moveTo(screen.x, screen.y);
      else context.lineTo(screen.x, screen.y);
    });
    const ground = surfacePoint(point);
    context.lineTo(ground.x, ground.y);
    context.strokeStyle = '#0a100b';
    context.lineWidth = 4;
    context.stroke();
    context.strokeStyle = accent;
    context.lineWidth = 1.8;
    context.setLineDash([3, 3]);
    context.stroke();
    context.setLineDash([]);
    const start = surfacePoint(route[0]);
    context.strokeStyle = '#a8b79c';
    context.lineWidth = 1;
    context.strokeRect(start.x - 3, start.y - 3, 6, 6);
    const end = surfacePoint(route[route.length - 1]);
    context.beginPath();
    context.moveTo(end.x - 5, end.y); context.lineTo(end.x + 5, end.y);
    context.moveTo(end.x, end.y - 5); context.lineTo(end.x, end.y + 5);
    context.stroke();

    const radius = clamp(width * 0.023, 8, 16);
    const ball = surfacePoint(point, radius / (scale * cp));
    context.fillStyle = 'rgba(0,0,0,.65)';
    context.beginPath(); context.ellipse(ground.x + 2, ground.y + 3, radius * 1.2, radius * 0.36, 0, 0, Math.PI * 2); context.fill();
    const shading = context.createRadialGradient(ball.x - radius * 0.4, ball.y - radius * 0.5, radius * 0.1, ball.x, ball.y, radius);
    shading.addColorStop(0, '#f7ffdb'); shading.addColorStop(0.35, accent);
    shading.addColorStop(0.75, '#8da842'); shading.addColorStop(1, '#35431d');
    context.fillStyle = shading;
    context.beginPath(); context.arc(ball.x, ball.y, radius, 0, Math.PI * 2); context.fill();
    context.save();
    context.translate(ball.x, ball.y);
    context.rotate(distance * 2.5);
    context.strokeStyle = 'rgba(32,49,12,.6)';
    context.beginPath(); context.ellipse(0, 0, radius * 0.4, radius * 0.92, 0, 0, Math.PI * 2); context.stroke();
    context.restore();
    context.globalAlpha = 1;

    const formattedLoss = point.loss.toFixed(3);
    const formattedStep = String(Math.round(index + fraction)).padStart(3, '0');
    if (lossLabel.textContent !== formattedLoss) lossLabel.textContent = formattedLoss;
    if (stepLabel.textContent !== formattedStep) stepLabel.textContent = formattedStep;
    stateLabel.textContent = !canMove() ? '[ paused ]' : elapsed >= 14 ? '[ settled ]' : '[ descending ]';
    landscape.classList.add('is-rendered');
  };

  const tick = (now) => {
    frame = 0;
    if (!canMove() || !inView) return;
    const delta = now - lastTime;
    // A modest frame rate, bounded character count, and no offscreen animation.
    if (delta >= 1000 / 30) {
      elapsed += Math.min(delta, 80) / 1000;
      if (elapsed >= 16.8) { seed++; route = makeRun(); elapsed = 0; }
      pointerX += (targetX - pointerX) * 0.08;
      pointerY += (targetY - pointerY) * 0.08;
      lastTime = now;
      render();
    }
    frame = requestAnimationFrame(tick);
  };
  const updateAnimation = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    document.documentElement.dataset.backgroundMotion = canMove() ? 'running' : 'paused';
    toggle.hidden = preference.matches;
    toggle.setAttribute('aria-label', paused ? 'Resume theme animation' : 'Pause theme animation');
    label.textContent = paused ? 'Resume motion' : 'Pause motion';
    render();
    if (canMove() && inView) { lastTime = performance.now(); frame = requestAnimationFrame(tick); }
  };
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    width = rect.width; height = rect.height;
    if (!width || !height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    cellHeight = width < 400 ? 8 : 10;
    cellWidth = cellHeight * 0.63;
    columns = Math.ceil(width / cellWidth) + 1;
    rows = Math.ceil(height / cellHeight) + 1;
    cells = new Int32Array(columns * rows);
    depths = new Float32Array(columns * rows);
    render();
  };

  toggle.addEventListener('click', () => {
    paused = !paused;
    try { localStorage.setItem(storageKey, paused ? 'paused' : 'running'); } catch {}
    updateAnimation();
  });
  restart.hidden = false;
  restart.addEventListener('click', () => {
    seed++; route = makeRun(); elapsed = canMove() ? 0.6 : 3.5;
    render();
  });
  landscape.addEventListener('pointermove', event => {
    if (!canMove() || event.pointerType === 'touch') return;
    const rect = landscape.getBoundingClientRect();
    targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
  }, {passive: true});
  landscape.addEventListener('pointerleave', () => { targetX = 0; targetY = 0; });
  preference.addEventListener('change', updateAnimation);
  document.addEventListener('visibilitychange', updateAnimation);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener('resize', resize, {passive: true});
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; updateAnimation(); }, {threshold: 0}).observe(landscape);
  } else { inView = true; }
  resize();
  updateAnimation();
})();
