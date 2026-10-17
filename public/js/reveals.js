(() => {
  const elements = [...document.querySelectorAll('.reveal')];
  if (!elements.length) return;
  const root = document.documentElement;
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let savedPause = false;
  try { savedPause = localStorage.getItem('puneet-background-motion') === 'paused'; } catch {}

  // Hidden states only exist after this controller is ready. Without scripting
  // or IntersectionObserver, every section remains readable.
  if (preference.matches || savedPause || !('IntersectionObserver' in window)) {
    elements.forEach((element) => element.classList.add('is-visible'));
    return;
  }

  const groups = new Map();
  elements.forEach((element) => {
    const group = element.closest('[data-reveal-group]') || element.parentElement;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(element);
  });
  const pending = new Map();
  let frame = 0;
  let finished = false;
  const inView = (element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 &&
      rect.top < window.innerHeight * .94;
  };
  const cancel = (element) => {
    const job = pending.get(element);
    if (job) window.clearTimeout(job.timer);
    pending.delete(element);
  };
  const show = (element, immediate = false) => {
    cancel(element);
    if (immediate) element.classList.add('is-instant');
    element.classList.add('is-visible');
    observer.unobserve(element);
  };
  const revealBatch = () => {
    frame = 0;
    if (finished || document.hidden) return;
    // Fast scrolling never leaves a queue of animations playing offscreen.
    pending.forEach((_, element) => { if (!inView(element)) cancel(element); });
    const now = performance.now();
    groups.forEach((members) => {
      const ready = members.filter((element) =>
        !element.classList.contains('is-visible') && !pending.has(element) && inView(element));
      if (!ready.length) return;
      const lastDue = members.reduce((latest, element) =>
        Math.max(latest, pending.get(element)?.due || 0), 0);
      const start = lastDue ? Math.min(450, Math.max(0, lastDue - now + 120)) : 0;
      const step = Math.min(120, (450 - start) / Math.max(1, ready.length - 1));
      ready.forEach((element, index) => {
        const delay = start + index * step;
        if (!delay) { show(element); return; }
        const timer = window.setTimeout(() => {
          pending.delete(element);
          if (!document.hidden && inView(element)) show(element);
        }, delay);
        pending.set(element, { timer, due: now + delay });
      });
    });
  };
  const schedule = () => {
    if (!finished && !document.hidden && !frame) frame = window.requestAnimationFrame(revealBatch);
  };
  const observer = new IntersectionObserver(schedule, {
    rootMargin: '0px 0px -6% 0px', threshold: 0
  });
  const finish = () => {
    finished = true;
    window.cancelAnimationFrame(frame);
    elements.forEach((element) => show(element, true));
    observer.disconnect();
    delete root.dataset.reveals;
  };
  const revealTarget = (hash) => {
    if (!hash || hash === '#') return;
    let target;
    try { target = document.getElementById(decodeURIComponent(hash.slice(1))); } catch { return; }
    if (!target) return;
    // A deep link or keyboard focus can enter a group halfway through. Reveal
    // that destination immediately, without waiting for offscreen predecessors.
    const item = target.closest('.reveal') || target.querySelector('.reveal');
    if (item) show(item, true);
    schedule();
  };

  root.dataset.reveals = 'active';
  elements.forEach((element) => observer.observe(element));
  document.addEventListener('focusin', (event) => {
    const item = event.target instanceof Element ? event.target.closest('.reveal') : null;
    if (item) show(item, true);
  });
  document.addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link) return;
    const url = new URL(link.href, window.location.href);
    if (url.origin === window.location.origin && url.pathname === window.location.pathname &&
      url.search === window.location.search) revealTarget(url.hash);
  });
  window.addEventListener('hashchange', () => revealTarget(window.location.hash));
  window.addEventListener('load', () => revealTarget(window.location.hash), { once: true });
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pending.forEach((_, element) => cancel(element));
      window.cancelAnimationFrame(frame);
      frame = 0;
    } else {
      schedule();
    }
  });
  preference.addEventListener('change', () => { if (preference.matches) finish(); });
  document.addEventListener('theme-motion-change', () => {
    if (preference.matches || (!document.hidden && root.dataset.backgroundMotion === 'paused')) finish();
  });
  revealTarget(window.location.hash);
  schedule();
})();
