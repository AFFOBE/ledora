import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import PageHead from '../components/ui/PageHead'
import { SM_CATS, SM_AUDS, SM_TONES, SM_GOALS } from '../data/mock'
import { escapeHtml, missingBizFields } from '../utils/helpers'
import { uploadFile } from '../api/client'

export default function BusinessOnboard() {
  const { sm, smSaveBiz, smSetStep, smSetResumeCheckout, showToast, go } = useApp()
  const biz = sm.biz || {}
  const resume = Boolean(sm.resumeCheckout)

  const [form, setForm] = useState({
    name: '', cat: '', owner: '', email: '', phone: '', city: '', site: '', year: '',
    about: '', aud: '', tone: '', goal: '', product: '', time: '', avoid: '', logoPath: '',
  })
  const [customCat, setCustomCat] = useState(false)
  const [catInput, setCatInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [logoPreview, setLogoPreview] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)

  useEffect(() => {
    setForm({
      name: biz.name || '', cat: biz.cat || '', owner: biz.owner || '', email: biz.email || '',
      phone: biz.phone || '', city: biz.city || '', site: biz.site || '', year: biz.year || '',
      about: biz.about || '', aud: biz.aud || '', tone: biz.tone || '', goal: biz.goal || '',
      product: biz.product || '', time: biz.time || '', avoid: biz.avoid || '',
      logoPath: biz.logoPath || '',
    })
    setLogoPreview(biz.logo || '')
    if (biz.cat && !SM_CATS.includes(biz.cat)) {
      setCustomCat(true)
      setCatInput(biz.cat)
    } else {
      setCustomCat(false)
      setCatInput('')
    }
  }, [biz.name, biz.cat, biz.owner, biz.email, biz.phone, biz.city, biz.site, biz.year, biz.about, biz.aud, biz.tone, biz.goal, biz.product, biz.time, biz.avoid, biz.logo, biz.logoPath])

  const onCategoryChange = (e) => {
    const val = e.target.value
    if (val === '__other__') {
      setCustomCat(true)
      setForm((f) => ({ ...f, cat: catInput }))
    } else {
      setCustomCat(false)
      setForm((f) => ({ ...f, cat: val }))
    }
  }

  const onCustomCatChange = (e) => {
    const val = e.target.value
    setCatInput(val)
    setForm((f) => ({ ...f, cat: val }))
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const onLogoChange = async (e) => {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!file) return
    if (!/^image\//.test(file.type)) {
      showToast('Please choose a PNG, JPG, WEBP or SVG image')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast('Logo must be under 8 MB')
      return
    }
    setUploadingLogo(true)
    try {
      const uploaded = await uploadFile('/business/logo', file)
      setForm((f) => ({ ...f, logoPath: uploaded.path }))
      setLogoPreview(uploaded.url)
      showToast('Logo uploaded - its brand colours will be used in your creatives')
    } catch (err) {
      showToast(err.message)
    } finally {
      setUploadingLogo(false)
    }
  }

  const clearLogo = () => {
    setForm((f) => ({ ...f, logoPath: '' }))
    setLogoPreview('')
  }

  const save = async () => {
    if (!String(form.name || '').trim()) { showToast('Please enter your business name'); return }
    if (resume) {
      const missing = missingBizFields(form)
      if (missing.length) {
        showToast(`Please fill: ${missing.join(', ')}`)
        return
      }
    }
    if (saving) return
    setSaving(true)
    try {
      await smSaveBiz({ ...form, accounts: biz.accounts || [] })
      if (resume) {
        smSetResumeCheckout(false)
        smSetStep('form')
        go('social')
        showToast('Business details saved — complete your payment now')
      } else {
        showToast('Business details saved')
      }
    } catch (e) {
      showToast(e.message)
    } finally {
      setSaving(false)
    }
  }

  const row = (l, v) => (
    <div className="kv" key={l}><span>{l}</span><b>{v ? escapeHtml(String(v)) : '—'}</b></div>
  )

  return (
    <section className="page active">
      {resume && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'rgba(109,51,231,0.55)', background: 'rgba(109,51,231,0.10)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div className="label">PAYMENT PAUSED</div>
              <h3 style={{ margin: '6px 0 2px' }}>Complete your business details to continue</h3>
              <div className="sub">
                Only <b>Business Name</b> is required. Fill whatever else you can — the rest is optional and you can add it later. Click <b>Save Business Details</b> and you will go straight back to the payment page.
              </div>
            </div>
            <button
              className="btn"
              onClick={() => { smSetResumeCheckout(false); smSetStep('form'); go('social') }}
            >
              ← Back to payment
            </button>
          </div>
        </div>
      )}
      <PageHead title="Business Onboard" sub="Fill your business information once — it is used everywhere across the panel.">
        <button className="btn primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Business Details'}</button>
      </PageHead>

      <form onSubmit={(e) => e.preventDefault()}>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="card">
            <h3>Business Information</h3>
            <div className="field"><label>Business Name *</label><input className="input" id="f_biz" placeholder="e.g. ABC Business" value={form.name} onChange={set('name')} /></div>
            <div className="field">
              <label>Business Category</label>
              <select className="input" id="f_cat" value={customCat ? '__other__' : form.cat} onChange={onCategoryChange}>
                <option value="">Select category</option>
                {SM_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="__other__">Other</option>
              </select>
              {customCat && (
                <input
                  className="input"
                  style={{ marginTop: 8 }}
                  placeholder="Type your business category"
                  value={catInput}
                  onChange={onCustomCatChange}
                />
              )}
            </div>
            <div className="field"><label>Contact Person Name</label><input className="input" id="f_owner" placeholder="e.g. Atul Sharma" value={form.owner} onChange={set('owner')} /></div>
            <div className="field"><label>Email</label><input className="input" id="f_email" type="email" placeholder="owner@yourbusiness.com" value={form.email} onChange={set('email')} /></div>
            <div className="field"><label>Phone / WhatsApp</label><input className="input" id="f_phone" placeholder="+91 98XXXXXXXX" value={form.phone} onChange={set('phone')} /></div>
            <div className="field"><label>City / Location</label><input className="input" id="f_city" placeholder="e.g. Jaipur, Rajasthan" value={form.city} onChange={set('city')} /></div>
            <div className="field"><label>Website</label><input className="input" id="f_site" placeholder="https://www.yourbusiness.com" value={form.site} onChange={set('site')} /></div>
            <div className="field"><label>Year Established</label><input className="input" id="f_year" placeholder="2021" value={form.year} onChange={set('year')} /></div>
            <div className="field">
              <label>Business Logo</label>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ width: 86, height: 86, borderRadius: 16, overflow: 'hidden', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
                  {logoPreview
                    ? <img src={logoPreview} alt="Business logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 7 }} />
                    : <span style={{ opacity: 0.55, fontSize: 26 }}>🖼</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, alignItems: 'flex-start' }}>
                  <label className="btn" style={{ cursor: uploadingLogo ? 'default' : 'pointer', margin: 0 }}>
                    {uploadingLogo ? 'Uploading…' : logoPreview ? 'Change logo' : 'Upload your logo'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={onLogoChange}
                      disabled={uploadingLogo}
                      style={{ display: 'none' }}
                    />
                  </label>
                  {logoPreview ? <button type="button" className="btn" onClick={clearLogo} style={{ padding: '5px 12px' }}>Remove logo</button> : null}
                  <div className="sub" style={{ fontSize: 11.5, margin: 0 }}>PNG / JPG / WEBP / SVG · max 8 MB. Its colours are used in your banners and reels.</div>
                </div>
              </div>
            </div>
          </div>
          <div className="card">
            <h3>Content Direction</h3>
            <div className="field"><label>About Your Business</label><textarea id="f_about" rows={3} placeholder="What you do, what makes you different, your USPs..." value={form.about} onChange={set('about')} /></div>
            <div className="field"><label>Target Audience</label><select className="input" id="f_aud" value={form.aud} onChange={set('aud')}><option value="">Select audience</option>{SM_AUDS.map((a) => <option key={a}>{a}</option>)}</select></div>
            <div className="field"><label>Brand Tone of Voice</label><select className="input" id="f_tone" value={form.tone} onChange={set('tone')}><option value="">Select tone</option>{SM_TONES.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div className="field"><label>Primary Goal This Month</label><select className="input" id="f_goal" value={form.goal} onChange={set('goal')}><option value="">Select goal</option>{SM_GOALS.map((g) => <option key={g}>{g}</option>)}</select></div>
            <div className="field"><label>Main Product / Service to Promote</label><input className="input" id="f_product" placeholder="e.g. Website Development Package" value={form.product} onChange={set('product')} /></div>
            <div className="field"><label>Preferred Posting Time</label><select className="input" id="f_time" value={form.time || 'Morning (9 AM - 12 PM)'} onChange={set('time')}><option>Morning (9 AM - 12 PM)</option><option>Afternoon (12 PM - 4 PM)</option><option>Evening (4 PM - 9 PM)</option></select></div>
            <div className="field"><label>Anything We Should Avoid?</label><input className="input" id="f_avoid" placeholder="e.g. no medical claims, no competitor names" value={form.avoid} onChange={set('avoid')} /></div>
          </div>
        </div>
      </form>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Saved Business Details</h3>
        {!sm.biz
          ? <div className="sub">No business details saved yet. Fill the form above and click <b>Save Business Details</b>.</div>
          : (
            <>
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '0 34px' }}>
                <div className="kv" key="logo"><span>Business Logo</span><b>{logoPreview ? <img src={logoPreview} alt="Business logo" style={{ height: 36, maxWidth: 120, objectFit: 'contain' }} /> : '—'}</b></div>
                {row('Business Name', form.name)}
                {row('Business Category', form.cat)}
                {row('Contact Person', form.owner)}
                {row('Email', form.email)}
                {row('Phone / WhatsApp', form.phone)}
                {row('City / Location', form.city)}
                {row('Website', form.site)}
                {row('Year Established', form.year)}
                {row('Target Audience', form.aud)}
                {row('Brand Tone', form.tone)}
                {row('Primary Goal', form.goal)}
                {row('Posting Time', form.time)}
                {row('Product / Service', form.product)}
                {row('Avoid', form.avoid)}
              </div>
              {form.about ? (<><div className="kv" style={{ border: 0 }}><span>About Business</span></div><div className="sub">{form.about}</div></>) : null}
            </>
          )}
      </div>
    </section>
  )
}