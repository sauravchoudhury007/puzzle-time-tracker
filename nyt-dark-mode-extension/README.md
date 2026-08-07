# NYT Games Plus

A Brave/Chrome (Manifest V3) extension that adds **per-game dark modes** to the
NYT puzzle games and two **Spelling Bee helpers**.

## Features

### 1. Per-game dark mode
Each game gets its own hand-tuned dark palette (so the highlight colors stay
true to the game), all driven by shared CSS variables:

| Game | Accent kept | Notes |
|------|-------------|-------|
| Spelling Bee | Bee yellow center cell | full board, word list, rank bar |
| Connections | the 4 difficulty colors | dark tiles + light text |
| Strands | blue theme / gold spangram | dark board, light letters |
| The Mini | amber selected, blue highlighted answer | grid + clue lists |
| Wordle | green/yellow tile states | **off by default** (Wordle has native dark mode) |

Configurable from the toolbar popup:
- **Master** on/off and **per-game** on/off
- **Darkness level**: Dim / Dark / OLED black
- **Accent intensity**: Low / Med / High
- Optional floating 🌙 quick-toggle on the page

### 2. Spelling Bee — points to next rank
A line under the ranking bar shows your current rank, current score, and exactly
how many points remain to the next rank — no clicking the rank bar.

### 3. Spelling Bee — hints on the page
A collapsible **Hints** panel computed from the puzzle (no visiting the Hints
page): total words, total points, pangram count, the "word count by length"
grid, and the two-letter list.

Both Spelling Bee numbers are derived from the puzzle's own `gameData` plus the
live score read from the rank bar's `aria-label`, so they update as you play.

## Install (unpacked)

1. Open `brave://extensions` (or `chrome://extensions`).
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked** and select this folder
   (`/Users/saurav/Desktop/NYTChromeExtension`).
4. Open/refresh any NYT game tab. Use the toolbar icon to configure.

> Already-open game tabs need a refresh after install/upgrade.

## How it works

- `src/darkmode.js` (isolated world) sets `data-nytx-*` attributes on `<html>`;
  the CSS files in `src/styles/` are gated on those attributes.
- `src/sb-bridge.js` runs in the **main world** to read `window.gameData`
  (a content script can't see page globals) and posts it to
  `src/spelling-bee.js`, which renders the two helpers.
- Settings live in `chrome.storage.sync`, mirrored to `localStorage` so dark
  mode paints with no flash on load.

## Local testing

The `TestHTML/` folder holds saved copies of real game pages. The
`*_static.html` files are script-stripped versions (the live NYT app would
otherwise tear down the server-rendered board offline). To re-test:

```sh
cd /Users/saurav/Desktop/NYTChromeExtension
python3 -m http.server 8765
# then open e.g. http://localhost:8765/TestHTML/spelling-bee_static.html
```

The extension was verified this way against the real DOM for Spelling Bee,
Connections, Strands, and the Mini.

## Icons

`icons/icon.svg` is the source — a Spelling Bee hexagon in the popup's accent
yellow (`#f7da21`) on a dark tile. Edit the SVG, then re-export:

```sh
for s in 16 32 48 128; do
  inkscape --export-type=png --export-width=$s --export-height=$s \
    --export-filename="icons/icon$s.png" icons/icon.svg
done
```
