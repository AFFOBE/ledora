/**
 * Voice-driven talking-mouth animation.
 *
 * The presenter portrait is a still AI photo. Instead of painting a second,
 * fake mouth on top of it (which always looks pasted on) we warp the *real*
 * lips apart, driven by the real voiceover envelope:
 *
 *   upper lip + skin above  -> moves up
 *   lower lip + jaw/chin    -> moves down
 *   the gap between them    -> filled with a natural mouth interior
 *
 * Because the lip pixels, gloss and skin tones are the original photo, the
 * result reads as the same face speaking instead of a sticker over the mouth.
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { spawn } = require('child_process')
const sharp = require('sharp')
const ffmpegPath = require('ffmpeg-static')

const FACE_MODELS_DIR = path.join(__dirname, '..', '..', 'ai-models', 'faceapi')

// Mouth position as a fraction of the 720x880 presenter card. These defaults
// match the cached presenter composition; locateMouth() refines them from the
// actual pixels when possible.
const MOUTH_BOX = { x: 0.403, y: 0.532, w: 0.18, h: 0.051 }

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const avg = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0)
const mix = (a, b, t) => a + (b - a) * t
const mixRgb = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]

/**
 * Refines the mouth position inside the expected area using lip colour. This
 * keeps the warp aligned even if a regenerated portrait shifts the face a bit.
 */
function locateMouth(raw, width, height) {
  const box = {
    x: MOUTH_BOX.x * width,
    y: MOUTH_BOX.y * height,
    w: MOUTH_BOX.w * width,
    h: MOUTH_BOX.h * height,
  }
  const winX0 = Math.max(0, Math.floor(box.x - width * 0.11))
  const winX1 = Math.min(width, Math.ceil(box.x + width * 0.11))
  const winY0 = Math.max(0, Math.floor(box.y - height * 0.075))
  const winY1 = Math.min(height, Math.ceil(box.y + height * 0.075))
  const lipPixels = []

  for (let y = winY0; y < winY1; y++) {
    for (let x = winX0; x < winX1; x++) {
      const i = (y * width + x) * 4
      const r = raw[i]
      const g = raw[i + 1]
      const b = raw[i + 2]
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const sat = max === 0 ? 0 : (max - min) / max
      const lum = 0.299 * r + 0.587 * g + 0.114 * b
      if (sat > 0.45 && lum > 55 && lum < 165 && r > 110 && r - g > 32 && r - b > 22) {
        lipPixels.push([x, y])
      }
    }
  }

  let lip = { r: 190, g: 86, b: 96 }
  if (lipPixels.length > 40) {
    const scored = lipPixels
      .map(([x, y]) => {
        const i = (y * width + x) * 4
        const r = raw[i]
        const g = raw[i + 1]
        const b = raw[i + 2]
        const max = Math.max(r, g, b)
        const sat = max === 0 ? 0 : (max - Math.min(r, g, b)) / max
        return { r, g, b, sat, score: r - (g + b) / 2 }
      })
      .filter((p) => p.r > 145 && p.sat > 0.48)
      .sort((a, b) => b.score - a.score)
    const keep = scored.slice(0, Math.max(20, Math.floor(scored.length * 0.35)))
    lip = {
      r: avg(keep.map((p) => p.r)),
      g: avg(keep.map((p) => p.g)),
      b: avg(keep.map((p) => p.b)),
    }
  }

  if (lipPixels.length > 120) {
    const xs = lipPixels.map((p) => p[0]).sort((a, b) => a - b)
    const ys = lipPixels.map((p) => p[1]).sort((a, b) => a - b)
    const q = (list, f) => list[Math.floor((list.length - 1) * f)]
    const x0 = q(xs, 0.08)
    const x1 = q(xs, 0.92)
    const y0 = q(ys, 0.08)
    const y1 = q(ys, 0.92)
    const w = clamp(x1 - x0, width * 0.12, width * 0.185)

    // The lips part on the dark seam between them, which sits in the upper
    // third of the lip mass (the lower lip is much thicker). Finding the
    // darkest row in the centre of the mouth gives a natural hinge line.
    let seam = (y0 + y1) / 2
    let darkest = Infinity
    const seamX0 = Math.max(0, Math.floor(x0 + w * 0.18))
    const seamX1 = Math.min(width - 1, Math.ceil(x1 - w * 0.18))
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(height - 1, Math.ceil(y1)); y++) {
      let total = 0
      let count = 0
      for (let x = seamX0; x <= seamX1; x++) {
        const i = (y * width + x) * 4
        total += 0.299 * raw[i] + 0.587 * raw[i + 1] + 0.114 * raw[i + 2]
        count++
      }
      const lum = count ? total / count : 255
      if (lum < darkest) {
        darkest = lum
        seam = y
      }
    }

    return {
      x: (x0 + x1) / 2,
      y: seam,
      w,
      h: clamp(y1 - y0, height * 0.036, height * 0.052),
      top: y0,
      bottom: y1,
      lip,
      detected: true,
    }
  }

  return { ...box, top: box.y - box.h / 2, bottom: box.y + box.h / 2, lip, detected: false }
}

