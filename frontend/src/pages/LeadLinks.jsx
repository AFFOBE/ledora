import { useState } from 'react'
import { useApp } from '../context/AppContext'
import PageHead from '../components/ui/PageHead'
import { copyText } from '../utils/helpers'

export default function LeadLinks() {
  const { linkData, createLink, showToast } = useApp()
  const [name, setName] = useState('')
  const [genUrl, setGenUrl] = useState('')
  const [generating, setGenerating] = useState(false)

  const gen = async () => {
    if (generating) return
    setGenerating(true)
    try {
      const n = name.trim() || 'my-link'
      const url = await createLink(n)
      setGenUrl(url)
    } catch (e) {
      showToast(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const copy = (url) => {
    if (!url || !url.startsWith('http')) return showToast('Generate a link first')
    copyText(url)
    showToast('Link copied')
  }

  const nativeShare = () => {
    if (!genUrl.startsWith('http')) return showToast('Generate a link first')
    if (navigator.share) navigator.share({ title: 'Check this out', url: genUrl })
    else copy(genUrl)
  }

  const social = (type) => {
    if (!genUrl.startsWith('http')) return showToast('Generate a link first')
    const u = encodeURIComponent(genUrl)
    const x = type === 'whatsapp' ? 'https://wa.me/?text=' : type === 'facebook' ? 'https://www.facebook.com/sharer/sharer.php?u=' : 'https://t.me/share/url?url='
    window.open(x + u, '_blank', 'noopener,noreferrer')
  }

  return (
    <section className="page active">
      <PageHead title="Lead Links" sub="Create one link, give it any name, and share it anywhere." />
      <div className="card" style={{ maxWidth: 850 }}>
        <h3>Create Link</h3>
        <div className="field">
          <label>Link Name</label>
          <input id="ln" className="input" placeholder="Example: August Offer"
            value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') gen() }} />
        </div>
        <div className="field">
          <label>Generated Link</label>
          <div className="linkrow">
            <div className="link">{genUrl || 'Generate your link first.'}</div>
            <button className="btn" onClick={() => copy(genUrl)}>Copy</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={gen}>Generate Link</button>
          <button className="btn" onClick={nativeShare}>↗ Share</button>
          <button className="btn" onClick={() => social('whatsapp')}>WhatsApp</button>
          <button className="btn" onClick={() => social('facebook')}>Facebook</button>
          <button className="btn" onClick={() => social('telegram')}>Telegram</button>
        </div>
      </div>
      <div className="card" style={{ marginTop: 18 }}>
        <h3>Your Links</h3>
        <div style={{ overflow: 'auto' }}>
          <table className="table">
            <thead><tr><th>LINK NAME</th><th>LINK</th><th>LEADS</th><th>ACTION</th></tr></thead>
            <tbody>
              {linkData.map((x) => (
                <tr key={x.id}>
                  <td><b>{x.name}</b></td>
                  <td>{x.url}</td>
                  <td>{x.leads}</td>
                  <td>
                    <button className="btn" onClick={() => copy(x.url)}>Copy</button>{' '}
                    <button className="btn" onClick={() => (navigator.share ? navigator.share({ title: 'Check this out', url: x.url }) : (copyText(x.url), showToast('Link copied — share it anywhere')))}>Share</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}