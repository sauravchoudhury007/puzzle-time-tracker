/* NYT Games Plus — Spelling Bee enhancements
 *  (2) Points-to-next-rank shown under the ranking bar (no clicking).
 *  (3) Hints panel (word count, pangram count, length grid, two-letter
 *      list) computed from the puzzle data and shown on the game page.
 *  (4) Wide layout switch in the game toolbar, plus the one-line title
 *      the wide layout shows there (the layout itself is CSS).
 *  (5) The word just found flashes in the word list and stays tinted
 *      until the next one.
 *
 * All numbers are derived from the puzzle answer list (received from
 * sb-bridge.js) plus the player's found words read out of the DOM, so
 * nothing needs the Hints page or a click on the rank bar.
 */
(function () {
  const NYTX = window.NYTX;
  if (NYTX.detectGame() !== "spelling-bee") return;

  // Official Spelling Bee rank thresholds, as a % of the puzzle's total.
  const RANKS = [
    { name: "Beginner", pct: 0 },
    { name: "Good Start", pct: 2 },
    { name: "Moving Up", pct: 5 },
    { name: "Good", pct: 8 },
    { name: "Solid", pct: 15 },
    { name: "Nice", pct: 25 },
    { name: "Great", pct: 40 },
    { name: "Amazing", pct: 50 },
    { name: "Genius", pct: 70 },
    { name: "Queen Bee", pct: 100 }
  ];

  let DATA = null; // {answers, pangrams, ...}
  let MODEL = null; // {total, thresholds, byLetter, ...}

  // The 7 valid letters for today's puzzle. We derive pangrams structurally
  // from this (a word that uses all 7 letters) instead of trusting
  // gameData.today.pangrams, which on the live page can be empty/unavailable
  // when our bridge reads it — that was dropping the +7 pangram bonus.
  function validLetters() {
    const v =
      DATA.validLetters && DATA.validLetters.length
        ? DATA.validLetters
        : [DATA.centerLetter].concat(DATA.outerLetters || []);
    return v.filter(Boolean).map((c) => String(c).toLowerCase());
  }

  // A pangram uses every valid letter at least once → its distinct-letter
  // count equals the number of valid letters (7).
  function isPangram(w, validCount) {
    return new Set(w).size === validCount;
  }

  function wordScore(w, validCount) {
    let s = w.length === 4 ? 1 : w.length;
    if (isPangram(w, validCount)) s += 7;
    return s;
  }

  function buildModel() {
    const answers = DATA.answers.map((w) => w.toLowerCase());
    const validCount = validLetters().length || 7;
    let total = 0;
    let pangramCount = 0;
    const byLetterLen = {}; // letter -> {len -> count}
    const twoLetter = {}; // 2-letter prefix -> count
    let minLen = Infinity,
      maxLen = 0;

    answers.forEach((w) => {
      total += wordScore(w, validCount);
      if (isPangram(w, validCount)) pangramCount++;
      const L = w[0];
      const len = w.length;
      minLen = Math.min(minLen, len);
      maxLen = Math.max(maxLen, len);
      (byLetterLen[L] = byLetterLen[L] || {})[len] =
        (byLetterLen[L][len] || 0) + 1;
      const pre = w.slice(0, 2);
      twoLetter[pre] = (twoLetter[pre] || 0) + 1;
    });

    const thresholds = RANKS.map((r) => ({
      name: r.name,
      pts: r.pct === 100 ? total : Math.round((r.pct / 100) * total)
    }));

    MODEL = {
      total,
      thresholds,
      wordCount: answers.length,
      pangramCount,
      byLetterLen,
      twoLetter,
      minLen,
      maxLen,
      validCount,
      answers
    };
  }

  // --- Read the player's found words from the on-page word list ---
  function readFoundWords() {
    const set = new Set();
    // Each found word is rendered as:
    //   <li><span class="sb-anagram">word</span>
    //       <span class="visually-hidden">word (pangram)</span></li>
    // Read ONLY the visible .sb-anagram span — reading the whole <li> doubles
    // the text and appends "(pangram)", which made pangrams unmatchable.
    let nodes = document.querySelectorAll(
      ".sb-wordlist-items-pag .sb-anagram, .sb-wordlist-items .sb-anagram, .sb-wordlist-drawer .sb-anagram"
    );
    if (!nodes.length) {
      // Fallback for any other markup: take the list item's own text.
      nodes = document.querySelectorAll(
        ".sb-wordlist-items-pag li, .sb-wordlist-items li, .sb-wordlist-drawer li"
      );
    }
    nodes.forEach((n) => {
      const w = (n.textContent || "").trim().toLowerCase().replace(/[^a-z]/g, "");
      if (w) set.add(w);
    });
    return set;
  }

  function currentScore() {
    if (!MODEL) return 0;
    // Primary: the rank bar's aria-label carries the live score,
    // e.g. "Beginner, score 0. Click to see today's ranks".
    const prog = document.querySelector(".sb-progress[aria-label]");
    if (prog) {
      const m = /score\s+(\d+)/i.exec(prog.getAttribute("aria-label") || "");
      if (m) return parseInt(m[1], 10);
    }
    // Fallback: sum the found-word list ourselves.
    const found = readFoundWords();
    let s = 0;
    found.forEach((w) => {
      if (MODEL.answers.includes(w)) s += wordScore(w, MODEL.validCount);
    });
    return s;
  }

  function rankInfo(score) {
    const t = MODEL.thresholds;
    let curIdx = 0;
    for (let i = 0; i < t.length; i++) if (score >= t[i].pts) curIdx = i;
    const cur = t[curIdx];
    const next = t[curIdx + 1] || null;
    return {
      current: cur,
      next,
      toNext: next ? Math.max(0, next.pts - score) : 0,
      score
    };
  }

  // ---------------- Rendering ----------------
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function renderNextRank() {
    const root = document.documentElement;
    const enabled = root.getAttribute("data-nytx-sb-nextrank") !== "off";
    let box = document.getElementById("nytx-next-rank");
    if (!enabled) {
      if (box) box.remove();
      return;
    }
    if (!MODEL) return;
    const info = rankInfo(currentScore());

    // The rank bar sits inside a <button>.sb-progress-button inside
    // .sb-progress-box — anchor to the box so our line lands below it,
    // not inside the clickable button.
    const anchor =
      document.querySelector(".sb-progress-box") ||
      document.querySelector(".sb-wordlist-pag") ||
      document.querySelector(".sb-wordlist-window");
    if (!anchor) return;

    if (!box) {
      box = el("div", "nytx-next-rank");
      box.id = "nytx-next-rank";
      anchor.insertAdjacentElement("afterend", box);
    }

    let html, max;
    if (info.next) {
      html =
        '<span class="nytx-nr-rank">' +
        info.current.name +
        "</span>" +
        '<span class="nytx-nr-score">' +
        info.score +
        " pts</span>" +
        '<span class="nytx-nr-to"><b>' +
        info.toNext +
        "</b> to " +
        info.next.name +
        "</span>";
      max = false;
    } else {
      html =
        '<span class="nytx-nr-rank">Queen Bee 👑</span>' +
        '<span class="nytx-nr-score">' +
        info.score +
        " pts</span>" +
        '<span class="nytx-nr-to">Max rank reached!</span>';
      max = true;
    }
    // Only touch the DOM when something actually changed, so re-running
    // on each MutationObserver tick can't loop or flicker.
    if (box.dataset.sig !== html) {
      box.innerHTML = html;
      box.dataset.sig = html;
      box.classList.toggle("nytx-nr-max", max);
    }
  }

  function renderHints() {
    const root = document.documentElement;
    const enabled = root.getAttribute("data-nytx-sb-hints") !== "off";
    let panel = document.getElementById("nytx-hints");
    if (!enabled) {
      if (panel) panel.remove();
      return;
    }
    if (!MODEL) return;

    const anchor =
      document.querySelector(".sb-wordlist-box") ||
      document.querySelector(".sb-wordlist-window") ||
      document.querySelector(".sb-content-box");
    if (!anchor) return;

    // Build once — the hints content is static for the day's puzzle. If the
    // panel is already on the page we leave it alone (this is what lets the
    // observer call us on every mutation without rebuilding/flickering).
    if (panel) return;
    panel = el("section", "nytx-hints");
    panel.id = "nytx-hints";

    const collapsed =
      localStorage.getItem("nytx-hints-collapsed") === "1" ? "" : " nytx-open";
    panel.className = "nytx-hints" + collapsed;

    // Header / summary
    const head = el(
      "button",
      "nytx-hints-head",
      '<span class="nytx-h-title">Hints</span>' +
        '<span class="nytx-h-sum">0/' +
        MODEL.wordCount +
        " words · 0/" +
        MODEL.total +
        " pts · 0/" +
        MODEL.pangramCount +
        " pangram" +
        (MODEL.pangramCount === 1 ? "" : "s") +
        "</span>" +
        '<span class="nytx-h-chev">▾</span>'
    );
    head.type = "button";
    head.addEventListener("click", () => {
      panel.classList.toggle("nytx-open");
      localStorage.setItem(
        "nytx-hints-collapsed",
        panel.classList.contains("nytx-open") ? "0" : "1"
      );
    });
    panel.appendChild(head);

    const body = el("div", "nytx-hints-body");

    // ---- Length grid ----
    const letters = Object.keys(MODEL.byLetterLen).sort();
    const lens = [];
    for (let n = MODEL.minLen; n <= MODEL.maxLen; n++) lens.push(n);

    let grid = '<table class="nytx-grid"><thead><tr><th>Σ</th>';
    lens.forEach((n) => (grid += "<th>" + n + "</th>"));
    grid += "<th>Σ</th></tr></thead><tbody>";

    const colTotals = {};
    lens.forEach((n) => (colTotals[n] = 0));
    letters.forEach((L) => {
      let rowTotal = 0;
      let row = "<tr><th>" + L.toUpperCase() + "</th>";
      lens.forEach((n) => {
        const c = (MODEL.byLetterLen[L] && MODEL.byLetterLen[L][n]) || 0;
        rowTotal += c;
        colTotals[n] += c;
        row += c
          ? '<td data-cell="' + L + "|" + n + '" data-total="' + c + '">0/' + c + "</td>"
          : '<td class="nytx-zero">-</td>';
      });
      row +=
        '<th class="nytx-rt" data-rowtotal="' + L + '" data-total="' + rowTotal + '">0/' +
        rowTotal +
        "</th></tr>";
      grid += row;
    });
    grid += '<tr class="nytx-colt"><th>Σ</th>';
    lens.forEach(
      (n) =>
        (grid +=
          '<th data-coltotal="' + n + '" data-total="' + colTotals[n] + '">0/' +
          colTotals[n] +
          "</th>")
    );
    grid +=
      '<th data-grand data-total="' + MODEL.wordCount + '">0/' + MODEL.wordCount + "</th></tr>";
    grid += "</tbody></table>";

    body.appendChild(el("h4", "nytx-h-sub", "Word count by length"));
    body.appendChild(el("div", "nytx-grid-wrap", grid));

    // ---- Two-letter list ----
    const pres = Object.keys(MODEL.twoLetter).sort();
    let two = "";
    let lastFirst = null;
    pres.forEach((p) => {
      if (p[0] !== lastFirst) {
        if (lastFirst !== null) two += "</div>";
        two += '<div class="nytx-two-row">';
        lastFirst = p[0];
      }
      two +=
        '<span class="nytx-two" data-prefix="' + p + '" data-total="' + MODEL.twoLetter[p] +
        '"><b>' +
        p.toUpperCase() +
        '</b> <span class="nytx-two-c">0/' +
        MODEL.twoLetter[p] +
        "</span></span>";
    });
    if (lastFirst !== null) two += "</div>";

    body.appendChild(el("h4", "nytx-h-sub", "Two-letter list"));
    body.appendChild(el("div", "nytx-two-wrap", two));

    panel.appendChild(body);
    anchor.insertAdjacentElement("beforebegin", panel);
    updateHints(); // seed the live counters with current progress
  }

  // Recompute found/total for every grid cell, row/col total, two-letter
  // entry and the summary, from the player's found words. Writes to the DOM
  // only when a value actually changed, so it's cheap and can't feed the
  // MutationObserver into a loop. Cells/entries that are complete go green.
  function updateHints() {
    const panel = document.getElementById("nytx-hints");
    if (!panel || !MODEL) return;

    const found = readFoundWords();
    const byCell = {},
      byRow = {},
      byCol = {},
      byPrefix = {};
    let words = 0,
      score = 0,
      pangrams = 0;
    found.forEach((w) => {
      if (!MODEL.answers.includes(w)) return;
      words++;
      score += wordScore(w, MODEL.validCount);
      if (isPangram(w, MODEL.validCount)) pangrams++;
      const L = w[0],
        n = w.length;
      byCell[L + "|" + n] = (byCell[L + "|" + n] || 0) + 1;
      byRow[L] = (byRow[L] || 0) + 1;
      byCol[n] = (byCol[n] || 0) + 1;
      const p = w.slice(0, 2);
      byPrefix[p] = (byPrefix[p] || 0) + 1;
    });

    const setCount = (node, textNode, f, t) => {
      const txt = f + "/" + t;
      if (textNode.textContent !== txt) textNode.textContent = txt;
      const done = t > 0 && f >= t;
      const partial = f > 0 && f < t;
      if (node.classList.contains("nytx-done") !== done)
        node.classList.toggle("nytx-done", done);
      if (node.classList.contains("nytx-partial") !== partial)
        node.classList.toggle("nytx-partial", partial);
    };

    panel.querySelectorAll("[data-cell]").forEach((td) =>
      setCount(td, td, byCell[td.dataset.cell] || 0, +td.dataset.total)
    );
    panel.querySelectorAll("[data-rowtotal]").forEach((th) =>
      setCount(th, th, byRow[th.dataset.rowtotal] || 0, +th.dataset.total)
    );
    panel.querySelectorAll("[data-coltotal]").forEach((th) =>
      setCount(th, th, byCol[+th.dataset.coltotal] || 0, +th.dataset.total)
    );
    const grand = panel.querySelector("[data-grand]");
    if (grand) setCount(grand, grand, words, +grand.dataset.total);

    panel.querySelectorAll(".nytx-two[data-prefix]").forEach((span) => {
      const cnt = span.querySelector(".nytx-two-c");
      if (cnt)
        setCount(span, cnt, byPrefix[span.dataset.prefix] || 0, +span.dataset.total);
    });

    const sum = panel.querySelector(".nytx-h-sum");
    if (sum) {
      const txt =
        words + "/" + MODEL.wordCount + " words · " +
        score + "/" + MODEL.total + " pts · " +
        pangrams + "/" + MODEL.pangramCount + " pangram" +
        (MODEL.pangramCount === 1 ? "" : "s");
      if (sum.textContent !== txt) sum.textContent = txt;
      const allDone = words >= MODEL.wordCount;
      if (sum.classList.contains("nytx-done") !== allDone)
        sum.classList.toggle("nytx-done", allDone);
    }
  }

  // The switch goes first in the toolbar (Stats · Answers · Hints · More);
  // the title fills the toolbar's empty left slot, which the wide layout
  // uses as its only header row. Neither needs the puzzle data.
  function renderLayoutChrome() {
    const right = document.querySelector(".pz-toolbar-right");
    if (!right) return;
    const wide =
      document.documentElement.getAttribute("data-nytx-sb-layout") === "wide";

    let btn = document.getElementById("nytx-layout-toggle");
    if (!btn) {
      btn = el(
        "button",
        "pz-toolbar-button nytx-layout-toggle",
        '<span>Wide layout</span><span class="nytx-switch" aria-hidden="true"></span>'
      );
      btn.id = "nytx-layout-toggle";
      btn.type = "button";
      // Keep focus off the button: the game reads Enter from the page, and
      // a focused button would turn the next word's Enter into a toggle.
      btn.addEventListener("mousedown", (e) => e.preventDefault());
      btn.addEventListener("click", () => {
        NYTX.load((cur) => NYTX.save({ sbWideLayout: !cur.sbWideLayout }));
      });
      right.insertBefore(btn, right.firstChild);
    }
    if (btn.getAttribute("aria-pressed") !== String(wide)) {
      btn.setAttribute("aria-pressed", String(wide));
      btn.title = wide
        ? "Switch back to the classic NYT layout"
        : "Spread the board across the window";
    }

    const left = document.querySelector(".pz-toolbar-left");
    if (!left) return;
    let title = document.getElementById("nytx-sb-title");
    if (!title) {
      title = el(
        "div",
        "nytx-sb-title",
        '<span class="nytx-sb-title-name">Spelling Bee</span>' +
          '<span class="nytx-sb-title-date"></span>'
      );
      title.id = "nytx-sb-title";
      left.appendChild(title);
    }
    const dateEl = document.querySelector(".pz-game-date");
    const date =
      (dateEl && dateEl.textContent.trim()) || (DATA && DATA.displayDate) || "";
    const dateSpan = title.querySelector(".nytx-sb-title-date");
    if (dateSpan.textContent !== date) dateSpan.textContent = date;
  }

  // ---- (5) Recent words: the last four found, newest brightest ----
  // The list is diffed against the last look at it: exactly one new word is
  // one the player just entered. The first look (the list mounting with
  // everything found so far) only sets the baseline, so nothing flashes on
  // load. Each <li> gets data-nytx-recent="1".."4" (1 = newest) and the CSS
  // fades the tint step by step as newer words push it down. The four are
  // remembered per puzzle so a reload still marks them.
  const RECENT_KEY = "nytx-sb-recent-words";
  const RECENT_MAX = 4;
  let knownWords = null;
  let recent = null;

  function puzzleId() {
    const d = document.querySelector(".pz-game-date");
    return (d && d.textContent.trim()) || (DATA && DATA.displayDate) || location.pathname;
  }

  function loadRecent() {
    try {
      const saved = JSON.parse(localStorage.getItem(RECENT_KEY));
      if (saved && saved.puzzle === puzzleId() && Array.isArray(saved.words))
        return saved.words.slice(0, RECENT_MAX);
    } catch (e) {}
    return [];
  }

  function markLatestWord() {
    const items = document.querySelectorAll(".sb-wordlist-items-pag > li");
    if (!items.length) return;
    const byWord = new Map();
    items.forEach((li) => {
      const a = li.querySelector(".sb-anagram") || li;
      const w = (a.textContent || "").trim().toLowerCase();
      if (w) byWord.set(w, li);
    });

    if (!recent) recent = loadRecent();
    let flash = null;
    if (knownWords) {
      const added = [...byWord.keys()].filter((w) => !knownWords.has(w));
      if (added.length === 1) {
        flash = added[0];
        recent = [flash, ...recent.filter((w) => w !== flash)].slice(0, RECENT_MAX);
        try {
          localStorage.setItem(RECENT_KEY, JSON.stringify({ puzzle: puzzleId(), words: recent }));
        } catch (e) {}
      }
    }
    knownWords = new Set(byWord.keys());

    const on = document.documentElement.getAttribute("data-nytx-sb-lastword") !== "off";
    byWord.forEach((li, w) => {
      const rank = on ? recent.indexOf(w) + 1 : 0;
      const want = rank ? String(rank) : null;
      if (li.getAttribute("data-nytx-recent") !== want) {
        if (want) li.setAttribute("data-nytx-recent", want);
        else li.removeAttribute("data-nytx-recent");
      }
    });
    const li = on && flash && byWord.get(flash);
    if (li) {
      // Restart the animation even if this li flashed before.
      li.classList.remove("nytx-flash");
      void li.offsetWidth;
      li.classList.add("nytx-flash");
      li.addEventListener("animationend", () => li.classList.remove("nytx-flash"), {
        once: true
      });
    }
  }

  let rendering = false;
  function renderAll() {
    if (rendering) return;
    rendering = true;
    try {
      renderLayoutChrome();
      markLatestWord();
      if (MODEL) {
        renderNextRank();
        renderHints();
        updateHints();
      }
    } catch (e) {
      /* keep the page alive no matter what */
    } finally {
      rendering = false;
    }
  }

  // ---------------- Wiring ----------------
  window.addEventListener("message", (ev) => {
    const d = ev.data;
    if (!d || d.__nytx !== "sb-data" || !d.payload) return;
    DATA = d.payload;
    buildModel();
    renderAll();
  });

  // The SB board is rendered by React after our script runs, so the anchors
  // (.sb-progress-box, .sb-wordlist-box) often don't exist on the first
  // renderAll. Re-run the FULL render — both the next-rank line and the hints
  // panel — as the layout mounts and as the player finds words. renderHints
  // builds once and renderNextRank only writes on change, so this is cheap.
  // The toolbar title goes in right away, before the next paint: the wide
  // layout swaps NYT's title bar for it, so a debounced insert would show
  // the board jumping up 150ms after it appears.
  const mo = new MutationObserver(() => {
    if (rendering) return;
    try {
      if (!document.getElementById("nytx-sb-title")) renderLayoutChrome();
    } catch (e) {}
    clearTimeout(window.__nytxSbT);
    window.__nytxSbT = setTimeout(renderAll, 150);
  });
  function startObserver() {
    if (document.body) mo.observe(document.body, { childList: true, subtree: true });
    else document.addEventListener("DOMContentLoaded", startObserver, { once: true });
  }
  startObserver();

  // Re-render on settings change (toggles for the two features).
  window.addEventListener("nytx-applied", renderAll);
})();
