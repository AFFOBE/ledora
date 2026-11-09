import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api, uploadFile } from '../../api/client'
import { SM_CAL_GRADS, SM_CAL_LIGHT_INDEX } from '../../data/mock'
import { downloadCSV } from '../../utils/helpers'

const PUB_PLATFORMS = [
  { id: 'facebook', name: 'Facebook Page', icon: 'f', color: '#1877f2', kinds: ['post', 'reel', 'video'] },
  { id: 'instagram', name: 'Instagram', icon: 'ig', color: '#e1306c', kinds: ['post', 'reel', 'video'] },
  { id: 'linkedin', name: 'LinkedIn', icon: 'in', color: '#0a66c2', kinds: ['post', 'video'] },
  { id: 'youtube', name: 'YouTube', icon: 'yt', color: '#ff0000', kinds: ['video'] },
  { id: 'google-business', name: 'Google Business Profile', icon: 'gb', color: '#34a853', kinds: ['post'] },
]

const platformLabel = (id) => (PUB_PLATFORMS.find((p) => p.id === id) || {}).name || id
const kindLabel = (kind) => ({ post: 'Post', reel: 'Reel', video: 'Video' }[kind] || 'Post')

const statusClass = (status) =>
  ({ posted: 'active', scheduled: 'blue', failed: 'off', publishing: 'demo', cancelled: 'demo' }[status] || 'demo')

const fmtWhen = (value) =>
  value
    ? new Date(value).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Not scheduled'

