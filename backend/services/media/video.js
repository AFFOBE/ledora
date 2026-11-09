/**
 * Reel renderer.
 *
 * An AI presenter portrait is animated with a real voice-driven mouth, gentle
 * body sway, a cinematic zoom and synced captions, then composited over a
 * content-matched background. The result is a real 1080x1920 MP4.
 *
 * If the voice service or a filter is unavailable the renderer falls back to a
 * simpler (still voiced) video so a reel is never lost.
 */

const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const ffmpegPath = require('ffmpeg-static')
const { cleanText, paletteFor } = require('./creative')
const { voiceoverTextFor, synthesizeVoice, splitIntoSegments } = require('./voice')
const { buildEnvelope, writeMouthFrames } = require('./mouth')

const FONT_CANDIDATES = [
  'C:/Windows/Fonts/arialbd.ttf',
  'C:/Windows/Fonts/seguisb.ttf',
  'C:/Windows/Fonts/arial.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
]

const fontPath = () => FONT_CANDIDATES.find((file) => fs.existsSync(file)) || ''

const runFfmpeg = (args, timeoutMs = 240000) =>
  new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true })
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('Video rendering timed out'))
    }, timeoutMs)

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
      if (stderr.length > 30000) stderr = stderr.slice(-30000)
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(stderr.trim().split('\n').slice(-4).join(' ') || `ffmpeg exited with ${code}`))
    })
  })

/** Reads duration from ffmpeg's stderr (ffprobe is not shipped with ffmpeg-static). */
function probeDuration(file) {
  return new Promise((resolve) => {
    if (!file || !fs.existsSync(file)) return resolve(0)
    const child = spawn(ffmpegPath, ['-hide_banner', '-i', file], { windowsHide: true })
    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', () => resolve(0))
    child.on('close', () => {
      const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
      if (!match) return resolve(0)
      resolve(Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]))
    })
  })
}

const escapeFilterPath = (file) =>
  String(file || '')
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")

const escapeXml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const wrapCaption = (text, maxChars = 36, maxLines = 3) => {
  const words = cleanText(text).split(/\s+/).filter(Boolean)
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
  if (lines.length <= maxLines) return lines.join('\n')
  const clipped = lines.slice(0, maxLines)
  clipped[maxLines - 1] = `${clipped[maxLines - 1].slice(0, maxChars - 2)}…`
  return clipped.join('\n')
}

const cube = (w, h, pal, index) => `
  <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${pal.dark}"/>
        <stop offset="58%" stop-color="${pal.mid}"/>
        <stop offset="100%" stop-color="${pal.dark}"/>
      </linearGradient>
      <pattern id="grid" width="64" height="64" patternUnits="userSpaceOnUse">
        <path d="M64 0H0V64" fill="none" stroke="#FFFFFF" stroke-opacity="0.05" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    <rect width="${w}" height="${h}" fill="url(#grid)"/>
    <circle cx="${w * 0.9}" cy="${h * 0.14}" r="${w * 0.4}" fill="${pal.accent}" opacity="0.18"/>
    <circle cx="${w * 0.04}" cy="${h * 0.7}" r="${w * 0.38}" fill="${pal.accent}" opacity="0.14"/>
    <rect x="0" y="0" width="10" height="${h}" fill="${pal.accent}"/>
    <rect x="54" y="1380" width="${w - 108}" height="300" rx="34" fill="${pal.dark}" opacity="0.5"/>
    <rect x="54" y="1380" width="${w - 108}" height="300" rx="34" fill="none" stroke="#FFFFFF" stroke-opacity="0.12"/>
    <rect x="180" y="360" width="720" height="880" rx="50" fill="${pal.accent}" opacity="0.18"/>
    <rect x="180" y="360" width="720" height="880" rx="50" fill="none" stroke="#FFFFFF" stroke-opacity="0.16" stroke-width="3"/>
    <text x="${w - 40}" y="${h * 0.24}" text-anchor="end" font-family="Arial, Helvetica, sans-serif"
      font-size="${w * 0.3}" font-weight="900" fill="#FFFFFF" opacity="0.06">${String(index + 1).padStart(2, '0')}</text>
  </svg>`