/* ------------------------------------------------------------------ */
/* Precise face-landmark mouth detection (MediaPipe-style 68 points)   */
/* ------------------------------------------------------------------ */

let faceNetState = null
const mouthCache = new Map()

function faceApi() {
  // Bundled weights live in backend/ai-models/faceapi. The node-wasm build of
  // @vladmandic/face-api runs on the plain TensorFlow.js CPU backend, which needs
  // no native compilation and works everywhere.
  return require('@vladmandic/face-api/dist/face-api.node-wasm.js')
}

/**
 * Detects the presenter's real mouth with a 68-point face landmark model.
 * Returns `{ x, y, w, h, top, bottom, lip }` in card pixel space or null.
 */
async function detectMouthLandmarks(cardRaw, width, height) {
  const key = crypto.createHash('sha1').update(String(width) + 'x' + String(height)).digest('hex')
  const hash = crypto.createHash('sha1').update(cardRaw).digest('hex') + key
  if (mouthCache.has(hash)) return mouthCache.get(hash)

  try {
    const faceapi = faceApi()
    if (!faceNetState) {
      await faceapi.tf.setBackend('cpu').catch(() => {})
      await faceapi.tf.ready().catch(() => {})
      await faceapi.nets.tinyFaceDetector.loadFromDisk(FACE_MODELS_DIR)
      await faceapi.nets.faceLandmark68Net.loadFromDisk(FACE_MODELS_DIR)
      faceNetState = { faceapi, error: null }
    }
    const { tf } = faceNetState.faceapi

    // writeMouthFrames works on RGBA raw buffers; the detector needs 3 channels.
    const pixelCount = width * height
    let bytes
    if (cardRaw.length === pixelCount * 4) {
      bytes = new Float32Array(pixelCount * 3)
      for (let p = 0; p < pixelCount; p++) {
        bytes[p * 3] = cardRaw[p * 4]
        bytes[p * 3 + 1] = cardRaw[p * 4 + 1]
        bytes[p * 3 + 2] = cardRaw[p * 4 + 2]
      }
    } else {
      bytes = new Float32Array(cardRaw.length)
      for (let i = 0; i < cardRaw.length; i++) bytes[i] = cardRaw[i]
    }
    const tensor = tf.tensor3d(bytes, [height, width, 3], 'float32')
    const detection = await faceapi
      .detectSingleFace(
        tensor,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.22 })
      )
      .withFaceLandmarks(false)
    tensor.dispose()
    if (!detection || !detection.landmarks) {
      mouthCache.set(hash, null)
      return null
    }

    const pts = detection.landmarks.positions
    // Mouth: corners 48/54, outer centre top 51, bottom 57, inner tops 60-63,
    // inner bottoms 64-67. Everything below is expressed in card coordinates.
    const cornerL = pts[48]
    const cornerR = pts[54]
    const upper = pts.slice(60, 64).reduce((acc, p) => ({ x: acc.x + p.x / 4, y: acc.y + p.y / 4 }), { x: 0, y: 0 })
    const lower = pts.slice(64, 68).reduce((acc, p) => ({ x: acc.x + p.x / 4, y: acc.y + p.y / 4 }), { x: 0, y: 0 })
    const outerTop = pts[51]
    const outerBottom = pts[57]

    const cx = (cornerL.x + cornerR.x) / 2
    const w = Math.max(48, Math.hypot(cornerR.x - cornerL.x, cornerR.y - cornerL.y))
    // Hinge the opening at the LOWER inner lip, not between the two. The
    // painted gap then always appears below the real upper lip (like a real
    // mouth parting), never as a white streak across the lips.
    const seamY = lower.y
    const lipH = Math.max(22, (seamY - upper.y) * 0.5 + Math.hypot(outerBottom.x - outerTop.x, outerBottom.y - outerTop.y) * 1.05)

    // Sample the gloss/colour near the outer lip line, above the seam.
    const sx = Math.round(cx)
    const sy = Math.round(clamp((upper.y + outerTop.y) / 2, 0, height - 1))
    const si = (sy * width + sx) * 4
    const lip = { r: cardRaw[si], g: cardRaw[si + 1], b: cardRaw[si + 2] }
    if (!Number.isFinite(lip.r) || lip.r < 40) lip.r = 170
    if (!Number.isFinite(lip.g)) lip.g = 70
    if (!Number.isFinite(lip.b)) lip.b = 78

    const mouth = {
      x: cx,
      y: clamp(seamY, 0, height - 1),
      w,
      h: lipH,
      top: outerTop.y,
      bottom: outerBottom.y,
      lip,
      detected: true,
      landmarks: true,
    }
    mouthCache.set(hash, mouth)
    return mouth
  } catch (error) {
    console.warn(`[mouth] landmark detection unavailable: ${error.message}`)
    faceNetState = faceNetState ? { ...faceNetState, error: error.message } : null
    return null
  }
}

