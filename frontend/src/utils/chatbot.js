import { SM_PLANS } from '../data/mock'

export function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]))
}

export function leadIntent(q) {
  const q0 = String(q).toLowerCase()
  const want = ['banwana', 'banwa', 'banani', 'banana hai', 'chahiye', 'chaiye', 'lena', 'leni', 'le lunga', 'karwana', 'karana', 'karani', 'karna hai', 'interested', 'interest', 'quote', 'quotation', 'enquiry', 'enquire', 'inquiry', 'hire', 'buy', 'purchase', 'order', 'start karna', 'book karna', 'service lena', 'kitne ka', 'kitne me', 'price kya', 'rate kya', 'want', 'need']
  if (!want.some((w) => q0.includes(w))) return null
  const svc = [['website', 'Website Development'], ['web', 'Website Development'], ['social media', 'Social Media Management'], ['social', 'Social Media Management'], ['marketing', 'Digital Marketing'], ['reel', 'Reels & Video'], ['seo', 'SEO'], ['ads', 'Ads Campaign'], ['software', 'Software Development'], ['crm', 'CRM Software'], ['chatbot', 'AI Chatbot'], ['lead link', 'Lead Links'], ['digital', 'Digital Marketing']]
  const hit = svc.find((p) => q0.includes(p[0]))
  return { service: hit ? hit[1] : 'General Enquiry' }
}

