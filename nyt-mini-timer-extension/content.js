const getTimerValue = () => {
  const el = document.querySelector('.timer-count')
  if (!el) return null
  const text = el.textContent?.trim() || null
  return text && text.length > 0 ? text : null
}

const getPuzzleDateFromPath = () => {
  const match = location.pathname.match(/\/game\/mini\/(\d{4})\/(\d{2})\/(\d{2})/)
  if (!match) return null
  return `${match[1]}-${match[2]}-${match[3]}`
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'GET_NYT_MINI_TIME') {
    console.debug('[NYT Mini Timer] responding with timer/date', {
      timer: getTimerValue(),
      date: getPuzzleDateFromPath(),
    })
    sendResponse({
      timer: getTimerValue(),
      date: getPuzzleDateFromPath(),
      url: location.href,
    })
  }
})
