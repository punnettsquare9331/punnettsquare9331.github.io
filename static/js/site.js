(async () => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const reveals = document.querySelectorAll(".reveal");
  if (reducedMotion || !("IntersectionObserver" in window)) {
    reveals.forEach((element) => element.classList.add("is-visible"));
  } else {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    reveals.forEach((element) => revealObserver.observe(element));
  }

  const navToggle = document.querySelector("[data-nav-toggle]");
  const nav = document.querySelector("[data-nav]");
  const closeNav = () => {
    navToggle?.setAttribute("aria-expanded", "false");
    nav?.classList.remove("is-open");
  };
  navToggle?.addEventListener("click", () => {
    const open = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!open));
    nav?.classList.toggle("is-open", !open);
  });
  nav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeNav));
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeNav();
  });

  const canvas = document.querySelector("#travel-globe");
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const context = canvas.getContext("2d");
  if (!context) return;

  const places = [
    { name: "Washington, DC", lat: 38.9072, lon: -77.0369, note: "Based in Washington, DC · current" },
    { name: "Victoria, BC", lat: 48.4284, lon: -123.3656, note: "Graduate research · University of Victoria" },
    { name: "Vancouver, BC", lat: 49.2827, lon: -123.1207, note: "ChimeraML · UBC invited seminar" },
    { name: "Ithaca, NY", lat: 42.443, lon: -76.5019, note: "Statistics & Economics · Cornell University" },
    { name: "New York, NY", lat: 40.7128, lon: -74.006, note: "AI/ML · Memorial Sloan Kettering" },
    { name: "Boston, MA", lat: 42.3601, lon: -71.0589, note: "Research · Harvard Medical School & MGH" },
    { name: "Bentonville, AR", lat: 36.3729, lon: -94.2088, note: "Software engineering · Walmart Global Tech" },
    { name: "San Francisco, CA", lat: 37.7749, lon: -122.4194, note: "Y Combinator interview · 2026" },
    { name: "Montreal, QC", lat: 45.5019, lon: -73.5674, note: "ICSA–Canada + OHBM" },
    { name: "Hamilton, ON", lat: 43.2557, lon: -79.8711, note: "Statistical Society of Canada · 2026" },
    { name: "Whistler, BC", lat: 50.1163, lon: -122.9574, note: "WNAR / IMS Annual Meeting · 2025" },
    { name: "Edmonton, AB", lat: 53.5461, lon: -113.4938, note: "Maud Menten Institute HQP Summit" },
    { name: "Winnipeg, MB", lat: 49.8951, lon: -97.1384, note: "3MC–PIMS–IDMS–ICMS Summer School" },
    { name: "Banff, AB", lat: 51.1784, lon: -115.5708, note: "BIRS mechanobiochemical modeling workshop" },
    { name: "Birmingham, UK", lat: 52.4862, lon: -1.8904, note: "Visiting researcher · AMICO Lab" },
    { name: "Amsterdam, NL", lat: 52.3676, lon: 4.9041, note: "Netherlands eScience JASP Hackathon" },
    { name: "Bordeaux, FR", lat: 44.8378, lon: -0.5792, note: "OHBM Annual Meeting · 2026" },
    { name: "Kyoto, JP", lat: 35.0116, lon: 135.7681, note: "Econometrics & Statistics · 2026" },
    { name: "Seoul, KR", lat: 37.5665, lon: 126.978, note: "OHBM Annual Meeting · 2024" }
  ];

  const d3 = window.d3;
  const topojson = window.topojson;
  if (!d3 || !topojson) {
    canvas.setAttribute("aria-label", "Geographic globe unavailable; location list remains accessible with the controls.");
    return;
  }

  let topology;
  try {
    const response = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json");
    if (!response.ok) throw new Error("World atlas unavailable");
    topology = await response.json();
  } catch {
    canvas.setAttribute("aria-label", "Geographic globe data unavailable; location list remains accessible with the controls.");
    return;
  }

  const land = topojson.feature(topology, topology.objects.land);
  const borders = topojson.mesh(topology, topology.objects.countries, (a, b) => a !== b);
  const sphere = { type: "Sphere" };
  const graticule = d3.geoGraticule10();
  const projection = d3.geoOrthographic().clipAngle(90).precision(0.35);
  const path = d3.geoPath(projection, context);

  const count = document.querySelector("[data-place-count]");
  const placeName = document.querySelector("[data-place-name]");
  const placeNote = document.querySelector("[data-place-note]");
  const pauseButton = document.querySelector("[data-globe-pause]");
  const prevButton = document.querySelector("[data-globe-prev]");
  const nextButton = document.querySelector("[data-globe-next]");

  let width = 720;
  let height = 720;
  let radius = 280;
  let centerX = 360;
  let centerY = 360;
  let rotation = [77.0369, -30, 0];
  let targetRotation = null;
  let paused = reducedMotion;
  let activePlace = 0;
  let dragging = false;
  let dragged = false;
  let pointerX = 0;
  let pointerY = 0;
  let lastFrame = performance.now();

  const normalizeLongitude = (value) => ((value + 540) % 360) - 180;

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(280, rect.width);
    height = width;
    radius = width * 0.42;
    centerX = width / 2;
    centerY = height / 2;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    projection.translate([centerX, centerY]).scale(radius);
  };

  const geographicCenter = () => [-rotation[0], -rotation[1]];
  const visible = (place) => d3.geoDistance([place.lon, place.lat], geographicCenter()) < Math.PI / 2;

  const strokeGeometry = (geometry, strokeStyle, lineWidth) => {
    context.beginPath();
    path(geometry);
    context.strokeStyle = strokeStyle;
    context.lineWidth = lineWidth;
    context.stroke();
  };

  const fillGeometry = (geometry, fillStyle) => {
    context.beginPath();
    path(geometry);
    context.fillStyle = fillStyle;
    context.fill();
  };

  const draw = (now) => {
    const elapsed = Math.min(50, now - lastFrame);
    lastFrame = now;

    if (targetRotation) {
      const longitudeDelta = normalizeLongitude(targetRotation[0] - rotation[0]);
      const latitudeDelta = targetRotation[1] - rotation[1];
      rotation[0] += longitudeDelta * Math.min(1, elapsed * 0.007);
      rotation[1] += latitudeDelta * Math.min(1, elapsed * 0.007);
      if (Math.abs(longitudeDelta) < 0.04 && Math.abs(latitudeDelta) < 0.04) targetRotation = null;
    } else if (!paused && !dragging) {
      rotation[0] = normalizeLongitude(rotation[0] + elapsed * 0.0022);
    }

    projection.rotate(rotation);
    context.clearRect(0, 0, width, height);

    fillGeometry(sphere, "#f9faf9");
    strokeGeometry(graticule, "rgba(23,56,95,.16)", 0.65);
    fillGeometry(land, "#dce4e8");
    strokeGeometry(land, "rgba(23,56,95,.72)", 0.85);
    strokeGeometry(borders, "rgba(23,56,95,.29)", 0.45);

    places.forEach((place, index) => {
      if (!visible(place)) return;
      const point = projection([place.lon, place.lat]);
      if (!point) return;
      const active = index === activePlace;
      if (active) {
        context.beginPath();
        context.arc(point[0], point[1], 10, 0, Math.PI * 2);
        context.strokeStyle = "rgba(53,76,98,.42)";
        context.lineWidth = 1.2;
        context.stroke();
      }
      context.beginPath();
      context.arc(point[0], point[1], active ? 4.3 : 2.6, 0, Math.PI * 2);
      context.fillStyle = active ? "#354c62" : "#7b8995";
      context.fill();
      context.strokeStyle = "#ffffff";
      context.lineWidth = 1;
      context.stroke();
    });

    strokeGeometry(sphere, "#17385f", 1.1);
    requestAnimationFrame(draw);
  };

  const setActivePlace = (index, shouldRotate = true) => {
    activePlace = (index + places.length) % places.length;
    const place = places[activePlace];
    if (count) count.textContent = `${String(activePlace + 1).padStart(2, "0")} / ${places.length}`;
    if (placeName) placeName.textContent = place.name;
    if (placeNote) placeNote.textContent = place.note;
    if (shouldRotate) targetRotation = [-place.lon, -Math.max(-55, Math.min(55, place.lat)), 0];
  };

  prevButton?.addEventListener("click", () => setActivePlace(activePlace - 1));
  nextButton?.addEventListener("click", () => setActivePlace(activePlace + 1));
  pauseButton?.addEventListener("click", () => {
    paused = !paused;
    pauseButton.setAttribute("aria-pressed", String(paused));
    pauseButton.textContent = paused ? "Resume" : "Pause";
  });

  canvas.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setActivePlace(activePlace - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setActivePlace(activePlace + 1);
    } else if (event.key === " ") {
      event.preventDefault();
      pauseButton?.click();
    }
  });

  canvas.addEventListener("pointerdown", (event) => {
    dragging = true;
    dragged = false;
    pointerX = event.clientX;
    pointerY = event.clientY;
    targetRotation = null;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const deltaX = event.clientX - pointerX;
    const deltaY = event.clientY - pointerY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 1) dragged = true;
    rotation[0] = normalizeLongitude(rotation[0] + deltaX * 0.35);
    rotation[1] = Math.max(-70, Math.min(70, rotation[1] - deltaY * 0.25));
    pointerX = event.clientX;
    pointerY = event.clientY;
  });
  const releasePointer = (event) => {
    if (!dragging) return;
    dragging = false;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  canvas.addEventListener("pointerup", releasePointer);
  canvas.addEventListener("pointercancel", releasePointer);

  canvas.addEventListener("click", (event) => {
    if (dragged) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    let nearest = -1;
    let nearestDistance = 18;
    places.forEach((place, index) => {
      if (!visible(place)) return;
      const point = projection([place.lon, place.lat]);
      if (!point) return;
      const distance = Math.hypot(point[0] - x, point[1] - y);
      if (distance < nearestDistance) {
        nearest = index;
        nearestDistance = distance;
      }
    });
    if (nearest >= 0) setActivePlace(nearest, false);
  });

  if ("ResizeObserver" in window) {
    new ResizeObserver(resize).observe(canvas);
  } else {
    window.addEventListener("resize", resize, { passive: true });
  }
  resize();
  setActivePlace(0, false);
  requestAnimationFrame(draw);
})();
