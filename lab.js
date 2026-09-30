// Look-ahead bias demo: a price series split at a decision day.
// A trailing average only reads the past; a centered one reads days that
// haven't happened yet, which is exactly what leakproof rejects.
(function () {
  const svg = document.getElementById("chart");
  const slider = document.getElementById("day");
  const out = document.getElementById("day-out");
  const caption = document.getElementById("lab-caption");
  const radios = document.querySelectorAll('input[name="ma"]');
  if (!svg || !slider) return;

  const NS = "http://www.w3.org/2000/svg";
  const N = 240;
  const WIN = 20;
  const HALF = WIN / 2;

  // Seeded random walk so every visitor sees the same series.
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(537584);
  const gauss = () => (rand() + rand() + rand() + rand() - 2) * 1.2;
  const price = [100];
  for (let i = 1; i < N; i++) {
    const drift = i < 90 ? 0.0006 : i < 160 ? -0.0009 : 0.0012;
    price.push(price[i - 1] * (1 + drift + 0.013 * gauss()));
  }
  const lo = Math.min(...price), hi = Math.max(...price);

  function mean(a, b) {
    let s = 0;
    for (let k = a; k <= b; k++) s += price[k];
    return s / (b - a + 1);
  }
  const trailing = (i) => mean(i - WIN + 1, i);
  const centered = (i) => mean(i - HALF, i + HALF - 1);

  function el(name, attrs, parent) {
    const node = document.createElementNS(NS, name);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    (parent || svg).appendChild(node);
    return node;
  }

  // Layout depends on the rendered width: narrow screens get a taller
  // viewBox so the series stays legible instead of shrinking to a strip.
  let W, H, pad, x, y, layers;

  function build() {
    const narrow = svg.parentElement.clientWidth < 600;
    W = narrow ? 600 : 1000;
    H = narrow ? 440 : 320;
    pad = narrow ? { l: 12, r: 12, t: 64, b: 16 } : { l: 16, r: 16, t: 52, b: 20 };
    x = (i) => pad.l + (i * (W - pad.l - pad.r)) / (N - 1);
    y = (p) => pad.t + ((hi - p) * (H - pad.t - pad.b)) / (hi - lo);

    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.replaceChildren();

    const defs = el("defs", {});
    const pat = el("pattern", { id: "hatch", width: 9, height: 9, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
    el("line", { class: "hatch-line", x1: 0, y1: 0, x2: 0, y2: 9 }, pat);

    const top = pad.t - 12, bottom = H - pad.b, h = bottom - top;
    const grid = el("g", { class: "grid" });
    for (let i = 0; i < N; i += 30) el("line", { x1: x(i), x2: x(i), y1: top, y2: bottom }, grid);
    for (let k = 0; k <= 4; k++) {
      const yy = pad.t + (k * (H - pad.t - pad.b)) / 4;
      el("line", { x1: pad.l, x2: W - pad.r, y1: yy, y2: yy }, grid);
    }

    layers = {
      veil: el("rect", { class: "veil", y: top, height: h }),
      winKnown: el("rect", { class: "win-known", y: top, height: h }),
      winLeak: el("rect", { class: "win-leak", y: top, height: h }),
      edgeLeak: el("line", { class: "edge-leak", y1: top, y2: bottom }),
      future: el("path", { class: "future" }),
      past: el("path", { class: "past" }),
      ma: el("path", { class: "ma" }),
      now: el("line", { class: "now", y1: pad.t - 20, y2: bottom }),
      dot: el("circle", { class: "dot", r: narrow ? 8 : 6 }),
      nowLabel: el("text", { y: pad.t - 26 }),
      futureLabel: el("text", { y: pad.t - 26, "text-anchor": "end", x: W - pad.r }),
      leakLabel: el("text", { class: "leak-label", y: bottom - 12 }),
    };
    layers.futureLabel.textContent = "not known yet";
    layers.leakLabel.textContent = "future data";
  }

  function pathFor(from, to, f) {
    let d = "";
    for (let i = from; i <= to; i++) d += (i === from ? "M" : "L") + x(i).toFixed(1) + " " + y(f(i)).toFixed(1);
    return d;
  }

  function render() {
    const L = layers;
    const t = Number(slider.value);
    const leaky = document.querySelector('input[name="ma"]:checked').value === "centered";
    out.textContent = t;

    L.veil.setAttribute("x", x(t));
    L.veil.setAttribute("width", W - pad.r - x(t));
    L.past.setAttribute("d", pathFor(0, t, (i) => price[i]));
    L.future.setAttribute("d", pathFor(t, N - 1, (i) => price[i]));

    const a = leaky ? t - HALF : t - WIN + 1;
    const b = leaky ? t + HALF - 1 : t;
    L.winKnown.setAttribute("x", x(a));
    L.winKnown.setAttribute("width", x(Math.min(b, t)) - x(a));
    for (const node of [L.winLeak, L.edgeLeak, L.leakLabel]) node.style.display = leaky ? "" : "none";
    if (leaky) {
      L.winLeak.setAttribute("x", x(t));
      L.winLeak.setAttribute("width", x(b) - x(t));
      L.edgeLeak.setAttribute("x1", x(b));
      L.edgeLeak.setAttribute("x2", x(b));
      const flip = x(b) > W * 0.8;
      L.leakLabel.setAttribute("x", flip ? x(t) - 8 : x(b) + 8);
      L.leakLabel.setAttribute("text-anchor", flip ? "end" : "start");
    }

    const f = leaky ? centered : trailing;
    L.ma.setAttribute("d", pathFor(leaky ? HALF : WIN - 1, t, f));
    L.ma.classList.toggle("leaky", leaky);
    L.dot.setAttribute("cx", x(t));
    L.dot.setAttribute("cy", y(f(t)));
    L.dot.classList.toggle("leaky", leaky);

    L.now.setAttribute("x1", x(t));
    L.now.setAttribute("x2", x(t));
    L.nowLabel.setAttribute("x", x(t));
    L.nowLabel.setAttribute("text-anchor", t > N - 40 ? "end" : t < 40 ? "start" : "middle");
    L.nowLabel.textContent = "day " + t;
    L.futureLabel.style.display = x(t) > W - 260 ? "none" : "";

    if (leaky) {
      caption.innerHTML =
        "<strong>A centered 20-day average on day " + t + "</strong> averages days " + a + " to " + b +
        ". <span class=\"leak-word\">Ten of those days haven't happened yet.</span> " +
        "A backtest that trades on it looks great, then falls apart live. leakproof rejects this pipeline before it runs.";
    } else {
      caption.innerHTML =
        "<strong>A trailing 20-day average on day " + t + "</strong> averages days " + a + " to " + b +
        ". Everything it reads is already known, so a strategy can safely trade on it.";
    }
  }

  function dayFromPointer(evt) {
    const r = svg.getBoundingClientRect();
    const vx = ((evt.clientX - r.left) / r.width) * W;
    const i = Math.round(((vx - pad.l) * (N - 1)) / (W - pad.l - pad.r));
    return Math.max(Number(slider.min), Math.min(Number(slider.max), i));
  }
  let dragging = false;
  svg.addEventListener("pointerdown", (e) => {
    dragging = true;
    svg.setPointerCapture(e.pointerId);
    slider.value = dayFromPointer(e);
    render();
  });
  svg.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    slider.value = dayFromPointer(e);
    render();
  });
  const stop = () => { dragging = false; };
  svg.addEventListener("pointerup", stop);
  svg.addEventListener("pointercancel", stop);

  slider.addEventListener("input", render);
  radios.forEach((r) => r.addEventListener("change", render));

  let lastNarrow = null;
  function relayout() {
    const narrow = svg.parentElement.clientWidth < 600;
    if (narrow === lastNarrow) return;
    lastNarrow = narrow;
    build();
    render();
  }
  window.addEventListener("resize", relayout);
  relayout();
})();
