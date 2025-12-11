# NYT Mini Timer Peek (Chrome Extension)

Small MV3 extension that reads the visible timer on an open NYT Mini puzzle tab and shows the puzzle date and timer value in the popup UI.

## How to install locally

1) In Chrome, open `chrome://extensions`.
2) Toggle **Developer mode** (top right).
3) Click **Load unpacked** and select the `nyt-mini-timer-extension` folder in this repo.
4) Pin the extension if you want quick access.

## How to use

1) Open the NYT Mini page (e.g. `https://www.nytimes.com/crosswords/game/mini/2025/12/08`) and start/finish the puzzle as usual.
2) Click the extension icon. The popup will show:
   - Puzzle date parsed from the URL.
   - Current on-page timer text (from the `.timer-count` element).
3) If you change tabs or the timer updates, click **Refresh** to pull the latest value.
4) To log straight into your tracker API:
   - The extension now auto-grabs your Supabase `access_token` from the tracker site if you have a tab open on it (`https://*.mr007.live` or `http://localhost:3000`). If it can’t find one, you can still paste it manually.
   - Set API URL if needed (defaults to `https://*.mr007.live/api/auto-log`; `http://localhost:3000/api/auto-log` also works).
   - Click **Save settings** if you change the URL/token.
   - Use **Refresh** to pull the timer/date, then **Submit** to send it to the API.

## Notes

- Works only on pages matching `https://www.nytimes.com/crosswords/game/mini/*`.
- The timer is whatever the NYT page displays; if the element is missing, you'll see “Timer not found.”
- Data you enter (token/API URL) is saved in `chrome.storage.local` inside the extension. The timer is read from the active tab and POSTed only when you have provided a token.
