# NYT Mini Timer Peek (Chrome Extension)

Small MV3 extension that reads the timer on an open NYT Mini tab, and logs your
time to the tracker automatically when you finish the puzzle.

## How to install locally

1) In Chrome, open `chrome://extensions`.
2) Toggle **Developer mode** (top right).
3) Click **Load unpacked** and select the `nyt-mini-timer-extension` folder in this repo.
4) Pin the extension if you want quick access.

After reloading the extension, reload any NYT Mini tab that was already open —
otherwise the content script isn't running in it yet.

## How to use

1) First run only: open the popup and set **API URL** to your deployed
   `/api/auto-log` endpoint, then hit **Save settings**. It defaults to
   `http://localhost:3000/api/auto-log`, and the value you save lives in
   `chrome.storage.local` — the deployed hostname is deliberately not in this repo.
2) Open the NYT Mini — either today's puzzle (`https://www.nytimes.com/crosswords/game/mini`)
   or an archive one (`.../game/mini/2026/08/04`) — and solve as usual.
3) Keep a tab open on the tracker (your deployed site or `http://localhost:3000`)
   while you play, signed in. The extension reads your Supabase `access_token`
   from it; those tokens expire after about an hour, so a signed-in tab is what
   makes automatic logging work.
4) When you solve, the extension POSTs the time to `/api/auto-log` on its own and
   shows a ✓ badge on the toolbar icon. A ! badge means it couldn't send — open
   the popup to see why.
5) Open the popup any time to see the current timer and puzzle date, or to submit
   manually with **Refresh** then **Submit**. Manual date/time fields override
   what was read from the page.

## How it works

- `content.js` polls the on-page timer once a second, so the final time survives
  NYT removing the timer when the congrats dialog appears. It resolves the puzzle
  date from the URL, then the date printed on the page, then today.
- `background.js` owns the token lookup and every POST, so manual and automatic
  submissions take the same path. A solve that can't be sent (no signed-in tracker
  tab, expired token) is queued and retried when a tracker tab loads or when you
  open the popup.
- `popup.js` is just the UI — it asks the content script for the timer and hands
  submissions to the background worker.

## Notes

- Works on `https://www.nytimes.com/crosswords/game/mini*`, which covers both
  today's puzzle and dated archive URLs.
- Each date is auto-logged once. The API also returns `already_logged` if the day
  already has an entry, so a manual re-submit can't create duplicates.
- The API only accepts requests from allow-listed origins, including this
  extension's ID. If you load the folder from a new path Chrome assigns a new ID,
  and you'll get `403 Origin not allowed` until it's added to `allowedOrigins` in
  `src/app/api/auto-log/route.ts`.
- Data you enter (token/API URL) is saved in `chrome.storage.local` inside the
  extension. The timer is read from the active tab and POSTed only when a token
  is available.
- `content.test.js` covers the timer reading, date resolution, and solve detection:
  `bun run vitest run nyt-mini-timer-extension/content.test.js`.

## Icons

`icons/icon.svg` is the source — a 3×3 mini grid with one solved square, in the
popup's navy and green-to-cyan accent. Edit the SVG, then re-export:

```sh
for s in 16 32 48 128; do
  inkscape --export-type=png --export-width=$s --export-height=$s \
    --export-filename="icons/icon$s.png" icons/icon.svg
done
```
