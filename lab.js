// "Spot the leak": leakproof's four kinds of peeking, each as a short code
// sketch, a one-arrow timeline, and the verdict. The small print under each
// rejection is leakproof's own message from its four-questions example.
(function () {
  const tabs = Array.from(document.querySelectorAll(".spot-tabs [role='tab']"));
  const panel = document.getElementById("spot-panel");
  const codeEl = document.getElementById("spot-code");
  const fixEl = document.getElementById("spot-fix");
  const svg = document.getElementById("spot-svg");
  const alertEl = document.getElementById("spot-alert");
  const iconEl = document.getElementById("spot-icon");
  const verdictEl = document.getElementById("spot-verdict");
  const toolEl = document.getElementById("spot-tool");
  if (!tabs.length || !svg) return;

  const NS = "http://www.w3.org/2000/svg";
  function el(parent, name, attrs, text) {
    const node = document.createElementNS(NS, name);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (text != null) node.textContent = text;
    parent.appendChild(node);
    return node;
  }

  // Code lines: [text, highlighted?]. Highlighted lines are where the leak is.
  const CASES = {
    when: {
      bad: {
        code: [
          ["up = df.Close > df.Close.shift(1)   # did it rise today?", false],
          ["buy_at = df.Open                    # then buy at today's open", true],
        ],
        verdict: "Rejected. To buy at Monday's 9:30 open, it needs Monday's 4:00 pm close, which doesn't exist yet.",
        tool: "look-ahead bias: the position of row 1 uses what is known only at the close of row 1, but it must be decided by the close of row 0",
      },
      good: {
        code: [
          ["up = df.Close > df.Close.shift(1)   # did it rise today?", false],
          ["buy_at = df.Open.shift(-1)          # buy at tomorrow's open", true],
        ],
        verdict: "Accepted, graded tradable. Monday's close is known 17½ hours before Tuesday's open.",
      },
      draw(fixed) {
        const T = timeline(fixed
          ? [{ at: 0.2, label: "Mon 4:00 pm close", kind: "info", note: "the signal needs this price" },
             { at: 0.8, label: "Tue 9:30 am open", kind: "trade", note: "the trade happens here" }]
          : [{ at: 0.2, label: "Mon 9:30 am open", kind: "trade", note: "the trade happens here" },
             { at: 0.8, label: "Mon 4:00 pm close", kind: "info", note: "the signal needs this price" }]);
        arrow(T, fixed ? 0.2 : 0.8, fixed ? 0.8 : 0.2, !fixed,
          fixed ? "known 17½ hours before the trade" : "used 6½ hours before it exists");
      },
    },

    which: {
      bad: {
        code: [
          ["y  = df.Close.pct_change().shift(-1)  # answer: next day's return", false],
          ["cv = KFold(5, shuffle=True)           # folds shuffled across time", true],
          ["score = cross_val_score(model, X, y, cv=cv)", false],
        ],
        verdict: "Rejected. The model is graded on days 4 and 5, but it trained on days 6 and 7, whose prices are the answers.",
        tool: "the forecast of row 0 has seen its own outcome: it reads row 1 of `bar.close`, and it is scored on rows 1 to 1",
      },
      good: {
        code: [
          ["y  = df.Close.pct_change().shift(-1)  # answer: next day's return", false],
          ["cv = purged_kfold(5)   # drop training days next to each test fold", true],
          ["score = cross_val_score(model, X, y, cv=cv)", false],
        ],
        verdict: "Accepted, graded out-of-sample. It never sees the answers, but it still trains on later days, so it isn't a result you could have traded live, and the grade says so.",
      },
      draw(fixed) {
        const W = size(), narrow = W < 520;
        const H = 150;
        setBox(W, H);
        const left = 8, right = W - 8, n = 10;
        const colW = (right - left) / n;
        const cx = (d) => left + (d + 0.5) * colW;
        const rows = { train: 30, test: 64 };
        el(svg, "text", { class: "t-lab", x: left, y: 16 }, "trained on");
        el(svg, "text", { class: "t-lab", x: left, y: 56 + 0 }, "graded on");
        const train = fixed ? [0, 1, 2, 3, 8] : [0, 1, 3, 6, 7, 8];
        const dropped = fixed ? [6, 7] : [];
        const bw = Math.min(colW - 4, 44);
        for (let d = 0; d < n; d++) {
          if (train.includes(d)) {
            const bad = !fixed && (d === 6 || d === 7);
            el(svg, "rect", { class: bad ? "blk leak" : "blk", x: cx(d) - bw / 2, y: rows.train - 8, width: bw, height: 14 });
          }
          if (dropped.includes(d)) el(svg, "rect", { class: "blk dither", x: cx(d) - bw / 2, y: rows.train - 8, width: bw, height: 14 });
          if (d === 4 || d === 5) el(svg, "rect", { class: "blk hollow", x: cx(d) - bw / 2, y: rows.test - 8, width: bw, height: 14 });
          el(svg, "text", { class: "t-tick", x: cx(d), y: 118, "text-anchor": "middle" }, narrow ? d : `day ${d}`);
        }
        el(svg, "line", { class: "axis", x1: left, x2: right, y1: 100, y2: 100 });
        // the answers: the prices of days 5 and 6
        [5, 6].forEach((d) => el(svg, "path", { class: "tri", d: `M${cx(d) - 6},88 L${cx(d) + 6},88 L${cx(d)},97 Z` }));
        el(svg, "text", { class: "t-note arr", x: (cx(5) + cx(6)) / 2, y: 140, "text-anchor": "middle" }, "▼ the answers: prices of days 5 and 6");
        if (fixed) el(svg, "text", { class: "t-lab arr", x: (cx(6) + cx(7)) / 2, y: 16, "text-anchor": "middle" }, "dropped");
        else el(svg, "text", { class: "t-lab leak-t arr", x: (cx(6) + cx(7)) / 2, y: 16, "text-anchor": "middle" }, "contain the answers");
      },
    },

    howmany: {
      bad: {
        code: [
          ["tries = {w: backtest(momentum(df, w), days=range(0, 500))", false],
          ["         for w in (5, 10, 20, 40, 80)}   # try five settings", false],
          ["best = max(tries, key=lambda w: tries[w].sharpe)  # pick one", false],
          ["trade(momentum(df, best), days=range(0, 500))  # same days", true],
        ],
        verdict: "Rejected. Days 0 to 499 are traded with a winner that could only be picked after day 499.",
        tool: "look-ahead bias: the position of row 1 uses what is known only at the open of row 500, but it must be decided by the close of row 0",
      },
      good: {
        code: [
          ["tries = {w: backtest(momentum(df, w), days=range(0, 500))", false],
          ["         for w in (5, 10, 20, 40, 80)}   # try five settings", false],
          ["best = max(tries, key=lambda w: tries[w].sharpe)  # pick one", false],
          ["trade(momentum(df, best), days=range(501, 1000))  # afterwards", true],
        ],
        verdict: "Accepted, graded tradable. (Reporting the winner's score on days 0 to 499 is also accepted, but graded “best of 5”, so the luck of picking can be corrected for.)",
      },
      draw(fixed) {
        const T = timeline([
          { at: 0.5, label: "day 500", kind: "trade", note: "winner picked here" },
        ], { start: "day 0", end: "day 1000" }, 196);
        const x0 = T.x(0.03), x5 = T.x(0.5), x1 = T.x(0.97);
        el(svg, "path", { class: "bracket", d: `M${x0},${T.axisY - 20} v-6 H${x5 - 4} v6` });
        el(svg, "text", { class: "t-note", x: (x0 + x5) / 2, y: T.axisY - 32, "text-anchor": "middle" }, "5 settings tried, results compared");
        const y = T.axisY + 66;
        if (fixed) {
          el(svg, "rect", { class: "blk arr", x: x5 + 4, y: y - 7, width: x1 - x5 - 4, height: 14 });
          el(svg, "text", { class: "t-note arr", x: (x5 + x1) / 2, y: y + 24, "text-anchor": "middle" }, "traded after the pick");
        } else {
          el(svg, "rect", { class: "blk leak arr", x: x0, y: y - 7, width: x5 - x0 - 4, height: 14 });
          el(svg, "text", { class: "t-note leak-t arr", x: (x0 + x5) / 2, y: y + 24, "text-anchor": "middle" }, "traded before the pick existed");
        }
      },
    },

    whatkind: {
      bad: {
        code: [
          ["px  = yf.download(\"XYZ\")[\"Adj Close\"]  # rescaled for later splits", false],
          ["buy = px < 60                          # a price level", true],
        ],
        verdict: "Rejected. An adjusted price is rescaled for every split and dividend up to the download, so “below $60” in 2015 depends on events years later.",
        tool: "look-ahead bias: the position of row 1 uses what is known only at the close of row 999, but it must be decided by the close of row 0",
      },
      good: {
        code: [
          ["px  = yf.download(\"XYZ\")[\"Adj Close\"]  # rescaled for later splits", false],
          ["buy = px.pct_change(20) > 0            # a return: rescaling cancels", true],
        ],
        verdict: "Accepted, graded tradable. A return divides one adjusted price by another, so the later rescaling cancels out.",
      },
      draw(fixed) {
        const T = timeline([
          { at: 0.15, label: "2015", kind: "trade", note: fixed ? "buy if up over 20 days" : "buy if below $60" },
          { at: 0.85, label: "2024", kind: "info", note: "downloaded: prices rescaled" },
        ]);
        if (fixed) {
          const a = T.x(0.15), b = T.x(0.85), y = T.axisY - 40, mid = (a + b) / 2;
          el(svg, "text", { class: "t-note arr", x: mid, y: y - 6, "text-anchor": "middle" }, "not needed: the rescaling cancels in a ratio");
        } else {
          arrow(T, 0.85, 0.15, true, "depends on events 9 years later");
        }
      },
    },
  };

  // ---- drawing helpers -----------------------------------------------------
  function size() { return Math.max(280, svg.parentElement.clientWidth); }
  function setBox(W, H) {
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("height", H);
  }

  // A horizontal time axis with labelled events. kind "trade" draws a flag,
  // kind "info" draws a dot for data the strategy uses.
  function timeline(events, ends, height) {
    const W = size(), H = height || (W < 520 ? 178 : 160);
    setBox(W, H);
    const L = 14, R = W - 14, axisY = 86;
    const x = (f) => L + f * (R - L);
    el(svg, "line", { class: "axis", x1: L, x2: R, y1: axisY, y2: axisY });
    el(svg, "path", { class: "axis-head", d: `M${R},${axisY} l-8,-5 v10 z` });
    el(svg, "text", { class: "t-tick", x: R, y: axisY + 18, "text-anchor": "end" }, "time");
    if (ends) {
      el(svg, "text", { class: "t-tick", x: x(0.03), y: axisY + 18, "text-anchor": "middle" }, ends.start);
      el(svg, "text", { class: "t-tick", x: x(0.97), y: axisY + 34, "text-anchor": "middle" }, ends.end);
    }
    const groups = [];
    for (const e of events) {
      const ex = x(e.at);
      if (e.kind === "trade") {
        el(svg, "line", { class: "flag-pole", x1: ex, x2: ex, y1: axisY, y2: axisY - 26 });
        el(svg, "path", { class: "flag", d: `M${ex},${axisY - 26} h12 l-4,5 l4,5 h-12 z` });
      } else {
        el(svg, "circle", { class: "dot", cx: ex, cy: axisY, r: 6 });
      }
      const label = el(svg, "text", { class: "t-lab", x: ex, y: axisY + 18, "text-anchor": anchorFor(e.at) }, e.label);
      const note = el(svg, "text", { class: "t-note", x: ex, y: axisY + 34, "text-anchor": anchorFor(e.at) }, e.note);
      groups.push([label, note]);
    }
    // On narrow screens, drop an event's label and note below the previous
    // event's if their text would overlap.
    const span = (g) => {
      const a = g[0].getBBox(), b = g[1].getBBox();
      return [Math.min(a.x, b.x), Math.max(a.x + a.width, b.x + b.width)];
    };
    for (let i = 1; i < groups.length; i++) {
      const [a0, a1] = span(groups[i - 1]), [b0, b1] = span(groups[i]);
      if (a1 + 8 > b0 && b1 + 8 > a0) {
        groups[i][0].setAttribute("y", axisY + 52);
        groups[i][1].setAttribute("y", axisY + 68);
      }
    }
    return { W, H, x, axisY };
  }
  function anchorFor(f) { return f < 0.3 ? "start" : f > 0.7 ? "end" : "middle"; }

  // A curved arrow from the time the information exists to the time it's used.
  function arrow(T, fromF, toF, leak, label) {
    const a = T.x(fromF), b = T.x(toF), y = T.axisY - 12, mid = (a + b) / 2, lift = 44;
    const cls = leak ? "arrow leak arr" : "arrow arr";
    el(svg, "path", { class: cls + " stroke", d: `M${a},${y} Q${mid},${y - lift} ${b + (b < a ? 8 : -8)},${y}` });
    const dir = b < a ? 1 : -1;
    el(svg, "path", { class: cls + " head", d: `M${b},${y + 2} l${dir * 9},-10 l${dir * 3},9 z` });
    el(svg, "text", { class: "t-note arr" + (leak ? " leak-t" : ""), x: mid, y: y - lift / 2 - 6, "text-anchor": "middle" }, label);
  }

  // ---- animation ------------------------------------------------------------
  // A "now" marker sweeps along the time axis, things appear as it passes
  // them, then the arrow (or the verdict bar) draws.
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let anim = null, seen = false;
  function animate() {
    cancelAnimationFrame(anim);
    svg.querySelectorAll(".now").forEach((n) => n.remove());
    if (reduce) return;
    const W = size();
    const late = Array.from(svg.querySelectorAll(".arr"));
    const early = Array.from(svg.children).filter((n) => !n.classList.contains("arr") && !n.classList.contains("axis") && !n.classList.contains("axis-head"));
    const at = early.map((n) => n.getBBox().x);
    early.concat(late).forEach((n) => { n.style.opacity = 0; });
    const now = el(svg, "line", { class: "now", y1: 4, y2: svg.viewBox.baseVal.height - 4, x1: 0, x2: 0 });
    const t0 = performance.now(), sweep = 1300;
    function frame(t) {
      const f = Math.min(1, (t - t0) / sweep), x = f * W;
      now.setAttribute("x1", x); now.setAttribute("x2", x);
      early.forEach((n, k) => { if (at[k] <= x) n.style.opacity = 1; });
      if (f < 1) { anim = requestAnimationFrame(frame); return; }
      now.remove();
      late.forEach((n) => {
        n.style.opacity = 1;
        if (n.classList.contains("stroke")) {
          const len = n.getTotalLength();
          n.style.transition = "none"; n.style.strokeDasharray = len; n.style.strokeDashoffset = len;
          n.getBoundingClientRect();
          n.style.transition = "stroke-dashoffset 0.7s ease-out"; n.style.strokeDashoffset = 0;
        }
      });
    }
    anim = requestAnimationFrame(frame);
  }

  // ---- state -----------------------------------------------------------------
  let current = "when";

  function render() {
    const c = CASES[current];
    const fixed = fixEl.checked;
    const v = fixed ? c.good : c.bad;
    codeEl.replaceChildren();
    v.code.forEach(([text, hl]) => {
      const line = document.createElement("span");
      line.className = "code-line" + (hl ? (fixed ? " hl-ok" : " hl-bad") : "");
      line.textContent = text;
      codeEl.appendChild(line);
    });
    svg.replaceChildren();
    c.draw(fixed);
    if (seen) animate();
    alertEl.className = "alert " + (fixed ? "is-ok" : "is-bad");
    iconEl.textContent = fixed ? "✓" : "!";
    verdictEl.textContent = v.verdict;
    toolEl.textContent = "";
    if (v.tool) {
      const lab = document.createElement("span");
      lab.textContent = "leakproof's message, from its own example (rows are days): ";
      const code = document.createElement("code");
      code.textContent = v.tool;
      toolEl.append(lab, code);
    }
  }

  function select(tab, focus) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", on);
      t.tabIndex = on ? 0 : -1;
    });
    panel.setAttribute("aria-labelledby", tab.id);
    if (focus) tab.focus();
    current = tab.dataset.case;
    fixEl.checked = false;
    render();
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => select(tab));
    tab.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      select(tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length], true);
    });
  });
  fixEl.addEventListener("change", render);
  const replay = document.getElementById("spot-replay");
  if (replay) replay.addEventListener("click", animate);
  // play the first animation when the walkthrough scrolls into view
  new IntersectionObserver((entries, obs) => {
    if (entries[0].isIntersecting) { seen = true; animate(); obs.disconnect(); }
  }, { threshold: 0.4 }).observe(svg);

  let lastW = svg.parentElement.clientWidth;
  window.addEventListener("resize", () => {
    const w = svg.parentElement.clientWidth;
    if (Math.abs(w - lastW) > 4) { lastW = w; render(); }
  });
  render();
})();
