// Pebble's extension, in the chat page: reads whether an answer is still being written and what the last answer says,
// and types your reply from the island into the message box, but only when that box is empty (a draft is never
// overwritten). Each site's page can change: the selectors below are the part to update when one stops working.

const SITES = {
  'claude.ai': {
    id: 'claude',
    stop: 'button[aria-label="Stop response"], button[aria-label*="Stop" i]',
    answer: '[data-testid="assistant-message"], .font-claude-response',
    input: 'div[contenteditable="true"].ProseMirror, div[contenteditable="true"]',
    send: 'button[aria-label="Send message"], button[aria-label*="Send" i]'
  },
  'chatgpt.com': {
    id: 'chatgpt',
    stop: 'button[data-testid="stop-button"]',
    answer: '[data-message-author-role="assistant"]',
    input: '#prompt-textarea',
    send: 'button[data-testid="send-button"]'
  },
  'gemini.google.com': {
    id: 'gemini',
    stop: 'button[aria-label*="Stop" i]',
    answer: 'message-content',
    input: 'rich-textarea .ql-editor, div[contenteditable="true"]',
    send: 'button[aria-label*="Send" i]'
  },
  'chat.deepseek.com': {
    id: 'deepseek',
    stop: null, // no stable stop button: an answer that still grows counts as being written
    answer: '.ds-markdown',
    input: 'textarea',
    send: null // Enter sends
  }
}

const site = SITES[location.hostname]
let lastAnswer = null, changedAt = 0, timer = 0, problem = ''

function state() {
  const answers = document.querySelectorAll(site.answer)
  const answer = (answers[answers.length - 1]?.innerText ?? '').trim()
  // the answer already there when the page opened is not one being written
  if (lastAnswer !== null && answer !== lastAnswer) changedAt = Date.now()
  lastAnswer = answer
  const stopping = site.stop ? !!document.querySelector(site.stop) : false
  return {
    site: site.id,
    title: document.title.replace(/\s*[-|–]\s*(Claude|ChatGPT|Gemini|DeepSeek)\s*$/i, ''),
    streaming: stopping || (!!answer && Date.now() - changedAt < 1500),
    answer: answer.slice(-8000)
  }
}

function inputBox() { return document.querySelector(site.input) }

/** Types the reply and sends it; false (with a reason) when there is a draft or no message box. */
function typeReply(text) {
  const box = inputBox()
  if (!box) return 'no message box found'
  const draft = box.tagName === 'TEXTAREA' ? box.value : box.innerText
  if (draft.trim()) return 'your draft is not empty: reply not sent'
  box.focus()
  if (box.tagName === 'TEXTAREA') {
    // React keeps its own copy of the value: set it the way a keypress would
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(box, text)
    box.dispatchEvent(new Event('input', { bubbles: true }))
  } else {
    document.execCommand('insertText', false, text)
  }
  setTimeout(() => {
    const send = site.send && document.querySelector(site.send)
    if (send && !send.disabled) send.click()
    else box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }))
    // still in the box a moment later: the site did not take it (its page changed); say so instead of leaving a draft
    setTimeout(() => {
      const left = inputBox(), now = left ? (left.tagName === 'TEXTAREA' ? left.value : left.innerText) : ''
      if (now.trim() === text.trim()) { problem = 'the reply is in the message box but was not sent: press Send there'; void report() }
    }, 1500)
  }, 150)
  return null
}

let lastSent = ''
async function report() {
  clearTimeout(timer)
  let r
  try { r = await chrome.runtime.sendMessage({ type: 'state', state: { ...state(), problem: problem || undefined } }) } catch { return } // the extension was reloaded
  problem = ''
  if (r?.reply) problem = typeReply(r.reply) ?? ''
  // while an answer is written: often; otherwise a heartbeat (Pebble forgets tabs quiet for a minute)
  timer = setTimeout(report, problem || state().streaming ? 700 : 20000)
}

if (site) {
  let pending = 0
  new MutationObserver(() => {
    // report changes at most every 700 ms
    if (pending) return
    pending = setTimeout(() => { pending = 0; const s = state(); const key = s.streaming + s.answer; if (key !== lastSent) { lastSent = key; void report() } }, 700)
  }).observe(document.body, { childList: true, subtree: true, characterData: true })
  void report()
}