/** Bilinear sample from an RGBA raw buffer. */
function sampleBilinear(raw, width, height, x, y) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(width - 1, x0 + 1)
  const y1 = Math.min(height - 1, y0 + 1)
  const fx = x - x0
  const fy = y - y0
  const cx0 = clamp(x0, 0, width - 1)
  const cy0 = clamp(y0, 0, height - 1)
  const i00 = (cy0 * width + cx0) * 4
  const i10 = (cy0 * width + x1) * 4
  const i01 = (y1 * width + cx0) * 4
  const i11 = (y1 * width + x1) * 4
  return [
    mix(mix(raw[i00], raw[i10], fx), mix(raw[i01], raw[i11], fx), fy),
    mix(mix(raw[i00 + 1], raw[i10 + 1], fx), mix(raw[i01 + 1], raw[i11 + 1], fx), fy),
    mix(mix(raw[i00 + 2], raw[i10 + 2], fx), mix(raw[i01 + 2], raw[i11 + 2], fx), fy),
  ]
}

/**
 * Builds the crop box around the mouth: enough room for the nose above and the
 * jaw below, so the whole lower face moves together.
 */
function mouthCrop(mouth, width, height) {
  const cropW = Math.round(clamp(mouth.w * 2.7, 240, width))
  const cropH = Math.round(clamp(mouth.h * 8.2, 300, height))
  const left = Math.round(clamp(mouth.x - cropW / 2, 0, width - cropW))
  const top = Math.round(clamp(mouth.y - cropH * 0.44, 0, height - cropH))
  return { left, top, width: cropW, height: cropH }
}

/**
 * Warps one mouth frame. Returns a small RGBA crop that replaces the mouth area
 * of the presenter card. Openness is 0..1.
 *
 * Design notes (tuned against real renders):
 *  - The opening stays small (<= ~13 px on the 720 px card). Real talking
 *    mouths open far less than the old 31 px warp, which read as a pasted
 *    crescent instead of speech.
 *  - Cavity colours are sampled from the photo's own lip seam, so the inside of
 *    the mouth inherits the exact lighting/gloss of the portrait.
 *  - Blending is feathered and the jaw is pulled much less, which stops the
 *    lower face from smearing.
 */
