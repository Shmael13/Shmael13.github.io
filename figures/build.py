"""Build ../index.html from index.template.html, drawing each project figure as
inline SVG from the data files in this folder (each notes where it came from).

    python3 figures/build.py
"""
import json
import math
import os
from html import escape

HERE = os.path.dirname(os.path.abspath(__file__))
W = 336


def svg(fid, h, title, desc, body, vb_w=W, extra_class=""):
    return (
        f'<svg class="fig-svg {extra_class}" viewBox="0 0 {vb_w} {h}" role="img" '
        f'aria-labelledby="{fid}-t {fid}-d">'
        f'<title id="{fid}-t">{escape(title)}</title><desc id="{fid}-d">{escape(desc)}</desc>'
        f"{body}</svg>"
    )


def bar_path(x0, y, length, thick, r=4):
    """Horizontal bar, square at the baseline, 4px rounded data end."""
    if length <= 0:
        return ""
    r = min(r, length, thick / 2)
    x1 = x0 + length
    return (f'M{x0:.1f},{y:.1f}H{x1 - r:.1f}Q{x1:.1f},{y:.1f} {x1:.1f},{y + r:.1f}'
            f'V{y + thick - r:.1f}Q{x1:.1f},{y + thick:.1f} {x1 - r:.1f},{y + thick:.1f}H{x0:.1f}Z')


# ---------------------------------------------------------------- leakproof
def fig_leakproof():
    # Techniques from the paper's benchmark table, named in plain words.
    rows = [
        ("leakproof", 78, True),
        ("Re-run hiding the future, at every day", 68, False),
        ("Same, at 25 random days", 61.4, False),
        ("Linters that look for look-ahead", 18, False),
        ("Flag any Sharpe ratio above 5", 14, False),
        ("Hold out the last 30% of days", 8, False),
        ("Point-in-time database", 8, False),
        ("ML data-leakage detectors", 0, False),
    ]
    pitch, thick, top = 33, 8, 2
    x0, x1 = 0, W
    scale = (x1 - x0) / 78
    h = top + pitch * len(rows)
    parts = []
    for i, (name, v, hl) in enumerate(rows):
        y = top + i * pitch
        by = y + 17
        cls = "s1" if hl else "bar-muted"
        shown = f"{v:g}"
        missed = 78 - v
        tip = f"{name}: caught {shown} of 78 leaks" + (f", missed {missed:g}" if missed else "")
        parts.append(f'<g><title>{escape(tip)}</title>'
                     f'<rect class="hit" x="0" y="{y}" width="{W}" height="{pitch}"/>'
                     f'<text class="lbl{" strong" if hl else ""}" x="{x0}" y="{y + 11}">{escape(name)}</text>'
                     f'<text class="val" x="{x1}" y="{y + 11}" text-anchor="end">{shown}</text>'
                     f'<rect class="track" x="{x0}" y="{by}" width="{x1 - x0}" height="{thick}" rx="2"/>'
                     f'<path class="{cls}" d="{bar_path(x0, by, v * scale, thick, r=2)}"/></g>')
    desc = "; ".join(f"{n}: {v:g} of 78" for n, v, _ in rows)
    return svg("fig-lp", h, "Leaks caught out of 78, by technique", desc, "".join(parts))


# ---------------------------------------------------------------- market sim
def nice_ticks(lo, hi, n=3):
    span = hi - lo
    step = 10 ** math.floor(math.log10(span / n))
    for m in (1, 2, 2.5, 5, 10):
        if span / (step * m) <= n + 0.5:
            step *= m
            break
    start = math.floor(lo / step) * step
    ticks, t = [], start
    while t <= hi + 1e-9:
        ticks.append(round(t, 6))
        t += step
    if ticks[-1] < hi:
        ticks.append(round(t, 6))
    return ticks