const toLocalInput = (date) => {
  const d = new Date(date)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const emptyPostForm = () => ({
  platform: 'facebook',
  accountId: '',
  kind: 'post',
  title: '',
  caption: '',
  hashtags: '',
  mediaUrl: '',
  mediaPath: '',
  mediaType: 'none',
  scheduledAt: toLocalInput(Date.now() + 60 * 60 * 1000),
  publishNow: true,
  creativeId: '',
})

const mediaTypeFromUrl = (url) => {
  const clean = String(url || '').split('?')[0].toLowerCase()
  if (/\.(mp4|mov|webm|avi|mkv|m4v)$/.test(clean)) return 'video'
  if (/\.(jpg|jpeg|png|webp|gif|heic|heif)$/.test(clean)) return 'image'
  return 'none'
}

const mimeFromUrl = (url) => {
  const clean = String(url || '').split('?')[0].toLowerCase()
  if (clean.endsWith('.mp4')) return 'video/mp4'
  if (clean.endsWith('.mov')) return 'video/quicktime'
  if (clean.endsWith('.webm')) return 'video/webm'
  if (clean.endsWith('.png')) return 'image/png'
  if (clean.endsWith('.webp')) return 'image/webp'
  if (clean.endsWith('.gif')) return 'image/gif'
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg'
  return ''
}

export default function SMDashboard() {
  const {
    sm,
    smSetStep,
    smToggleVideo,
    smToggleSchedule,
    smGenerateItems,
    refreshGeneration,
    smRetryMissing,
    smScheduleAll,
    smToggleAutoPublish,
    showToast,
    go,
    openAccounts,
    refreshBilling,
  } = useApp()
  const [modal, setModal] = useState({ open: false, title: '', body: null })
  const [pubOpen, setPubOpen] = useState(false)
  const [pubBusy, setPubBusy] = useState(false)
  const [pubForm, setPubForm] = useState(emptyPostForm)
  const [pubFile, setPubFile] = useState(null)
  const [publishing, setPublishing] = useState({ accounts: [], posts: [], counts: {}, loading: true })

  const loadPublishing = async () => {
    try {
      const data = await api('/social/publishing')
      setPublishing({
        accounts: (data && data.accounts) || [],
        posts: (data && data.posts) || [],
        counts: (data && data.counts) || {},
        loading: false,
      })
    } catch (e) {
      setPublishing((p) => ({ ...p, loading: false }))
      showToast(e.message)
    }
  }

  useEffect(() => {
    loadPublishing()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const items = sm.items
  const biz = sm.biz || {}
  const video = sm.video
  const generation = sm.generation || {}
  const genStatus = generation.status || 'idle'
  const genRunning = ['text', 'images', 'videos'].includes(genStatus)
  const genDone = ['done', 'partial', 'failed'].includes(genStatus)
  const genTotal = Number(generation.total || items.length || 0)
  const genCompleted = Number(generation.completed || 0)
  const genPct = genTotal ? Math.min(100, Math.round((genCompleted / genTotal) * 100)) : 0
  const imageReady = items.filter((x) => x.imagePath).length
  const videoReady = items.filter((x) => x.videoPath).length
  const failedMedia = items.filter((x) => x.mediaStatus === 'failed').length

  useEffect(() => {
    if (!genRunning) return undefined
    let cancelled = false
    const timer = setInterval(async () => {
      const next = await refreshGeneration()
      if (!next || cancelled) return
      if (!['text', 'images', 'videos'].includes(next.status)) {
        await refreshBilling().catch(() => {})
        loadPublishing()
      }
    }, 4000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genRunning, refreshGeneration, refreshBilling])

  const closeModal = () => setModal({ open: false, title: '', body: null })
  const openModal = (title, body) => setModal({ open: true, title, body })

  const platformAccounts = (platform) =>
    publishing.accounts.filter((account) => account.platform === platform)

  const openPublisher = (preset = {}) => {
    loadPublishing()
    const next = { ...emptyPostForm(), ...preset }
    next.accountId = preset.accountId || platformAccounts(next.platform)[0]?._id || ''
    setPubForm(next)
    setPubFile(null)
    setPubOpen(true)
  }

  const closePublisher = () => {
    if (pubBusy) return
    setPubOpen(false)
    setPubFile(null)
    setPubForm(emptyPostForm())
  }

  const changePlatform = (platform) => {
    const meta = PUB_PLATFORMS.find((p) => p.id === platform)
    const kinds = (meta && meta.kinds) || ['post']
    const kind = kinds.includes(pubForm.kind) ? pubForm.kind : kinds[kinds.length - 1]
    setPubForm((f) => ({
      ...f,
      platform,
      kind,
      accountId: platformAccounts(platform)[0]?._id || '',
    }))
  }

  const submitPublisher = async (event) => {
    event.preventDefault()
    const accounts = platformAccounts(pubForm.platform)
    if (!accounts.length) {
      showToast(`Connect your ${platformLabel(pubForm.platform)} account first`)
      openAccounts()
      return
    }

    const accountId = pubForm.accountId || accounts[0]._id
    const hasUrl = Boolean(pubForm.mediaUrl.trim())
    const hasFile = Boolean(pubFile)
    let effectiveType = hasFile
      ? pubFile.type.startsWith('video/')
        ? 'video'
        : 'image'
      : mediaTypeFromUrl(pubForm.mediaUrl)

    if (!hasFile && effectiveType === 'none' && pubForm.mediaType && pubForm.mediaType !== 'none') {
      effectiveType = pubForm.mediaType
    }
    if (!hasFile && hasUrl && effectiveType === 'none') {
      effectiveType = pubForm.kind === 'post' ? 'image' : 'video'
    }

    if (pubForm.platform === 'instagram' && !hasFile && !hasUrl) {
      return showToast('Instagram needs an image or video')
    }
    if (pubForm.platform === 'youtube' && effectiveType !== 'video') {
      return showToast('YouTube needs a video file')
    }
    if ((pubForm.kind === 'reel' || pubForm.kind === 'video') && effectiveType !== 'video') {
      return showToast('Choose a video file for a reel or video post')
    }
    if (!pubForm.caption.trim() && !pubForm.title.trim() && !hasFile && !hasUrl) {
      return showToast('Add a caption or media before publishing')
    }
    if (!pubForm.publishNow && !pubForm.scheduledAt) {
      return showToast('Choose a date and time to schedule')
    }

    setPubBusy(true)
    try {
      let media = {
        url: pubForm.mediaUrl.trim(),
        path: pubForm.mediaPath.trim(),
        type: effectiveType,
        mimeType: mimeFromUrl(pubForm.mediaUrl),
      }

      if (hasFile) {
        const uploaded = await uploadFile('/social/media', pubFile)
        media = {
          url: uploaded.url,
          path: uploaded.path,
          type: uploaded.mediaType,
          mimeType: uploaded.mimeType,
        }
      }

      const payload = {
        platform: pubForm.platform,
        accountId,
        kind: pubForm.kind,
        title: pubForm.title.trim(),
        caption: pubForm.caption,
        hashtags: pubForm.hashtags,
        mediaUrl: media.url,
        mediaPath: media.path,
        mediaType: media.type,
        mimeType: media.mimeType,
        scheduledAt: pubForm.publishNow
          ? null
          : new Date(pubForm.scheduledAt).toISOString(),
        publishNow: pubForm.publishNow,
        creativeId: pubForm.creativeId || '',
      }

      const created = await api('/social/posts', { method: 'POST', body: payload })
      showToast(
        pubForm.publishNow
          ? `${platformLabel(pubForm.platform)} published`
          : `Scheduled for ${fmtWhen(created.scheduledAt)}`
      )
      setPubOpen(false)
      setPubFile(null)
      setPubForm(emptyPostForm())
      await loadPublishing()
      await refreshBilling().catch(() => {})
    } catch (e) {
      showToast(e.message)
      await loadPublishing()
    } finally {
      setPubBusy(false)
    }
  }

  const publishNow = async (post) => {
    setPubBusy(true)
    try {
      await api(`/social/posts/${post._id}/publish`, { method: 'POST' })
      showToast(`${platformLabel(post.platform)} published`)
      await loadPublishing()
      await refreshBilling().catch(() => {})
    } catch (e) {
      showToast(e.message)
      await loadPublishing()
    } finally {
      setPubBusy(false)
    }
  }

  const cancelQueued = async (post) => {
    if (!window.confirm('Cancel this scheduled post?')) return
    try {
      await api(`/social/posts/${post._id}/cancel`, { method: 'PATCH' })
      showToast('Scheduled post cancelled')
      await loadPublishing()
    } catch (e) {
      showToast(e.message)
    }
  }

  const removeQueued = async (post) => {
    if (!window.confirm('Remove this post from the queue? Platform posts are not affected.')) return
    try {
      await api(`/social/posts/${post._id}`, { method: 'DELETE' })
      showToast('Post removed from queue')
      await loadPublishing()
    } catch (e) {
      showToast(e.message)
    }
  }

  const reels = items.filter((x) => x.type === 'reel')
  const posts = items.filter((x) => x.type === 'post')
  const scheduled = items.filter((x) => x.status === 'Scheduled').length
  const pd = items.length - scheduled
  const connectedPlatforms = new Set(publishing.accounts.map((account) => account.platform))

  const initials = String(biz.name || 'ABC')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const regenerate = async () => {
    if (!biz || !biz.name) return showToast('Save your business details first')
    if (!window.confirm('Generate a fresh 30-day batch? Current creatives and approvals will be replaced.')) return
    try {
      await smGenerateItems(biz)
    } catch (e) {
      showToast(e.message)
    }
  }

  const publishCreative = (x) => {
    const preferred = x.platform || (publishing.accounts[0] && publishing.accounts[0].platform) || 'instagram'
    const meta = PUB_PLATFORMS.find((p) => p.id === preferred) || PUB_PLATFORMS[0]
    const desired = x.type === 'reel' ? 'reel' : 'post'
    const kind = meta.kinds.includes(desired) ? desired : meta.kinds[meta.kinds.length - 1]
    const useVideo = Boolean(x.videoPath)
    openPublisher({
      platform: meta.id,
      kind,
      title: x.title,
      caption: x.caption || '',
      hashtags: x.hashtags || '',
      mediaUrl: useVideo ? x.videoUrl : x.imageUrl || '',
      mediaPath: useVideo ? x.videoPath : x.imagePath || '',
      mediaType: useVideo ? 'video' : 'image',
      creativeId: x.id,
    })
  }

  const download = () => {
    if (!items.length) return showToast('No content to download yet')
    const headers = ['#', 'Creative', 'Type', 'Platforms', 'Handle', 'Publishing', 'Status', 'Caption', 'Hashtags', 'CTA', 'Image URL', 'Video URL']
    const rows = items.map((x) => [String(x.no).padStart(2, '0'), x.title, x.type, x.platformLabel, x.handle, x.dstr, x.status, x.caption, x.hashtags, x.cta, x.imageUrl || '', x.videoUrl || ''])
    downloadCSV((biz.name || 'business').toLowerCase().replace(/\W+/g, '-') + '-monthly-creatives.csv', headers, rows)
    showToast('Calendar downloaded')
  }

  function renderPreview(x) {
    return (
      <div>
        <div className="phonepv">
          <div className="pvhd">
            <div className="pvav">{initials}</div>
            <div>
              <b style={{ fontSize: 12.5 }}>{biz.name}</b>
              <div className="sub" style={{ fontSize: 10 }}>{x.platformLabel} · {x.handle}</div>
            </div>
          </div>
          <div className="pvmedia" style={{ background: x.grad, padding: 0, overflow: 'hidden', position: 'relative' }}>
            {x.type === 'reel' && x.videoUrl ? (
              <video src={x.videoUrl} muted loop playsInline controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : x.imageUrl ? (
              <img src={x.imageUrl} alt={x.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <>
                <div>{x.type === 'post' ? x.title.toUpperCase() : '▶'}</div>
                <div style={{ fontSize: 10.5, fontWeight: 600, opacity: 0.85, marginTop: 8 }}>{x.title}</div>
              </>
            )}
            {x.type === 'reel' && x.videoUrl ? (
              <span className="play" style={{ position: 'absolute', right: 8, top: 8, background: '#0009', borderRadius: 99, padding: '2px 8px', fontSize: 10 }}>REEL</span>
            ) : null}
          </div>
          <div className="pvacts"><span>♡</span><span>✉</span><span>💬</span></div>
          <div className="pvbody">
            <div style={{ fontSize: 11.5, lineHeight: 1.6 }}><b>{biz.name}</b> {x.caption}</div>
            <div className="tags" style={{ marginTop: 8 }}>{x.hashtags}</div>
          </div>
          <div className="pvfoot">
            {x.dstr} · <span className={`chip ${x.type}`}>{x.type.toUpperCase()}</span> · <span className={`badge ${x.status === 'Scheduled' ? 'active' : 'demo'}`}>{x.status}</span>
          </div>
        </div>
        {x.type === 'reel' && (<><h4 style={{ margin: '18px 0 0' }}>Reel Script & Shot List</h4><div className="smbox">{x.script}</div></>)}
        <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
          {x.type === 'reel' && <button className="btn" onClick={() => playVideo(x)}>▶ Video Preview</button>}
          <button className="btn primary" onClick={() => openModal(`Schedule Details - #${String(x.no).padStart(2, '0')}`, renderSchedule(x))}>Schedule</button>
        </div>
      </div>
    )
  }

  function renderSchedule(x) {
    const sc = x.status === 'Scheduled'
    return (
      <div>
        <div className="kv"><span>Content ID</span><b>#{String(x.no).padStart(2, '0')}</b></div>
        <div className="kv"><span>Title</span><b>{x.title}</b></div>
        <div className="kv"><span>Publishing</span><b>{x.dstr}</b></div>
        <div className="kv"><span>Platforms</span><b>{x.platformLabel}</b></div>
        <div className="kv"><span>Handle</span><b>{x.handle}</b></div>
        <div className="kv"><span>Content Type</span><b>{x.type === 'reel' ? 'Reel (9:16 Video)' : 'Post (Image / Carousel)'}</b></div>
        <div className="kv"><span>Status</span><b><span className={`badge ${sc ? 'active' : 'demo'}`}>{x.status}</span></b></div>
        <div className="kv"><span>Auto Publish</span><b>{sc ? 'Queued for connected accounts' : 'Not scheduled yet'}</b></div>
        <div className="kv"><span>Best Time</span><b>{x.bestTime || 'AI suggested slot'}</b></div>
        <div className="kv"><span>Media</span><b>{x.imagePath ? 'Image ready' : 'Pending'}{x.videoPath ? ' + Video ready' : ''}</b></div>
        <div className="kv" style={{ borderBottom: 0 }}><span>Goal</span><b>{biz.goal}</b></div>
        <h4 style={{ margin: '18px 0 0' }}>Caption</h4><div className="smbox">{x.caption}\n\n{x.hashtags}</div>
        {x.type === 'reel' && (<><h4 style={{ margin: '18px 0 0' }}>Reel Script</h4><div className="smbox">{x.script}</div></>)}
        <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={() => { closeModal(); publishCreative(x) }}>
            Publish / Real Schedule →
          </button>
          <button className="btn" onClick={() => { smToggleSchedule(x.id); closeModal(); showToast(`#${String(x.no).padStart(2, '0')} ${sc ? 'marked as draft' : 'marked in calendar'}`) }}>
            {sc ? 'Unmark calendar' : 'Mark in calendar'}
          </button>
          <button className="btn" onClick={() => openModal(`Creative Preview #${String(x.no).padStart(2, '0')}`, renderPreview(x))}>Preview Post</button>
          {x.type === 'reel' && <button className="btn" onClick={() => playVideo(x)}>▶ Video</button>}
        </div>
      </div>
    )
  }

  function playVideo(x) {
    if (!x.videoUrl) {
      openModal(`Video Preview - ${x.title}`, (
        <div>
          <div className="vempty" style={{ padding: 14 }}>
            {x.mediaStatus === 'failed'
              ? 'Video rendering failed. Use Retry missing creatives to render it again.'
              : video
                ? 'Video is still rendering. It will appear here automatically.'
                : <>Video Mode is <b>OFF</b>, so this reel was generated as an image only. Turn it on and generate a fresh batch to get MP4 reels.</>}
          </div>
          {video ? (
            <button className="btn primary" style={{ width: '100%', marginTop: 12 }} onClick={() => { closeModal(); smRetryMissing() }}>Retry missing creatives</button>
          ) : (
            <button className="btn primary" style={{ width: '100%', marginTop: 12 }} onClick={smToggleVideo}>▶ Enable Video Mode</button>
          )}
          <button className="btn" style={{ width: '100%', marginTop: 7 }} onClick={closeModal}>Close</button>
        </div>
      ))
      return
    }
    openModal(`Video Preview - ${x.title}`, (
      <div>
        <video
          src={x.videoUrl}
          controls
          muted
          loop
          playsInline
          style={{ width: '100%', maxWidth: 250, margin: '0 auto', display: 'block', borderRadius: 10, aspectRatio: '9/16', background: '#000' }}
        />
        <div className="vk" style={{ marginTop: 12 }}><span>File</span><b>MP4 · 15–30 sec · 1080x1920</b></div>
        <div className="vk"><span>Scheduled</span><b>{x.dstr}</b></div>
        <div className="vk" style={{ borderBottom: 0 }}><span>Platforms</span><b>{x.platformLabel}</b></div>
        <h4 style={{ margin: '14px 0 6px', fontSize: 12 }}>Reel Script</h4>
        <div className="smbox" style={{ fontSize: 10 }}>{x.script}</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn" style={{ padding: '6px 11px', fontSize: 11.5 }} onClick={() => openModal(`Creative Preview #${String(x.no).padStart(2, '0')}`, renderPreview(x))}>Post Preview</button>
          <button className="btn primary" style={{ padding: '6px 11px', fontSize: 11.5 }} onClick={() => { closeModal(); publishCreative(x) }}>Publish / Schedule</button>
        </div>
      </div>
    ))
  }

  function renderProfile(meta) {
    const acct = publishing.accounts.find((account) => account.platform === meta.id)
    return (
      <div>
        <div style={{ display: 'flex', gap: 11, alignItems: 'center', marginBottom: 16 }}>
          <div className="connic" style={{ background: meta.color, width: 46, height: 46 }}>{meta.icon}</div>
          <div>
            <b>{meta.name}</b>
            <div className="sub">{acct ? acct.username || acct.platformUserId : 'Not connected yet'}</div>
          </div>
        </div>
        <div className="kv"><span>Connection</span><b><span className={`badge ${acct ? 'active' : 'off'}`}>{acct ? 'CONNECTED' : 'NOT CONNECTED'}</span></b></div>
        <div className="kv"><span>Publishing</span><b>Auto Publish {acct ? 'ON' : 'OFF'}</b></div>
        <div className="kv"><span>Supported formats</span><b>{meta.kinds.map(kindLabel).join(' · ')}</b></div>
        <div className="kv" style={{ borderBottom: 0 }}><span>Permission</span><b>{acct ? 'Publishing permission granted' : 'Connect the account to publish'}</b></div>
        <button className="btn primary" style={{ width: '100%', marginTop: 14 }} onClick={() => { closeModal(); openAccounts() }}>
          {acct ? 'Manage accounts' : `Connect ${meta.name}`}
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="head">
        <div>
          <h1>AI Social Media Manager</h1>
          <div className="sub" id="smBizSub">
            {items.length
              ? `${items.length} creatives · ${imageReady} images ready · ${videoReady} reels ready for ${biz.name || 'your business'}.`
              : 'Choose a plan and complete Business Onboard. Your 30-day content appears here automatically.'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => smSetStep('plans')}>Buy / Change Plan</button>
          <button className="btn" onClick={() => openPublisher()}>+ Create Creative</button>
          <button className="btn primary" onClick={regenerate} disabled={genRunning}>
            {genRunning ? 'Generating…' : '⚡ Generate 30-Day Batch'}
          </button>
        </div>
      </div>
      <div className="smsteps">
        <span className="smstep" style={{ cursor: 'pointer' }} onClick={() => smSetStep('plans')}>1. Choose Plan</span>
        <span style={{ color: 'rgba(255,255,255,.45)' }}>→</span>
        <span className="smstep" style={{ cursor: 'pointer' }} onClick={() => smSetStep('form')}>2. Payment</span>
        <span style={{ color: 'rgba(255,255,255,.45)' }}>→</span>
        <span className="smstep on">3. 30 Day Content</span>
      </div>

      {(genRunning || genDone) && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="pubshead">
            <div>
              <div className="label">AI CONTENT ENGINE</div>
              <h3 style={{ margin: '4px 0 0' }}>
                {genRunning
                  ? 'Generating your 30-day content…'
                  : genStatus === 'failed'
                    ? 'Generation failed'
                    : genStatus === 'partial'
                      ? 'Content ready with a few gaps'
                      : 'Your 30-day content is ready'}
              </h3>
              <div className="sub" style={{ marginTop: 4 }}>
                {generation.phase || 'Working'}
                {generation.message ? ` · ${generation.message}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {genRunning ? (
                <span className="badge demo">{genCompleted} / {genTotal}</span>
              ) : (
                <>
                  {failedMedia > 0 || genStatus === 'partial' || genStatus === 'failed' ? (
                    <button className="btn" onClick={smRetryMissing}>Retry missing creatives</button>
                  ) : null}
                  {items.length > 0 ? (
                    <button className="btn primary" onClick={smScheduleAll}>Schedule all to connected accounts</button>
                  ) : null}
                </>
              )}
            </div>
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,.12)', borderRadius: 99, overflow: 'hidden', marginTop: 14 }}>
            <div
              style={{
                height: '100%',
                width: genRunning ? `${Math.max(genPct, 4)}%` : '100%',
                background: genStatus === 'failed' ? '#ef4444' : 'linear-gradient(90deg,#6D33E7,#384FE7)',
                transition: 'width .4s ease',
              }}
            />
          </div>
          <div className="sub" style={{ marginTop: 7, fontSize: 11 }}>
            {genCompleted} of {genTotal || items.length} creatives rendered · {imageReady} images · {videoReady} videos
            {failedMedia ? ` · ${failedMedia} failed` : ''}
          </div>
        </div>
      )}

      <div className="conn4" id="smConn">
        {PUB_PLATFORMS.map((meta) => {
          const acct = publishing.accounts.find((account) => account.platform === meta.id)
          const isConnected = Boolean(acct)
          return (
            <div className="connc" key={meta.id}>
              <div className="conntop">
                <div className="connic" style={{ background: meta.color }}>{meta.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className="connnm">{meta.name}</span>
                  <span className={`bdgxs badge ${isConnected ? 'active' : 'off'}`} style={{ float: 'right' }}>
                    {isConnected ? 'CONNECTED' : 'NOT CONNECTED'}
                  </span>
                  <div className="connsub">{isConnected ? (acct.username || acct.platformUserId) : 'Connect to publish automatically'}</div>
                  <div className="connsub">{meta.kinds.map(kindLabel).join(' · ')}</div>
                </div>
              </div>
              <button
                className="btn"
                style={{ padding: '4px 8px', fontSize: 10, alignSelf: 'flex-start' }}
                onClick={() => openModal(`${meta.name} - ${isConnected ? (acct.username || acct.platformUserId) : 'not connected'}`, renderProfile(meta))}
              >
                View Profile
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,.75)' }}>Publishing</span>
                <span className={`bdgxs badge ${isConnected && sm.autoPublish ? 'active' : 'off'}`}>
                  Auto {isConnected && sm.autoPublish ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="pubshead">
          <div>
            <div className="label">REAL PUBLISHING & AUTO-POST</div>
            <h3 style={{ margin: '4px 0 0' }}>Publish to connected accounts</h3>
            <div className="sub" style={{ marginTop: 4 }}>
              Posts and reels are sent to the real platform APIs. Scheduled posts publish automatically from the backend queue.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" onClick={loadPublishing}>Refresh</button>
            <button className="btn" onClick={openAccounts}>Manage Accounts</button>
            <button className="btn primary" onClick={() => openPublisher()}>+ New Post / Reel / Video</button>
          </div>
        </div>

        {publishing.accounts.length === 0 ? (
          <div className="vempty" style={{ marginTop: 12 }}>
            No social account connected yet. Click <b>Manage Accounts</b> and connect Facebook, Instagram, LinkedIn, YouTube or Google Business.
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {publishing.accounts.map((account) => (
              <div
                key={account._id}
                style={{
                  border: '1px solid rgba(255,255,255,.12)',
                  borderRadius: 10,
                  padding: '8px 10px',
                  minWidth: 150,
                }}
              >
                <div style={{ fontSize: 11.5, fontWeight: 800 }}>{platformLabel(account.platform)}</div>
                <div className="sub" style={{ fontSize: 10.5 }}>{account.username || account.platformUserId}</div>
                <span className="badge active" style={{ marginTop: 5 }}>CONNECTED</span>
              </div>
            ))}
          </div>
        )}

        <div className="tile4" style={{ marginTop: 14 }}>
          <div className="t"><span>Scheduled</span><b>{publishing.counts.scheduled || 0}</b><div className="sub" style={{ fontSize: 11 }}>Auto-publish queue</div></div>
          <div className="t"><span>Published</span><b>{publishing.counts.posted || 0}</b><div className="sub" style={{ fontSize: 11 }}>Sent to platforms</div></div>
          <div className="t"><span>Failed</span><b style={{ color: publishing.counts.failed ? '#fca5a5' : undefined }}>{publishing.counts.failed || 0}</b><div className="sub" style={{ fontSize: 11 }}>Needs attention</div></div>
          <div className="t"><span>Connected</span><b>{publishing.accounts.length}</b><div className="sub" style={{ fontSize: 11 }}>Real accounts</div></div>
        </div>

        {publishing.posts.length === 0 ? (
          <div className="sub" style={{ marginTop: 14, fontSize: 11.5 }}>
            Nothing in the publishing queue yet. Create a post above or use <b>Publish / Real Schedule</b> on any creative.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
            {publishing.posts.map((post) => (
              <div
                key={post._id}
                style={{
                  border: '1px solid rgba(255,255,255,.1)',
                  borderRadius: 10,
                  padding: '10px 12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 12.5 }}>
                      {platformLabel(post.platform)} · {kindLabel(post.kind)}
                      <span className={`badge ${statusClass(post.status)}`} style={{ marginLeft: 8 }}>
                        {String(post.status || '').toUpperCase()}
                      </span>
                    </div>
                    <div className="sub" style={{ marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {post.title || post.caption || 'Media post'}
                    </div>
                    <div className="sub" style={{ fontSize: 10.5 }}>
                      {post.status === 'posted'
                        ? `Published ${post.postedAt ? fmtWhen(post.postedAt) : ''}`
                        : post.scheduledAt
                          ? `Scheduled ${fmtWhen(post.scheduledAt)}`
                          : 'Not scheduled'}
                      {post.attempts ? ` · attempts ${post.attempts}` : ''}
                    </div>
                    {post.error ? (
                      <div className="sub" style={{ color: '#fca5a5', fontSize: 10.5, marginTop: 4 }}>{post.error}</div>
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    {post.status === 'posted' && post.externalUrl ? (
                      <button className="btn" onClick={() => window.open(post.externalUrl, '_blank', 'noopener,noreferrer')}>View</button>
                    ) : null}
                    {['draft', 'scheduled', 'failed'].includes(post.status) ? (
                      <button className="btn primary" disabled={pubBusy} onClick={() => publishNow(post)}>Publish now</button>
                    ) : null}
                    {['draft', 'scheduled'].includes(post.status) ? (
                      <button className="btn" onClick={() => cancelQueued(post)}>Cancel</button>
                    ) : null}
                    {post.status !== 'publishing' ? (
                      <button className="btn" onClick={() => removeQueued(post)}>Delete</button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="pubshead">
          <div>
            <div className="label">MONTHLY CREATIVES</div>
            <div style={{ fontSize: 21, fontWeight: 800, marginTop: 4 }}>
              {items.length} <span className="badge active" style={{ verticalAlign: 'middle' }}>{items.length ? `${imageReady + videoReady} media ready` : 'Not generated'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" onClick={download}>Download Calendar</button>
            <button className="btn" onClick={() => go('onboard')}>Edit Business Details</button>
          </div>
        </div>
        <div className="tile4" id="smTiles">
          <div className="t"><span>Reels</span><b>{reels.length}</b><div className="sub" style={{ fontSize: 11 }}>{videoReady} MP4 files ready</div></div>
          <div className="t"><span>Posts</span><b>{posts.length}</b><div className="sub" style={{ fontSize: 11 }}>{imageReady} images ready</div></div>
          <div className="t"><span>Auto Publish</span><b style={{ color: sm.autoPublish ? '#4ade80' : '#fca5a5' }}>{sm.autoPublish ? 'ON' : 'OFF'}</b><div className="sub" style={{ fontSize: 11 }}>Connected accounts</div></div>
          <div className="t"><span>Media Errors</span><b style={{ color: failedMedia ? '#fca5a5' : undefined }}>{failedMedia}</b><div className="sub" style={{ fontSize: 11 }}>{failedMedia ? 'Retry from progress card' : 'All creatives healthy'}</div></div>
        </div>
        <div className="sub" style={{ marginTop: 12 }}><b id="mcFoot">{items.length} Creatives · {reels.length} Reels · {scheduled} Scheduled</b></div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="pubshead">
          <h3 style={{ margin: 0 }}>Publishing Calendar</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="badge active" id="calSc">{scheduled} Scheduled</span>
            <span className="badge demo" id="calPd">{pd} Draft</span>
          </div>
        </div>
        <div className="sub" style={{ margin: '2px 0 12px', fontSize: 12 }}>
          Each row is one planned day and creative. <b>Scheduled</b> means it is queued for your connected account at the AI-suggested time; <b>Draft</b> means the content is ready but not queued yet. Click a thumbnail to preview, or use <b>Schedule</b> / <b>Publish</b> on any creative to send it now.
        </div>
        <div className="calgrid" id="smCalRows">
          {items.map((x) => {
            const sc = x.status === 'Scheduled'
            const ic = x.type === 'reel' ? '▶' : '✳'
            const ci = (x.no - 1) % SM_CAL_GRADS.length
            const isLight = ci === SM_CAL_LIGHT_INDEX
            return (
              <div className={`calrow${isLight ? ' light' : ''}`} style={{ ['--cg']: SM_CAL_GRADS[ci] }} key={x.id}>
                <div className="top">
                  <div className="thumb" onClick={() => openModal(`Creative Preview #${String(x.no).padStart(2, '0')}`, renderPreview(x))} title={`Preview ${x.title}`} style={{ overflow: 'hidden' }}>
                    {x.imageUrl ? (
                      <img src={x.imageUrl} alt={x.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 7 }} />
                    ) : (
                      ic
                    )}
                    {x.type === 'reel' ? <span className="play">▶</span> : null}
                  </div>
                  <span className={`badge ${sc ? 'active' : 'demo'}`}>{x.status}</span>
                </div>
                <span className="ttl">{x.title}</span>
                <div className="meta2">
                  <span className="o">#{String(x.no).padStart(2, '0')} · {x.platformLabel}</span>
                  <span className="o">{x.dstr}</span>
                  <span className={`chip ${x.type}`}>{x.type.toUpperCase()}</span>
                </div>
                <div className="acts">
                  <button className="btn" onClick={() => openModal(`Creative Preview #${String(x.no).padStart(2, '0')}`, renderPreview(x))}>Preview</button>
                  <button className={`btn ${sc ? '' : 'pri'}`} onClick={() => openModal(`Schedule Details - #${String(x.no).padStart(2, '0')}`, renderSchedule(x))}>{sc ? 'Scheduled' : 'Schedule'}</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="vgrid2">
        <div className="vcard">
          <div className="vh">
            <div className="vhi" style={{ background: 'linear-gradient(135deg,#6D33E7,#384FE7)' }}>▶</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="vt">Video Mode</div>
              <div className="connsub" id="vmNote">{video ? 'Reels render as real MP4 files' : 'Reels are generated as image posters only'}</div>
            </div>
            <div className={`sw ${video ? 'on' : ''}`} id="vmSw" onClick={smToggleVideo}><i /></div>
          </div>
          <div className="vk"><span>Status</span><b id="vmState">{video ? 'ON' : 'OFF'}</b></div>
          <div className="vk"><span>Reels ready</span><b id="vmCount">{videoReady} / {reels.length} rendered</b></div>
          <div className="vk" style={{ borderBottom: 0 }}><span>Format</span><b>9:16 · 15–30 sec MP4</b></div>
        </div>
        <div className="vcard">
          <div className="vh">
            <div className="vhi" style={{ background: 'linear-gradient(135deg,#5B2BE0,#4542E4)' }}>⚙</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="vt">Video Information</div>
              <div className="connsub">Format & delivery</div>
            </div>
          </div>
          <div className="vk"><span>Resolution</span><b>1080 x 1920</b></div>
          <div className="vk"><span>Audio</span><b>AI voiceover + captions</b></div>
          <div className="vk"><span>Motion</span><b>AI presenter with lip motion</b></div>
          <div className="vk" style={{ borderBottom: 0 }}><span>Delivery</span><b>Reel + Feed</b></div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="pubshead">
          <h3 style={{ margin: 0 }}>Reel Previews</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="connsub" id="viCount">{reels.length} reels this month</span>
            <span className={`badge ${video ? 'active' : 'demo'}`} id="viHint">Video Mode {video ? 'ON' : 'OFF'}</span>
          </div>
        </div>
        {reels.length === 0 ? (
          <div className="vempty" style={{ gridColumn: '1/-1' }}>
            No reels in this batch. Premium and Advance plans include reels.
          </div>
        ) : (
          <div className="vidgrid5" id="smVidRows">
            {reels.map((x) => {
              const ci = (x.no - 1) % SM_CAL_GRADS.length
              const isLight = ci === SM_CAL_LIGHT_INDEX
              return (
                <div className="vcard5" key={x.id}>
                  <div
                    className={`vt5${isLight ? ' light' : ''}`}
                    style={{ ['--g']: SM_CAL_GRADS[ci], position: 'relative', overflow: 'hidden' }}
                    onClick={() => playVideo(x)}
                    title={`Play ${x.title}`}
                  >
                    {x.imageUrl ? (
                      <img src={x.imageUrl} alt={x.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      '▶'
                    )}
                    <span className="pl">▶</span>
                    {!x.videoPath && <span style={{ position: 'absolute', bottom: 6, left: 6, right: 6, fontSize: 9, background: '#000a', borderRadius: 6, padding: '2px 4px' }}>{x.mediaStatus === 'failed' ? 'Render failed' : 'Rendering…'}</span>}
                  </div>
                  <div className="vb">
                    <span className="vt2" title={x.title}>{x.title}</span>
                    <div className="bm">
                      <span className={`badge ${x.status === 'Scheduled' ? 'active' : 'demo'}`}>{x.videoPath ? 'MP4 ready' : x.mediaStatus}</span>
                      <button className="btn" onClick={() => openModal(`Schedule Details - #${String(x.no).padStart(2, '0')}`, renderSchedule(x))}>Set</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="pubshead">
          <div>
            <h3 style={{ margin: 0 }}>Auto-Publishing</h3>
            <div className="sub" style={{ margin: '4px 0 0' }}>
              New creatives are queued to your connected accounts. The backend scheduler publishes them at the planned time.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className={`badge ${sm.autoPublish ? 'active' : 'demo'}`}>{sm.autoPublish ? 'AUTO ON' : 'AUTO OFF'}</span>
            <div className={`sw ${sm.autoPublish ? 'on' : ''}`} onClick={smToggleAutoPublish} title="Toggle auto-publish"><i /></div>
          </div>
        </div>
        <div className="auto3" id="smAuto">
          {publishing.accounts.length === 0 ? (
            <div className="vempty" style={{ gridColumn: '1/-1' }}>
              Connect a social account to turn on auto-publishing. Content is still generated and saved locally without an account.
            </div>
          ) : (
            publishing.accounts.map((account) => (
              <div className="connc" key={account._id}>
                <div className="conntop">
                  <div className="connic" style={{ background: (PUB_PLATFORMS.find((p) => p.id === account.platform) || {}).color || '#6D33E7' }}>
                    {platformLabel(account.platform).slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span className="connnm">{platformLabel(account.platform)}</span>
                    <div className="connsub">{account.username || account.platformUserId}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span className="bdgxs badge active">CONNECTED</span>
                  <span className={`bdgxs badge ${sm.autoPublish ? 'active' : 'demo'}`}>Auto {sm.autoPublish ? 'ON' : 'OFF'}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card">
        <h3>Publishing Snapshot</h3>
        <div className="sub" style={{ margin: '-6px 0 0' }}>Live numbers from your real publishing queue</div>
        <div className="perf4" id="smPerf">
          <div className="p"><span>Queued</span><b>{publishing.counts.scheduled || 0}</b></div>
          <div className="p"><span>Published</span><b>{publishing.counts.posted || 0}</b></div>
          <div className="p"><span>Failed</span><b>{publishing.counts.failed || 0}</b></div>
          <div className="p"><span>Connected</span><b>{publishing.accounts.length}</b></div>
        </div>
        <div className="sub" style={{ marginTop: 10, fontSize: 11 }}>
          {publishing.accounts.length === 0
            ? 'Connect an account to start publishing. Until then, creatives stay safely in your dashboard.'
            : `Ready to publish to ${[...connectedPlatforms].map(platformLabel).join(', ')}.`}
        </div>
      </div>

      <div className={`modal ${pubOpen ? 'show' : ''}`} id="smPublishModal">
        <form
          className="modalbox"
          onSubmit={submitPublisher}
          style={{ width: 'min(520px,94vw)', maxHeight: '88vh', overflowY: 'auto', padding: 16 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div>
              <div className="label">REAL PUBLISHING</div>
              <h3 style={{ margin: '3px 0 0', fontSize: 15 }}>New Post / Reel / Video</h3>
            </div>
            <button type="button" className="btn" style={{ padding: '5px 10px', fontSize: 11.5 }} onClick={closePublisher}>✕ Cancel</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="field">
              <label>Platform</label>
              <select className="input" value={pubForm.platform} onChange={(e) => changePlatform(e.target.value)}>
                {PUB_PLATFORMS.map((platform) => (
                  <option key={platform.id} value={platform.id}>{platform.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Content Type</label>
              <select
                className="input"
                value={pubForm.kind}
                onChange={(e) => setPubForm((f) => ({ ...f, kind: e.target.value }))}
              >
                {(PUB_PLATFORMS.find((p) => p.id === pubForm.platform) || { kinds: ['post'] }).kinds.map((kind) => (
                  <option key={kind} value={kind}>{kindLabel(kind)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label>Connected Account</label>
            {platformAccounts(pubForm.platform).length ? (
              <select
                className="input"
                value={pubForm.accountId || platformAccounts(pubForm.platform)[0]?._id || ''}
                onChange={(e) => setPubForm((f) => ({ ...f, accountId: e.target.value }))}
              >
                {platformAccounts(pubForm.platform).map((account) => (
                  <option key={account._id} value={account._id}>
                    {account.username || account.platformUserId}
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="sub" style={{ fontSize: 11 }}>
                  No {platformLabel(pubForm.platform)} account connected.
                </div>
                <button type="button" className="btn" onClick={openAccounts}>Connect Account</button>
              </div>
            )}
          </div>

          <div className="field">
            <label>Title {pubForm.platform === 'youtube' ? '(video title)' : '(optional)'}</label>
            <input
              className="input"
              value={pubForm.title}
              onChange={(e) => setPubForm((f) => ({ ...f, title: e.target.value }))}
              placeholder={pubForm.platform === 'youtube' ? 'Video title for YouTube' : 'Short internal title'}
              maxLength={100}
            />
          </div>

          <div className="field">
            <label>Caption / Text</label>
            <textarea
              className="input"
              rows={4}
              value={pubForm.caption}
              onChange={(e) => setPubForm((f) => ({ ...f, caption: e.target.value }))}
              placeholder="What should be posted on the platform?"
            />
          </div>

          <div className="field">
            <label>Hashtags</label>
            <input
              className="input"
              value={pubForm.hashtags}
              onChange={(e) => setPubForm((f) => ({ ...f, hashtags: e.target.value }))}
              placeholder="#YourBrand #Business"
            />
          </div>

          <div className="field">
            <label>Media File (image or video, max 250 MB)</label>
            <input
              type="file"
              accept="image/*,video/*"
              className="input"
              onChange={(e) => setPubFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
            />
            {pubFile ? (
              <div className="sub" style={{ fontSize: 10.5, marginTop: 4 }}>
                Selected: {pubFile.name} · {(pubFile.size / (1024 * 1024)).toFixed(1)} MB
              </div>
            ) : null}
            {!pubFile && pubForm.mediaPath ? (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, padding: 8 }}>
                {pubForm.mediaType === 'video' ? (
                  <video src={pubForm.mediaUrl} muted playsInline controls style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} />
                ) : (
                  <img src={pubForm.mediaUrl} alt="Generated creative" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} />
                )}
                <div className="sub" style={{ fontSize: 10.5, minWidth: 0 }}>
                  Generated {pubForm.mediaType === 'video' ? 'reel (MP4)' : 'image'} attached automatically.
                  <br />
                  <span style={{ wordBreak: 'break-all' }}>{pubForm.mediaPath}</span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="field">
            <label>Or paste a public media URL</label>
            <input
              className="input"
              value={pubForm.mediaUrl}
              onChange={(e) => setPubForm((f) => ({ ...f, mediaUrl: e.target.value, mediaPath: '' }))}
              placeholder="https://your-cdn.com/image-or-video.jpg"
            />
            {['instagram', 'facebook', 'google-business'].includes(pubForm.platform) ? (
              <div className="sub" style={{ fontSize: 10.5, marginTop: 4 }}>
                {platformLabel(pubForm.platform)} needs a public URL. Local generated media is mirrored to public hosting automatically before publishing.
              </div>
            ) : null}
          </div>

          <div className="label" style={{ marginTop: 4 }}>WHEN TO PUBLISH</div>
          <div style={{ display: 'flex', gap: 8, margin: '8px 0 10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn ${pubForm.publishNow ? 'primary' : ''}`}
              onClick={() => setPubForm((f) => ({ ...f, publishNow: true }))}
            >
              Publish now
            </button>
            <button
              type="button"
              className={`btn ${pubForm.publishNow ? '' : 'primary'}`}
              onClick={() => setPubForm((f) => ({ ...f, publishNow: false }))}
            >
              Schedule
            </button>
          </div>

          {!pubForm.publishNow ? (
            <div className="field">
              <label>Date & Time</label>
              <input
                type="datetime-local"
                className="input"
                value={pubForm.scheduledAt}
                onChange={(e) => setPubForm((f) => ({ ...f, scheduledAt: e.target.value }))}
              />
              <div className="sub" style={{ fontSize: 10.5, marginTop: 4 }}>
                The backend scheduler checks every 60 seconds and publishes automatically.
              </div>
            </div>
          ) : null}

          <button className="btn primary" type="submit" disabled={pubBusy} style={{ width: '100%', padding: 11, marginTop: 6 }}>
            {pubBusy ? 'Working…' : pubForm.publishNow ? 'Publish Now' : 'Schedule Post'}
          </button>
        </form>
      </div>

      <div className={`modal ${modal.open ? 'show' : ''}`} id="smModal">
        <div className="modalbox" style={{ width: 'min(430px,94vw)', maxHeight: '86vh', overflowY: 'auto', padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 14.5 }} id="smModalTitle">{modal.title}</h3>
            <button className="btn" style={{ padding: '5px 10px', fontSize: 11.5 }} onClick={closeModal}>✕ Cancel</button>
          </div>
          <div id="smModalBody" style={{ fontSize: 12.5 }}>{modal.body}</div>
        </div>
      </div>
    </>
  )
}