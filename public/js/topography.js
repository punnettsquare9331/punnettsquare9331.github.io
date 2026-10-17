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

  const drawRail = (view, project) => {
    // A shallow architectural rail shares the portrait's camera. The top edge
    // follows the photographed palms; the fingers overlap its front face.
    const contact = (u) => .398 + (u - .047) * .0231;
    const front = (u, v) => project(u, v, .043);
    const rear = (u, v) => project(u + .018, v - .018, -.045);
    const polygon = (points, fill, stroke) => {
      context.beginPath();
      points.forEach((point, index) => {
        if (!index) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.closePath();
      context.fillStyle = fill;
      context.fill();
      context.strokeStyle = stroke;
      context.stroke();
    };
    const line = (a, b, color, weight = .75) => {
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.strokeStyle = color;
      context.lineWidth = weight;
      context.stroke();
    };
    context.save();
    context.globalAlpha = view.visibility;
    context.lineWidth = .8;
    context.lineJoin = 'round';

    // Slim extruded uprights give the handrest a physical structure without
    // filling the space around the figure with another opaque panel.
    for (const u of [.085, .925]) {
      const a = u - .014, b = u + .014;
      const top = contact(u) + .022, bottom = .976;
      polygon([rear(a, top), front(a, top), front(a, bottom), rear(a, bottom)], '#141e16', '#46563d');
      polygon([front(b, top), rear(b, top), rear(b, bottom), front(b, bottom)], '#101914', '#3b4b39');
      polygon([front(a, top), front(b, top), front(b, bottom), front(a, bottom)], '#1b251d', '#586951');
      line(front(a + .006, top), front(a + .006, bottom), '#7d8e6e', .55);
      const footA = a - .024, footB = b + .024;
      polygon([rear(footA, bottom), rear(footB, bottom), front(footB, bottom + .005), front(footA, bottom + .005)], '#1b241b', '#53634a');
    }

    const left = -.025, right = 1.025;
    const topLeft = contact(left) + .004, topRight = contact(right) + .004;
    const a = front(left, topLeft), b = front(right, topRight);
    const c = rear(right, topRight), d = rear(left, topLeft);
    const thickness = .022;
    polygon([d, a, front(left, topLeft + thickness), rear(left, topLeft + thickness)], '#263322', '#71815c');
    polygon([b, c, rear(right, topRight + thickness), front(right, topRight + thickness)], '#202d20', '#71815c');
    const topShade = context.createLinearGradient(d.x, d.y, a.x, a.y + 12);
    topShade.addColorStop(0, '#202c22');
    topShade.addColorStop(1, '#45513a');
    polygon([d, c, b, a], topShade, '#8e9c73');
    const faceShade = context.createLinearGradient(a.x, a.y, a.x, a.y + view.portraitHeight * thickness);
    faceShade.addColorStop(0, '#293622');
    faceShade.addColorStop(1, '#111a14');
    polygon([a, b, front(right, topRight + thickness), front(left, topLeft + thickness)], faceShade, '#63734e');

    // Visible depth divisions and a restrained lit edge keep the material
    // consistent with the site's wireframe/ASCII palette.
    for (let i = 1; i < 24; i++) {
      const u = left + (right - left) * i / 24;
      line(rear(u, contact(u) + .004), front(u, contact(u) + .004), '#82906755', .6);
    }
    line(a, b, '#c7de8e', 1.15);
    line(front(left, topLeft + thickness), front(right, topRight + thickness), '#556448', .7);
    // Contact shadows sit under the palms and are occluded by the cutout.
    for (const u of [.047, .957]) {
      const p = front(u, contact(u) + .001);
      context.fillStyle = '#030703b8';
      context.beginPath();
      context.ellipse(p.x, p.y, view.portraitHeight * .022, view.portraitHeight * .004, .034, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  };

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
    drawRail(view, project);
    document.dispatchEvent(new CustomEvent('portfolio-view', {detail: view}));
  };

  const tick = (now) => {
    frame = 0;
    const easing = 1 - Math.exp(-Math.min(50, now - (previousTime || now - 16)) / 95);
    previousTime = now;
    pointerX += (targetX - pointerX) * easing;
    pointerY += (targetY - pointerY) * easing;
    scrollPosition += (targetScroll - scrollPosition) * easing;
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
