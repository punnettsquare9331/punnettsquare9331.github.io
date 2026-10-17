(() => {
  const canvas = document.querySelector('#landscape-canvas');
  const toggle = document.querySelector('[data-motion-toggle]');
  if (!(canvas instanceof HTMLCanvasElement) || !toggle) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const storageKey = 'puneet-background-motion';
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  let paused = false, frame = 0, previousTime = 0;
  let width = 1, height = 1, dpr = 1;
  let pointerX = 0, pointerY = 0, targetX = 0, targetY = 0;
  let scrollPosition = window.scrollY / Math.max(window.innerHeight, 1);
  let targetScroll = scrollPosition;
  try { paused = localStorage.getItem(storageKey) === 'paused'; } catch {}
  const canMove = () => !paused && !preference.matches && !document.hidden;

  const render = () => {
    const mobile = width <= 600;
    const progress = clamp(scrollPosition, 0, 1.6);
    const movement = canMove() ? progress : 0;
    const portraitHeight = mobile ? Math.min(width * .9, height * .52) : Math.min(height * .8, 860, width * .7);
    const view = {
      width, height, dpr, portraitHeight,
      centerX: width * (mobile ? .67 : .76) + pointerX * (mobile ? 3 : 8),
      centerY: mobile ? 117 + portraitHeight / 2 - movement * 32 : height * .54 - movement * 30,
      yaw: pointerX * .14 - movement * .11,
      pitch: pointerY * .045 + movement * .025,
      visibility: (mobile ? .72 : .9) * (1 - clamp(progress / 1.05, 0, 1) * .84),
      asciiMix: .14 + clamp(progress / 1.1, 0, 1) * .63,
      pointerX, pointerY
    };
    // The two hands anchor a continuous sheet. It bends with the same camera as
    // the portrait, so the photograph appears to pull the screen around it.
    const project = (u, v, z = .04) => {
      const x = (u - .5) * 701 / 1043, y = .5 - v;
      const cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
      const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw);
      const py = y * cp - z * sp, pz = y * sp + z * cp;
      const px = x * cy + pz * sy, depth = -x * sy + pz * cy;
      const scale = portraitHeight / (1 - depth * .35);
      return {x: view.centerX + px * scale, y: view.centerY - py * scale};
    };
    const leftHand = project(.057, .397), rightHand = project(.961, .419);
    const spacing = mobile ? 25 : 32;
    const columns = Math.ceil(width / spacing) + 8;
    const rows = Math.ceil(height / spacing) + 8;
    const radius = portraitHeight * .34;
    const strength = portraitHeight * (.12 + movement * .025);
    const warp = (column, row) => {
      let x = (column - 4) * spacing;
      let y = (row - 4) * spacing;
      let displacement = 0;
      for (const hand of [leftHand, rightHand]) {
        const dx = x - hand.x, dy = y - hand.y;
        const influence = Math.exp(-(dx * dx + dy * dy * 1.6) / (radius * radius));
        displacement -= influence * strength;
        x += dx / radius * influence * 17;
      }
      const body = Math.exp(-Math.pow((x - view.centerX) / (radius * .9), 2));
      y += displacement + body * 38 * Math.sin((y - view.centerY) / height * Math.PI);
      x += (y / height - .5) * (pointerX * 16 - movement * 17);
      return {x, y};
    };
    context.clearRect(0, 0, width, height);
    context.lineWidth = .65;
    const fade = context.createLinearGradient(0, 0, width, 0);
    fade.addColorStop(0, 'rgba(125,151,127,.025)');
    fade.addColorStop(.4, 'rgba(125,151,127,.09)');
    fade.addColorStop(1, 'rgba(151,174,135,.22)');
    context.strokeStyle = fade;
    for (let row = 0; row <= rows; row++) {
      context.beginPath();
      for (let column = 0; column <= columns * 2; column++) {
        const p = warp(column / 2, row);
        if (!column) context.moveTo(p.x, p.y); else context.lineTo(p.x, p.y);
      }
      context.stroke();
    }
    for (let column = 0; column <= columns; column++) {
      context.beginPath();
      for (let row = 0; row <= rows * 2; row++) {
        const p = warp(column, row / 2);
        if (!row) context.moveTo(p.x, p.y); else context.lineTo(p.x, p.y);
      }
      context.stroke();
    }
    context.font = '10px "IBM Plex Mono", monospace';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const glyphs = ['+', '.', ':', ':', '+', '·'];
    for (let row = 0; row <= rows; row++) {
      for (let column = 0; column <= columns; column++) {
        if ((column + row) % 2) continue;
        const p = warp(column, row);
        if (p.x < 0 || p.x > width || p.y < 70 || p.y > height) continue;
        const opacity = .06 + clamp(p.x / width, 0, 1) * .26;
        context.fillStyle = `rgba(175,193,154,${opacity})`;
        context.fillText(glyphs[(column * 7 + row * 3) % glyphs.length], p.x, p.y);
      }
    }
    document.dispatchEvent(new CustomEvent('portfolio-view', {detail: view}));
  };

  const tick = (now) => {
    frame = 0;
    const elapsed = Math.min(50, now - (previousTime || now - 16));
    const easing = 1 - Math.exp(-elapsed / 95);
    const scrollEasing = 1 - Math.exp(-elapsed / 240);
    previousTime = now;
    pointerX += (targetX - pointerX) * easing;
    pointerY += (targetY - pointerY) * easing;
    scrollPosition += (targetScroll - scrollPosition) * scrollEasing;
    render();
    if (canMove() && (Math.abs(targetX - pointerX) + Math.abs(targetY - pointerY) + Math.abs(targetScroll - scrollPosition) > .001)) {
      frame = requestAnimationFrame(tick);
    } else previousTime = 0;
  };
  const schedule = () => {
    if (document.hidden) return;
    if (!canMove()) {
      // Reduced-motion and paused views still follow page position for contrast,
      // but camera movement and interpolation remain off.
      pointerX = pointerY = 0;
      scrollPosition = targetScroll;
      render();
    } else if (!frame) frame = requestAnimationFrame(tick);
  };
  const updateMotion = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = previousTime = 0;
    const running = canMove();
    document.documentElement.dataset.backgroundMotion = running ? 'running' : 'paused';
    toggle.hidden = false;
    toggle.disabled = preference.matches;
    toggle.setAttribute('aria-pressed', String(!running));
    toggle.setAttribute('aria-label', preference.matches ? 'Reduced motion enabled' : paused ? 'Resume theme animation' : 'Pause theme animation');
    const label = toggle.querySelector('[data-motion-label]');
    if (label) label.textContent = running ? 'Pause motion' : 'Motion paused';
    document.dispatchEvent(new CustomEvent('theme-motion-change'));
    schedule();
  };
  const resize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    targetScroll = window.scrollY / Math.max(height, 1);
    schedule();
  };
  toggle.addEventListener('click', () => {
    paused = !paused;
    try { localStorage.setItem(storageKey, paused ? 'paused' : 'running'); } catch {}
    updateMotion();
  });
  window.addEventListener('pointermove', (event) => {
    if (!canMove() || event.pointerType === 'touch') return;
    targetX = clamp(event.clientX / width * 2 - 1, -1, 1);
    targetY = clamp(event.clientY / height * 2 - 1, -1, 1);
    schedule();
  }, {passive: true});
  document.addEventListener('pointerleave', () => { targetX = targetY = 0; schedule(); });
  window.addEventListener('scroll', () => { targetScroll = window.scrollY / Math.max(height, 1); schedule(); }, {passive: true});
  window.addEventListener('resize', resize, {passive: true});
  document.addEventListener('visibilitychange', updateMotion);
  preference.addEventListener('change', updateMotion);
  document.fonts?.ready.then(schedule);
  resize();
  updateMotion();
})();
