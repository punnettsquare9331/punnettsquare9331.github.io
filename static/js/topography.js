(() => {
  const canvas = document.querySelector('#landscape-canvas');
  const toggle = document.querySelector('[data-motion-toggle]');
  if (!(canvas instanceof HTMLCanvasElement) || !toggle) return;
  const context = canvas.getContext('2d');
  if (!context) return;

  const landscape = canvas.closest('.landscape');
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const label = toggle.querySelector('[data-motion-label]');
  const storageKey = 'puneet-background-motion';
  let paused = false;
  let inView = false;
  let frame = 0;
  let lastTime = 0;
  let phase = 0;
  let width = 600;
  let height = 600;
  let pointerX = 0;
  let pointerY = 0;
  let targetX = 0;
  let targetY = 0;

  try { paused = localStorage.getItem(storageKey) === 'paused'; } catch {}
  const canMove = () => !paused && !preference.matches && !document.hidden;

  // These are abstract level sets, not a rendering of research measurements.
  const angles = Array.from({length: 121}, (_, index) => index * Math.PI * 2 / 120);
  const render = () => {
    context.clearRect(0, 0, width, height);
    const scale = width / 8.6;
    const yaw = -0.48 + pointerX * 0.28 + Math.sin(phase * 0.12) * 0.12;
    const pitch = 0.66 + pointerY * 0.12;
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    const sinPitch = Math.sin(pitch);
    const cosPitch = Math.cos(pitch);
    const project = (x, y, z) => {
      const depth = x * sinYaw + z * cosYaw;
      return [width * 0.5 + (x * cosYaw - z * sinYaw) * scale,
        height * 0.59 + (depth * sinPitch - y * cosPitch) * scale];
    };

    // A faint plane anchors the floating contour surface.
    context.strokeStyle = 'rgba(151,206,182,.15)';
    context.lineWidth = 0.6;
    for (let index = -4; index <= 4; index++) {
      const a = project(index, -0.12, -4);
      const b = project(index, -0.12, 4);
      const c = project(-4, -0.12, index);
      const d = project(4, -0.12, index);
      context.beginPath();
      context.moveTo(...a); context.lineTo(...b);
      context.moveTo(...c); context.lineTo(...d);
      context.stroke();
    }

    for (let ring = 32; ring >= 0; ring--) {
      const radius = 0.12 + ring * 0.102;
      const elevation = 2.6 * Math.exp(-radius * radius / 5.5);
      const drift = Math.sin(phase * 0.5 + radius * 0.65);
      const major = ring % 6 === 0;
      const scan = Math.exp(-Math.pow(ring - (Math.sin(phase * 0.45) * 0.5 + 0.5) * 32, 2) / 5);
      context.beginPath();
      angles.forEach((angle, index) => {
        const contour = radius * (1 + 0.16 * Math.sin(3 * angle + phase * 0.23)
          + 0.08 * Math.cos(2 * angle - phase * 0.17 + radius * 0.2));
        const x = contour * Math.cos(angle) + drift * 0.33;
        const z = contour * Math.sin(angle) * 0.92;
        const point = project(x, elevation + drift * 0.08, z);
        if (index === 0) context.moveTo(...point);
        else context.lineTo(...point);
      });
      context.closePath();
      context.strokeStyle = scan > 0.5 ? `rgba(224,255,178,${0.6 + scan * 0.4})`
        : major ? 'rgba(197,255,67,.85)' : `rgba(124,190,162,${0.27 + (32-ring) * 0.009})`;
      context.lineWidth = major || scan > 0.5 ? 1.25 : 0.7;
      context.shadowColor = '#c5ff43';
      context.shadowBlur = scan > 0.5 ? 7 : 0;
      context.stroke();
    }
    context.shadowBlur = 0;

    const summit = project(Math.sin(phase * 0.5) * 0.33, 2.6, 0);
    context.beginPath(); context.arc(...summit, 3.2, 0, Math.PI * 2);
    context.fillStyle = '#e0ffb2'; context.fill();
    landscape.classList.add('is-rendered');
  };

  const tick = (now) => {
    frame = 0;
    if (!canMove() || !inView) return;
    const elapsed = now - lastTime;
    // Cap painting at 30 fps; the art stops entirely outside the viewport.
    if (elapsed >= 1000 / 30) {
      phase += Math.min(elapsed, 80) / 1000;
      pointerX += (targetX - pointerX) * 0.09;
      pointerY += (targetY - pointerY) * 0.09;
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
    if (canMove() && inView) {
      lastTime = performance.now();
      frame = requestAnimationFrame(tick);
    }
  };
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    if (!width || !height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
  };

  toggle.addEventListener('click', () => {
    paused = !paused;
    try { localStorage.setItem(storageKey, paused ? 'paused' : 'running'); } catch {}
    updateAnimation();
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
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      updateAnimation();
    }, {threshold: 0}).observe(landscape);
  } else { inView = true; }
  resize();
  updateAnimation();
})();
