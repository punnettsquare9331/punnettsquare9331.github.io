(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const deck = document.querySelector('[data-research-deck]');
  if (deck) {
    const cards = [...deck.querySelectorAll('[data-research-card]')];
    const select = (selected, scroll = false) => {
      deck.style.setProperty('--research-columns', cards.map((_, index) => index === selected ? '1.7fr' : '1fr').join(' '));
      cards.forEach((card, index) => {
        const active = index === selected;
        card.toggleAttribute('data-active', active);
        card.querySelector('[data-research-select]').setAttribute('aria-expanded', String(active));
        card.querySelector('.research-panel').hidden = !active;
      });
      if (scroll && window.matchMedia('(max-width: 800px)').matches) {
        cards[selected].scrollIntoView({block: 'start', behavior: reducedMotion.matches ? 'instant' : 'smooth'});
      }
    };
    cards.forEach((card, index) => {
      card.querySelector('[data-research-select]').addEventListener('click', () => select(index, true));
      card.addEventListener('click', event => {
        if (!event.target.closest('a, button')) select(index, true);
      });
    });
    deck.classList.add('is-interactive');
    select(0);
  }

  const filters = document.querySelector('[data-publication-filters]');
  if (filters) {
    const publications = [...document.querySelectorAll('#publications .bibliography > li')];
    const buttons = [...filters.querySelectorAll('[data-year]')];
    const status = document.querySelector('[data-publication-status]');
    filters.hidden = false;
    buttons.forEach(button => button.addEventListener('click', () => {
      const year = button.dataset.year;
      let shown = 0;
      publications.forEach(publication => {
        const visible = year === 'all' || publication.querySelector('.pub-year').textContent.trim() === year;
        publication.hidden = !visible;
        if (visible) shown++;
      });
      buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      status.textContent = `${shown} publication${shown === 1 ? '' : 's'} shown${year === 'all' ? '' : ` from ${year}`}.`;
    }));
  }

  const links = [...document.querySelectorAll('.home .site-nav a')];
  const sections = links.map(link => document.querySelector(new URL(link.href).hash));
  const hero = document.querySelector('.profile-hero');
  const achievementCards = [...document.querySelectorAll('.achievement-card')];
  const archive = document.querySelector('#award-archive');
  document.querySelector('.recognition-index')?.addEventListener('click', () => {
    if (archive) archive.open = true;
  });
  if (!links.length) return;
  let queued = false;
  const updateNavigation = () => {
    queued = false;
    const readingLine = Math.min(240, window.innerHeight * 0.3);
    let active = -1;
    sections.forEach((section, index) => {
      if (section && section.getBoundingClientRect().top <= readingLine) active = index;
    });
    links.forEach((link, index) => {
      if (index === active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    const distance = document.documentElement.scrollHeight - innerHeight;
    document.documentElement.style.setProperty('--reading-progress', distance > 0 ? Math.min(1, scrollY / distance) : 0);
    const motion = !reducedMotion.matches && document.documentElement.dataset.backgroundMotion !== 'paused';
    if (hero) {
      const drift = motion ? Math.min(innerWidth <= 800 ? 12 : 30, Math.max(0, scrollY) * 0.045) : 0;
      hero.style.setProperty('--hero-drift', `${drift.toFixed(1)}px`);
    }
    achievementCards.forEach((card, index) => {
      const next = achievementCards[index + 1];
      const top = parseFloat(getComputedStyle(card).top) || 0;
      const progress = motion && next ? Math.max(0, Math.min(1, (innerHeight * 0.7 - next.getBoundingClientRect().top + top) / (innerHeight * 0.7))) : 0;
      card.style.setProperty('--stack-scale', (1 - progress * 0.045).toFixed(4));
    });
  };
  const scheduleNavigation = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(updateNavigation);
  };
  window.addEventListener('scroll', scheduleNavigation, {passive: true});
  window.addEventListener('resize', scheduleNavigation, {passive: true});
  document.addEventListener('theme-motion-change', scheduleNavigation);
  reducedMotion.addEventListener('change', scheduleNavigation);
  archive?.addEventListener('toggle', scheduleNavigation);
  updateNavigation();
})();
