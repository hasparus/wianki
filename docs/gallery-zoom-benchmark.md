# Gallery zoom: DOM versus React Three Fiber

The gallery grid zooms the way Apple Photos does: square plates at several
column counts, pinch or trackpad to change the level, the photograph under the
fingers stays put, one column shows every photo in its own aspect. Before
building it, two rendering approaches were benchmarked on the same layout
model with the same scripted input: React DOM (absolutely positioned
`<img>` plates, transforms for the transition) and React Three Fiber (one
textured plane per plate in a WebGL canvas, the DOM scroller only for
scrolling). The harness lives in `scripts/bench/gallery-zoom`.

## Verdict

The DOM grid with CSS-transition FLIP (`dom-css`) ships. The numbers are
below; the reasons hold beyond them:

- **Time to first plates.** The DOM shows decoded images in well under a
  second. R3F waits for textures: full-size uploads with mipmaps took over
  ten seconds on the phone profile, and even 512px downsized textures took
  several seconds, because every photo has to be decoded, resized and
  uploaded before it can be drawn at all.
- **Stalls.** R3F zooming to a denser level uploads dozens of new textures in
  one go; the worst frame ran into seconds with full-size textures. The DOM's
  worst frames are image decodes, which the browser schedules off the main
  thread and paints progressively.
- **Memory.** A 1920×1440 RGBA texture with mipmaps is about 14 MB of GPU
  memory; a few hundred plates exceed what a phone browser will keep before
  losing the WebGL context. The DOM's decoded-image cache is managed by the
  browser and degrades gracefully.
- **What the DOM gives for free.** `next/image` blur placeholders, native lazy
  loading, focus rings, screen-reader plates, text zoom, a lightbox that
  reuses the already decoded image, and no second dependency tree (three +
  fiber is roughly 700 KB of JavaScript before gzip).

Where R3F is better, honestly: with every texture already resident it holds a
flat 16.7 ms during a live pinch, because it moves a camera instead of
touching layout, and on the phone profile its scroll after warm-up (p95 100
ms, mean 25 ms) is a little smoother than the DOM's (p95 133 ms, mean 33 ms).
The first costs twelve seconds of blank plates before it applies; the second
is the same image-decode cost both sides pay, only paid up front. The DOM
answer to the pinch is the same trick, one `transform: scale()` on the grid
container during the gesture, which the compositor runs without layout.

Between the two DOM drivers, CSS transitions beat per-frame transform writes
on every zoom scenario (phone zoom p95 50 ms versus 167 ms; throttled 133 ms
versus 217 ms; desktop 67 ms versus 117 ms), because the compositor keeps
animating while the main thread decodes the newly visible images.

The DOM's remaining jank is image decode: every plate loads the same 1920px
derivative whatever its size on screen. A smaller thumbnail derivative would
cut the scroll and zoom stalls for the DOM grid too; it is the next lever,
not a renderer change.

## Caveats

- The container has no GPU. Chromium ran WebGL on SwiftShader (software
  ANGLE/Vulkan), so absolute R3F frame times are pessimistic. Texture decode,
  resize and upload cost, and the time-to-first-plates gap, are CPU work on a
  phone too.
- DOM raster also ran in software. Both sides are handicapped the same way;
  the comparison is fair, the absolute numbers are not phone numbers.
- Frame intervals are `requestAnimationFrame` deltas, so a compositor-only
  stall that the main thread never sees is under-counted for `dom-css`. The
  CDP main-thread totals are the more conservative column.

## Method

1500 plates over 160 unique synthetic 1920px JPEGs (~350 KB each, noisy
gradients so decode cost resembles photographs); unique query strings so no
two plates share a decoded image. Phone profile 390×844 at 3×, the same with
4× CPU throttling, and desktop 1280×800 at 2×. Each renderer runs the same
in-page script: 4 s of scrolling at 1200 px/s, a cycle of animated zoom-level
changes, and two pinches (40 frames of live scale, then a snap). Three runs
each, medians reported. Columns: ready = ms until every plate of the first
viewport has decoded; frames = animation frames observed; mean/p50/p95/max =
frame interval in ms; >20 ms and >34 ms = frames longer than that;
main-thread/script/layout/style = CDP durations in ms over the scenario;
heap = JS heap in MB after it.

## Results

### phone (390×844 @3x)

