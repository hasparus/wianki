# Gallery zoom benchmark

Standalone harness behind `docs/gallery-zoom-benchmark.md`. It is not part of
the app build: it has its own `package.json` and is excluded from the root
`tsconfig.json`.

Three renderers of the same Apple Photos-like grid (square plates at zoomable
column counts, one column with natural aspect, virtualised, focal-point
anchored zoom) share `src/layout.ts`:

- `dom-css`: absolutely positioned `<img>` plates, FLIP with CSS transitions.
- `dom-raf`: same plates, transforms written every animation frame.
- `r3f-full`: React Three Fiber, one textured plane per plate, full-size
  textures with mipmaps.
- `r3f-512`: same, textures downsized to 512px through `createImageBitmap`
  before upload.

```sh
cd scripts/bench/gallery-zoom
npm install
npm run images     # 160 synthetic 1920px JPEGs into public/img (needs sharp)
npm run build
CHROMIUM_PATH=/path/to/chrome RUNS=3 N=1500 npm run bench
```

`CHROMIUM_PATH` is optional when Playwright's own Chromium is installed. The
run prints one Markdown table per viewport into `results.md` and the raw
medians into `results.json`.

Scenarios, driven in-page so every renderer gets identical input:

- `scroll`: 4 s of programmatic scrolling at 1200 px/s.
- `zoom`: a cycle of animated zoom-level changes.
- `pinchIn` / `pinchOut`: 40 frames of live scaling, then a snap.

Metrics are `requestAnimationFrame` intervals (mean, p50, p95, max, frames
over 20 ms and over 34 ms) plus Chrome DevTools Protocol counters over each
scenario (main-thread task time, script, layout, style, JS heap) and the time
until every plate of the first viewport has decoded.
