export const LAST_SELECTED_PUZZLE_DATE_KEY = 'lastSelectedPuzzleDate'

/** Poster setup on the Frame page — layout, sheet, ink, wording. */
export const FRAME_OPTIONS_KEY = 'frameOptions'

/** Last synced copy of the puzzle_times rows — see usePuzzleTimes. Must never match
 *  `sb-*-auth-token`, the pattern the extension scans for the session. */
export const PUZZLE_TIMES_CACHE_KEY = 'puzzleTimesCache'

/** Signed highlight-reel links and when they lapse — see usePhotos. */
export const HIGHLIGHT_REEL_CACHE_KEY = 'highlightReelCache'