def fig_market():
    prices = json.load(open(os.path.join(HERE, "market_prices.json")))["prices"]
    h = 180
    L, R, T, B = 30, 44, 10, 22
    yt = nice_ticks(min(prices), max(prices))
    lo, hi = yt[0], yt[-1]
    n = len(prices)
    x = lambda i: L + i * (W - L - R) / (n - 1)
    y = lambda p: T + (hi - p) * (h - T - B) / (hi - lo)
    parts = []
    for t in yt:
        parts.append(f'<line class="grid" x1="{L}" x2="{W - R}" y1="{y(t):.1f}" y2="{y(t):.1f}"/>'
                     f'<text class="tick" x="{L - 6}" y="{y(t) + 4:.1f}" text-anchor="end">{t:g}</text>')
    for t in (0, 100, 200, 300):
        parts.append(f'<text class="tick" x="{x(min(t, n - 1)):.1f}" y="{h - 6}" text-anchor="middle">{t}</text>')
    d = "M" + "L".join(f"{x(i):.1f},{y(p):.1f}" for i, p in enumerate(prices))
    parts.append(f'<path class="line s1-stroke" d="{d}"/>')
    parts.append(f'<circle class="dot s1" cx="{x(n - 1):.1f}" cy="{y(prices[-1]):.1f}" r="4"/>')
    parts.append(f'<text class="val" x="{x(n - 1) + 8:.1f}" y="{y(prices[-1]) + 4:.1f}">{prices[-1]:.1f}</text>')
    hover = "".join(
        f'<rect class="hit" x="{x(i) - (W - L - R) / (n - 1) * 5:.1f}" y="{T}" width="{(W - L - R) / (n - 1) * 10:.1f}" height="{h - T - B}">'
        f'<title>tick {i}: price {prices[i]:.2f}</title></rect>' for i in range(0, n, 10))
    parts.append(hover)
    desc = f"Price starts at {prices[0]:.1f}, peaks at {max(prices):.1f} and ends at {prices[-1]:.1f} after {n} ticks."
    return svg("fig-mk", h, "Stock price by tick", desc, "".join(parts))


# ---------------------------------------------------------------- COMP 559
def fig_comp559():
    edges = json.load(open(os.path.join(HERE, "comp559_edges.json")))["edges"]
    cnt = {(e["from"], e["to"]): e["messages"] for e in edges}
    mean_nli = {(e["from"], e["to"]): e["mean_nli"] for e in edges}
    h = 214
    pos = {"regulator": (168, 104), "libertarian": (54, 34), "pragmatist": (282, 34), "skeptic": (168, 186)}
    agents = list(pos)
    parts = []
    # unused edges first (hairlines between the outer three)
    outer = ["libertarian", "pragmatist", "skeptic"]
    for i in range(3):
        for j in range(i + 1, 3):
            a, b = outer[i], outer[j]
            assert (a, b) not in cnt and (b, a) not in cnt
            (x1, y1), (x2, y2) = pos[a], pos[b]
            parts.append(f'<line class="edge-unused" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">'
                         f'<title>{a} and {b}: no messages either way</title></line>')

    def arc(a, b, bend):
        (x1, y1), (x2, y2) = pos[a], pos[b]
        dx, dy = x2 - x1, y2 - y1
        dist = math.hypot(dx, dy)
        ux, uy = dx / dist, dy / dist
        # shorten to stop outside node circles
        sx, sy = x1 + ux * 11, y1 + uy * 11
        ex, ey = x2 - ux * 13, y2 - uy * 13
        mx, my = (sx + ex) / 2 - uy * bend, (sy + ey) / 2 + ux * bend
        return f"M{sx:.1f},{sy:.1f}Q{mx:.1f},{my:.1f} {ex:.1f},{ey:.1f}"

    for other in outer:
        for a, b in (("regulator", other), (other, "regulator")):
            n, mean = cnt[(a, b)], mean_nli[(a, b)]
            parts.append(f'<path class="edge" d="{arc(a, b, 9)}" marker-end="url(#arr)">'
                         f'<title>{a} to {b}: {n} messages, mean NLI score {mean:+.2f}</title></path>')
    for a in agents:
        x, y = pos[a]
        anchor, tx = "middle", x
        ty = y - 12 if y < 100 else y + 20
        if a == "regulator":  # the east side of the hub is free of arrows
            anchor, tx, ty = "start", x + 13, y + 4
        parts.append(f'<circle class="node{" node-hub" if a == "regulator" else ""}" cx="{x}" cy="{y}" r="7"><title>{a}</title></circle>'
                     f'<text class="lbl{" strong" if a == "regulator" else ""}" x="{tx}" y="{ty}" text-anchor="{anchor}">{a}</text>')
    defs = ('<defs><marker id="arr" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="7" markerHeight="7" '
            'orient="auto-start-reverse"><path class="arrowhead" d="M0,0L8,4L0,8z"/></marker></defs>')
    used = sum(1 for k, v in cnt.items() if v)
    total = sum(cnt.values())
    desc = (f"Four agents, fully connected. {total} messages used {used} of 12 directed edges, all touching the regulator: "
            + "; ".join(f"{a} to {b}: {v}" for (a, b), v in sorted(cnt.items())))
    return svg("fig-559", h, "Who talked to whom in the 80-round debate", desc, defs + "".join(parts))