function presenterPosterSvg({ w, h, item, biz, pal, brand, logo }) {
  const title = cleanText(item.title || 'Your business update').slice(0, 90)
  const titleLines = wrapCaption(title, 30, 2).split('\n')
  const name = escapeXml(cleanText(biz.name || 'Your Business').toUpperCase().slice(0, 24))
  const category = escapeXml(cleanText(biz.cat || 'SOCIAL CREATIVE').toUpperCase().slice(0, 30))
  const cta = cleanText(item.cta || 'Book now').slice(0, 70)
  const tagline = escapeXml(cleanText(brand.tagline || '').slice(0, 80))
  const siteLabel = escapeXml(
    cleanText(biz.site || '')
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .slice(0, 34)
  )
  const tile = logo ? logo.tile : '#FFFFFF'
  const markInset = 13
  const markSize = 108 - markInset * 2
  const ctaWidth = Math.min(940, Math.max(170, cta.length * 12.2 + 56))

  return {
    logo: logo
      ? { left: 54 + markInset, top: 50 + markInset, width: markSize, height: markSize }
      : null,
    svg: `
      <g>
        <rect x="54" y="50" rx="26" width="108" height="108" fill="${tile}" opacity="0.97"/>
        <rect x="54.5" y="50.5" rx="26" width="107" height="107" fill="none" stroke="#FFFFFF" stroke-opacity="0.3"/>
        ${
          logo
            ? ''
            : `<text x="108" y="116" text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
                font-size="44" font-weight="800" fill="${logo ? logo.onTile : '#111118'}">${cleanText(
                biz.name || 'B'
              )
                .split(/\s+/)
                .slice(0, 2)
                .map((word) => word[0])
                .join('')
                .toUpperCase()}</text>`
        }
        <text x="184" y="104" font-family="Arial, Helvetica, sans-serif" font-size="29" font-weight="800"
          fill="#FFFFFF" letter-spacing="1.2">${name}</text>
        <rect x="184" y="122" rx="16" width="196" height="32" fill="${pal.accent}" opacity="0.95"/>
        <text x="282" y="144" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="17"
          font-weight="800" fill="#FFFFFF" letter-spacing="2">AI PRESENTER</text>
        <rect x="64" y="206" width="126" height="7" rx="4" fill="${pal.accent}"/>
        ${titleLines
          .map(
            (line, index) =>
              `<text x="64" y="${252 + index * 66}" font-family="Arial, Helvetica, sans-serif" font-size="58"
                font-weight="800" fill="#FFFFFF" letter-spacing="-1">${line
                  .replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')}</text>`
          )
          .join('')}
        <text x="66" y="352" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="700"
          fill="#FFFFFF" opacity="0.7" letter-spacing="1.6">${category}</text>
        ${tagline ? `<text x="66" y="1328" font-family="Arial, Helvetica, sans-serif" font-size="23" font-weight="500" fill="#FFFFFF" opacity="0.82">${tagline}</text>` : ''}
        <rect x="64" y="1292" rx="30" width="${ctaWidth}" height="60" fill="${pal.accent}"/>
        <text x="${64 + ctaWidth / 2}" y="1330" text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
          font-size="22" font-weight="800" fill="#FFFFFF">${cta
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')}</text>
        <line x1="64" y1="1810" x2="${w - 64}" y2="1810" stroke="#FFFFFF" stroke-opacity="0.18"/>
        <text x="64" y="1872" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="600"
          fill="#FFFFFF" opacity="0.74">AI generated by Ledora · ${name}</text>
        <text x="${w - 64}" y="1872" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="22"
          font-weight="600" fill="#FFFFFF" opacity="0.74">${siteLabel}</text>
      </g>`,
  }
}

/**
 * Writes the branded background and the presenter card as two separate layers,
 * so ffmpeg can move the presenter (body sway) and animate her mouth.
 */
async function renderPresenterLayers({
  presenter,
  logo,
  biz,
  brand,
  item,
  pal,
  backdrop,
  backgroundPath,
  presenterPath,
}) {
  const width = 1080
  const height = 1920

  const presenterCard = await sharp(presenter)
    .rotate()
    .resize(720, 960, { fit: 'cover', position: 'attention' })
    // Crop the bottom strip so the image-model watermark never appears in reels.
    .extract({ left: 0, top: 0, width: 720, height: 880 })
    .modulate({ brightness: 1.04, saturation: 1.03 })
    .composite([
      {
        input: Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="880"><rect width="720" height="880" rx="48" fill="#fff"/></svg>'
        ),
        blend: 'dest-in',
      },
    ])
    .composite([
      {
        input: Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="880"><rect x="2" y="2" width="716" height="876" rx="47" fill="none" stroke="#FFFFFF" stroke-opacity="0.22" stroke-width="3"/></svg>'
        ),
      },
    ])
    .png()
    .toBuffer()
  await sharp(presenterCard).png({ compressionLevel: 8 }).toFile(presenterPath)

  let background
  if (backdrop) {
    try {
      const photo = await sharp(backdrop)
        .rotate()
        .resize(width, height, { fit: 'cover', position: 'attention' })
        .blur(16)
        .modulate({ brightness: 0.68, saturation: 1.04 })
        .png()
        .toBuffer()
      const veil = await sharp(Buffer.from(cube(width, height, pal, item.no || 0)))
        .ensureAlpha(0.78)
        .png()
        .toBuffer()
      background = await sharp(photo).composite([{ input: veil }]).png().toBuffer()
    } catch (error) {
      console.warn('[video] content backdrop could not be used:', error.message)
    }
  }
  if (!background) {
    background = await sharp(Buffer.from(cube(width, height, pal, item.no || 0))).png().toBuffer()
  }

  const poster = presenterPosterSvg({ w: width, h: height, item, biz, pal, brand, logo })
  const overlay = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${poster.svg}</svg>`
    )
  )
    .png()
    .toBuffer()

  const composites = [{ input: overlay }]
  if (logo && logo.buffer && poster.logo) {
    const mark = await sharp(logo.buffer)
      .resize(poster.logo.width, poster.logo.height, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer()
    composites.push({ input: mark, left: poster.logo.left, top: poster.logo.top })
  }

  await sharp(background).composite(composites).png({ compressionLevel: 8 }).toFile(backgroundPath)
  return { backgroundPath, presenterPath, presenterCard }
}