export function botReply(q, biz, services) {
  const b = biz || {}
  const name = escapeHtml(b.name || 'ABC Business')
  const cat = escapeHtml(b.cat || 'Digital Marketing')
  const about = escapeHtml(b.about || '')
  const prod = escapeHtml(b.product || '')
  const aud = escapeHtml(b.aud || '')
  const goal = escapeHtml(b.goal || '')
  const city = escapeHtml(b.city || '')
  const year = escapeHtml(b.year || '')
  const email = escapeHtml(b.email || '')
  const phone = escapeHtml(b.phone || '')
  const site = escapeHtml(b.site || '')

  const q0 = String(q).toLowerCase()
  const has = (...words) => words.some((w) => q0.includes(w))

  const svc = services && services.length
    ? services.map((s) => escapeHtml(s.name)).filter(Boolean).join(', ')
    : 'Website Development, Digital Marketing, Software Development'
  const pdet = (p) => `<b>${p.name} Plan — \u20B9${p.price.toLocaleString('en-IN')}/year</b> (${p.tag}):<br>• ${p.feats.join('<br>• ')}`
  const allPlans = SM_PLANS.map((p) => `• <b>${p.name}</b> — \u20B9${p.price.toLocaleString('en-IN')}/yr · ${p.posts} posts + ${p.reels} reels/month`).join('<br>')

  if (!q0 || /\b(hi|hii|hlo|helo|hello|hey|namaste|namaskar)\b/.test(q0)) return `Hello! I am the ${name} assistant.<br>Ask me about ${name} — services, plans, dashboard, lead links or how to join.`
  if (has('who are', 'about you', 'your name')) return `I am the assistant of ${name}.<br>I answer questions about our business and the ${name} dashboard.`
  if (has('since', 'how long', 'established', 'founded', 'kb se', 'kab se', 'kitne saal', 'purani', 'years old', 'start hua', 'shuru')) return year ? `${name} has been running since ${year}.` : null

  const pf = SM_PLANS.find((p) => q0.includes(p.id))
  if (pf) return pdet(pf) + '<br>Ask "all plans" to compare all three.'
  if (has('plan', 'plans', 'price', 'pricing', 'cost', 'charge', 'fee', 'payment', 'gst', 'rupee', 'money', 'emi', 'subscription', 'pay')) return `Plans of ${name} (per year):<br>${allPlans}<br>+18% GST. Pay via UPI, Card, NetBanking or EMI.<br>Ask e.g. "basic plan details" for full features, or say "I want to start" and I will take your details.`
  if (has('link lead', 'linkleads', 'link-lead')) return '<b>Link Leads</b> page shows every lead captured from your shared links — name, link name, date and status, with search, date filter and CSV download.'
  if (has('lead link', 'lead-link', 'link', 'links', 'share')) return `<b>Lead Links</b> — create one link, give it any name, then share it on WhatsApp, Instagram, Facebook or Telegram.<br>• Anyone who opens it can send their details<br>• Every lead lands in the <b>Link Leads</b> page automatically<br>• Copy or native-share the link in one click.`
  if (has('chatbot', 'chat bot', 'bot reply', 'auto reply', 'bot')) return '<b>AI Chatbot</b> — replies to website visitors 24/7 and captures Name, Phone, Email & Requirement as leads.<br>• Welcome message and service buttons are editable<br>• Installs with one line of code (see Integration)<br>• Works on any website or landing page.'
  if (has('dashboard', 'option', 'options', 'everything', 'pages', 'menu', 'modules', 'feature', 'features', 'full')) return `The ${name} dashboard has:<br>• <b>Dashboard</b> — overview of leads, creatives and performance<br>• <b>AI Chatbot</b> — answers visitors 24/7, editable replies<br>• <b>Chatbot Leads</b> — name, phone, requirement with filters & CSV download<br>• <b>Lead Links</b> — shareable capture links (WhatsApp, Instagram, Telegram)<br>• <b>Link Leads</b> — leads collected from your links<br>• <b>Integration</b> — one-line code to add the chatbot to any website<br>• <b>Meeting Time</b> — booking slots<br>• <b>Subscription</b> — 3 yearly plans + GST<br>• <b>Business Onboard</b> — your business details & services<br>• <b>Social Media</b> — Reel Previews (video mode) + Publishing Calendar`
  if (has('calendar', 'schedul', 'publish', 'autopublish')) return '<b>Publishing Calendar</b> — a 30-day auto-publishing plan.<br>• Post to Instagram, Facebook, LinkedIn & X automatically<br>• Each card shows thumb, platform, date and REEL/POST tag<br>• Preview and Schedule any post in one click.'
  if (has('social', 'marketing', 'reel', 'instagram', 'facebook', 'post', 'content', 'linkedin', 'youtube', 'video')) return `<b>AI Social Media Manager</b> of ${name}:<br>• 15 posts + reels every month<br>• Reel Previews with video mode ON<br>• Auto-publishing calendar on Instagram, Facebook, LinkedIn, X<br>• Captions, hashtags and reel scripts are AI written.`
  if (has('analytics', 'performance', 'report', 'insight', 'growth', 'follower', 'impression', 'engagement')) return `<b>Analytics</b> — track performance of ${name}: followers, reach, impressions, top post and goal progress with monthly reports.`
  if (has('integration', 'install', 'code', 'widget', 'snippet', 'embed')) return '<b>Integration</b> — add the chatbot to any website with one line before &lt;/body&gt;:<br>&lt;script src="https://ledora.app/widget.js" data-bot-id="YOUR_BOT_ID"&gt;&lt;/script&gt;<br>Copy the exact snippet from the Integration page and it will load the chat bubble automatically.'
  if (has('onboard', 'setup', 'business detail', 'profile', 'settings')) return '<b>Business Onboard</b> stores your business details — name, category, owner, contact, city, website, about, audience, goal, tone and services. The chatbot and all creatives use this data.'
  if (has('meeting', 'appointment', 'book', 'slot', 'schedule a call')) return `Meeting Time for ${name}: Mon–Fri 10–6, Sat 11–3, 30–60 min slots. Sunday closed. Share your preferred time to book.`
  if (has('service', 'services', 'offer')) return `Services ${name} offers:<br>• ${svc.replace(/,\s+/g, '<br>• ')}<br>Plus AI chatbot, social media management, lead links and lead capture.<br><br>Want any of these? Just say e.g. "I want a website" and I will take your details.`
  if (has('website', 'web design', 'web develop', 'landing', 'ecommerce', 'e-commerce', 'seo')) return `Web services by ${name}: business websites, landing pages and e-commerce — mobile-friendly and SEO-ready, maintenance included in plans.`
  if (has('software', 'crm', 'automation', 'tool')) return `Software services of ${name}: custom CRM, WhatsApp/email/SMS automations, dashboards and reports for small businesses.`
  if (has('join', 'sign', 'subscribe', 'register', 'get started', 'start with', 'kese join', 'kaise join')) return `To join ${name}:<br>1. Pick a plan — Basic ₹2,999 · Advance ₹4,999 · Premium ₹6,999 per year<br>2. Fill Business Onboard details<br>3. Pay (UPI, Card, NetBanking, EMI — +18% GST)<br>4. Your 30-day content dashboard starts with 15 creatives.`
  if (has('how it work', 'how we work', 'how do you work', 'how does', 'work', 'kya karta', 'kya kaam', 'kaam', 'kese', 'kaise')) return `How ${name} works:<br>• AI chatbot answers visitors 24/7 and saves leads<br>• AI Social Media Manager posts 15 creatives/month on a 30-day calendar<br>• Lead Links capture leads from anywhere<br>• Analytics reports growth; plans start from ₹2,999/year.`
  if (has('what is', 'about', 'tell me', 'introduce', 'company', 'business', 'kya hai', 'detail')) {
    const o = [`About ${name}:`]
    o.push(about ? about : `${name} is a ${cat} business helping companies grow online.`)
    o.push(`Category: ${cat}${prod ? ` · Main offering: ${prod}` : ''}`)
    if (aud) o.push('Audience: ' + aud)
    if (goal) o.push('Goal: ' + goal)
    if (city) o.push('Location: ' + city)
    if (year) o.push('Since ' + year)
    return o.join('<br>')
  }
  if (has('contact', 'phone', 'email', 'call', 'number', 'address', 'location')) {
    const c = [`Contact ${name} —`]
    if (email) c.push('Email: ' + email)
    if (phone) c.push('Phone: ' + phone)
    if (site) c.push('Website: ' + site)
    if (city) c.push('Location: ' + city)
    return c.join('<br>')
  }
  if (has('thank', 'thanks', 'thx')) return 'You are welcome! Anything else about ' + name + '?'
  if (has('bye', 'goodbye', 'tata')) return 'Goodbye! We are here anytime you need help.'
  return null
}