# ---------------------------------------------------------------- COMP 584
def fig_comp584():
    hist = json.load(open(os.path.join(HERE, "comp584_history.json")))
    steps, train, val = hist["steps"], hist["train"], hist["val"]
    h = 190
    L, R, T, B = 34, 58, 26, 22
    x = lambda s: L + s * (W - L - R) / 20000
    y = lambda v: T + (1 - v) * (h - T - B)
    parts = []
    for v in (0, 0.5, 1.0):
        parts.append(f'<line class="grid" x1="{L}" x2="{W - R}" y1="{y(v):.1f}" y2="{y(v):.1f}"/>'
                     f'<text class="tick" x="{L - 6}" y="{y(v) + 4:.1f}" text-anchor="end">{int(v * 100)}%</text>')
    for s in (0, 10000, 20000):
        parts.append(f'<text class="tick" x="{x(s):.1f}" y="{h - 6}" text-anchor="middle">{s // 1000}k</text>')
    parts.append(f'<line class="ref" x1="{L}" x2="{W - R}" y1="{y(0.125):.1f}" y2="{y(0.125):.1f}"/>'
                 f'<text class="tick" x="{W - R + 6}" y="{y(0.125) + 4:.1f}">chance</text>')
    pts = lambda vals: "M" + "L".join(f"{x(s):.1f},{y(v):.1f}" for s, v in zip(steps, vals))
    parts.append(f'<path class="line s2-stroke" d="{pts(train)}"/>')
    parts.append(f'<path class="line s1-stroke" d="{pts(val)}"/>')
    i = max(range(len(val)), key=lambda k: val[k])
    parts.append(f'<circle class="dot s1" cx="{x(steps[i]):.1f}" cy="{y(val[i]):.1f}" r="4"/>'
                 f'<text class="val" x="{x(steps[i]):.1f}" y="{y(val[i]) + 18:.1f}" text-anchor="middle">{val[i] * 100:.1f}%</text>')
    parts.append(f'<text class="lbl" x="{W - R + 6}" y="{y(train[-1]) - 2:.1f}">train</text>'
                 f'<text class="lbl" x="{W - R + 6}" y="{y(val[-1]) + 10:.1f}">held-out</text>')
    # legend row
    parts.append(f'<g class="legend"><line class="s1-stroke line" x1="{L}" x2="{L + 14}" y1="9" y2="9"/>'
                 f'<text class="lbl" x="{L + 19}" y="13">held-out objects</text>'
                 f'<line class="s2-stroke line" x1="{L + 124}" x2="{L + 138}" y1="9" y2="9"/>'
                 f'<text class="lbl" x="{L + 143}" y="13">training objects</text></g>')
    step_w = (W - L - R) / len(steps)
    parts.append("".join(
        f'<rect class="hit" x="{x(s) - step_w / 2:.1f}" y="{T}" width="{step_w:.1f}" height="{h - T - B}">'
        f'<title>step {s:,}: held-out {v * 100:.1f}%, train {t * 100:.1f}%</title></rect>'
        for s, v, t in zip(steps, val, train)))
    desc = (f"Held-out accuracy rises to {val[i] * 100:.1f}% at step {steps[i]:,} and ends at {val[-1] * 100:.1f}% "
            f"at step {steps[-1]:,}; training accuracy ends at {train[-1] * 100:.1f}%. Chance is 12.5%.")
    return svg("fig-584", h, "Referential game accuracy over training", desc, "".join(parts))