function buildCaptionTimings(text, duration, segments) {
  const cleaned = segments && segments.length ? segments : splitIntoSegments(text)
  const totalChars = cleaned.reduce((total, segment) => total + Math.max(1, segment.length), 0)
  let cursor = 0.35
  return cleaned.map((segment, index) => {
    const share = Math.max(1, segment.length) / totalChars
    const isLast = index === cleaned.length - 1
    const span = isLast ? Math.max(1.2, duration - cursor - 0.25) : Math.max(1.5, share * (duration - 0.8))
    const start = cursor
    const end = isLast ? duration - 0.15 : Math.min(duration - 0.3, start + span)
    cursor = end - 0.05
    return { text: segment, start, end: Math.max(end, start + 0.8) }
  })
}

/**
 * Renders a full presenter reel.
 *
 * @returns {Promise<{ path: string, size: number, duration: number, captions: number, voice: boolean, talking: boolean }>}
 */
async function renderPresenterReel({
  presenter,
  logo,
  biz = {},
  brand = {},
  item = {},
  backdrop = null,
  outPath,
}) {
  if (!ffmpegPath) throw new Error('ffmpeg binary is unavailable')
  if (!presenter) throw new Error('AI presenter portrait is unavailable')

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const backgroundPath = path.join(path.dirname(outPath), `presenter-bg-${stamp}.png`)
  const presenterPath = path.join(path.dirname(outPath), `presenter-card-${stamp}.png`)
  const fallbackPath = path.join(path.dirname(outPath), `presenter-fallback-${stamp}.png`)
  const audioPath = path.join(path.dirname(outPath), `presenter-voice-${stamp}`)
  const captionFiles = []

  const pal = paletteFor(brand, ['#1B1035', '#6D33E7', '#D8CCFF'])

  const voiceText = voiceoverTextFor(item, biz)
  const voice = await synthesizeVoice(voiceText)
  let audio = null
  if (voice) {
    audio = `${audioPath}${voice.ext}`
    try {
      await fs.promises.copyFile(voice.path, audio)
    } catch {
      audio = voice.path
    }
  }

  const duration = audio
    ? Math.max(8, (await probeDuration(audio)) || Math.max(10, voiceText.split(/\s+/).length / 2.4))
    : Math.max(10, Math.min(45, voiceText.split(/\s+/).length / 2.4))

  const layers = await renderPresenterLayers({
    presenter,
    logo,
    biz,
    brand,
    item,
    pal,
    backdrop,
    backgroundPath,
    presenterPath,
  })

  // Build a voice-driven mouth sequence. If anything goes wrong the reel still
  // renders with the presenter visible (just without lip motion).
  const mouthFps = 15
  let mouth = null
  try {
    const envelope = await buildEnvelope(audio, duration, mouthFps)
    mouth = await writeMouthFrames({
      cardBuffer: layers.presenterCard,
      dir: path.dirname(outPath),
      prefix: `presenter-mouth-${stamp}`,
      envelope,
      fps: mouthFps,
    })
  } catch (error) {
    console.warn('[video] mouth animation skipped:', error.message)
    mouth = null
  }

  const timings = buildCaptionTimings(voiceText, duration)
  const fontFile = fontPath()
  const drawFilters = []

  if (fontFile) {
    timings.forEach((cue, index) => {
      const file = path.join(path.dirname(outPath), `presenter-cap-${stamp}-${index}.txt`)
      fs.writeFileSync(file, wrapCaption(cue.text), 'utf8')
      captionFiles.push(file)
      const label = index === 0 ? '[v0]' : `[c${index}]`
      const next = `[c${index + 1}]`
      drawFilters.push(
        `${label}drawtext=fontfile='${escapeFilterPath(fontFile)}':textfile='${escapeFilterPath(file)}':` +
          `expansion=none:fontcolor=white:fontsize=42:line_spacing=10:box=1:boxcolor=0x0B0B12@0.62:` +
          `boxborderw=22:x=(w-text_w)/2:y=h-520:enable='between(t,${cue.start.toFixed(2)},${cue.end.toFixed(
            2
          )})'${next}`
      )
    })
  }

  const finishLabel = drawFilters.length ? `[c${timings.length}]` : '[v0]'
  const fadeStart = Math.max(0.1, duration - 0.6)
  const tail =
    `${finishLabel}fade=t=in:st=0:d=0.4,fade=t=out:st=${fadeStart.toFixed(2)}:d=0.55,` +
    `format=yuv420p[vout]`

  const swayX = '180+5*sin(2*PI*t/5.3)'
  const swayY = '360+3.2*sin(2*PI*t/7.1)'

  const graph = []
  graph.push('[0:v]format=rgba[bg0]')
  graph.push('[1:v]format=rgba[pr0]')
  graph.push(`[bg0][pr0]overlay=x='${swayX}':y='${swayY}':shortest=0[v1]`)

  let composed = '[v1]'
  if (mouth) {
    const mouthX = mouth.crop.left
    const mouthY = mouth.crop.top
    graph.push(`[2:v]fps=30,format=rgba[mo0]`)
    graph.push(
      `[v1][mo0]overlay=x='${swayX}+${mouthX}':y='${swayY}+${mouthY}':shortest=0:eof_action=repeat[v2]`
    )
    composed = '[v2]'
  }

  graph.push(
    `${composed}scale=1188:2112,zoompan=z='min(zoom+0.00018,1.06)':` +
      `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30[bg]`
  )

  let audioMap = ''
  if (audio) {
    graph.push('[3:a]asplit=2[aout][aw]')
    graph.push('[aw]showwaves=s=820x120:mode=cline:rate=25:colors=0xFFFFFF@0.75[wave]')
    graph.push('[bg][wave]overlay=(W-w)/2:H-300:shortest=1[v0]')
    audioMap = '[aout]'
  } else {
    graph.push('[bg]null[v0]')
  }

  graph.push(...drawFilters)
  graph.push(tail)
  const filterComplex = graph.join(';')

  const args = [
    '-y',
    '-loop',
    '1',
    '-framerate',
    '30',
    '-i',
    backgroundPath,
    '-loop',
    '1',
    '-framerate',
    '30',
    '-i',
    presenterPath,
  ]
  if (mouth) {
    args.push(
      '-framerate',
      String(mouthFps),
      '-start_number',
      '0',
      '-i',
      mouth.pattern || path.join(path.dirname(outPath), `presenter-mouth-${stamp}-%04d.jpg`)
    )
  }
  if (audio) args.push('-i', audio)
  args.push(
    '-filter_complex',
    filterComplex,
    '-map',
    '[vout]',
    ...(audioMap ? ['-map', audioMap] : []),
    '-t',
    duration.toFixed(2),
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '23',
    '-pix_fmt',
    'yuv420p',
    ...(audio ? ['-c:a', 'aac', '-b:a', '128k'] : ['-an']),
    '-movflags',
    '+faststart',
    outPath,
  )

  try {
    await runFfmpeg(args)
  } catch (error) {
    console.warn('[video] full presenter render failed, trying simple render:', error.message)
    // The most common failure is a filter issue. Keep the presenter and audio,
    // but drop the animated mouth, captions and waveform.
    const fallbackBase = await sharp(backgroundPath)
      .composite([{ input: presenterPath, left: 180, top: 360 }])
      .png()
      .toFile(fallbackPath)
    const simpleArgs = [
      '-y',
      '-loop',
      '1',
      '-framerate',
      '30',
      '-i',
      fallbackPath,
    ]
    if (audio) simpleArgs.push('-i', audio)
    simpleArgs.push(
      '-vf',
      `scale=1080:1920,fade=t=in:st=0:d=0.4,fade=t=out:st=${fadeStart.toFixed(2)}:d=0.55,format=yuv420p`,
      '-t',
      duration.toFixed(2),
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      ...(audio ? ['-c:a', 'aac', '-b:a', '128k'] : ['-an']),
      '-movflags',
      '+faststart',
      outPath,
    )
    await runFfmpeg(simpleArgs)
    void fallbackBase
  } finally {
    await fs.promises.unlink(backgroundPath).catch(() => {})
    await fs.promises.unlink(presenterPath).catch(() => {})
    await fs.promises.unlink(fallbackPath).catch(() => {})
    captionFiles.forEach((file) => fs.promises.unlink(file).catch(() => {}))
    if (mouth) mouth.frames.forEach((file) => fs.promises.unlink(file).catch(() => {}))
    if (audio && audio.startsWith(audioPath)) fs.promises.unlink(audio).catch(() => {})
  }

  const stat = await fs.promises.stat(outPath)
  if (!stat.size) throw new Error('ffmpeg produced an empty video')
  return {
    path: outPath,
    size: stat.size,
    duration: Number(duration.toFixed(2)),
    captions: timings.length,
    voice: Boolean(audio),
    talking: Boolean(mouth),
  }
}

