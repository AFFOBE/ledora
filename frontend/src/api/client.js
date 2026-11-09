const API_URL =
  import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api')

const TOKEN_KEY = 'ledora_token'

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}
export const setToken = (token) => {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch { /* storage unavailable */ }
}
export const clearToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch { /* storage unavailable */ }
}

const notifyUnauthorized = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('ledora:unauthorized'))
}

const handleUnauthorized = (auth) => {
  if (!auth) return
  clearToken()
  notifyUnauthorized()
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const request = async (path, { method = 'GET', body, auth = true } = {}) => {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const token = getToken()
  if (auth && token) headers.Authorization = `Bearer ${token}`

  try {
    return await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Network error. Please check your connection and try again.', 0)
  }
}

export async function api(path, options) {
  const res = await request(path, options)
  let payload = null
  try {
    payload = await res.json()
  } catch {
    payload = null
  }

  if (!res.ok) {
    handleUnauthorized(!options || options.auth !== false)
    throw new ApiError((payload && payload.message) || `Request failed (${res.status})`, res.status)
  }

  return payload ? payload.data : null
}

export async function uploadFile(path, file, { field = 'file', auth = true } = {}) {
  const headers = { Accept: 'application/json' }
  const token = getToken()
  if (auth && token) headers.Authorization = `Bearer ${token}`

  const form = new FormData()
  form.append(field, file)

  let res
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers,
      body: form,
    })
  } catch {
    throw new ApiError('Network error while uploading. Please try again.', 0)
  }

  let payload = null
  try {
    payload = await res.json()
  } catch {
    payload = null
  }

  if (!res.ok) {
    handleUnauthorized(auth)
    throw new ApiError((payload && payload.message) || `Upload failed (${res.status})`, res.status)
  }

  return payload ? payload.data : null
}

export async function downloadFile(path, filename, auth = true) {
  const res = await request(path, { auth })

  if (!res.ok) {
    handleUnauthorized(auth)
    let message = `Download failed (${res.status})`
    try {
      const payload = await res.json()
      if (payload && payload.message) message = payload.message
    } catch { /* response is not json */ }
    throw new ApiError(message, res.status)
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'download'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
