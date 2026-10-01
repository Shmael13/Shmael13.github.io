# Shmael13.github.io

Source for my portfolio site at <https://shmael13.github.io>.

It's a single static page styled as a retro desktop: each project opens in a different era of computing (a classic Mac, an 80s amber terminal, Windows 95, and a 70s lab manual).

- **leakproof** has a "Spot the leak" walkthrough: four ways a backtest peeks at the future, each as a short code sketch, an animated one-arrow timeline, and the verdict, with a toggle to show the fix.
- Every project has a live figure built from that project's own data, written for someone who has never seen the project:
  - a replay of the real LLM-agent debate log, message by message;
  - the language two neural networks invented, one made-up word per object;
  - a chart recorder drawing real accelerometer traces for walking and sleeping;
  - the market simulation's price, round by round;
  - a particle-life world running in the browser with the simulator's rules;
  - a slider that rebuilds an image from more or fewer SVD patterns.
- Every headline number says what it was computed from. Animations pause when off screen and respect the reduced-motion setting.

## Layout

```
index.html              the page (generated; edit figures/index.template.html)
style.css               the four era themes; figures read each era's colour variables
lab.js                  the "Spot the leak" walkthrough
viz.js                  the live figures
data.js                 their data (generated from figures/*.json)
img/                    SVD reconstructions at 13 ranks (WebP)
figures/build.py        writes index.html (with static fallback figures) and data.js
figures/*.json          the data behind each figure; each file names its source
```

To rebuild after editing the template or the data:

```
python3 figures/build.py
```

To preview locally, open `index.html` in a browser or run `python3 -m http.server` in this folder.
