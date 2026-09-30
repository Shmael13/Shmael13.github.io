# Shmael13.github.io

Source for my portfolio site at <https://shmael13.github.io>.

It's a single static page with no framework and no build step at load time.

- The hero is an interactive walk through [leakproof](https://github.com/Shmael13/leakproof)'s four questions (when, which, how many, what kind). Each question is shown on a small case as written and as corrected, drawing the cells the result was computed from and the checker's verdict.
- Each project has a figure drawn from that project's own data: benchmark results, a market simulation run, an agent conversation log, training history, model accuracies, SVD reconstructions and a particle simulation snapshot.

## Layout

```
index.html              the page (generated; edit figures/index.template.html)
style.css               styles, including light and dark chart colours
lab.js                  the leakproof explorer
img/                    SVD reconstructions (WebP)
figures/build.py        draws the project figures as inline SVG into index.html
figures/*.json          the data behind each figure; each file names its source
```

To rebuild after editing the template or the data:

```
python3 figures/build.py
```

To preview locally, open `index.html` in a browser or run `python3 -m http.server` in this folder.
