/* NYT Games Plus — Connections hints
 * Adds a "Hints" switch to the game toolbar. Turning it on reads this
 * puzzle's Connections Companion (the article behind the toolbar's
 * lightbulb), whose "Need a Hint?" section reveals one word from each
 * color group, and paints those words' tiles in their group's color.
 *
 * The switch is remembered only for the puzzle it was turned on for, so
 * the next puzzle starts without spoilers.
 */
(function () {
  const NYTX = window.NYTX;
  if (NYTX.detectGame() !== "connections") return;

  // Each reveal block's summary starts with its group's square:
  // "🟨 Straightforward", "🟩 ⬇️", "🟦 ⬇️", "🟪 Tricky".
  const COLORS = { "🟨": "yellow", "🟩": "green", "🟦": "blue", "🟪": "purple" };
  const ORDER = ["yellow", "green", "blue", "purple"];
  const ON_KEY = "nytx-cx-hints-on"; // companion URL the switch is on for

  let hints = null; // { url, list: [{ color, text }] }
  let pending = null; // companion URL being fetched
  let failed = null; // companion URL that couldn't be read

  // Case-, accent- and punctuation-blind, so tiles like "MÖBIUS" and
  // "POP-UP" match the article however it spells them.
  function norm(s) {
    return (s || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, " ")
      .trim();
  }

  function companionUrl() {
    const link = document.querySelector(
      '[data-testid="toolbar"] a[href*="connections-companion"]'
    );
    if (link) return link.href;
    // No lightbulb link: puzzle #1 ran on 2023-06-12 and each companion is
    // dated the day before its puzzle.
    const m = /(\d{4})-(\d{2})-(\d{2})/.exec(location.pathname);
    const now = new Date();
    const day = m
      ? Date.UTC(+m[1], +m[2] - 1, +m[3])
      : Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const num = Math.round((day - Date.UTC(2023, 5, 12)) / 864e5) + 1;
    const prev = new Date(day - 864e5).toISOString().slice(0, 10);
    return (
      location.origin +
      "/" +
      prev.replace(/-/g, "/") +
      "/crosswords/connections-companion-" +
      num +
      ".html"
    );
  }

  async function fetchHints(url) {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    const list = [];
    doc
      .querySelectorAll('details[data-testid="reveal-block"]')
      .forEach((block, i) => {
        const summary = block.querySelector("summary");
        const label = summary ? summary.textContent : "";
        const emoji = Object.keys(COLORS).find((e) => label.includes(e));
        if (summary) summary.remove();
        const text = norm(block.textContent);
        if (text)
          list.push({
            color: emoji ? COLORS[emoji] : ORDER[i],
            text: " " + text + " "
          });
      });
    if (!list.length) throw new Error("no hints in " + url);
    return list;
  }

  function isOn(url) {
    try {
      return localStorage.getItem(ON_KEY) === url;
    } catch (e) {
      return false;
    }
  }
  function setOn(url, on) {
    try {
      if (on) localStorage.setItem(ON_KEY, url);
      else localStorage.removeItem(ON_KEY);
    } catch (e) {}
  }

  // Tiles are <label data-testid="card-label" data-flip-id="WORD">; the
  // color goes on as data-nytx-hint, which connections.css paints.
  function markTiles(list) {
    document.querySelectorAll('[data-testid="card-label"]').forEach((tile) => {
      let color = null;
      if (list) {
        const word =
          " " + norm(tile.getAttribute("data-flip-id") || tile.textContent) + " ";
        const hit = list.find((h) => h.text.includes(word));
        if (hit) color = hit.color;
      }
      if (color) {
        if (tile.dataset.nytxHint !== color) tile.dataset.nytxHint = color;
      } else if (tile.dataset.nytxHint) {
        delete tile.dataset.nytxHint;
      }
    });
  }

  function setAttr(node, name, value) {
    if (node.getAttribute(name) !== value) node.setAttribute(name, value);
  }

  function render() {
    const enabled =
      document.documentElement.getAttribute("data-nytx-cx-hints") !== "off";
    const bar = document.querySelector('[data-testid="toolbar"]');
    const board = document.querySelector('[data-testid="connections-board"]');
    let btn = document.getElementById("nytx-cx-hints");
    if (!enabled || !bar || !board) {
      if (btn) btn.remove();
      markTiles(null);
      return;
    }
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "nytx-cx-hints";
      btn.type = "button";
      btn.className = "nytx-cx-hints-toggle";
      btn.innerHTML =
        '<span class="nytx-cx-hints-label">Hints</span>' +
        '<span class="nytx-switch" aria-hidden="true"></span>';
      btn.addEventListener("click", () => {
        const url = companionUrl();
        failed = null;
        setOn(url, !isOn(url));
        render();
      });
      bar.insertBefore(btn, bar.firstChild);
    }

    const url = companionUrl();
    const on = isOn(url);
    if (on && (!hints || hints.url !== url) && pending !== url && failed !== url) {
      pending = url;
      fetchHints(url)
        .then((list) => {
          hints = { url, list };
        })
        .catch(() => {
          failed = url;
          setOn(url, false);
        })
        .finally(() => {
          pending = null;
          render();
        });
    }
    const ready = on && hints && hints.url === url;

    setAttr(btn, "aria-pressed", String(on));
    setAttr(btn, "aria-busy", String(on && !ready));
    const label = btn.querySelector(".nytx-cx-hints-label");
    const text = failed === url ? "Hints unavailable" : "Hints";
    if (label.textContent !== text) label.textContent = text;
    setAttr(
      btn,
      "title",
      failed === url
        ? "Couldn't read the Connections Companion. Click to try again."
        : on
        ? "Hide the Connections Companion hints"
        : "Color one word from each group, from the Connections Companion"
    );

    markTiles(ready ? hints.list : null);
  }

  // The board is rendered by React after the Play screen and re-rendered
  // as groups are solved, so re-check on every change; render() only
  // writes when something differs.
  const mo = new MutationObserver(render);
  function start() {
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", start, { once: true });
      return;
    }
    mo.observe(document.body, { childList: true, subtree: true });
    render();
  }
  start();
  window.addEventListener("nytx-applied", render);
})();
