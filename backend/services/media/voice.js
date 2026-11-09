/**
 * Voiceover generation for AI presenter reels.
 *
 * Primary: Microsoft Edge neural TTS (en-IN-NeerjaNeural, natural Indian
 * English female voice). Fallback on Windows: the built-in SAPI voice, so a
 * video is still produced if the online service is blocked.
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { spawn } = require('child_process')
const { UPLOAD_DIR } = require('../../middlewares/upload.middleware')

const CACHE_DIR = path.join(UPLOAD_DIR, 'cache', 'voice')
fs.mkdirSync(CACHE_DIR, { recursive: true })

const hash = (value) => crypto.createHash('sha1').update(String(value)).digest('hex')

const stripEmoji = (value = '') =>
  String(value)
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[#*_`~<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const firstSentences = (text, count = 3) =>
  stripEmoji(text)
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .slice(0, count)
    .join(' ')

/**
 * A natural 25-40 second spoken script. Gemini can supply one; otherwise it is
 * assembled from the title, caption and CTA.
 */
function voiceoverTextFor(item, biz = {}) {
  const direct = stripEmoji(item && item.voiceover)
  if (direct.length > 30) return direct.slice(0, 700)

  const name = stripEmoji(biz.name || 'our business')
  const title = stripEmoji(item && item.title)
  const caption = firstSentences(item && item.caption, 2)
  const cta = stripEmoji(item && item.cta)

  const parts = [
    `Hello and welcome! I am your AI brand presenter for ${name}.`,
    title ? `Today let me tell you about ${title}.` : '',
    caption,
    cta,
    `Thank you for watching. Follow ${name} for more.`,
  ].filter(Boolean)

  return parts.join(' ').replace(/\s+/g, ' ').slice(0, 720)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function edgeTts(text, outPath) {
  let EdgeTTS
  try {
    ;({ EdgeTTS } = require('node-edge-tts'))
  } catch {
    throw new Error('node-edge-tts is not installed')
  }
  const tts = new EdgeTTS({
    voice: process.env.PRESENTER_VOICE || 'en-IN-NeerjaNeural',
    lang: process.env.PRESENTER_LANG || 'en-IN',
    outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
    rate: process.env.PRESENTER_RATE || '+2%',
    pitch: 'default',
    timeout: 45000,
  })
  await tts.ttsPromise(text, outPath)
  const stat = await fs.promises.stat(outPath).catch(() => null)
  if (!stat || stat.size < 1500) throw new Error('Edge TTS returned empty audio')
}

function runPowerShell(script, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { windowsHide: true }
    )
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('Windows speech synthesis timed out'))
    }, timeoutMs)
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(stderr.trim().slice(-400) || `powershell exited with ${code}`))
    })
  })
}

async function windowsTts(text, outPath) {
  if (process.platform !== 'win32') throw new Error('Windows TTS is unavailable')
  const textFile = path.join(CACHE_DIR, `${hash(text)}-sapi.txt`)
  await fs.promises.writeFile(textFile, text, 'utf8')
  const script = [
    'Add-Type -AssemblyName System.Speech;',
    '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer;',
    "try { $s.SelectVoice('Microsoft Zira Desktop') } catch {};",
    '$s.Rate = 0;',
    `$s.SetOutputToWaveFile('${outPath.replace(/'/g, "''")}');`,
    `$s.Speak([IO.File]::ReadAllText('${textFile.replace(/'/g, "''")}'));`,
    '$s.Dispose();',
  ].join(' ')
  await runPowerShell(script)
  const stat = await fs.promises.stat(outPath).catch(() => null)
  if (!stat || stat.size < 1500) throw new Error('Windows TTS returned empty audio')
}

/**
 * Synthesises speech and returns `{ path, ext }` or null. Cached by a hash of
 * the text so retries and monthly refreshes reuse the same voiceover.
 */
async function synthesizeVoice(text, { maxChars = 720 } = {}) {
  const clean = stripEmoji(text).slice(0, maxChars)
  if (clean.length < 12) return null
  const key = hash(clean)
  const mp3 = path.join(CACHE_DIR, `${key}.mp3`)
  const wav = path.join(CACHE_DIR, `${key}.wav`)

  if (fs.existsSync(mp3)) return { path: mp3, ext: '.mp3' }
  if (fs.existsSync(wav)) return { path: wav, ext: '.wav' }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await edgeTts(clean, mp3)
      return { path: mp3, ext: '.mp3' }
    } catch (error) {
      console.warn(`[voice] Edge TTS attempt ${attempt + 1} failed: ${error.message}`)
      await fs.promises.unlink(mp3).catch(() => {})
      if (attempt === 0) await sleep(1500)
    }
  }

  try {
    await windowsTts(clean, wav)
    return { path: wav, ext: '.wav' }
  } catch (error) {
    console.warn('[voice] Windows TTS failed:', error.message)
  }

  return null
}

/** Splits a script into short caption-sized chunks. */
function splitIntoSegments(text, { maxWords = 12 } = {}) {
  const clean = stripEmoji(text)
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean)
  const segments = []

  for (const sentence of sentences) {
    const words = sentence.split(/\s+/).filter(Boolean)
    if (words.length <= maxWords) {
      if (words.length) segments.push(words.join(' '))
      continue
    }
    for (let i = 0; i < words.length; i += maxWords) {
      segments.push(words.slice(i, i + maxWords).join(' '))
    }
  }

  if (!segments.length && clean) segments.push(clean.slice(0, 140))
  return segments
}

module.exports = {
  voiceoverTextFor,
  synthesizeVoice,
  splitIntoSegments,
  stripEmoji,
}
