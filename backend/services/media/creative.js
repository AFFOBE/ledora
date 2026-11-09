/**
 * Banner creative designer.
 *
 * Every post is built like a real social ad:
 *   real photo / AI image background -> brand gradient & shapes -> logo ->
 *   headline -> supporting line -> CTA -> handle/website.
 *
 * Brand colours come from the uploaded logo (when present), merged with the
 * category palette. Layouts keep text inside safe areas and always use a
 * readable scrim over photos, so a creative never looks like plain text on a
 * flat colour again.
 */

const sharp = require('sharp')

const FONT = 'Arial, Helvetica, sans-serif'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const escapeXml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const cleanText = (value = '') =>
  String(value)
    // Some stored fields can arrive HTML-escaped (e.g. "Web Design &amp;
    // Development"). Decode them once so the render does not double-escape.
    .replace(/&amp;/gi, '&')
    .replace(/&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/g, "'")
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[#*_`~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Word-boundary truncation with an ellipsis, for on-image labels. */
const clipLabel = (value = '', max = 30) => {
  const clean = cleanText(value)
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.5 ? cut.slice(0, space) : cut).trimEnd()}…`
}

const parseHex = (hex) => {
  const raw = String(hex || '').replace('#', '').trim()
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw
  if (!/^[0-9a-f]{6}$/i.test(full)) return null
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  }
}

const toHex = (r, g, b) =>
  '#' +
  [r, g, b]
    .map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0'))
    .join('')

const luminance = (hex) => {
  const rgb = parseHex(hex)
  if (!rgb) return 0.5
  const linear = [rgb.r, rgb.g, rgb.b].map((value) => {
    const c = value / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

const saturation = (hex) => {
  const rgb = parseHex(hex)
  if (!rgb) return 0
  const max = Math.max(rgb.r, rgb.g, rgb.b)
  const min = Math.min(rgb.r, rgb.g, rgb.b)
  return max === 0 ? 0 : (max - min) / max
}

const textOn = (hex) => (luminance(hex) > 0.45 ? '#101014' : '#FFFFFF')

const mix = (a, b, amount) => {
  const one = parseHex(a)
  const two = parseHex(b)
  if (!one || !two) return a
  return toHex(
    one.r + (two.r - one.r) * amount,
    one.g + (two.g - one.g) * amount,
    one.b + (two.b - one.b) * amount
  )
}

const shade = (hex, amount) =>
  mix(hex, amount < 0 ? '#000000' : '#FFFFFF', Math.abs(amount))

const isHex = (value) => /^#[0-9a-f]{6}$/i.test(String(value || '').trim())

const initials = (name) =>
  String(name || 'B')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()

const domainOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function paletteFor(brand = {}, fallback = []) {
  const list = [...(brand.palette || []), ...(fallback || [])]
    .map((hex) => String(hex || '').trim().toLowerCase())
    .filter(isHex)
  const unique = [...new Set(list)]
  const sorted = [...unique].sort((a, b) => luminance(a) - luminance(b))

  let dark = sorted[0] || '#141024'
  let light = sorted[sorted.length - 1] || '#F8FAFC'
  if (luminance(dark) > 0.28) dark = shade(dark, -0.48)
  if (luminance(light) < 0.82) light = shade(light, 0.55)
  if (dark === light) light = '#F8FAFC'

  const accentCandidates = unique.filter((hex) => hex !== dark && hex !== light)
  let accent = (accentCandidates.length ? accentCandidates : unique)
    .slice()
    .sort((a, b) => saturation(b) - saturation(a))[0] || '#6D33E7'
  if (luminance(accent) < 0.07) accent = shade(accent, 0.4)

  const mid =
    accentCandidates.find((hex) => hex !== accent) ||
    sorted[Math.floor(sorted.length / 2)] ||
    mix(dark, accent, 0.45)

  return {
    dark,
    mid: mid === dark ? mix(dark, accent, 0.4) : mid,
    accent,
    light,
    raw: unique,
  }
}

function wrapWords(text, maxChars) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (candidate.length > maxChars && line) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines
}

function fitHeadline(title, width, maxLines = 3) {
  const clean = cleanText(title) || 'Your next post'
  const margin = width > 900 ? 76 : 60
  const available = width - margin * 2
  let size = width > 900 ? 92 : 74
  let lines = []
  while (size > 42) {
    const chars = Math.max(12, Math.floor(available / (size * 0.52)))
    lines = wrapWords(clean, chars)
    if (lines.length <= maxLines) break
    size -= 6
  }
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines)
    const last = lines[maxLines - 1]
    lines[maxLines - 1] = `${last.slice(0, Math.max(8, last.length - 2))}…`
  }
  return { lines, size, lineHeight: Math.round(size * 1.08), margin }
}

const pill = ({ x, y, text, fill, color, fontSize = 27, paddingX = 30, height = 66, maxWidth = 900 }) => {
  const label = escapeXml(clipLabel(text, 46))
  // Bold Arial averages ~0.62em per glyph; a generous factor prevents the
  // label from being visually cut off at the rounded ends.
  const width = Math.min(
    maxWidth,
    Math.max(160, clipLabel(text, 46).length * fontSize * 0.62 + paddingX * 2)
  )
  const baseline = y + height / 2 + fontSize * 0.35
  if (width >= maxWidth && clipLabel(text, 46).length > 38) paddingX = 22
  return `
    <g>
      <rect x="${x}" y="${y}" rx="${height / 2}" width="${width}" height="${height}" fill="${fill}" />
      <text x="${x + paddingX}" y="${baseline}" font-family="${FONT}" font-size="${fontSize}" font-weight="700"
        fill="${color}" letter-spacing="0.3">${label}</text>
    </g>`
}

const badge = ({ x, y, text, bg, color, width = 164 }) => `
  <g>
    <rect x="${x}" y="${y}" rx="23" width="${width}" height="46" fill="${bg}" opacity="0.96"/>
    <text x="${x + width / 2}" y="${y + 30}" text-anchor="middle" font-family="${FONT}" font-size="19"
      font-weight="800" fill="${color}" letter-spacing="2">${escapeXml(String(text).toUpperCase())}</text>
  </g>`

/**
 * Logo tile + business name. Returns the SVG and the exact pixel box where the
 * real logo image must be composited.
 */
function brandHeader({ x, y, biz, color, muted, logo, tileSize = 118 }) {
  const tile = logo ? logo.tile : '#FFFFFF'
  const initialsColor = logo ? logo.onTile : '#111118'
  const markInset = Math.round(tileSize * 0.12)
  const markSize = tileSize - markInset * 2
  const name = escapeXml(cleanText(biz.name || 'Your Business').toUpperCase().slice(0, 26))
  const category = escapeXml(cleanText(biz.cat || 'SOCIAL CREATIVE').toUpperCase().slice(0, 30))

  return {
    svg: `
      <g>
        <rect x="${x}" y="${y}" rx="26" width="${tileSize}" height="${tileSize}" fill="${tile}" opacity="0.97"/>
        <rect x="${x + 0.5}" y="${y + 0.5}" rx="26" width="${tileSize - 1}" height="${tileSize - 1}"
          fill="none" stroke="#FFFFFF" stroke-opacity="0.28"/>
        ${
          logo
            ? ''
            : `<text x="${x + tileSize / 2}" y="${y + tileSize / 2 + 17}" text-anchor="middle"
                font-family="${FONT}" font-size="${Math.round(tileSize * 0.4)}" font-weight="800"
                fill="${initialsColor}">${escapeXml(initials(biz.name))}</text>`
        }
        <text x="${x + tileSize + 22}" y="${y + tileSize * 0.48}" font-family="${FONT}" font-size="29"
          font-weight="800" fill="${color}" letter-spacing="1.4">${name}</text>
        <text x="${x + tileSize + 22}" y="${y + tileSize * 0.78}" font-family="${FONT}" font-size="17"
          font-weight="700" fill="${muted}" letter-spacing="3.2">${category}</text>
      </g>`,
    placement: logo
      ? {
          left: x + markInset,
          top: y + markInset,
          width: markSize,
          height: markSize,
        }
      : null,
  }
}

function categoryTag({ x, y, text, color, size = 21 }) {
  const label = clipLabel(text, 30).toUpperCase()
  return `
    <g>
      <rect x="${x}" y="${y - 20}" width="${Math.max(90, label.length * size * 0.66 + 34)}" height="34"
        rx="17" fill="${color}" opacity="0.18"/>
      <text x="${x + 17}" y="${y + 3}" font-family="${FONT}" font-size="${size}" font-weight="800"
        fill="${color}" letter-spacing="2.4">${escapeXml(label)}</text>
    </g>`
}

function headlineBlock({ lines, x, y, size, lineHeight, color, weight = 800 }) {
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * lineHeight}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${color}" letter-spacing="-1.4">${escapeXml(
          line
        )}</text>`
    )
    .join('\n')
}

