(function () {
  if (window.__ledoraWidgetLoaded) return
  window.__ledoraWidgetLoaded = true

  var script = document.currentScript || document.querySelector('script[data-bot-id]')
  if (!script) return

  var botId = script.getAttribute('data-bot-id')
  if (!botId) return

  var origin
  try {
    origin = new URL(script.src, window.location.href).origin
  } catch (e) {
    return
  }

  var allowed = [origin]
  try {
    allowed.push(window.location.origin)
  } catch (e) {}

  var WIDTH = 380
  var HEIGHT = 620
  var OPEN = false
  var READY = false

  var button = document.createElement('button')
  button.type = 'button'
  button.setAttribute('aria-label', 'Open chat')
  button.style.cssText = [
    'position:fixed', 'right:20px', 'bottom:20px', 'width:58px', 'height:58px',
    'border-radius:50%', 'border:0', 'cursor:pointer', 'z-index:2147483001',
    'background:linear-gradient(135deg,#6D33E7,#384FE7)', 'color:#fff',
    'box-shadow:0 10px 30px rgba(80,40,200,.45)', 'display:flex',
    'align-items:center', 'justify-content:center', 'font-size:24px',
    'transition:transform .18s ease'
  ].join(';')
  button.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.9-.9L3 21l1.9-4.8A8.4 8.4 0 1 1 21 11.5z"/></svg>'

  var frame = document.createElement('iframe')
  frame.src = origin + '/widget/' + encodeURIComponent(botId)
  frame.title = 'Chat assistant'
  frame.allow = 'clipboard-write'
  frame.style.cssText = [
    'position:fixed', 'right:20px', 'bottom:90px',
    'width:' + WIDTH + 'px', 'height:' + HEIGHT + 'px',
    'max-width:calc(100vw - 32px)', 'max-height:calc(100vh - 120px)',
    'border:0', 'border-radius:16px', 'overflow:hidden',
    'box-shadow:0 24px 70px rgba(0,0,0,.35)', 'z-index:2147483000',
    'background:#071225', 'display:none', 'opacity:0',
    'transition:opacity .18s ease', 'transform-origin:bottom right'
  ].join(';')

  function show() {
    OPEN = true
    frame.style.display = 'block'
    requestAnimationFrame(function () { frame.style.opacity = '1' })
    button.setAttribute('aria-label', 'Close chat')
    button.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  }

  function hide() {
    OPEN = false
    frame.style.opacity = '0'
    setTimeout(function () { if (!OPEN) frame.style.display = 'none' }, 180)
    button.setAttribute('aria-label', 'Open chat')
    button.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.9-.9L3 21l1.9-4.8A8.4 8.4 0 1 1 21 11.5z"/></svg>'
  }

  button.addEventListener('click', function () {
    if (OPEN) hide()
    else show()
  })

  window.addEventListener('message', function (event) {
    if (!frame.contentWindow || event.source !== frame.contentWindow) return
    if (allowed.indexOf(event.origin) === -1 && event.origin !== origin) return
    if (!event.data || typeof event.data !== 'object') return
    if (event.data.type === 'ledora:close') hide()
    if (event.data.type === 'ledora:ready') {
      READY = true
      if (!OPEN) {
        var delay = event.data.autoOpen === 'After 3 seconds' ? 3000 : event.data.autoOpen === 'After 5 seconds' ? 5000 : 800
        setTimeout(function () { if (!OPEN && READY) show() }, delay)
      }
    }
  })

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && OPEN) hide()
  })

  function mount() {
    document.body.appendChild(button)
    document.body.appendChild(frame)
  }

  if (document.body) mount()
  else document.addEventListener('DOMContentLoaded', mount)
})()
