/**
 * Logo helpers: load a brand logo once and derive a small, usable palette from
 * it. The palette is merged with the category palette so creatives always look
 * like the customer's own brand instead of a generic template.
 */

const sharp = require('sharp')

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const toHex = (r, g, b) =>
  '#' +
  [r, g, b]
    .map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0'))
    .join('')

const parseHex = (hex) => {
  const raw = String(hex || '').replace('#', '').trim()
  if (![3, 6].includes(raw.length)) return null
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw
  if (!/^[0-9a-f]{6}$/i.test(full)) return null
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  }
}

const luminanceOf = ({ r, g, b }) => {
  const linear = [r, g, b].map((value) => {
    const c = value / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

const saturationOf = ({ r, g, b }) => {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max === 0 ? 0 : (max - min) / max
}

const mix = (a, b, amount) =>
  toHex(
    a.r + (b.r - a.r) * amount,
    a.g + (b.g - a.g) * amount,
    a.b + (b.b - a.b) * amount
  )

const shift = (hex, amount) => {
  const rgb = parseHex(hex)
  if (!rgb) return hex
  const target = amount < 0 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 }
  return mix(rgb, target, Math.abs(amount))
}

const distance = (a, b) =>
  Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2)

function buildPalette(colors = []) {
  const entries = colors
    .map((entry) => {
      const value = entry && entry.hex ? entry.hex : entry
      const rgb = parseHex(value)
      if (!rgb) return null
      return {
        hex: toHex(rgb.r, rgb.g, rgb.b),
        rgb,
        count: Math.max(1, Number((entry && entry.count) || 1)),
      }
    })
    .filter(Boolean)
  if (!entries.length) return []

  const accentEntry =
    [...entries].sort((a, b) => saturationOf(b.rgb) - saturationOf(a.rgb))[0] ||
    entries[0]
  const darkest = [...entries].sort(
    (a, b) => luminanceOf(a.rgb) - luminanceOf(b.rgb)
  )[0]
  const lightest = [...entries].sort(
    (a, b) => luminanceOf(b.rgb) - luminanceOf(a.rgb)
  )[0]

  let dark = darkest.hex
  let light = lightest.hex
  const accent = accentEntry.hex
  if (luminanceOf(parseHex(dark)) > 0.32) dark = shift(dark, -0.42)
  if (light === dark || luminanceOf(parseHex(light)) < 0.76) light = shift(light, 0.55)
  if (light === dark) light = '#F8FAFC'

  const mid = mix(parseHex(dark), parseHex(accent), 0.45)
  return [...new Set([dark, mid, accent, light].filter(Boolean))]
}

/**
 * Loads, rotates and normalises a logo. Also reports whether the mark is light
 * or dark so the creative can place it on a contrasting tile.
 */
async function loadLogo(input) {
  if (!input) return null
  const source = Buffer.isBuffer(input) ? input : input
  const buffer = await sharp(source)
    .rotate()
    .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .png()
    .toBuffer()

  const { data, info } = await sharp(buffer)
    .resize(80, 80, { fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  let r = 0
  let g = 0
  let b = 0
  let weight = 0
  const buckets = new Map()

  for (let i = 0; i < data.length; i += info.channels) {
    const alpha = info.channels === 4 ? data[i + 3] : 255
    if (alpha < 140) continue
    const pr = data[i]
    const pg = data[i + 1]
    const pb = data[i + 2]
    const rgb = { r: pr, g: pg, b: pb }
    const lum = luminanceOf(rgb)
    const sat = saturationOf(rgb)

    // Ignore near-white / near-black background pixels for palette building,
    // but still use them to work out whether the logo itself is light or dark.
    if (lum > 0.96 || lum < 0.04) continue

    r += pr
    g += pg
    b += pb
    weight += 1

    const key = `${pr >> 4},${pg >> 4},${pb >> 4}`
    const bucket = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0, sat: 0 }
    bucket.r += pr
    bucket.g += pg
    bucket.b += pb
    bucket.n += 1
    bucket.sat += sat
    buckets.set(key, bucket)
  }

  const mean =
    weight > 0
      ? { r: r / weight, g: g / weight, b: b / weight }
      : { r: 128, g: 128, b: 128 }
  const meanLum = luminanceOf(mean)

  const ranked = [...buckets.values()]
    .map((bucket) => ({
      r: bucket.r / bucket.n,
      g: bucket.g / bucket.n,
      b: bucket.b / bucket.n,
      hex: toHex(bucket.r / bucket.n, bucket.g / bucket.n, bucket.b / bucket.n),
      count: bucket.n,
      sat: bucket.sat / bucket.n,
    }))
    .sort((a, b) => b.count * (0.35 + b.sat) - a.count * (0.35 + a.sat))

  const picked = []
  for (const entry of ranked) {
    if (picked.every((other) => distance(other, entry) > 55)) picked.push(entry)
    if (picked.length >= 5) break
  }

  const palette = buildPalette(
    picked.map((entry) => ({ hex: entry.hex, rgb: entry, count: entry.count }))
  )

  return {
    buffer,
    palette,
    luminance: meanLum,
    // A light logo needs a dark tile and vice versa.
    tile: meanLum > 0.48 ? '#111118' : '#FFFFFF',
    onTile: meanLum > 0.48 ? '#FFFFFF' : '#111118',
  }
}

module.exports = { loadLogo, buildPalette, shift }