| impl | ready ms | scenario | frames | mean | p50 | p95 | max | >20ms | >34ms | main-thread ms | script ms | layout ms | style ms | heap MB |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| dom-css | 689 | scroll | 127 | 33.5 | 16.7 | 133.3 | 216.6 | 22 | 22 | 3046 | 2381 | 32 | 10 | 4.1 |
| dom-css | 689 | zoom | 96 | 32.1 | 16.7 | 50.1 | 766.7 | 10 | 6 | 2244 | 43 | 8 | 84 | 4.9 |
| dom-css | 689 | pinchIn | 51 | 37.9 | 16.7 | 66.7 | 533.2 | 10 | 5 | 1388 | 7 | 2 | 9 | 4.2 |
| dom-css | 689 | pinchOut | 77 | 16.7 | 16.7 | 16.7 | 16.8 | 0 | 0 | 115 | 12 | 2 | 23 | 4.8 |
| dom-raf | 599 | scroll | 147 | 28.2 | 16.7 | 133.3 | 200.1 | 23 | 20 | 2695 | 1946 | 30 | 13 | 4.1 |
| dom-raf | 599 | zoom | 66 | 52.5 | 16.7 | 166.6 | 1066.6 | 22 | 14 | 3210 | 58 | 9 | 66 | 4.4 |
| dom-raf | 599 | pinchIn | 52 | 38.8 | 16.7 | 50.1 | 616.7 | 12 | 3 | 1380 | 7 | 2 | 7 | 4.8 |
| dom-raf | 599 | pinchOut | 74 | 17.3 | 16.7 | 16.8 | 50 | 2 | 1 | 245 | 18 | 2 | 21 | 4.6 |
| r3f-full | 11873 | scroll | 163 | 25.3 | 16.7 | 100 | 133.4 | 33 | 13 | 4222 | 282 | 0 | 0 | 8.3 |
| r3f-full | 11873 | zoom | 100 | 75.5 | 16.7 | 16.8 | 4966.5 | 4 | 3 | 7501 | 1443 | 0 | 0 | 9 |
| r3f-full | 11873 | pinchIn | 76 | 16.7 | 16.7 | 16.7 | 16.8 | 0 | 0 | 1221 | 33 | 0 | 0 | 10.6 |
| r3f-full | 11873 | pinchOut | 76 | 16.7 | 16.7 | 16.8 | 16.8 | 0 | 0 | 1210 | 26 | 0 | 0 | 10.4 |
| r3f-512 | 3794 | scroll | 63 | 64.8 | 50.1 | 116.7 | 133.3 | 59 | 41 | 4267 | 280 | 0 | 0 | 13.4 |
| r3f-512 | 3794 | zoom | 57 | 54.1 | 33.4 | 133.3 | 216.6 | 40 | 26 | 3076 | 124 | 0 | 0 | 10.6 |
| r3f-512 | 3794 | pinchIn | 77 | 30.3 | 16.7 | 116.6 | 133.3 | 18 | 12 | 2360 | 43 | 0 | 0 | 8.6 |
| r3f-512 | 3794 | pinchOut | 77 | 16.7 | 16.7 | 16.7 | 16.8 | 0 | 0 | 1319 | 28 | 0 | 0 | 11.1 |

### phone-4x (390×844 @3x, CPU 4× slower)

| impl | ready ms | scenario | frames | mean | p50 | p95 | max | >20ms | >34ms | main-thread ms | script ms | layout ms | style ms | heap MB |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| dom-css | 881 | scroll | 140 | 30.1 | 16.7 | 116.6 | 350 | 36 | 17 | 3486 | 1216 | 132 | 35 | 3.9 |
| dom-css | 881 | zoom | 83 | 39.9 | 16.7 | 133.4 | 666.6 | 16 | 10 | 2706 | 172 | 25 | 292 | 5 |
| dom-css | 881 | pinchIn | 51 | 37.3 | 16.7 | 50.1 | 499.9 | 16 | 6 | 1407 | 30 | 13 | 32 | 4.7 |
| dom-css | 881 | pinchOut | 63 | 20.9 | 16.7 | 16.8 | 200.1 | 3 | 3 | 615 | 56 | 7 | 69 | 4.3 |
| dom-raf | 876 | scroll | 115 | 36.5 | 16.7 | 116.6 | 316.6 | 40 | 25 | 3799 | 1353 | 109 | 51 | 4.1 |
| dom-raf | 876 | zoom | 63 | 52.6 | 16.7 | 216.7 | 783.3 | 22 | 15 | 3287 | 197 | 28 | 174 | 4.4 |
| dom-raf | 876 | pinchIn | 51 | 36.5 | 16.7 | 50 | 616.7 | 8 | 4 | 1317 | 22 | 9 | 27 | 4.9 |
| dom-raf | 876 | pinchOut | 69 | 18.8 | 16.7 | 33.4 | 50 | 7 | 2 | 485 | 59 | 10 | 69 | 5.8 |
| r3f-full | 19545 | scroll | 36 | 115.3 | 100 | 249.9 | 250 | 36 | 36 | 4327 | 537 | 0 | 0 | 8.1 |
| r3f-full | 19545 | zoom | 49 | 99.3 | 49.9 | 133.3 | 2416.5 | 49 | 25 | 4906 | 1605 | 2 | 1 | 9.1 |
| r3f-full | 19545 | pinchIn | 56 | 37.6 | 33.4 | 50 | 50.1 | 56 | 14 | 2178 | 125 | 0 | 0 | 10.2 |
| r3f-full | 19545 | pinchOut | 57 | 36.8 | 33.3 | 50 | 50.1 | 57 | 12 | 2206 | 94 | 0 | 0 | 9.1 |
| r3f-512 | 11130 | scroll | 31 | 162.9 | 166.6 | 200 | 200 | 31 | 31 | 5382 | 603 | 0 | 0 | 7.4 |
| r3f-512 | 11130 | zoom | 112 | 164.4 | 166.6 | 200 | 283.4 | 112 | 112 | 19946 | 537 | 1 | 1 | 7.7 |
| r3f-512 | 11130 | pinchIn | 55 | 85.8 | 50 | 183.3 | 183.3 | 55 | 34 | 4835 | 130 | 0 | 1 | 6.9 |
| r3f-512 | 11130 | pinchOut | 55 | 39.4 | 33.4 | 50.1 | 50.1 | 55 | 20 | 2297 | 109 | 0 | 0 | 7.5 |

