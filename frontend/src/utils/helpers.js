export const REQUIRED_BIZ_FIELDS = [
  { key: 'name', label: 'Business Name' },
]

export function missingBizFields(biz) {
  const src = biz || {}
  return REQUIRED_BIZ_FIELDS
    .filter((f) => !String(src[f.key] || '').trim())
    .map((f) => f.label)
}

export const RECOMMENDED_BIZ_FIELDS = [
  { key: 'cat', label: 'Business Category' },
  { key: 'owner', label: 'Contact Person Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone / WhatsApp' },
  { key: 'city', label: 'City / Location' },
  { key: 'about', label: 'About Your Business' },
  { key: 'aud', label: 'Target Audience' },
  { key: 'tone', label: 'Brand Tone' },
  { key: 'goal', label: 'Primary Goal' },
  { key: 'product', label: 'Main Product / Service' },
]

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]))
}

export function badgeClass(s) {
  if (s === 'New' || s === 'Won') return 'active'
  if (s === 'Qualified') return 'demo'
  if (s === 'Lost') return 'off'
  return 'blue'
}

export function fmt12(t) {
  const a = String(t).split(':')
  const h = +a[0]
  const m = a[1]
  const ap = h >= 12 ? 'PM' : 'AM'
  const hh = h % 12 || 12
  return hh + ':' + String(m).padStart(2, '0') + ' ' + ap
}

export function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function inr(n) {
  return '\u20B9' + Number(n).toLocaleString('en-IN')
}

export function copyText(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
    return true
  }
  return false
}

export function downloadCSV(filename, headers, rows) {
  const lines = [headers.join(',')]
  rows.forEach((r) => lines.push(r.map((a) => `"${String(a).replaceAll('"', '""')}"`).join(',')))
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}