function warpMouthCrop(fullRaw, width, height, mouth, crop, openness) {
  const open = clamp(Number(openness) || 0, 0, 1)
  const out = Buffer.alloc(crop.width * crop.height * 4)
  const cx = mouth.x
  const my = mouth.y
  const lipH = Math.max(24, mouth.h)
  const lipW = Math.max(70, mouth.w)
  const radX = lipW * 0.54

  const openPx = Math.min(open * lipH * 0.42, 11)
  const upperShift = openPx * 0.14
  const lowerShift = openPx * 0.7
  const canOpen = openPx > 1.6
  const plateau = lipH * 0.2

  // Interior colours are derived from the photo itself: the darkest pixels
  // around the lip seam carry the true shadow colour of this face.
  let seamDark = [42, 14, 20]
  let skinTone = [226, 178, 168]
  const sampleCount = { seam: 0, skin: 0 }
  const seamY = Math.round(my)
  for (let y = seamY - 1; y <= seamY + 1; y++) {
    if (y < 0 || y >= height) continue
    for (let x = Math.round(cx - radX * 0.8); x <= Math.round(cx + radX * 0.8); x++) {
      if (x <= 0 || x >= width - 1) continue
      const i = (y * width + x) * 4
      const r = fullRaw[i]
      const g = fullRaw[i + 1]
      const b = fullRaw[i + 2]
      const lum = 0.299 * r + 0.587 * g + 0.114 * b
      if (lum < 118) {
        seamDark[0] += r
        seamDark[1] += g
        seamDark[2] += b
        sampleCount.seam++
      }
    }
  }
  for (let y = seamY + 8; y <= seamY + 26; y += 6) {
    if (y < 0 || y >= height) continue
    for (const x of [Math.round(cx - radX * 1.15), Math.round(cx + radX * 1.15)]) {
      if (x <= 0 || x >= width - 1) continue
      const i = (y * width + x) * 4
      skinTone[0] = (skinTone[0] * sampleCount.skin + fullRaw[i]) / (sampleCount.skin + 1)
      skinTone[1] = (skinTone[1] * sampleCount.skin + fullRaw[i + 1]) / (sampleCount.skin + 1)
      skinTone[2] = (skinTone[2] * sampleCount.skin + fullRaw[i + 2]) / (sampleCount.skin + 1)
      sampleCount.skin++
    }
  }
  if (sampleCount.seam > 6) seamDark = seamDark.map((c) => c / sampleCount.seam)
  else seamDark = [40, 14, 20]

  // Interior colours, warmed with the detected lip/skin tones.
  const lipBase = [mouth.lip.r, mouth.lip.g, mouth.lip.b]
  const cavityTop = mixRgb(seamDark, [26, 8, 12], 0.42)
  const cavityMid = mixRgb(cavityTop, [92, 30, 38], 0.42)
  const cavityBottom = mixRgb(cavityMid, [118, 48, 54], 0.5)
  const teethColor = mixRgb([236, 228, 216], skinTone, 0.12)
  const tongueColor = mixRgb([128, 52, 60], lipBase, 0.24)

  for (let yy = 0; yy < crop.height; yy++) {
    const y = crop.top + yy
    for (let xx = 0; xx < crop.width; xx++) {
      const x = crop.left + xx
      const di = (yy * crop.width + xx) * 4

      const nx = Math.abs(x - cx) / radX
      const fx = nx >= 1 ? 0 : Math.pow(Math.cos((nx * Math.PI) / 2), 0.55)

      let srcY = y
      let fill = false

      if (canOpen && fx > 0.01) {
        const topEdge = my - upperShift * fx
        const bottomEdge = my + lowerShift * fx
        if (y >= topEdge && y <= bottomEdge) {
          fill = true
        } else if (y < topEdge) {
          const d = my - y
          const fall = d <= plateau ? 1 : Math.max(0, 1 - (d - plateau) / (lipH * 1.6))
          srcY = y + upperShift * fx * fall
        } else {
          // The jaw/chin moves down with the lower lip, but strongly damped and
          // with a wide falloff, so the lower face never stretches visibly.
          const d = y - my
          const fall = d <= plateau ? 1 : Math.max(0, 1 - (d - plateau) / (lipH * 3.4))
          srcY = y - lowerShift * fx * fall * 0.55
        }
      }

      if (fill) {
        const topEdge = my - upperShift * fx
        const bottomEdge = my + lowerShift * fx
        const gapH = Math.max(1, bottomEdge - topEdge)
        const t = clamp((y - topEdge) / gapH, 0, 1)
        const half = lipW * 0.42 * Math.pow(Math.sin(Math.PI * clamp(t, 0.015, 0.985)), 0.42)
        const dx = Math.abs(x - cx)

        if (dx <= half) {
          let color = cavityTop
          if (t > 0.28) color = mixRgb(cavityTop, cavityMid, Math.min(1, (t - 0.28) / 0.34))
          if (t > 0.62) color = mixRgb(color, cavityBottom, (t - 0.62) / 0.38)

          // Upper teeth appear as a thin, dim band on clear vowels only.
          const teethDepth = openPx > 4.5 ? clamp(lipH * 0.34 / gapH, 0.14, 0.26) : 0
          if (teethDepth && t < teethDepth) {
            const toothT = t / teethDepth
            const dimTeeth = mixRgb([212, 205, 194], skinTone, 0.24)
            color = mixRgb(dimTeeth, cavityTop, toothT * toothT * 0.55)
          } else if (openPx > 9 && t > 0.76) {
            // Tongue barely visible low in the mouth on big openings.
            const tongueT = (t - 0.76) / 0.24
            color = mixRgb(color, tongueColor, Math.min(1, tongueT * 1.1))
          }

          const under = sampleBilinear(fullRaw, width, height, x, srcY)
          const edgeX = clamp((half - dx) / 4.4, 0, 1)
          const edgeY = clamp(Math.min(t, 1 - t) / 0.17, 0, 1)
          const alpha = edgeX * edgeY
          out[di] = Math.round(mix(under[0], color[0], alpha))
          out[di + 1] = Math.round(mix(under[1], color[1], alpha))
          out[di + 2] = Math.round(mix(under[2], color[2], alpha))
          out[di + 3] = 255
          continue
        }
      }

      const sy = clamp(srcY, 0, height - 1)
      if (sy === y) {
        const si = (y * width + x) * 4
        out[di] = fullRaw[si]
        out[di + 1] = fullRaw[si + 1]
        out[di + 2] = fullRaw[si + 2]
        out[di + 3] = fullRaw[si + 3]
      } else {
        const pixel = sampleBilinear(fullRaw, width, height, x, sy)
        out[di] = Math.round(pixel[0])
        out[di + 1] = Math.round(pixel[1])
        out[di + 2] = Math.round(pixel[2])
        out[di + 3] = 255
      }
    }
  }

  return out
}

