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

Each game's archive follows the same toggle: the Wordle, Connections and
Strands calendars (`/games/<game>/archive`) and the Spelling Bee **Past
Puzzles** hub (`/puzzles/spelling-bee/hub`). The shared NYT chrome (game
toolbar and its "More" menu, icon toolbar, modals, masthead) goes dark with
every game.

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

### 4. Spelling Bee — wide layout
NYT caps the board at a 1080px column and centers the hive in it, so on a big
or zoomed-in window the hive sinks below the fold while the sides sit empty.
The wide layout:
- folds the title bar into the toolbar row (one header line instead of three);
- spreads the board across the window (up to 1800px): hints | hive | rank
  and found words side by side from 1100px wide, with the hive in the middle
  of the page; hive | everything else below that;
- centers the hive top to bottom in the window, sizes it to the window
  height, and keeps it there while you scroll;
- lists every found word in balanced columns instead of NYT's paged list.

On by default. Toggle it with the **Wide layout** switch in the game toolbar
(next to Stats) or in the popup. Desktop widths only — under 768px NYT's own
mobile layout takes over.

### 5. Spelling Bee — recent words
Each word you find flashes bee yellow in the word list. Your last four words
stay highlighted, newest brightest: every new find pushes the others down a
step and their tint and underline fade, so the oldest slowly disappears. They're
remembered per puzzle, so a reload still marks them. Turn it off in the popup
(**Highlight recent words**). Reduced-motion settings skip the flash and fades
and keep only the tints.

### 6. Connections — companion hints on the board
A **Hints** switch in the Connections toolbar, next to the lightbulb. Turning
it on reads that puzzle's *Connections Companion* (the article the lightbulb
links to), whose "Need a Hint?" section reveals one word from each group, and
colors those four tiles yellow / green / blue / purple on the board. A
selected tile keeps NYT's selected fill with a ring in its hint color.

The switch stays on for that puzzle across reloads, but the next puzzle starts
with it off. Hide the switch entirely from the popup (**Connections extras**).

## Install (unpacked)

1. Open `brave://extensions` (or `chrome://extensions`).
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked** and select this folder
   (`/Users/saurav/Desktop/NYTChromeExtension`).
4. Open/refresh any NYT game tab. Use the toolbar icon to configure.

> Already-open game tabs need a refresh after install/upgrade.

### Version number
`manifest.json` → `version` is what `chrome://extensions` and the bottom of
the popup show, so you can tell which build Chrome has loaded. Chrome never
changes it itself; bump it with every change: the middle number for a new
feature (1.1.0 → 1.2.0), the last for a fix (1.1.0 → 1.1.1).

## How it works

- `src/darkmode.js` (isolated world) sets `data-nytx-*` attributes on `<html>`;
  the CSS files in `src/styles/` are gated on those attributes.
- NYT paints its shared chrome from its own theme tokens (`--bg-page`,
  `--text`, …) but only switches them to dark on games that support its display
  settings. `common.css` points those tokens at the extension's palette so the
  toolbar, menus and modals follow the Dim / Dark / OLED setting;
  `archive.css` covers the archive calendar and the Spelling Bee hub.
- `src/sb-bridge.js` runs in the **main world** to read `window.gameData`
  (a content script can't see page globals) and posts it to
  `src/spelling-bee.js`, which renders the two helpers and the wide layout's
  toolbar switch and title. The wide layout itself is CSS in
  `spelling-bee.css`, gated on `data-nytx-sb-layout="wide"`.
- `src/connections.js` fetches the Connections Companion (same origin, so
  your subscription cookies come along), reads its four `reveal-block`s and
  sets `data-nytx-hint="<color>"` on the matching tiles; `connections.css`
  paints them.
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
