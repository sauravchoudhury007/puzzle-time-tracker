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

Content scripts and the background service worker update independently, so it's
possible to end up running a new `content.js` against an old worker. If the two
disagree the toast is suppressed and the reason is logged to the page console
rather than showing something misleading. Check the version on
`chrome://extensions` against `manifest.json` to confirm a reload actually took;
if it's stale, toggle the extension off and on.

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
   a small toast appears bottom-right of the puzzle page — `✓ 1:23 logged` — which
   fades out after about four seconds, or on click. Amber means the day was
   already on record; red means it couldn't send, with the reason.
5) Open the popup any time to see the current timer and puzzle date, or to submit
   manually with **Refresh** then **Submit**. Manual date/time fields override
   what was read from the page.

The toolbar badge is only used for problems, never for success — a `!` means at
least one solve is still queued, and it stays until that clears. Success is the
toast, so nothing lingers on the icon.

## How it works

- `content.js` polls the on-page timer once a second, so the final time survives
  NYT removing the timer when the congrats dialog appears. It resolves the puzzle
  date from the URL, then the date printed on the page, then today. It also draws
  the confirmation toast, in a shadow root so NYT's styles can't reach it.
- `background.js` owns the token lookup and every POST, so manual and automatic
  submissions take the same path. A solve that can't be sent right away (no
  signed-in tracker tab, expired token) is queued and retried **by a one-minute
  alarm** until it lands, so it completes without you clicking anything. A tracker
  tab loading, the popup opening, and a browser restart also trigger a retry.
  After ~20 attempts the alarm stops, leaving the `!` badge — at that point
  something needs a human, and retrying would just be waking tabs on a loop.
- Tokens are cached in `chrome.storage.local` and trusted until the JWT's own
  `exp` says otherwise, so a normal auto-log is one storage read plus one POST.
  Going out to a tracker tab is the slow path — Chrome may have discarded the tab,
  and waking it can take seconds — so it only happens when there's nothing usable
  cached, on a 401, or when the tab loads and the cache is warmed for free. If the
  server rejects a cached token anyway, one forced refresh is retried before
  giving up. Timings for every submit are logged to the service worker console.
- `popup.js` is just the UI — it asks the content script for the timer and hands
  submissions to the background worker.

## Notes

- Works on `https://www.nytimes.com/crosswords/game/mini*`, which covers both
  today's puzzle and dated archive URLs.
- Each date is auto-logged once. The API also returns `already_logged` if the day
  already has an entry, so a manual re-submit can't create duplicates.
- The API only accepts requests from allow-listed origins, including this
  extension's ID. The ID is **pinned** by the `key` field in `manifest.json`, so
  every install — yours, a friend's, any folder on any machine — resolves to
  `nibbjcjdaadnhnibdbikkicjgcpijhee` and matches the allowlist in
  `src/app/api/auto-log/route.ts`. Don't remove that `key`: without it Chrome
  derives the ID from the install path, each machine gets a different one, and
  everyone but you gets `403 Origin not allowed`. To allow an extra origin
  without editing code, set `CORS_EXTENSION_ORIGIN` to a comma-separated list.
- The private half of that key (`key.pem`) is gitignored and is **not** needed to
  run or share the extension — only to publish this exact ID to the Chrome Web
  Store. If you do publish, either upload using that keypair or drop the `key`
  field and switch the allowlist to the Store-assigned ID.
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
