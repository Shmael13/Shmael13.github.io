# Shmael13.github.io

Source for my portfolio site at <https://shmael13.github.io>.

It's a single static page styled as a retro desktop: each project opens in a different era of computing (a classic Mac, an 80s amber terminal, Windows 95, and a 70s lab manual).

- **leakproof** has a "Spot the leak" walkthrough: four ways a backtest peeks at the future, each as a short code sketch, a one-arrow timeline, and the verdict, with a toggle to show the fix.
- Every project has a figure drawn from that project's own data, and every headline number says what it was computed from.

## Layout

```
index.html              the page (generated; edit figures/index.template.html)
style.css               the four era themes; figures read each era's colour variables
lab.js                  the "Spot the leak" walkthrough
img/                    SVD reconstructions (WebP)
figures/build.py        draws the project figures as inline SVG into index.html
figures/*.json          the data behind each figure; each file names its source
```

To rebuild after editing the template or the data:

```
python3 figures/build.py
```

To preview locally, open `index.html` in a browser or run `python3 -m http.server` in this folder.
