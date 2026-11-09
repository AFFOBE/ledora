import DOMPurify from 'dompurify'

export const sanitizeHtml = (html) => {
  if (typeof html !== 'string') return ''
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'br', 'ul', 'ol', 'li', 'p', 'span'],
    ALLOWED_ATTR: [],
    ALLOW_DATA_ATTR: false,
  })
}

export const escapeText = (value) => {
  const text = String(value === undefined || value === null ? '' : value)
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