/** Silent poster zoom, used only if the presenter pipeline fails. */
async function renderReelVideo({ imagePath, outPath }) {
  if (!ffmpegPath) throw new Error('ffmpeg binary is unavailable')
  if (!fs.existsSync(imagePath)) throw new Error('Reel poster image is missing')

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  const filter = [
    'scale=1350:2400',
    "zoompan=z='min(zoom+0.0009,1.16)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30",
    'fade=t=in:st=0:d=0.6',
    'fade=t=out:st=7.2:d=0.8',
    'format=yuv420p',
  ].join(',')

  try {
    await runFfmpeg([
      '-y', '-loop', '1', '-framerate', '30', '-i', imagePath, '-t', '8',
      '-vf', filter, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24',
      '-movflags', '+faststart', '-an', outPath,
    ])
  } catch (error) {
    console.warn('[video] zoom render failed, retrying static:', error.message)
    await runFfmpeg([
      '-y', '-loop', '1', '-framerate', '30', '-i', imagePath, '-t', '8',
      '-vf', 'scale=1080:1920,fade=t=in:st=0:d=0.6,fade=t=out:st=7.2:d=0.8,format=yuv420p',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24',
      '-movflags', '+faststart', '-an', outPath,
    ])
  }

  const stat = await fs.promises.stat(outPath)
  if (!stat.size) throw new Error('ffmpeg produced an empty video')
  return { path: outPath, size: stat.size }
}

module.exports = { renderPresenterReel, renderReelVideo, probeDuration }