function supportBlock({ text, x, y, color, width, size = 25, maxLines = 2 }) {
  const clean = cleanText(text)
  if (!clean) return ''
  const lines = wrapWords(clean, Math.floor(width / (size * 0.52))).slice(0, maxLines)
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * Math.round(size * 1.35)}" font-family="${FONT}" font-size="${size}" font-weight="500" fill="${color}" opacity="0.88">${escapeXml(
          line
        )}</text>`
    )
    .join('\n')
}

function footerRow({ x, y, width, biz, color, muted }) {
  const handle = cleanText(biz.handle || '@yourbusiness').slice(0, 32)
  const site = (
    domainOf(biz.site) ||
    cleanText(biz.site || '').replace(/^https?:\/\//, '').replace(/\/$/, '') ||
    'ledora.app'
  ).slice(0, 34)
  return `
    <g>
      <line x1="${x}" y1="${y - 32}" x2="${width - x}" y2="${y - 32}" stroke="${color}" stroke-opacity="0.22"/>
      <text x="${x}" y="${y}" font-family="${FONT}" font-size="22" font-weight="600" fill="${muted}">${escapeXml(handle)}</text>
      <text x="${width - x}" y="${y}" text-anchor="end" font-family="${FONT}" font-size="22" font-weight="600" fill="${muted}">${escapeXml(site)}</text>
    </g>`
}

const metaFor = ({ item, biz, brand }) => ({
  cta: cleanText(item.cta || 'Book a free consultation').slice(0, 58),
  tag: cleanText(item.platformLabel || item.platform || biz.cat || '').slice(0, 34),
  support:
    cleanText(brand.tagline || '').slice(0, 115) ||
    cleanText(item.support || item.caption || '').slice(0, 115),
  badge: item.type === 'reel' ? 'AI REEL' : 'NEW POST',
})

/* ------------------------------- layouts -------------------------------- */

function layoutFullBleed({ w, h, item, biz, pal, headline, logo }) {
  const t = '#FFFFFF'
  const muted = '#FFFFFFC7'
  const meta = metaFor({ item, biz, brand: item.brand || {} })
  const headY = Math.round(h * 0.35)
  const headBottom = headY + headline.lines.length * headline.lineHeight
  const header = brandHeader({ x: 62, y: 58, biz, color: t, muted, logo })
  return {
    logo: header.placement,
    svg: `
      <defs>
        <linearGradient id="scrim" x1="0" y1="0" x2="1" y2="0.2">
          <stop offset="0%" stop-color="${pal.dark}" stop-opacity="0.95"/>
          <stop offset="58%" stop-color="${pal.dark}" stop-opacity="0.72"/>
          <stop offset="100%" stop-color="${pal.dark}" stop-opacity="0.26"/>
        </linearGradient>
        <linearGradient id="bottom" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${pal.dark}" stop-opacity="0"/>
          <stop offset="100%" stop-color="${pal.dark}" stop-opacity="0.95"/>
        </linearGradient>
      </defs>
      <rect width="${w}" height="${h}" fill="url(#scrim)"/>
      <rect x="0" y="${h * 0.52}" width="${w}" height="${h * 0.48}" fill="url(#bottom)"/>
      <rect x="0" y="0" width="10" height="${h}" fill="${pal.accent}"/>
      <circle cx="${w * 0.92}" cy="${h * 0.18}" r="${w * 0.26}" fill="${pal.accent}" opacity="0.18"/>
      <rect x="${w * 0.68}" y="${h * 0.62}" width="${w * 0.42}" height="${w * 0.42}" rx="46"
        fill="${pal.accent}" opacity="0.13" transform="rotate(16 ${w * 0.68} ${h * 0.62})"/>
      ${header.svg}
      ${meta.tag ? categoryTag({ x: 64, y: headY - 60, text: meta.tag, color: '#FFFFFF', size: 20 }) : ''}
      ${headlineBlock({ lines: headline.lines, x: 64, y: headY + 48, size: headline.size, lineHeight: headline.lineHeight, color: t })}
      ${supportBlock({ text: meta.support, x: 66, y: Math.min(headBottom + 58, h - 300), color: muted, width: w * 0.68, size: 24, maxLines: 2 })}
      ${pill({ x: 64, y: h - 214, text: meta.cta, fill: pal.accent, color: textOn(pal.accent), fontSize: 26, height: 66, maxWidth: w - 128 })}
      ${footerRow({ x: 64, y: h - 62, width: w, biz, color: t, muted })}
      ${badge({ x: w - 214, y: 62, text: meta.badge, bg: pal.accent, color: textOn(pal.accent) })}
    `,
  }
}

function layoutSplit({ w, h, item, biz, pal, headline, logo }) {
  const panelW = Math.round(w * 0.47)
  const tall = h > w * 1.2
  const t = '#FFFFFF'
  const muted = '#FFFFFFBE'
  const meta = metaFor({ item, biz, brand: item.brand || {} })
  const header = brandHeader({ x: 54, y: 56, biz, color: t, muted, logo, tileSize: 108 })
  const headY = Math.round(h * 0.35)
  const supportY = tall ? Math.round(h * 0.73) : Math.round(h * 0.66)
  return {
    logo: header.placement,
    svg: `
      <defs>
        <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${pal.dark}"/>
          <stop offset="100%" stop-color="${pal.mid}"/>
        </linearGradient>
      </defs>
      <rect width="${w}" height="${h}" fill="url(#panel)"/>
      <path d="M${panelW} 0 L${panelW + 86} 0 L${panelW} ${h} L${panelW - 86} ${h} Z" fill="${pal.accent}" opacity="0.22"/>
      <circle cx="${w * 0.82}" cy="${h * 0.16}" r="${w * 0.24}" fill="${pal.accent}" opacity="0.15"/>
      ${header.svg}
      ${meta.tag ? categoryTag({ x: 56, y: headY - 60, text: meta.tag, color: pal.accent, size: 19 }) : ''}
      ${headlineBlock({ lines: headline.lines, x: 56, y: headY + 46, size: Math.min(headline.size, 82), lineHeight: Math.round(Math.min(headline.size, 82) * 1.08), color: t })}
      ${supportBlock({ text: meta.support, x: 58, y: supportY, color: muted, width: panelW - 96, size: 22, maxLines: tall ? 3 : 2 })}
      ${pill({ x: 56, y: h - 214, text: meta.cta, fill: pal.accent, color: textOn(pal.accent), fontSize: 23, height: 62, paddingX: 24, maxWidth: panelW - 104 })}
      ${footerRow({ x: 56, y: h - 58, width: panelW, biz, color: t, muted })}
      ${badge({ x: w - 214, y: 62, text: meta.badge, bg: pal.accent, color: textOn(pal.accent) })}
    `,
  }
}

function layoutBottomPanel({ w, h, item, biz, pal, headline, logo }) {
  const tall = h > w * 1.2
  const t = '#FFFFFF'
  const muted = '#FFFFFFC2'
  const meta = metaFor({ item, biz, brand: item.brand || {} })
  const panelY = Math.round(h * 0.56)
  const header = brandHeader({ x: 62, y: 58, biz, color: t, muted, logo, tileSize: 108 })
  const lines = headline.lines.slice(0, tall ? 3 : 2)
  const headSize = Math.min(headline.size, tall ? 80 : 66)
  const headLineHeight = Math.round(headSize * 1.08)
  // Position the support line and CTA right below the headline so the bottom
  // panel never has a large empty gap between the text blocks.
  const headBottom = panelY + 150 + lines.length * headLineHeight
  const supportLines = wrapWords(cleanText(meta.support), Math.floor((w - 136) / 24)).slice(0, 2)
  const supportSize = tall ? 24 : 22
  const supportY = headBottom + Math.round(supportSize * 1.5)
  const pillHeight = tall ? 62 : 56
  const ctaY = supportY + supportLines.length * Math.round(supportSize * 1.4) + 34
  return {
    logo: header.placement,
    svg: `
      <defs>
        <linearGradient id="topscrim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${pal.dark}" stop-opacity="0.8"/>
          <stop offset="100%" stop-color="${pal.dark}" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="panelGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${pal.dark}" stop-opacity="0.98"/>
          <stop offset="100%" stop-color="${pal.mid}" stop-opacity="0.98"/>
        </linearGradient>
      </defs>
      <rect width="${w}" height="${h * 0.42}" fill="url(#topscrim)"/>
      <rect x="0" y="${panelY}" width="${w}" height="${h - panelY}" fill="url(#panelGrad)"/>
      <rect x="0" y="${panelY}" width="${w}" height="12" fill="${pal.accent}"/>
      <circle cx="${w * 0.88}" cy="${panelY + 90}" r="${w * 0.2}" fill="${pal.accent}" opacity="0.18"/>
      ${header.svg}
      ${meta.tag ? categoryTag({ x: 66, y: panelY + 58, text: meta.tag, color: pal.accent, size: 19 }) : ''}
      ${headlineBlock({ lines, x: 66, y: panelY + 150, size: headSize, lineHeight: headLineHeight, color: t })}
      ${supportBlock({ text: meta.support, x: 68, y: supportY, color: muted, width: w - 136, size: supportSize, maxLines: 2 })}
      ${pill({ x: 66, y: ctaY, text: meta.cta, fill: pal.accent, color: textOn(pal.accent), fontSize: tall ? 24 : 22, height: pillHeight, maxWidth: w - 132 })}
      ${badge({ x: w - 214, y: 62, text: meta.badge, bg: pal.accent, color: textOn(pal.accent) })}
    `,
  }
}

function layoutCard({ w, h, item, biz, pal, headline, logo }) {
  const tall = h > w * 1.2
  const meta = metaFor({ item, biz, brand: item.brand || {} })
  const panelY = Math.round(h * 0.54)
  const dark = pal.dark
  const muted = '#4B465C'
  const header = brandHeader({ x: 68, y: panelY - 58, biz, color: dark, muted, logo, tileSize: 110 })
  const lines = headline.lines.slice(0, tall ? 3 : 2)
  const headSize = Math.min(headline.size, tall ? 78 : 64)
  return {
    logo: header.placement,
    svg: `
      <defs>
        <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${pal.light}"/>
          <stop offset="100%" stop-color="${shade(pal.light, 0.32)}"/>
        </linearGradient>
        <linearGradient id="cardshade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${pal.dark}" stop-opacity="0"/>
          <stop offset="100%" stop-color="${pal.dark}" stop-opacity="0.55"/>
        </linearGradient>
      </defs>
      <rect x="0" y="${panelY}" width="${w}" height="${h - panelY}" fill="url(#paper)"/>
      <rect x="0" y="${panelY - 16}" width="${w}" height="16" fill="${pal.accent}"/>
      <rect x="48" y="48" width="${w - 96}" height="${panelY - 74}" rx="38" fill="none"
        stroke="#FFFFFF" stroke-opacity="0.55" stroke-width="6"/>
      <rect x="0" y="${panelY * 0.62}" width="${w}" height="${panelY * 0.38}" fill="url(#cardshade)"/>
      ${header.svg}
      ${meta.tag ? categoryTag({ x: 72, y: panelY + 58, text: meta.tag, color: pal.accent, size: 18 }) : ''}
      ${headlineBlock({ lines, x: 72, y: panelY + 146, size: headSize, lineHeight: Math.round(headSize * 1.06), color: dark })}
      ${supportBlock({ text: meta.support, x: 74, y: h - 226, color: muted, width: w - 148, size: 22, maxLines: tall ? 2 : 1 })}
      ${pill({ x: 72, y: h - 136, text: meta.cta, fill: pal.accent, color: textOn(pal.accent), fontSize: 23, height: 60, maxWidth: w - 144 })}
      ${badge({ x: w - 208, y: 68, text: meta.badge, bg: pal.dark, color: '#FFFFFF', width: 152 })}
      ${footerRow({ x: 72, y: h - 44, width: w, biz, color: dark, muted })}
    `,
  }
}

function layoutMagazine({ w, h, item, biz, pal, headline, logo }) {
  const tall = h > w * 1.2
  const t = '#FFFFFF'
  const muted = '#FFFFFFC2'
  const meta = metaFor({ item, biz, brand: item.brand || {} })
  const header = brandHeader({ x: 62, y: 58, biz, color: t, muted, logo, tileSize: 104 })
  const headY = tall ? h - 560 : h - 380
  const lines = headline.lines.slice(0, tall ? 3 : 2)
  const headSize = Math.min(headline.size, tall ? 86 : 72)
  return {
    logo: header.placement,
    svg: `
      <defs>
        <linearGradient id="magscrim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${pal.dark}" stop-opacity="0.55"/>
          <stop offset="42%" stop-color="${pal.dark}" stop-opacity="0.05"/>
          <stop offset="100%" stop-color="${pal.dark}" stop-opacity="0.97"/>
        </linearGradient>
        <linearGradient id="accentFade" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${pal.accent}" stop-opacity="0.65"/>
          <stop offset="100%" stop-color="${pal.mid}" stop-opacity="0.05"/>
        </linearGradient>
      </defs>
      <rect width="${w}" height="${h}" fill="url(#magscrim)"/>
      <rect x="0" y="0" width="${w}" height="${h * 0.46}" fill="url(#accentFade)" opacity="0.55"/>
      <text x="${w - 34}" y="${h * 0.46}" text-anchor="end" font-family="${FONT}" font-size="${w * 0.34}"
        font-weight="900" fill="#FFFFFF" opacity="0.08">${String(item.no || 1).padStart(2, '0')}</text>
      <rect x="62" y="${headY - 60}" width="118" height="8" rx="4" fill="${pal.accent}"/>
      ${header.svg}
      ${meta.tag ? categoryTag({ x: 64, y: headY - 84, text: meta.tag, color: '#FFFFFF', size: 20 }) : ''}
      ${headlineBlock({ lines, x: 64, y: headY + 10, size: headSize, lineHeight: Math.round(headSize * 1.07), color: t })}
      ${supportBlock({ text: meta.support, x: 66, y: tall ? h - 250 : h - 206, color: muted, width: w - 132, size: 23, maxLines: tall ? 2 : 1 })}
      <g>
        ${pill({ x: 64, y: h - 128, text: meta.cta, fill: pal.accent, color: textOn(pal.accent), fontSize: 23, height: 58, maxWidth: w - 128 })}
      </g>
      ${badge({ x: w - 208, y: 62, text: meta.badge, bg: pal.accent, color: textOn(pal.accent), width: 152 })}
    `,
  }
}

const LAYOUTS = [layoutFullBleed, layoutSplit, layoutBottomPanel, layoutCard, layoutMagazine]

function fallbackBackground({ w, h, pal, index = 0 }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${pal.dark}"/>
        <stop offset="100%" stop-color="${pal.mid}"/>
      </linearGradient>
      <pattern id="dots" width="54" height="54" patternUnits="userSpaceOnUse">
        <circle cx="6" cy="6" r="3" fill="#FFFFFF" opacity="0.14"/>
      </pattern>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    <rect width="${w}" height="${h}" fill="url(#dots)"/>
    <circle cx="${w * 0.84}" cy="${h * 0.2}" r="${w * 0.34}" fill="${pal.accent}" opacity="0.2"/>
    <circle cx="${w * 0.12}" cy="${h * 0.86}" r="${w * 0.3}" fill="${pal.accent}" opacity="0.13"/>
    <rect x="${w * (0.55 + (index % 3) * 0.08)}" y="${h * 0.52}" width="${w * 0.5}" height="${w * 0.5}"
      rx="54" fill="${pal.accent}" opacity="0.12" transform="rotate(${12 + index * 6} ${w * 0.7} ${h * 0.6})"/>
  </svg>`
}

