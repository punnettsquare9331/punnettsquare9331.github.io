(() => {
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
    { name: "Victoria, BC", lat: 48.4284, lon: -123.3656, note: "Graduate research · University of Victoria" },
    { name: "Vancouver, BC", lat: 49.2827, lon: -123.1207, note: "ChimeraML · UBC invited seminar" },
    { name: "Ithaca, NY", lat: 42.443, lon: -76.5019, note: "Statistics & Economics · Cornell University" },
    { name: "New York, NY", lat: 40.7128, lon: -74.006, note: "AI/ML · Memorial Sloan Kettering" },
    { name: "Boston, MA", lat: 42.3601, lon: -71.0589, note: "Research · Harvard Medical School & MGH" },
    { name: "Washington, DC", lat: 38.9072, lon: -77.0369, note: "Critical Ops + SCSP AI Expo" },
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

  const landPolygons = [
    [[-168,72],[-145,70],[-130,58],[-124,50],[-128,42],[-117,31],[-106,23],[-97,18],[-88,20],[-82,25],[-79,34],[-68,44],[-58,51],[-54,61],[-64,72],[-95,82],[-130,76]],
    [[-81,12],[-72,11],[-62,5],[-52,-2],[-45,-14],[-52,-31],[-63,-50],[-73,-54],[-76,-32],[-80,-12]],
    [[-73,83],[-22,82],[-18,71],[-43,59],[-58,61]],
    [[-11,36],[-3,43],[12,46],[28,43],[40,48],[57,54],[78,58],[99,73],[140,72],[170,61],[180,52],[160,43],[146,36],[128,22],[112,6],[98,10],[82,22],[70,22],[58,27],[45,30],[35,31],[29,37],[18,39],[7,36]],
    [[-17,35],[4,37],[18,32],[32,31],[43,12],[51,2],[42,-13],[33,-29],[18,-35],[5,-34],[-7,-23],[-15,-2]],
    [[112,-11],[129,-12],[144,-20],[153,-28],[146,-39],[128,-35],[114,-25]],
    [[95,5],[110,-2],[118,-8],[107,-9],[99,-5]],
    [[130,34],[142,44],[146,39],[138,32]],
    [[-10,50],[2,58],[20,60],[29,55],[22,47],[8,44]],
    [[47,-13],[51,-17],[49,-26],[44,-20]]
  ];

  const pointInPolygon = (lon, lat, polygon) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];
      const intersects = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
      if (intersects) inside = !inside;
    }
    return inside;
  };

  const landPoints = [];
  for (let lat = -58; lat <= 82; lat += 3.2) {
    for (let lon = -178; lon <= 178; lon += 3.2) {
      if (landPolygons.some((polygon) => pointInPolygon(lon, lat, polygon))) {
        landPoints.push([lon, lat]);
      }
    }
  }

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
  let rotation = (123.3656 * Math.PI) / 180;
  let targetRotation = null;
  let paused = reducedMotion;
  let activePlace = 0;
  let dragging = false;
  let dragged = false;
  let pointerX = 0;
  let lastFrame = performance.now();
  const tilt = -0.17;
  const rad = Math.PI / 180;

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(300, rect.width);
    height = width;
    radius = width * 0.405;
    centerX = width / 2;
    centerY = height / 2;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const project = (lat, lon) => {
    const latitude = lat * rad;
    const longitude = lon * rad + rotation;
    const cosLat = Math.cos(latitude);
    const x = cosLat * Math.sin(longitude);
    const y = -Math.sin(latitude);
    const z = cosLat * Math.cos(longitude);
    const yTilt = y * Math.cos(tilt) - z * Math.sin(tilt);
    const zTilt = y * Math.sin(tilt) + z * Math.cos(tilt);
    return { x: centerX + x * radius, y: centerY + yTilt * radius, z: zTilt };
  };

  const line = (points, stroke, lineWidth, dash = []) => {
    context.beginPath();
    let drawing = false;
    points.forEach(([lat, lon]) => {
      const point = project(lat, lon);
      if (point.z <= 0.02) {
        drawing = false;
        return;
      }
      if (!drawing) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
      drawing = true;
    });
    context.setLineDash(dash);
    context.strokeStyle = stroke;
    context.lineWidth = lineWidth;
    context.stroke();
    context.setLineDash([]);
  };

  const draw = (now) => {
    const elapsed = Math.min(50, now - lastFrame);
    lastFrame = now;
    if (targetRotation !== null) {
      let difference = targetRotation - rotation;
      difference = Math.atan2(Math.sin(difference), Math.cos(difference));
      rotation += difference * Math.min(1, elapsed * 0.006);
      if (Math.abs(difference) < 0.002) targetRotation = null;
    } else if (!paused && !dragging) {
      rotation += elapsed * 0.000045;
    }

    context.clearRect(0, 0, width, height);

    context.save();
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.fillStyle = "#17385f";
    context.fill();
    context.clip();

    for (let lat = -60; lat <= 60; lat += 30) {
      const points = [];
      for (let lon = -180; lon <= 180; lon += 3) points.push([lat, lon]);
      line(points, "rgba(255,255,255,.13)", 0.75);
    }
    for (let lon = -150; lon <= 180; lon += 30) {
      const points = [];
      for (let lat = -88; lat <= 88; lat += 2) points.push([lat, lon]);
      line(points, "rgba(255,255,255,.11)", 0.75);
    }

    landPoints.forEach(([lon, lat]) => {
      const point = project(lat, lon);
      if (point.z <= 0.015) return;
      context.beginPath();
      context.arc(point.x, point.y, 1.05 + point.z * 0.6, 0, Math.PI * 2);
      context.fillStyle = `rgba(255,255,255,${0.22 + point.z * 0.5})`;
      context.fill();
    });

    places.forEach((place, index) => {
      const point = project(place.lat, place.lon);
      if (point.z <= 0.04) return;
      const active = index === activePlace;
      if (active) {
        context.beginPath();
        context.arc(point.x, point.y, 12, 0, Math.PI * 2);
        context.strokeStyle = "rgba(168,132,67,.72)";
        context.lineWidth = 1;
        context.stroke();
      }
      context.beginPath();
      context.arc(point.x, point.y, active ? 4.5 : 2.7, 0, Math.PI * 2);
      context.fillStyle = active ? "#d2b16c" : "#a85a64";
      context.fill();
    });
    context.restore();

    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.strokeStyle = "rgba(16,40,66,.92)";
    context.lineWidth = 1.2;
    context.stroke();

    requestAnimationFrame(draw);
  };

  const setActivePlace = (index, shouldRotate = true) => {
    activePlace = (index + places.length) % places.length;
    const place = places[activePlace];
    if (count) count.textContent = `${String(activePlace + 1).padStart(2, "0")} / ${places.length}`;
    if (placeName) placeName.textContent = place.name;
    if (placeNote) placeNote.textContent = place.note;
    if (shouldRotate) targetRotation = -place.lon * rad;
  };

  prevButton?.addEventListener("click", () => setActivePlace(activePlace - 1));
  nextButton?.addEventListener("click", () => setActivePlace(activePlace + 1));
  pauseButton?.addEventListener("click", () => {
    paused = !paused;
    pauseButton.setAttribute("aria-pressed", String(paused));
    pauseButton.textContent = paused ? "Resume" : "Pause";
  });

  canvas.addEventListener("pointerdown", (event) => {
    dragging = true;
    dragged = false;
    pointerX = event.clientX;
    targetRotation = null;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const delta = event.clientX - pointerX;
    if (Math.abs(delta) > 1) dragged = true;
    rotation += delta * 0.008;
    pointerX = event.clientX;
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
    let nearestDistance = 22;
    places.forEach((place, index) => {
      const point = project(place.lat, place.lon);
      if (point.z <= 0.04) return;
      const distance = Math.hypot(point.x - x, point.y - y);
      if (distance < nearestDistance) {
        nearest = index;
        nearestDistance = distance;
      }
    });
    if (nearest >= 0) setActivePlace(nearest, false);
  });

  if ("ResizeObserver" in window) {
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
  } else {
    window.addEventListener("resize", resize, { passive: true });
  }
  resize();
  setActivePlace(0, false);
  requestAnimationFrame(draw);
})();
