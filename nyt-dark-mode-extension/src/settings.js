/* NYT Games Plus — settings store
 * Shared across content-script files (same isolated world).
 * Falls back to window.__NYTX_SETTINGS__ when chrome.storage is absent
 * (used by the local test harness so the exact same code runs there).
 */
(function () {
  const DEFAULTS = {
    enabled: true,
    games: {
      "spelling-bee": true,
      connections: true,
      strands: true,
      mini: true,
      wordle: false // Wordle ships its own native dark mode; off by default
    },
    level: "dark", // dim | dark | oled
    accent: "medium", // low | medium | high
    sbNextRank: true,
    sbHints: true,
    toggleButton: true
  };

  const CACHE_KEY = "nytx-settings-cache";

  function detectGame() {
    const p = location.pathname;
    if (p.includes("/spelling-bee")) return "spelling-bee";
    if (p.includes("/connections")) return "connections";
    if (p.includes("/strands")) return "strands";
    if (p.includes("/wordle")) return "wordle";
    if (p.includes("/mini")) return "mini";
    return null;
  }

  function merge(s) {
    s = s || {};
    return Object.assign({}, DEFAULTS, s, {
      games: Object.assign({}, DEFAULTS.games, s.games || {})
    });
  }

  function readCache() {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY)) || null;
    } catch (e) {
      return null;
    }
  }
  function writeCache(s) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(s));
    } catch (e) {}
  }

  const hasChrome =
    typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync;

  function load(cb) {
    if (hasChrome) {
      chrome.storage.sync.get("nytx", (res) => {
        const s = merge(res && res.nytx);
        writeCache(s);
        cb(s);
      });
    } else {
      cb(merge(window.__NYTX_SETTINGS__ || readCache()));
    }
  }

  function save(partial, cb) {
    load((cur) => {
      const next = merge(Object.assign({}, cur, partial));
      writeCache(next);
      if (hasChrome) {
        chrome.storage.sync.set({ nytx: next }, () => cb && cb(next));
      } else {
        window.__NYTX_SETTINGS__ = next;
        window.dispatchEvent(
          new CustomEvent("nytx-settings-updated", { detail: next })
        );
        cb && cb(next);
      }
    });
  }

  function onChange(cb) {
    if (hasChrome) {
      chrome.storage.onChanged.addListener((ch, area) => {
        if (area === "sync" && ch.nytx) {
          const s = merge(ch.nytx.newValue);
          writeCache(s);
          cb(s);
        }
      });
    }
    window.addEventListener("nytx-settings-updated", (e) =>
      cb(merge(e.detail))
    );
  }

  window.NYTX = {
    DEFAULTS,
    CACHE_KEY,
    detectGame,
    merge,
    readCache,
    writeCache,
    load,
    save,
    onChange
  };
})();
