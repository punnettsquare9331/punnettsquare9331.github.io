(() => {
  const toggle = document.querySelector("[data-motion-toggle]");
  if (!toggle) return;

  const label = toggle.querySelector("[data-motion-label]");
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const storageKey = "puneet-background-motion";
  let paused = false;

  try {
    paused = localStorage.getItem(storageKey) === "paused";
  } catch {
    // The control also works when browser storage is unavailable.
  }

  const syncMotion = () => {
    const still = paused || preference.matches || document.hidden;
    document.documentElement.dataset.backgroundMotion = still ? "paused" : "running";
    toggle.hidden = preference.matches;
    toggle.setAttribute("aria-label", paused ? "Resume background animation" : "Pause background animation");
    label.textContent = paused ? "Resume motion" : "Pause motion";
  };

  toggle.addEventListener("click", () => {
    paused = !paused;
    try {
      localStorage.setItem(storageKey, paused ? "paused" : "running");
    } catch {
      // Keep the preference for this page when storage is unavailable.
    }
    syncMotion();
  });

  preference.addEventListener("change", syncMotion);
  document.addEventListener("visibilitychange", syncMotion);

  // Let the contours recede while visitors read the longer sections.
  const hero = document.querySelector(".profile-hero");
  if (hero && "IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      document.documentElement.classList.toggle("has-visible-hero", entry.isIntersecting);
    }, { rootMargin: "-76px 0px 0px 0px", threshold: 0.1 }).observe(hero);
  }

  syncMotion();
})();
