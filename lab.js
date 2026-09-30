// "What has this number seen?" -- leakproof's four questions on small cases.
// Each case draws the value's footprint (the data cells it was computed from)
// on a half-row clock: bar t opens at time t and closes at t + 1/2.
(function () {
  const svg = document.getElementById("lab-svg");
  const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
  const variantsBox = document.getElementById("lab-variants");
  const questionEl = document.getElementById("lab-question");
  const verdictEl = document.getElementById("lab-verdict");
  const noteEl = document.getElementById("lab-note");
  if (!svg || !tabs.length) return;

  const NS = "http://www.w3.org/2000/svg";
  const ROWS = 10;

  function el(parent, name, attrs, text) {
    const node = document.createElementNS(NS, name);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (text != null) node.textContent = text;
    parent.appendChild(node);
    return node;
  }

  // Shared layout, rebuilt from the rendered width so text stays at its CSS size.
  function layout(cols, lanes) {
    const W = Math.max(300, svg.parentElement.clientWidth);
    const narrow = W < 560;
    const labelW = narrow ? 56 : 104;
    const bw = (W - labelW - 6) / cols;
    const cell = Math.max(9, Math.min(26, bw * (narrow ? 0.52 : 0.4)));
    const laneH = cell + (narrow ? 12 : 14);
    const top = 30;
    const H = top + lanes * laneH + 26;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("height", H);
    svg.replaceChildren();
    return {
      W, H, narrow, labelW, bw, cell, laneH, top,
      // x of a moment on the clock (bar t opens at t, closes at t + 1/2)
      x: (time) => labelW + (time + 0.25) * bw,
      laneY: (i) => top + i * laneH + laneH / 2,
    };
  }

  function laneLabel(L, i, text) {
    el(svg, "text", { class: "lane", x: L.labelW - 10, y: L.laneY(i) + 4, "text-anchor": "end" }, text);
  }

  function cell(L, cx, cy, state, tip) {
    const s = L.cell;
    const g = el(svg, "g", { class: "cell " + state });
    el(g, "rect", { x: cx - s / 2, y: cy - s / 2, width: s, height: s, rx: 3 });
    if (tip) el(g, "title", {}, tip);
    return g;
  }

  function rowAxis(L, lanes, label) {
    const y = L.top + lanes * L.laneH + 16;
    for (let t = 0; t < ROWS; t++) {
      if (L.narrow && t % 2) continue;
      el(svg, "text", { class: "tick", x: L.x(t + 0.25), y, "text-anchor": "middle" }, t);
    }
    el(svg, "text", { class: "tick", x: L.labelW - 10, y, "text-anchor": "end" }, label || "row");
  }

  function deadline(L, time, lanes, text, anchor) {
    const x = L.x(time);
    el(svg, "line", { class: "deadline", x1: x, x2: x, y1: L.top - 12, y2: L.top + lanes * L.laneH });
    const label = el(svg, "text", { class: "dl-label", x: anchor === "end" ? x - 6 : x + 6, y: L.top - 16, "text-anchor": anchor || "start" }, text);
    // Flip the label to whichever side of the line it fits on.
    const w = label.getComputedTextLength();
    if (anchor !== "end" && x + 6 + w > L.W - 2) {
      label.setAttribute("text-anchor", "end");
      label.setAttribute("x", x - 6);
    } else if (anchor === "end" && x - 6 - w < 2) {
      label.setAttribute("text-anchor", "start");
      label.setAttribute("x", x + 6);
    }
  }

  // ---- the four cases -----------------------------------------------------
  const CASES = {
    when: {
      question: "When is it known? A value is known when the last cell it read is known, and a position must be known strictly before the price it trades at prints.",
      variants: [
        {
          label: "sig entered at today's open",
          entry: 6,
          ok: false,
          grade: "rejected",
          msg: "look-ahead bias: the position of row 6 uses what is known only at the close of row 6, but it must be decided by the close of row 5",
          note: "The signal is today's return, which reads the close of row 6. That close prints half a row after the open of row 6, where the trade happens.",
        },
        {
          label: "sig entered at tomorrow's open",
          entry: 7,
          ok: true,
          grade: "accepted (tradable)",
          note: "The same signal, entered one open later, is tradable: the close of row 6 prints half a row before the open of row 7.",
        },
      ],
      draw(v) {
        const L = layout(ROWS, 2);
        laneLabel(L, 0, "open");
        laneLabel(L, 1, "close");
        const foot = new Set([5, 6]);
        for (let t = 0; t < ROWS; t++) {
          const isEntry = t === v.entry;
          cell(L, L.x(t), L.laneY(0), isEntry ? "mark" : "plain",
            isEntry ? `open of row ${t}: the trade prints here (time ${t})` : `open of row ${t}, known at time ${t}`);
          let state = "plain";
          if (foot.has(t)) state = t + 0.5 < v.entry ? "ok" : "late";
          cell(L, L.x(t + 0.5), L.laneY(1), state,
            `close of row ${t}, known at time ${t}½` + (foot.has(t) ? (state === "ok" ? ": read, known in time" : ": read, known too late") : ""));
        }
        deadline(L, v.entry, 2, `trade at the open of row ${v.entry}`, v.entry > 7 ? "end" : "start");
        rowAxis(L, 2);
      },
    },

    which: {
      question: "Which outcome is it scored on? A forecast's score is contaminated if the cells it was computed from touch the outcome it is scored against.",
      variants: [
        {
          label: "shuffled K-fold, validated",
          train: [0, 1, 3, 6, 7, 8],
          ok: false,
          grade: "rejected",
          msg: "the forecast of row 4 has seen its own outcome: it reads row 5 of `bar.close`, and it is scored on rows 5 to 6",
          note: "Rows 4 and 5 are scored against the next close. Shuffled folds still train on rows 6 to 8, whose inputs are those very closes.",
        },
        {
          label: "purged K-fold, validated",
          train: [0, 1, 2, 3, 8],
          ok: true,
          grade: "accepted (out-of-sample)",
          note: "Purging drops rows 6 and 7, whose cells overlap the scored outcomes. It still trains on row 8, after the test, so it could never have run live: the grade is out-of-sample, not tradable.",
        },
      ],
      draw(v) {
        const L = layout(ROWS, 3);
        laneLabel(L, 0, L.narrow ? "train" : "trained on");
        laneLabel(L, 1, L.narrow ? "scored" : "scored on");
        laneLabel(L, 2, "close");
        const train = new Set(v.train);
        const test = new Set([4, 5]);
        const outcome = new Set([5, 6]); // the forecast of row r is scored on close r + 1
        // A training row i uses closes i-1, i (inputs) and i+1 (its label);
        // a forecast of row r also reads its own inputs, closes r-1 and r.
        const model = new Set();
        train.forEach((i) => [i - 1, i, i + 1].forEach((c) => c >= 0 && c < ROWS && model.add(c)));
        const inputs = new Set();
        test.forEach((i) => [i - 1, i].forEach((c) => inputs.add(c)));
        for (let t = 0; t < ROWS; t++) {
          const tc = L.x(t + 0.25);
          if (train.has(t)) cell(L, tc, L.laneY(0), "role", `row ${t} is in the training folds`);
          if (test.has(t)) cell(L, tc, L.laneY(1), "role", `row ${t} is forecast and scored`);
          let state = "plain";
          let tip = `close of row ${t}`;
          if (model.has(t) && outcome.has(t)) {
            state = "late";
            tip += ": a scored outcome, and the model trained on it";
          } else if (model.has(t) || inputs.has(t)) {
            state = outcome.has(t) ? "ok mark-ring" : "ok";
            tip += outcome.has(t) ? ": a scored outcome, read only as a later row's input" : ": read by the forecasts";
          } else if (outcome.has(t)) {
            state = "mark";
            tip += ": a scored outcome, not read";
          }
          cell(L, tc, L.laneY(2), state, tip);
        }
        rowAxis(L, 3);
      },
    },

    howmany: {
      question: "How many tries was it picked from? A result chosen as the best of K on the outcomes it is reported on is one of K series.",
      variants: [
        {
          label: "chosen on rows 0..499, traded on them",
          trade: "early",
          ok: false,
          grade: "rejected",
          msg: "look-ahead bias: the position of row 1 uses what is known only at the open of row 500, but it must be decided by the close of row 0",
          note: "Picking the best of five tries reads all five results on rows 0 to 499, so the pick is known only at the open of row 500. Trading it on those same rows uses it early.",
        },
        {
          label: "... reported in sample",
          trade: "report",
          ok: true,
          grade: "accepted (in-sample (best of 5))",
          note: "Reported on the rows it was picked on, the result is accepted but graded as the best of 5, so a multiple-testing correction can use K = 5.",
        },
        {
          label: "chosen on rows 0..499, traded from 501",
          trade: "late",
          ok: true,
          grade: "accepted (tradable)",
          note: "Traded only after the pick is known, it is an ordinary tradable strategy.",
        },
      ],
      draw(v) {
        const K = 5, chosen = 2;
        const L = layout(ROWS, K);
        for (let k = 0; k < K; k++) laneLabel(L, k, k === chosen ? (L.narrow ? "try 3 ✓" : "try 3, picked") : `try ${k + 1}`);
        for (let k = 0; k < K; k++) {
          for (let b = 0; b < ROWS; b++) {
            const read = b < 5;
            let state = read ? "ok" : "plain";
            let tip = `try ${k + 1}, rows ${b * 100} to ${b * 100 + 99}` + (read ? ": read by the pick" : "");
            if (k === chosen) {
              const traded = (v.trade === "early" && b < 5) || (v.trade === "late" && b >= 5);
              const reported = v.trade === "report" && b < 5;
              if (traded) {
                state = b < 5 ? "late" : "mark";
                tip += b < 5 ? ", and traded before the pick is known" : ", traded after the pick is known";
              } else if (reported) {
                state = "ok mark-ring";
                tip += ", and reported";
              }
            }
            cell(L, L.x(b + 0.25), L.laneY(k), state, tip);
          }
        }
        deadline(L, 5, K, "pick known at the open of row 500", "start");
        const y = L.top + K * L.laneH + 16;
        [0, 500, 1000].forEach((r) => el(svg, "text", { class: "tick", x: L.x(r / 100), y, "text-anchor": "middle" }, r));
        el(svg, "text", { class: "tick", x: L.labelW - 10, y, "text-anchor": "end" }, "row");
      },
    },

    whatkind: {
      question: "What kind of value is it? A back-adjusted price is the printed price times a factor fixed when the data was downloaded.",
      variants: [
        {
          label: "adj_close < 60",
          level: true,
          ok: false,
          grade: "rejected",
          msg: "look-ahead bias: the position of row 7 uses what is known only at the close of row 999, but it must be decided by the close of row 6",
          note: "A price level like “below $60” depends on the adjustment factor, so it is known only when the data was downloaded, years after the trade.",
        },
        {
          label: "momentum of adj_close returns",
          level: false,
          ok: true,
          grade: "accepted (tradable)",
          note: "In a return the factor cancels, like a unit of measure, so the signal is known as soon as the prices print.",
        },
      ],
      draw(v) {
        const cols = ROWS; // rows 0..7, a gap, then the factor
        const L = layout(cols, 2);
        laneLabel(L, 0, L.narrow ? "close" : "close, printed");
        laneLabel(L, 1, L.narrow ? "factor" : "adj. factor");
        const foot = v.level ? new Set([6]) : new Set([5, 6]);
        for (let t = 0; t < 8; t++) {
          cell(L, L.x(t + 0.5), L.laneY(0), foot.has(t) ? "ok" : "plain",
            `close of row ${t} as printed` + (foot.has(t) ? ": read, known in time" : ""));
        }
        const fx = L.x(9.25);
        el(svg, "text", { class: "tick", x: L.x(8.4), y: L.laneY(0) + 4, "text-anchor": "middle" }, "…");
        cell(L, fx, L.laneY(1), v.level ? "late" : "void",
          v.level ? "adjustment factor, fixed at download: read, known too late" : "adjustment factor: cancels in a return, so not read");
        if (!v.level) el(svg, "line", { class: "strike", x1: fx - L.cell / 2 - 3, x2: fx + L.cell / 2 + 3, y1: L.laneY(1) + L.cell / 2 + 3, y2: L.laneY(1) - L.cell / 2 - 3 });
        deadline(L, 7, 2, "trade at the open of row 7", "end");
        const y = L.top + 2 * L.laneH + 16;
        [0, 2, 4, 6].forEach((t) => el(svg, "text", { class: "tick", x: L.x(t + 0.5), y, "text-anchor": "middle" }, t));
        el(svg, "text", { class: "tick", x: fx, y, "text-anchor": "middle" }, L.narrow ? "dl." : "download");
        el(svg, "text", { class: "tick", x: L.labelW - 10, y, "text-anchor": "end" }, "row");
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
    c.draw(v);
    verdictEl.className = "verdict " + (v.ok ? "is-ok" : "is-bad");
    verdictEl.replaceChildren();
    const head = document.createElement("div");
    head.className = "v-head";
    const icon = document.createElement("span");
    icon.className = "v-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = v.ok ? "✓" : "✕";
    const status = document.createElement("span");
    status.textContent = `${v.label}: ${v.grade}`;
    head.append(icon, status);
    verdictEl.appendChild(head);
    if (v.msg) {
      const code = document.createElement("code");
      code.textContent = v.msg;
      verdictEl.appendChild(code);
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

  let lastW = 0;
  window.addEventListener("resize", () => {
    const w = svg.parentElement.clientWidth;
    if (Math.abs(w - lastW) > 4) { lastW = w; render(); }
  });
  lastW = svg.parentElement.clientWidth;
  renderVariants();
  render();
})();
