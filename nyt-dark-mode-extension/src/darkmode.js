/* NYT Games Plus — dark-mode applier
 * Sets data attributes on <html> that the CSS files key off of.
 * Runs at document_start and primes from a localStorage cache to avoid
 * a flash of the light theme before chrome.storage resolves.
 */
(function () {
  const NYTX = window.NYTX;
  const game = NYTX.detectGame();
  const root = document.documentElement;

  function apply(s) {
    const on = !!(s.enabled && game && s.games[game]);
    root.setAttribute("data-nytx-game", game || "");
    root.setAttribute("data-nytx-dark", on ? "on" : "off");
    root.setAttribute("data-nytx-level", s.level || "dark");
    root.setAttribute("data-nytx-accent", s.accent || "medium");
    root.setAttribute("data-nytx-sb-nextrank", s.sbNextRank ? "on" : "off");
    root.setAttribute("data-nytx-sb-hints", s.sbHints ? "on" : "off");
    window.__nytxSettings = s;
    window.__nytxGame = game;
    window.dispatchEvent(new CustomEvent("nytx-applied", { detail: s }));
  }

  // 1) Immediate paint from cache (no flash).
  apply(NYTX.merge(NYTX.readCache()));
  // 2) Authoritative load + live updates.
  NYTX.load(apply);
  NYTX.onChange(apply);

  // Floating quick-toggle for the current game.
  function mountToggle() {
    if (!game || document.getElementById("nytx-toggle")) return;
    const s = window.__nytxSettings || NYTX.merge(NYTX.readCache());
    if (!s.toggleButton) return;
    const btn = document.createElement("button");
    btn.id = "nytx-toggle";
    btn.type = "button";
    btn.title = "Toggle NYT Games Plus dark mode";
    btn.setAttribute("aria-label", "Toggle dark mode");
    btn.textContent = "🌙";
    btn.addEventListener("click", () => {
      NYTX.load((cur) => {
        const games = Object.assign({}, cur.games);
        games[game] = !games[game];
        NYTX.save({ enabled: true, games });
      });
    });
    document.body.appendChild(btn);
    const sync = () => {
      const cur = window.__nytxSettings || s;
      const on = cur.enabled && cur.games[game];
      btn.textContent = on ? "☀️" : "🌙";
      btn.classList.toggle("nytx-on", !!on);
    };
    window.addEventListener("nytx-applied", sync);
    sync();
  }

  if (document.body) mountToggle();
  else
    document.addEventListener("DOMContentLoaded", mountToggle, { once: true });
})();