/** Reads mono PCM from the voice file so mouth shapes follow the real audio. */
function readPcm(file, sampleRate = 8000) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      file,
      '-f',
      's16le',
      '-ac',
      '1',
      '-ar',
      String(sampleRate),
      '-',
    ])
    const chunks = []
    child.stdout.on('data', (chunk) => chunks.push(chunk))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error('Could not decode the voiceover'))
      resolve(Buffer.concat(chunks))
    })
  })
}

/**
 * Builds one openness value per video frame from the voiceover amplitude.
 * Values are normalised to the loud parts of the clip and smoothed so the mouth
 * opens/closes naturally instead of flickering.
 */
async function buildEnvelope(audioPath, duration, fps = 15) {
  const frames = Math.max(1, Math.ceil(duration * fps))
  if (!audioPath || !fs.existsSync(audioPath)) return new Array(frames).fill(0)
  let pcm
  try {
    pcm = await readPcm(audioPath)
  } catch {
    return new Array(frames).fill(0)
  }
  const sampleRate = 8000
  const perFrame = Math.max(1, Math.round(sampleRate / fps))
  const rms = []
  for (let i = 0; i < frames; i++) {
    const start = i * perFrame * 2
    const end = Math.min(pcm.length, start + perFrame * 2)
    let sum = 0
    let count = 0
    for (let j = start; j < end; j += 2) {
      const sample = pcm.readInt16LE(j) / 32768
      sum += sample * sample
      count++
    }
    rms.push(count ? Math.sqrt(sum / count) : 0)
  }

  const sorted = [...rms].sort((a, b) => a - b)
  const loud = sorted[Math.floor((sorted.length - 1) * 0.9)] || sorted[sorted.length - 1] || 1
  const floor = sorted[Math.floor((sorted.length - 1) * 0.22)] || 0
  const span = Math.max(0.008, loud - floor)

  let smoothed = 0
  return rms.map((value, index) => {
    const level = clamp((value - floor * 0.7) / span, 0, 1)
    const target = level < 0.07 ? 0 : Math.pow(level, 0.72)
    smoothed = target > smoothed ? smoothed * 0.32 + target * 0.68 : smoothed * 0.68 + target * 0.32
    // A tiny natural wobble keeps repeated syllables from looking mechanical.
    const wobble = 0.95 + 0.05 * Math.sin(index * 1.7)
    return clamp(smoothed * wobble, 0, 1)
  })
}

/**
 * Writes the warped mouth crop sequence consumed by ffmpeg. Each frame is a
 * small PNG plus the exact position where it must be overlaid on the card.
 */
async function writeMouthFrames({ cardBuffer, dir, prefix, envelope, fps = 15 }) {
  const { data, info } = await sharp(cardBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const lips = await detectMouthLandmarks(data, info.width, info.height)
  const mouth = lips || locateMouth(data, info.width, info.height)
  const crop = mouthCrop(mouth, info.width, info.height)
  const frames = new Array(envelope.length)
  const extension = '.jpg'
  const concurrency = 8
  let cursor = 0

  const workers = Array.from({ length: Math.min(concurrency, envelope.length) }, async () => {
    while (cursor < envelope.length) {
      const index = cursor
      cursor += 1
      const pixels = warpMouthCrop(data, info.width, info.height, mouth, crop, envelope[index])
      const buffer = await sharp(pixels, {
        raw: { width: crop.width, height: crop.height, channels: 4 },
      })
        .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
        .toBuffer()
      const file = path.join(dir, `${prefix}-${String(index).padStart(4, '0')}${extension}`)
      await fs.promises.writeFile(file, buffer)
      frames[index] = file
    }
  })
  await Promise.all(workers)

  const pattern = path.join(dir, `${prefix}-%04d${extension}`)
  return { mouth, crop, frames, fps, pattern }
}

module.exports = {
  MOUTH_BOX,
  locateMouth,
  detectMouthLandmarks,
  mouthCrop,
  warpMouthCrop,
  buildEnvelope,
  writeMouthFrames,
}
