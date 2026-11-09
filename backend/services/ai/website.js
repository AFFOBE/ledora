/**
 * Reads the customer's own website and returns a compact text profile used in
 * the content prompt. Fails soft and never blocks generation.
 */

const MAX_BYTES = 350 * 1024
const MAX_TEXT = 3200

const isPrivateHost = (hostname = '') => {
  const host = String(hostname).toLowerCase()
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '[::1]' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  )
}

const normalizeUrl = (value) => {
  let raw = String(value || '').trim()
  if (!raw) return null
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`
  try {
    const url = new URL(raw)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    if (isPrivateHost(url.hostname)) return null
    if (!url.hostname.includes('.')) return null
    return url
  } catch {
    return null
  }
}

const decodeEntities = (value = '') =>
  String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&hellip;/gi, '…')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))

const metaContent = (html, keys) => {
  for (const key of keys) {
    const patterns = [
      new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${key}["']`, 'i'),
    ]
    for (const pattern of patterns) {
      const match = html.match(pattern)
      if (match && match[1]) return decodeEntities(match[1]).trim()
    }
  }
  return ''
}

async function fetchWebsiteProfile(value, { timeoutMs = 8000 } = {}) {
  const url = normalizeUrl(value)
  if (!url) return { url: '', title: '', description: '', text: '' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'LedoraBot/1.0 (+https://ledora.app)',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return { url: url.toString(), title: '', description: '', text: '' }
    }

    const reader = response.body && response.body.getReader ? response.body.getReader() : null
    let html = ''
    if (reader) {
      const decoder = new TextDecoder()
      let received = 0
      while (received < MAX_BYTES) {
        const { done, value: chunk } = await reader.read()
        if (done) break
        received += chunk.length
        html += decoder.decode(chunk, { stream: true })
      }
      try {
        await reader.cancel()
      } catch {
        // ignore
      }
    } else {
      html = await response.text()
      html = html.slice(0, MAX_BYTES)
    }

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const title = titleMatch ? decodeEntities(titleMatch[1]).replace(/\s+/g, ' ').trim() : ''
    const description =
      metaContent(html, ['description', 'og:description', 'twitter:description']) || ''
    const keywords = metaContent(html, ['keywords', 'og:site_name'])

    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<\/(p|div|section|article|li|h[1-6]|br|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
    const text = decodeEntities(cleaned)
      .replace(/\r/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n+/g, '\n')
      .trim()
      .slice(0, MAX_TEXT)

    return { url: url.toString(), title, description, keywords, text }
  } catch (error) {
    return {
      url: url.toString(),
      title: '',
      description: '',
      text: '',
      error: error.message || 'Could not read website',
    }
  } finally {
    clearTimeout(timer)
  }
}

module.exports = { fetchWebsiteProfile, normalizeUrl, isPrivateHost }