### desktop (1280×800 @2x)

| impl | ready ms | scenario | frames | mean | p50 | p95 | max | >20ms | >34ms | main-thread ms | script ms | layout ms | style ms | heap MB |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| dom-css | 366 | scroll | 160 | 25.5 | 16.7 | 50.1 | 150 | 41 | 27 | 2673 | 2203 | 10 | 4 | 4.3 |
| dom-css | 366 | zoom | 98 | 42.3 | 16.7 | 66.6 | 1400 | 6 | 6 | 2703 | 25 | 7 | 45 | 4.8 |
| dom-css | 366 | pinchIn | 68 | 19.6 | 16.7 | 16.8 | 99.9 | 3 | 3 | 277 | 6 | 1 | 11 | 5.1 |
| dom-css | 366 | pinchOut | 77 | 16.7 | 16.7 | 16.8 | 16.8 | 0 | 0 | 60 | 9 | 1 | 13 | 5.4 |
| dom-raf | 423 | scroll | 141 | 29.2 | 16.7 | 83.2 | 149.9 | 44 | 27 | 2833 | 2404 | 9 | 5 | 5.3 |
| dom-raf | 423 | zoom | 94 | 39.2 | 16.7 | 116.7 | 716.5 | 13 | 10 | 2385 | 260 | 4 | 41 | 4.5 |
| dom-raf | 423 | pinchIn | 66 | 19.7 | 16.7 | 33.2 | 100 | 4 | 3 | 264 | 6 | 1 | 9 | 4.4 |
| dom-raf | 423 | pinchOut | 77 | 16.7 | 16.7 | 16.8 | 16.8 | 0 | 0 | 57 | 11 | 1 | 13 | 4.5 |
| r3f-full | 5724 | scroll | 123 | 33.5 | 33.2 | 133.4 | 166.6 | 62 | 11 | 4302 | 144 | 0 | 0 | 6.5 |
| r3f-full | 5724 | zoom | 85 | 81.6 | 16.7 | 33.4 | 4116.5 | 29 | 3 | 6989 | 1159 | 0 | 0 | 7.6 |
| r3f-full | 5724 | pinchIn | 69 | 21.5 | 16.7 | 33.4 | 33.4 | 20 | 0 | 1547 | 26 | 0 | 0 | 7.5 |
| r3f-full | 5724 | pinchOut | 68 | 21.5 | 16.7 | 33.4 | 33.4 | 20 | 0 | 1525 | 21 | 0 | 0 | 8.1 |
| r3f-512 | 2485 | scroll | 62 | 67.2 | 50.1 | 150 | 150 | 62 | 47 | 4350 | 148 | 0 | 0 | 8 |
| r3f-512 | 2485 | zoom | 71 | 40.1 | 33.3 | 100 | 400 | 42 | 14 | 2872 | 78 | 0 | 0 | 7.9 |
| r3f-512 | 2485 | pinchIn | 67 | 22.8 | 16.7 | 33.4 | 33.4 | 24 | 0 | 1591 | 25 | 0 | 0 | 9.6 |
| r3f-512 | 2485 | pinchOut | 66 | 23 | 16.7 | 33.4 | 33.4 | 25 | 0 | 1583 | 22 | 0 | 0 | 8.1 |

