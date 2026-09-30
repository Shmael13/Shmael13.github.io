// "What has this number seen?" -- leakproof's four questions on small cases.
// Time runs left to right. Each trading day has an open and, half a day later,
// a close. Anything to the right of the trade line is not yet known when the
// trade is made.
(function () {
  const svg = document.getElementById("lab-svg");
  const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
  const variantsBox = document.getElementById("lab-variants");
  const questionEl = document.getElementById("lab-question");
  const verdictEl = document.getElementById("lab-verdict");
  const noteEl = document.getElementById("lab-note");
  const legendItems = Array.from(document.querySelectorAll(".lab-legend [data-key]"));
  if (!svg || !tabs.length) return;

  const NS = "http://www.w3.org/2000/svg";

  function el(parent, name, attrs, text) {
    const node = document.createElementNS(NS, name);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (text != null) node.textContent = text;
    parent.appendChild(node);
    return node;
  }

  // Layout from the rendered width, so text stays at its CSS size.
  // t0..t1 is the stretch of time shown; lanes are the rows of the drawing.
  function layout(t0, t1, lanes, opts) {
    opts = opts || {};
    const W = Math.max(300, svg.parentElement.clientWidth);
    const narrow = W < 600;
    const labelW = narrow ? 58 : 128;
    const span = t1 - t0;
    const unit = (W - labelW - 8) / span;
    const cell = opts.cell || Math.max(12, Math.min(28, unit * (narrow ? 0.34 : 0.26)));
    const laneH = cell + (narrow ? 14 : 18);
    const top = 34;
    const below = opts.below || 58;
    const H = top + lanes * laneH + below;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("height", H);
    svg.replaceChildren();
    const defs = el(svg, "defs", {});
    const pat = el(defs, "pattern", { id: "future-hatch", width: 8, height: 8, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" });
    el(pat, "line", { class: "hatch", x1: 0, y1: 0, x2: 0, y2: 8 });
    return {
      W, H, narrow, labelW, cell, laneH, top, t0, t1,
      x: (t) => labelW + (t - t0) * unit,
      laneY: (i) => top + i * laneH + laneH / 2,
      lanesBottom: top + lanes * laneH,
    };
  }

  function laneLabel(L, i, wide, short) {
    el(svg, "text", { class: "lane", x: L.labelW - 12, y: L.laneY(i) + 4, "text-anchor": "end" }, L.narrow ? short : wide);
  }

  function cell(L, cx, cy, state, tip) {
    const s = L.cell;
    const g = el(svg, "g", { class: "cell " + state });
    el(g, "rect", { x: cx - s / 2, y: cy - s / 2, width: s, height: s, rx: 3 });
    if (tip) el(g, "title", {}, tip);
    return g;
  }

  // Hatched "not yet known" region to the right of the trade.
  function future(L, t, label) {
    const x = L.x(t);
    el(svg, "rect", { class: "future", x, y: L.top - 6, width: L.W - x, height: L.lanesBottom - L.top + 6 });
    if (label) {
      const t = el(svg, "text", { class: "future-label", x: L.W - 4, y: L.top - 12, "text-anchor": "end" }, label);
      if (t.getComputedTextLength() > L.W - x - 14) t.style.display = "none";
    }
  }

  // The moment of the trade (or of the pick), as a vertical line with a label.
  function moment(L, t, label) {
    const x = L.x(t);
    el(svg, "line", { class: "moment", x1: x, x2: x, y1: L.top - 20, y2: L.lanesBottom });
    const text = el(svg, "text", { class: "moment-label", x: x - 6, y: L.top - 12, "text-anchor": "end" }, label);
    if (x - 6 - text.getComputedTextLength() < 2) { text.setAttribute("text-anchor", "start"); text.setAttribute("x", x + 6); }
  }

  // A bracket under part of the drawing with a short label.
  function bracket(L, xa, xb, y, label, cls) {
    const g = el(svg, "g", { class: "bracket " + (cls || "") });
    el(g, "path", { d: `M${xa},${y - 5}V${y}H${xb}V${y - 5}` });
    const mid = (xa + xb) / 2;
    const t = el(g, "text", { x: mid, y: y + 15, "text-anchor": "middle" }, label);
    const w = t.getComputedTextLength();
    if (mid - w / 2 < 2) { t.setAttribute("text-anchor", "start"); t.setAttribute("x", Math.min(xa, 2)); }
    else if (mid + w / 2 > L.W - 2) { t.setAttribute("text-anchor", "end"); t.setAttribute("x", L.W - 2); }
    return g;
  }

  // offset: where a day's label sits within the day (0.25 = between its open and close)
  function dayAxis(L, days, y, offset) {
    const off = offset == null ? 0.25 : offset;
    days.forEach((d) => el(svg, "text", { class: "tick", x: L.x(d + off), y, "text-anchor": "middle" }, L.narrow ? d : `day ${d}`));
  }

  // ---- the four cases -----------------------------------------------------
  const CASES = {
    when: {
      legend: { ok: "used, and already known", late: "used before it was known", future: "not yet known at the trade", mark: "where it trades" },
      question: "Could this trade have been placed with what was known at the time?",
      variants: [
        {
          label: "Trade at today's open",
          entry: 6,
          ok: false,
          plain: "Leak: the signal uses today's close, which doesn't exist yet when it trades at today's open.",
          msg: "look-ahead bias: the position of row 6 uses what is known only at the close of row 6, but it must be decided by the close of row 5",
          note: "The signal is today's return, so it needs the close of day 6. That close prints half a day after the open of day 6, where the trade is placed.",
        },
        {
          label: "Trade at tomorrow's open",
          entry: 7,
          ok: true,
          plain: "Accepted, graded tradable: everything the signal uses is known before the trade.",
          note: "The same signal traded one open later is fine: the close of day 6 prints half a day before the open of day 7.",
        },
      ],
      draw(v) {
        const days = [3, 4, 5, 6, 7, 8];
        const L = layout(2.75, 9, 2);
        future(L, v.entry, L.narrow ? "not known yet" : "not yet known at the trade");
        laneLabel(L, 0, "opening price", "open");
        laneLabel(L, 1, "closing price", "close");
        for (const d of days) {
          const isEntry = d === v.entry;
          cell(L, L.x(d), L.laneY(0), isEntry ? "mark" : "plain",
            isEntry ? `open of day ${d}: the trade is placed at this price` : `open of day ${d}`);
          const used = d === 5 || d === 6;
          const state = used ? (d + 0.5 < v.entry ? "ok" : "late") : "plain";
          cell(L, L.x(d + 0.5), L.laneY(1), state,
            `close of day ${d}` + (used ? (state === "ok" ? ": used by the signal, known before the trade" : ": used by the signal before it is known") : ""));
        }
        moment(L, v.entry, L.narrow ? `trade, day ${v.entry}` : `trade: open of day ${v.entry}`);
        const y = L.lanesBottom + 4;
        bracket(L, L.x(5.5) - L.cell / 2, L.x(6.5) + L.cell / 2, y, "the signal uses these two closes", v.ok ? "" : "bad");
        dayAxis(L, days, y + 40);
      },
    },

    which: {
      legend: { ok: "used by the model", late: "an answer the model trained on", mark: "an answer it is graded on" },
      question: "Did the model see the answers it is graded on?",
      variants: [
        {
          label: "Shuffled cross-validation",
          train: [0, 1, 3, 6, 7, 8],
          dropped: [],
          ok: false,
          plain: "Leak: the model trained on days whose data contains the answers it is then graded on.",
          msg: "the forecast of row 4 has seen its own outcome: it reads row 5 of `bar.close`, and it is scored on rows 5 to 6",
          note: "Days 4 and 5 each predict the next close. Shuffled folds still train on days 6 to 8, and those days' data includes the closes of days 5 and 6: the answers.",
        },
        {
          label: "Purged cross-validation",
          train: [0, 1, 2, 3, 8],
          dropped: [6, 7],
          ok: true,
          plain: "Accepted, graded out-of-sample: the model never saw the answers.",
          note: "Purging drops days 6 and 7, whose data overlaps the answers. It still trains on day 8, after the test, so it could not have run live. That's why the grade is out-of-sample, not tradable.",
        },
      ],
      draw(v) {
        const days = [...Array(10).keys()];
        const L = layout(0, 10, 3, { below: 62 });
        laneLabel(L, 0, "trained on", "train");
        laneLabel(L, 1, "graded on", "test");
        laneLabel(L, 2, "closing price", "close");
        const train = new Set(v.train), dropped = new Set(v.dropped), test = new Set([4, 5]);
        const answers = new Set([5, 6]); // day r is graded on the close of day r + 1
        const model = new Set();
        train.forEach((i) => [i - 1, i, i + 1].forEach((c) => c >= 0 && c < 10 && model.add(c)));
        const inputs = new Set([3, 4, 5]);
        const barH = Math.max(8, L.cell * 0.55);
        const seg = (lane, d, cls, tip) => {
          const g = el(svg, "g", { class: "seg " + cls });
          el(g, "rect", { x: L.x(d) + 2, y: L.laneY(lane) - barH / 2, width: L.x(d + 1) - L.x(d) - 4, height: barH, rx: 2 });
          el(g, "title", {}, tip);
        };
        for (const d of days) {
          if (train.has(d)) seg(0, d, "seg-train", `day ${d} is in the training folds`);
          if (dropped.has(d)) seg(0, d, "seg-dropped", `day ${d} is dropped: its data overlaps the answers`);
          if (test.has(d)) seg(1, d, "seg-test", `day ${d} is predicted and graded`);
          let state = "plain", tip = `close of day ${d}`;
          if (model.has(d) && answers.has(d)) { state = "late"; tip += ": an answer, and the model trained on it"; }
          else if (answers.has(d)) { state = inputs.has(d) || model.has(d) ? "ok mark-ring" : "mark"; tip += ": an answer the model is graded on"; }
          else if (model.has(d) || inputs.has(d)) { state = "ok"; tip += ": used by the model"; }
          cell(L, L.x(d + 0.5), L.laneY(2), state, tip);
        }
        const y = L.lanesBottom + 4;
        bracket(L, L.x(5.5) - L.cell / 2, L.x(6.5) + L.cell / 2, y, "the answers", v.ok ? "" : "bad");
        if (v.dropped.length) {
          const t = el(svg, "text", { class: "seg-note", x: L.x(7), y: L.laneY(0) - barH / 2 - 5, "text-anchor": "middle" }, "dropped");
          if (L.narrow) t.style.display = "none";
        }
        dayAxis(L, L.narrow ? days.filter((d) => d % 2 === 0) : days, y + 40, 0.5);
      },
    },

    howmany: {
      legend: { ok: "results looked at to pick the winner", late: "traded before the pick existed", mark: "traded, or reported" },
      question: "Was the winner picked by looking at the same results it reports?",
      variants: [
        {
          label: "Trade the winner on the same days",
          trade: "early",
          ok: false,
          plain: "Leak: days 0 to 499 are traded with a pick that is only made after day 499.",
          msg: "look-ahead bias: the position of row 1 uses what is known only at the open of row 500, but it must be decided by the close of row 0",
          note: "Five strategies are tried on days 0 to 499 and the best is picked by looking at the results. That pick exists only from day 500, so trading it on days 0 to 499 uses the future.",
        },
        {
          label: "Report it as best of 5",
          trade: "report",
          ok: true,
          plain: "Accepted, graded in-sample (best of 5): the result is reported as one pick among five tries.",
          note: "As a report on the days it was picked on, it's accepted, but graded as the best of 5 so a multiple-testing correction can use K = 5.",
        },
        {
          label: "Trade the winner from day 501",
          trade: "late",
          ok: true,
          plain: "Accepted, graded tradable: the winner is only traded after it was picked.",
          note: "Traded only after the pick is made, it's an ordinary strategy that could have run live.",
        },
      ],
      draw(v) {
        const K = 5, win = 2;
        const L = layout(0, 1000, K, { cell: 14, below: 48 });
        for (let k = 0; k < K; k++) laneLabel(L, k, k === win ? "strategy 3, the winner" : `strategy ${k + 1}`, k === win ? "win" : `s${k + 1}`);
        const barH = 10;
        for (let k = 0; k < K; k++) {
          const y = L.laneY(k) - barH / 2;
          el(svg, "rect", { class: "track", x: L.x(0), y, width: L.x(1000) - L.x(0), height: barH, rx: 2 });
          const g = el(svg, "g", { class: "seg seg-looked" });
          el(g, "rect", { x: L.x(0), y, width: L.x(499) - L.x(0), height: barH, rx: 2 });
          el(g, "title", {}, `strategy ${k + 1}: results on days 0 to 499 are looked at to pick the winner`);
        }
        const y = L.laneY(win) - barH / 2 - 3, h = barH + 6;
        if (v.trade === "early") {
          const g = el(svg, "g", { class: "seg seg-bad" });
          el(g, "rect", { x: L.x(0), y, width: L.x(499) - L.x(0), height: h, rx: 3 });
          el(g, "title", {}, "the winner, traded on days 0 to 499, before it was picked");
        } else if (v.trade === "late") {
          const g = el(svg, "g", { class: "seg seg-trade" });
          el(g, "rect", { x: L.x(501), y, width: L.x(1000) - L.x(501), height: h, rx: 3 });
          el(g, "title", {}, "the winner, traded from day 501, after it was picked");
        } else {
          const g = el(svg, "g", { class: "seg seg-report" });
          el(g, "rect", { x: L.x(0), y, width: L.x(499) - L.x(0), height: h, rx: 3 });
          el(g, "title", {}, "the winner's result on days 0 to 499, reported as the best of 5");
        }
        moment(L, 500, L.narrow ? "pick" : "winner picked here");
        const ay = L.lanesBottom + 4;
        bracket(L, L.x(0), L.x(499), ay, "results looked at to pick the winner");
        const ty = ay + 36;
        [0, 500, 1000].forEach((d) => el(svg, "text", { class: "tick", x: L.x(d), y: ty, "text-anchor": d === 0 ? "start" : d === 1000 ? "end" : "middle" }, L.narrow ? d : `day ${d}`));
      },
    },

    whatkind: {
      legend: { ok: "used, and already known", late: "used before it was known", future: "not yet known at the trade" },
      question: "Does the value depend on something that is only fixed later?",
      variants: [
        {
          label: "Buy when adjusted price < $60",
          level: true,
          ok: false,
          plain: "Leak: an adjusted price depends on a factor fixed when the data was downloaded, years after the trade.",
          msg: "look-ahead bias: the position of row 7 uses what is known only at the close of row 999, but it must be decided by the close of row 6",
          note: "Adjusted price = printed price × a factor fixed at download. “Below $60” depends on that factor, so the signal is only known at the download.",
        },
        {
          label: "Buy on adjusted-price momentum",
          level: false,
          ok: true,
          plain: "Accepted, graded tradable: the factor cancels, so only printed prices are used.",
          note: "Momentum divides today's adjusted close by yesterday's, and the factor cancels like a unit of measure. The signal is known as soon as the prices print.",
        },
      ],
      draw(v) {
        const days = [3, 4, 5, 6, 7];
        const L = layout(3, 10.2, 2);
        future(L, 7, L.narrow ? "not known yet" : "not yet known at the trade");
        laneLabel(L, 0, "printed close", "close");
        laneLabel(L, 1, "adjustment factor", "factor");
        const used = v.level ? new Set([6]) : new Set([5, 6]);
        for (const d of days) {
          cell(L, L.x(d + 0.5), L.laneY(0), used.has(d) ? "ok" : "plain",
            `printed close of day ${d}` + (used.has(d) ? ": used by the signal, known before the trade" : ""));
        }
        el(svg, "text", { class: "tick", x: L.x(8.55), y: L.laneY(0) + 4, "text-anchor": "middle" }, L.narrow ? "…" : "… years …");
        const fx = L.x(9.6);
        cell(L, fx, L.laneY(1), v.level ? "late" : "void",
          v.level ? "adjustment factor, fixed at download: used before it is known" : "adjustment factor: cancels in a return, so not used");
        if (!v.level) el(svg, "line", { class: "strike", x1: fx - L.cell / 2 - 3, x2: fx + L.cell / 2 + 3, y1: L.laneY(1) + L.cell / 2 + 3, y2: L.laneY(1) - L.cell / 2 - 3 });
        moment(L, 7, L.narrow ? "trade, day 7" : "trade: open of day 7");
        const y = L.lanesBottom + 4;
        const xa = L.x((v.level ? 6.5 : 5.5)) - L.cell / 2;
        bracket(L, xa, (v.level ? fx : L.x(6.5)) + L.cell / 2, y,
          v.level ? "the signal uses this close and the factor" : "the signal uses two printed closes", v.ok ? "" : "bad");
        dayAxis(L, days, y + 40);
        el(svg, "text", { class: "tick", x: fx, y: y + 40, "text-anchor": "middle" }, L.narrow ? "dl." : "download");
      },
    },
  };

  let current = "when";
  let variant = 0;

  function renderVariants() {
    variantsBox.querySelectorAll("label").forEach((n) => n.remove());
    CASES[current].variants.forEach((v, i) => {
      const lab = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "variant";
      input.value = i;
      input.checked = i === variant;
      input.addEventListener("change", () => { variant = i; render(); });
      const span = document.createElement("span");
      span.textContent = v.label;
      lab.append(input, span);
      variantsBox.appendChild(lab);
    });
  }

  function render() {
    const c = CASES[current];
    const v = c.variants[variant];
    questionEl.textContent = c.question;
    legendItems.forEach((item) => {
      const text = c.legend[item.dataset.key];
      item.hidden = !text;
      if (text) item.querySelector("b").textContent = text;
    });
    c.draw(v);
    verdictEl.className = "verdict " + (v.ok ? "is-ok" : "is-bad");
    verdictEl.replaceChildren();
    const head = document.createElement("p");
    head.className = "v-head";
    const icon = document.createElement("span");
    icon.className = "v-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = v.ok ? "✓" : "✕";
    const status = document.createElement("span");
    status.textContent = v.plain;
    head.append(icon, status);
    verdictEl.appendChild(head);
    if (v.msg) {
      const p = document.createElement("p");
      p.className = "v-msg";
      const lab = document.createElement("span");
      lab.textContent = "What leakproof prints (rows are trading days):";
      const code = document.createElement("code");
      code.textContent = v.msg;
      p.append(lab, code);
      verdictEl.appendChild(p);
    }
    noteEl.textContent = v.note;
  }

  function select(tab, focus) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", on);
      t.tabIndex = on ? 0 : -1;
    });
    if (focus) tab.focus();
    current = tab.dataset.q;
    variant = 0;
    renderVariants();
    render();
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => select(tab));
    tab.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      select(next, true);
    });
  });

  let lastW = svg.parentElement.clientWidth;
  window.addEventListener("resize", () => {
    const w = svg.parentElement.clientWidth;
    if (Math.abs(w - lastW) > 4) { lastW = w; render(); }
  });
  renderVariants();
  render();
})();