# ---------------------------------------------------------------- ELEC 537
def fig_elec537():
    groups = [
        ("Classical, 14 window features", "s1", [("kNN", 0.93), ("Logistic reg.", 0.91), ("Random forest", 0.87), ("SVM", 0.82)]),
        ("Deep, raw sequences", "s2", [("1D CNN", 0.82), ("CNN-LSTM", 0.82), ("GRU", 0.80), ("LSTM", 0.71)]),
    ]
    L, R = 92, 36
    lo, hi = 0.5, 1.0
    x = lambda v: L + (v - lo) * (W - L - R) / (hi - lo)
    pitch, head = 17, 20
    parts, yy = [], 4
    rows_y = []
    for gname, cls, rows in groups:
        parts.append(f'<circle class="dot {cls}" cx="{L - 84}" cy="{yy + 9}" r="4"/>'
                     f'<text class="lbl strong" x="{L - 76}" y="{yy + 13}">{escape(gname)}</text>')
        yy += head
        for name, v in rows:
            cy = yy + pitch / 2
            rows_y.append(cy)
            parts.append(f'<g><title>{escape(name)}: {v * 100:.0f}% accuracy</title>'
                         f'<rect class="hit" x="0" y="{yy}" width="{W}" height="{pitch}"/>'
                         f'<line class="grid" x1="{L}" x2="{W - R}" y1="{cy}" y2="{cy}"/>'
                         f'<text class="lbl" x="{L - 8}" y="{cy + 4}" text-anchor="end">{escape(name)}</text>'
                         f'<circle class="dot {cls}" cx="{x(v):.1f}" cy="{cy}" r="4.5"/>'
                         f'<text class="val" x="{x(v) + 9:.1f}" y="{cy + 4}">{v * 100:.0f}%</text></g>')
            yy += pitch
        yy += 6
    top, bottom = rows_y[0] - pitch / 2, rows_y[-1] + pitch / 2
    h = yy + 34
    base = 0.59
    parts.insert(0, f'<line class="ref" x1="{x(base):.1f}" x2="{x(base):.1f}" y1="{top - 2}" y2="{bottom + 16}"/>')
    parts.append(f'<text class="tick" x="{x(base) + 5:.1f}" y="{bottom + 27}">always guessing "sleeping": 59%</text>')
    for t in (0.5, 0.75, 1.0):
        parts.append(f'<text class="tick" x="{x(t):.1f}" y="{bottom + 13}" text-anchor="middle">{int(t * 100)}%</text>')
    desc = "; ".join(f"{n}: {v * 100:.0f}%" for _, _, rows in groups for n, v in rows) + "; always predicting sleeping: 59%."
    return svg("fig-537", h, "Accuracy on 91 held-out windows", desc, "".join(parts))


# ---------------------------------------------------------------- particles
def fig_particles():
    pts = json.load(open(os.path.join(HERE, "particles.json")))["particles"]
    body = [f'<rect class="world" x="0" y="0" width="700" height="700" rx="10"/>']
    for x, y, t in pts:
        body.append(f'<circle class="p{t}" cx="{x:.0f}" cy="{y:.0f}" r="4.2"/>')
    desc = "800 particles of 8 types after 900 frames; most have gathered into small mixed-type clusters."
    return svg("fig-pl", 700, "Particle positions after 900 frames", desc, "".join(body), vb_w=700, extra_class="fig-square")


FIGS = {
    "leakproof": fig_leakproof,
    "market": fig_market,
    "comp559": fig_comp559,
    "comp584": fig_comp584,
    "elec537": fig_elec537,
    "particles": fig_particles,
}

if __name__ == "__main__":
    src = os.path.join(HERE, "index.template.html")
    dst = os.path.join(HERE, os.pardir, "index.html")
    html = open(src).read()
    for name, fn in FIGS.items():
        marker = f"<!--FIG:{name}-->"
        assert marker in html, marker
        html = html.replace(marker, fn())
    open(dst, "w").write(html)
    print("wrote", dst)