/**
 * Renders one real PNG creative.
 *
 * @param {object} options
 * @param {object} options.item      Creative (title, cta, type, no...)
 * @param {object} options.biz       Business name/cat/site/handle
 * @param {object} options.brand     Brand palette + tagline
 * @param {number} options.index     Used to choose a layout
 * @param {Buffer} options.aiImage   Optional AI-generated background
 * @param {object} options.photo     Optional `{ buffer, source }` public photo
 * @param {object} options.logo      `{ buffer, tile, onTile }` from logo.js
 */
async function renderCreative({
  item,
  biz,
  brand = {},
  index = 0,
  aiImage = null,
  photo = null,
  logo = null,
}) {
  const width = 1080
  const height = item.type === 'reel' ? 1920 : 1080
  const safeItem = {
    ...item,
    title: cleanText(item.title || 'Your next big idea').slice(0, 90),
    cta: cleanText(item.cta || 'Book a free consultation').slice(0, 70),
    no: item.no || index + 1,
  }
  const safeBiz = {
    name: cleanText(biz.name || 'Your Business').slice(0, 60),
    cat: cleanText(biz.cat || '').slice(0, 50),
    site: biz.site || '',
    handle: biz.handle || '@yourbusiness',
  }
  const safeBrand = {
    ...brand,
    tagline: cleanText(brand.tagline || '').slice(0, 115),
    palette: Array.isArray(brand.palette) ? brand.palette : [],
  }
  if (!safeBrand.tagline) {
    safeBrand.tagline = [safeBiz.cat, cleanText(biz.city || '')].filter(Boolean).join(' · ')
  }

  const pal = paletteFor(safeBrand, item.gradFallback)
  const photoBuffer = aiImage || (photo && photo.buffer) || photo || null

  let base
  if (photoBuffer) {
    try {
      // Slight crop variation so two posts that share a backdrop still look
      // like different creatives in the feed.
      const scale = 1.16
      const scaledW = Math.round(width * scale)
      const scaledH = Math.round(height * scale)
      const scaled = await sharp(photoBuffer)
        .rotate()
        .resize(scaledW, scaledH, { fit: 'cover', position: 'attention' })
        .modulate({ brightness: 0.95, saturation: 1.05 })
        .toBuffer()
      const focus = [
        [0.5, 0.5],
        [0.24, 0.42],
        [0.76, 0.36],
        [0.38, 0.68],
        [0.66, 0.6],
      ][index % 5]
      const slackX = Math.max(0, scaledW - width)
      const slackY = Math.max(0, scaledH - height)
      base = await sharp(scaled)
        .extract({
          left: Math.round(slackX * focus[0]),
          top: Math.round(slackY * focus[1]),
          width,
          height,
        })
        .toBuffer()
    } catch (error) {
      console.warn('[creative] photo could not be used:', error.message)
      base = null
    }
  }
  if (!base) {
    base = await sharp(Buffer.from(fallbackBackground({ w: width, h: height, pal, index })))
      .png()
      .toBuffer()
  }

  const headline = fitHeadline(safeItem.title, width, height > width ? 4 : 3)
  const layout = LAYOUTS[index % LAYOUTS.length]
  const built = layout({
    w: width,
    h: height,
    item: { ...safeItem, brand: safeBrand },
    biz: safeBiz,
    pal,
    headline,
    logo,
  })

  const overlay = await sharp(
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${built.svg}</svg>`)
  )
    .png()
    .toBuffer()

  const composites = [{ input: overlay }]
  if (logo && logo.buffer && built.logo) {
    try {
      const mark = await sharp(logo.buffer)
        .resize(built.logo.width, built.logo.height, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer()
      composites.push({ input: mark, left: Math.round(built.logo.left), top: Math.round(built.logo.top) })
    } catch (error) {
      console.warn('[creative] logo compositing failed:', error.message)
    }
  }

  const buffer = await sharp(base).composite(composites).png({ compressionLevel: 8 }).toBuffer()
  return {
    buffer,
    width,
    height,
    ext: '.png',
    mimeType: 'image/png',
    aiBackground: Boolean(aiImage),
    photoSource: aiImage ? 'ai' : (photo && photo.source) || 'design',
  }
}

module.exports = { renderCreative, paletteFor, fitHeadline, cleanText }
