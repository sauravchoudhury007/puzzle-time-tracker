/* NYT Games Plus — Spelling Bee bridge (MAIN world)
 * window.gameData lives in the page's JS context, which an isolated
 * content script can't read directly. This runs in the MAIN world,
 * grabs the puzzle data, and hands it to the isolated script via
 * window.postMessage.
 */
(function () {
  function grab() {
    const gd = window.gameData;
    const today = gd && gd.today;
    if (!today || !Array.isArray(today.answers) || !today.answers.length)
      return false;
    window.postMessage(
      {
        __nytx: "sb-data",
        payload: {
          centerLetter: today.centerLetter,
          outerLetters: today.outerLetters,
          validLetters: today.validLetters,
          pangrams: today.pangrams || [],
          answers: today.answers,
          displayDate: today.displayDate
        }
      },
      "*"
    );
    return true;
  }

  if (grab()) return;
  // gameData may not be ready yet — poll briefly.
  let tries = 0;
  const t = setInterval(() => {
    if (grab() || ++tries > 40) clearInterval(t);
  }, 250);
})();
