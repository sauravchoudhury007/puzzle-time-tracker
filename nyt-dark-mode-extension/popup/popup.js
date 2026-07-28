/* NYT Games Plus — popup controller.
 * Reads/writes the same chrome.storage.sync "nytx" object the content
 * scripts use. Every change is saved immediately and content scripts
 * pick it up live via chrome.storage.onChanged.
 */
const DEFAULTS = {
  enabled: true,
  games: {
    "spelling-bee": true,
    connections: true,
    strands: true,
    mini: true,
    wordle: false
  },
  level: "dark",
  accent: "medium",
  sbNextRank: true,
  sbHints: true,
  toggleButton: true
};

function merge(s) {
  s = s || {};
  return Object.assign({}, DEFAULTS, s, {
    games: Object.assign({}, DEFAULTS.games, s.games || {})
  });
}

let state = merge();

function load() {
  chrome.storage.sync.get("nytx", (res) => {
    state = merge(res && res.nytx);
    render();
  });
}

function save() {
  chrome.storage.sync.set({ nytx: state });
}

function render() {
  document.getElementById("enabled").checked = state.enabled;
  document.body.classList.toggle("master-off", !state.enabled);

  document.querySelectorAll("[data-game]").forEach((el) => {
    el.checked = !!state.games[el.dataset.game];
  });

  document.querySelectorAll("#level button").forEach((b) => {
    b.classList.toggle("active", b.dataset.level === state.level);
  });
  document.querySelectorAll("#accent button").forEach((b) => {
    b.classList.toggle("active", b.dataset.accent === state.accent);
  });

  document.getElementById("sbNextRank").checked = state.sbNextRank;
  document.getElementById("sbHints").checked = state.sbHints;
  document.getElementById("toggleButton").checked = state.toggleButton;
}

document.addEventListener("DOMContentLoaded", () => {
  load();

  document.getElementById("enabled").addEventListener("change", (e) => {
    state.enabled = e.target.checked;
    save();
    render();
  });

  document.querySelectorAll("[data-game]").forEach((el) => {
    el.addEventListener("change", () => {
      state.games[el.dataset.game] = el.checked;
      save();
    });
  });

  document.querySelectorAll("#level button").forEach((b) => {
    b.addEventListener("click", () => {
      state.level = b.dataset.level;
      save();
      render();
    });
  });
  document.querySelectorAll("#accent button").forEach((b) => {
    b.addEventListener("click", () => {
      state.accent = b.dataset.accent;
      save();
      render();
    });
  });

  ["sbNextRank", "sbHints", "toggleButton"].forEach((id) => {
    document.getElementById(id).addEventListener("change", (e) => {
      state[id] = e.target.checked;
      save();
    });
  });
});
