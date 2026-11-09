export const initialServices = [
  { id: 1, name: 'Website Development' },
  { id: 2, name: 'Digital Marketing' },
]

export const initialFields = [
  { id: 1, name: 'Name' },
  { id: 2, name: 'Phone Number' },
  { id: 3, name: 'Email' },
  { id: 4, name: 'Requirement' },
]

export const initialChatData = [
  { id: 1, name: 'Rahul Sharma', service: 'Website Development', req: 'E-commerce website', date: '2026-08-21', status: 'New', phone: '', email: '', meeting: '' },
  { id: 2, name: 'Neha Gupta', service: 'Digital Marketing', req: 'Meta Ads', date: '2026-08-21', status: 'Contacted', phone: '', email: '', meeting: '' },
  { id: 3, name: 'Amit Verma', service: 'Software Development', req: 'CRM software', date: '2026-08-20', status: 'Qualified', phone: '', email: '', meeting: '' },
  { id: 4, name: 'Pooja Singh', service: 'Website Development', req: 'Business website', date: '2026-08-19', status: 'Won', phone: '', email: '', meeting: '' },
  { id: 5, name: 'Karan Jain', service: 'Digital Marketing', req: 'SEO', date: '2026-08-18', status: 'New', phone: '', email: '', meeting: '' },
  { id: 6, name: 'Meera Gupta', service: 'Website Development', req: 'Landing page', date: '2026-08-17', status: 'Lost', phone: '', email: '', meeting: '' },
  { id: 7, name: 'Ravi Kumar', service: 'Website Development', req: 'Shopify store', date: '2026-08-16', status: 'New', phone: '', email: '', meeting: '' },
  { id: 8, name: 'Sonia Jain', service: 'Digital Marketing', req: 'Google Ads', date: '2026-08-15', status: 'Contacted', phone: '', email: '', meeting: '' },
  { id: 9, name: 'Vikas Sharma', service: 'Software Development', req: 'CRM', date: '2026-08-14', status: 'Qualified', phone: '', email: '', meeting: '' },
]

export const initialLinkData = [
  { id: 1, name: 'August Offer', url: 'https://abc-business.ledora.app/l/august-offer', leads: 74 },
  { id: 2, name: 'Website Campaign', url: 'https://affobe.ledora.app/l/website-campaign', leads: 31 },
  { id: 3, name: 'WhatsApp Promotion', url: 'https://mybusiness.ledora.app/l/whatsapp-promotion', leads: 18 },
]

export const initialLinkLeads = [
  { id: 101, name: 'Rohit Singh', link: 'August Offer', date: '2026-08-21', status: 'New' },
  { id: 102, name: 'Priya Jain', link: 'August Offer', date: '2026-08-21', status: 'Contacted' },
  { id: 103, name: 'Arjun Mehta', link: 'Website Campaign', date: '2026-08-20', status: 'Qualified' },
  { id: 104, name: 'Nisha Kapoor', link: 'WhatsApp Promotion', date: '2026-08-19', status: 'New' },
  { id: 105, name: 'Mohit Jain', link: 'August Offer', date: '2026-08-18', status: 'Won' },
  { id: 106, name: 'Ankit Verma', link: 'Website Campaign', date: '2026-08-17', status: 'New' },
  { id: 107, name: 'Deepak Singh', link: 'August Offer', date: '2026-08-16', status: 'Contacted' },
]

const _meetDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const _meet = (id, name, service, phone, offset, time) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return {
    id, name, service, phone,
    day: _meetDays[d.getDay()],
    date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    raw: iso,
    time,
    dur: '30 minutes',
  }
}

export const initialMeetings = [
  _meet(1, 'Rohit Singh', 'AI Website Development', '+91 98765 43210', 0, '05:30 PM'),
  _meet(2, 'Priya Jain', 'AI Chatbot Setup', '+91 91234 56780', 1, '11:00 AM'),
  _meet(3, 'Arjun Mehta', 'Social Media Management', '+91 99887 76655', 3, '03:00 PM'),
  _meet(4, 'Nisha Kapoor', 'AI Website Development', '+91 90000 11223', 6, '10:30 AM'),
  _meet(5, 'Deepak Singh', 'AI Chatbot Setup', '+91 90909 80808', -2, '04:00 PM'),
  _meet(6, 'Ankit Verma', 'AI Website Development', '+91 98111 22334', -9, '12:30 PM'),
  _meet(7, 'Sonia Jain', 'Social Media Management', '+91 97777 66554', -17, '02:00 PM'),
  _meet(8, 'Mohit Jain', 'AI Chatbot Setup', '+91 96543 21098', -34, '05:00 PM'),
  _meet(9, 'Meera Gupta', 'AI Website Development', '+91 95432 10987', -58, '11:30 AM'),
  _meet(10, 'Vikas Sharma', 'Social Media Management', '+91 94321 09876', -96, '03:30 PM'),
  _meet(11, 'Karan Jain', 'AI Chatbot Setup', '+91 93210 98765', -154, '01:00 PM'),
  _meet(12, 'Pooja Singh', 'AI Website Development', '+91 92109 87654', -221, '10:00 AM'),
  _meet(13, 'Ravi Kumar', 'Social Media Management', '+91 91098 76543', -298, '04:30 PM'),
  _meet(14, 'Neha Gupta', 'AI Chatbot Setup', '+91 90987 65432', -341, '02:30 PM'),
]

const _isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const _subDay = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return d }
const _sub = (id, name, icon, plan, price, billing, startedOffset, validOffset) => ({
  id, name, icon, plan, price, billing,
  started: _subDay(startedOffset).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
  validTill: _subDay(validOffset).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
  validRaw: _isoOf(_subDay(validOffset)),
})

export const DEFAULT_NOTIFY_PHONE = '+91 98765 43210'

export const SUBSCRIPTIONS = [
  _sub('chatbot', 'Ledora Subscription', '◉', 'Ledora Subscription — Yearly', 2999, 'year', -361, 4),
  _sub('social', 'Social Media Management', '▶', 'Advance · Yearly', 49990, 'year', -225, 140),
]

export const SM_PLANS = [
  {
    id: 'basic', name: 'Basic', price: 2999, posts: 10, reels: 5, tag: 'Great Start', tone: '#384FE7',
    feats: ['10 social posts every month', '5 AI presenter reels every month', 'Caption + hashtag writing', '30 day content calendar', 'Up to 4 platforms', 'Email support within 24h', 'Monthly performance report'],
  },
  {
    id: 'advance', name: 'Advance', price: 4999, posts: 15, reels: 6, tag: 'Most Popular', tone: '#6D33E7',
    feats: ['15 social posts every month', '6 AI presenter reels every month', 'Caption + hashtag writing', 'Reel script + shot list included', '30 day content calendar', 'Up to 6 platforms', 'Hashtag research report', 'Priority chat support'],
  },
  {
    id: 'premium', name: 'Premium', price: 6999, posts: 30, reels: 8, tag: 'Best Value', tone: '#5B2BE0',
    feats: ['30 social posts every month', '8 AI presenter reels every month', 'Caption + hashtag writing', 'Reel script + shot list included', '30 day content calendar', 'All platforms supported', 'Hashtag research report', 'Competitor & trend analysis', 'Design + thumbnail support', 'Dedicated account manager'],
  },
]

export const SM_YEARLY_FREE_MONTHS = 2

export const smPlanPrice = (plan, billing) =>
  billing === 'yearly' ? plan.price * (12 - SM_YEARLY_FREE_MONTHS) : plan.price

export const smPlanPeriod = (billing) => (billing === 'yearly' ? 'year' : 'month')

export const smPlanUnits = (plan, billing) => ({
  posts: plan.posts,
  reels: plan.reels,
  days: 30,
  months: billing === 'yearly' ? 12 : 1,
})

export const SM_DELIVERABLES = [
  { ic: '▦', t: '30-Day Content Calendar', d: 'Your entire month planned in advance — dates, post types, platforms and timings.' },
  { ic: '✎', t: 'Design + Caption + Hashtags', d: 'Ready-to-post creatives with written captions and researched hashtag sets.' },
  { ic: '▶', t: 'Reels & Short Videos', d: 'Reel scripts, shot lists and editing direction — ready to shoot or publish.' },
  { ic: '#', t: 'Hashtag Research', d: 'Niche hashtags picked to grow your reach and discovery every week.' },
  { ic: '⏱', t: 'Auto Publishing', d: 'We schedule and publish every post and reel on time on all your platforms.' },
  { ic: '▤', t: 'Monthly Performance Report', d: 'Reach, engagement and leads — a clear report of what worked and what is next.' },
  { ic: '🔎', t: 'Competitor & Trend Analysis', d: 'What is working in your industry right now and how to stay ahead of it.' },
  { ic: '☎', t: 'Support & Account Manager', d: 'Priority chat support, plus a dedicated account manager on the Premium plan.' },
]

export const SM_PLATFORMS = [
  { id: 'instagram', name: 'Instagram', icon: 'IG', color: '#e1306c', len: 2200 },
  { id: 'facebook', name: 'Facebook', icon: 'FB', color: '#1877f2', len: 63206 },
  { id: 'linkedin', name: 'LinkedIn', icon: 'IN', color: '#0a66c2', len: 3000 },
  { id: 'youtube', name: 'YouTube', icon: 'YT', color: '#ff0000', len: 5000 },
  { id: 'google-business', name: 'Google Business Profile', icon: 'GB', color: '#4285f4', len: 3000 },
]

export const SM_CATS = ['Digital Marketing', 'Web Design & Development', 'Real Estate', 'Interior Design', 'Fitness & Gym', 'Education & Coaching', 'Restaurant & Cafe', 'Clinic & Healthcare', 'Clothing & Apparel', 'Automobile Service', 'Beauty & Salon', 'Construction & Interior', 'Travel & Tourism', 'IT & Software', 'Finance & Accounting', 'Manufacturing']

export const SM_AUDS = ['Small business owners', 'Startups & founders', 'Working professionals', 'Families', 'Students', 'Local customers', 'Shop owners', 'First-time home buyers', 'Parents (30-50)', 'Young adults (18-30)']

export const SM_TONES = ['Professional & expert', 'Friendly & warm', 'Fun & playful', 'Bold & motivational', 'Minimal & clean', 'Storytelling & emotional', 'Inspirational']

export const SM_GOALS = ['Increase brand awareness', 'Generate leads / enquiries', 'Boost engagement & followers', 'Drive website traffic', 'Promote a new offer', 'Build trust & credibility', 'Sell a product online']

export const SM_HOOKS = ['Stop scrolling if you are looking for {cat}', '3 quick reasons to choose {biz}', 'Save this for your next {cat} decision', 'Nobody tells you this about {cat}', 'We asked 50 customers about {cat}', 'The honest truth about {cat}', 'One habit that fixes 80% of {cat} problems', 'Before you spend money on {cat}, read this']

export const SM_POST = [
  '{hook}. At {biz} we keep it simple - clear work, honest pricing and results you can actually measure. {cta}',
  'Hi there! Looking for reliable {cat}? {biz} helps {aud} get results without the usual stress. {cta}',
  '{hook}. Here is exactly what our customers love most about working with us. {cta}',
  'Ever wondered what a good {cat} process looks like? We break it into 4 simple steps. {cta}',
  'Milestone moment at {biz}! Thank you {aud}, you are the reason we keep getting better every single day. {cta}',
  'Quick tip: choose your {cat} partner based on proof, not promises. {cta}',
  'Behind every great {cat} campaign is a solid plan. Here is ours for this month. {cta}',
  'A small business is built on trust, not ads. That is why {biz} always delivers on time. {cta}',
  'Your {cat} questions, answered in one post. Swipe through and save the one you need most. {cta}',
  'We just crossed {n} happy customers. Here is to the next hundred. {cta}',
]

export const SM_CTA = ['DM us "INFO" and we will call you today.', 'Tap the link in bio to book a free slot.', 'Comment "START" and our team will reach out.', 'Save this post so you do not forget it.', 'Share this with someone who needs it.', 'Book a free 15 minute call this week.', 'Send us a WhatsApp message on the number in bio.']

export const SM_REEL_IDEA = ['30 second {cat} explained in 60 seconds', 'Day in the life inside {biz}', '3 mistakes people make in {cat}', 'Before and after: our best {cat} project', 'Meet the team behind {biz}', 'Real customer reaction', 'Quick tip: {cat} in 30 seconds', 'How we plan a {cat} month', '5 questions to ask before hiring', 'Our favourite tool for {cat}']

export const SM_REEL_CTA = ['Follow for daily {cat} tips.', 'Save this reel for later.', 'Share with a friend who needs this.', 'DM us to get started today.', 'Comment "GUIDE" for the full checklist.', 'Follow for more reels like this.', 'Tap bio link - limited slots this month.']

export const SM_REEL_SCRIPT = 'HOOK (0-3s): "{hook}"\n\nPROBLEM (3-10s): Show the mistake your customer is making right now.\n\nSOLUTION (10-22s): Show your process in 3 quick cuts - problem, method, result.\n\nPROOF (22-27s): Paste a real result, review or number on screen.\n\nCTA (27-30s): "{cta}"\n\nSHOTS NEEDED:\n1. Close-up hook text on screen\n2. Wide shot of the work / team\n3. 3 quick screen recordings\n4. Customer smile or result shot\n5. Logo end card + handle'

export const SM_TIMES = ['09:30 AM', '11:00 AM', '01:15 PM', '04:00 PM', '06:30 PM', '08:45 PM']

export const SM_TPL = [['ABC', 'xyz', 'business'], ['Bold', 'Growth', 'Together'], ['Grow', 'Daily', 'Now']]

export const SM_CREATIVE = [
  { t: 'AI Website Development', d: 'Today · 6:08 PM', y: 'reel' },
  { t: '5 SEO Mistakes', d: 'Today · 8:00 PM', y: 'reel' },
  { t: 'SEO vs GEO', d: '25 Sep · 6:30 PM', y: 'reel' },
  { t: 'AI Lead Generation', d: '26 Sep · 7:00 PM', y: 'reel' },
  { t: 'CRM Automation', d: '27 Sep · 6:15 PM', y: 'reel' },
  { t: 'Website Cost Guide', d: '28 Sep · 7:10 PM', y: 'reel' },
  { t: 'Google Ranking Tips', d: '29 Sep · 6:20 PM', y: 'reel' },
  { t: 'GMB Growth Tips', d: '30 Sep · 7:00 PM', y: 'reel' },
  { t: 'AI Agents Explained', d: '01 Oct · 6:30 PM', y: 'post' },
  { t: 'Business Automation', d: '02 Oct · 7:15 PM', y: 'post' },
  { t: 'AEO for Businesses', d: '03 Oct · 6:05 PM', y: 'post' },
  { t: 'GEO Optimization', d: '04 Oct · 7:00 PM', y: 'post' },
  { t: 'Lead Follow-up AI', d: '05 Oct · 6:40 PM', y: 'post' },
  { t: 'Social Media AI', d: '06 Oct · 7:20 PM', y: 'post' },
  { t: 'AFFOBE AI OS', d: '07 Oct · 6:10 PM', y: 'post' },
]

export const SM_GRADS = [
  'linear-gradient(135deg,#6D33E7,#384FE7)', 'linear-gradient(135deg,#5B2BE0,#4542E4)',
  'linear-gradient(135deg,#4F3BE5,#384FE7)', 'linear-gradient(135deg,#6D33E7,#5B2BE0)',
  'linear-gradient(135deg,#384FE7,#4542E4)', 'linear-gradient(150deg,#5B2BE0,#384FE7)',
  'linear-gradient(135deg,#6D33E7,#4F3BE5)', 'linear-gradient(160deg,#4542E4,#6D33E7)',
  'linear-gradient(135deg,#384FE7,#6D33E7)', 'linear-gradient(135deg,#4F3BE5,#5B2BE0)',
  'linear-gradient(150deg,#6D33E7,#4542E4)', 'linear-gradient(135deg,#5B2BE0,#4F3BE5)',
  'linear-gradient(135deg,#4542E4,#384FE7)', 'linear-gradient(160deg,#6D33E7,#384FE7)',
  'linear-gradient(135deg,#4F3BE5,#6D33E7)',
]

export const SM_CAL_GRADS = [
  'linear-gradient(135deg,#6D33E7,#384FE7)',
  'linear-gradient(135deg,#111827,#14532d 55%,#12b76a)',
  'linear-gradient(135deg,#1f2937,#92400e 55%,#f79009)',
  'linear-gradient(135deg,#111827,#86198f 55%,#ec4899)',
  'linear-gradient(135deg,#e0e7ff,#ffffff 55%,#bfdbfe)',
  'linear-gradient(135deg,#111827,#075985 55%,#06b6d4)',
]

export const SM_CAL_LIGHT_INDEX = 4

export const SM_ACCOUNTS = [
  {
    id: 'facebook', name: 'Facebook', icon: 'f', color: '#1877f2', desc: 'Facebook Page · Connected', sub: '@affobe · Page publishing and insights enabled',
    stats: [['12.8K', 'Followers'], ['92K / month', 'Page Reach'], ['8.7%', 'Engagement']], auto: true,
  },
  {
    id: 'instagram', name: 'Instagram', icon: 'ig', color: '#e1306c', desc: 'Instagram Professional Account · Connected', sub: 'AFFOBE · Media publishing, reels and insights enabled',
    stats: [['18.4K', 'Followers'], ['184K / month', 'Reach'], ['8 this month', 'Reels']], auto: true,
  },
  {
    id: 'linkedin', name: 'LinkedIn', icon: 'in', color: '#0a66c2', desc: 'Company Page · Connected', sub: '@affobe · Page publishing and insights enabled',
    stats: [['6.2K', 'Followers'], ['28K / month', 'Page Reach'], ['5.4%', 'Engagement']], auto: true,
  },
  {
    id: 'x', name: 'X (Twitter)', icon: 'X', color: '#101828', desc: 'Business Account · Connected', sub: '@affobe · Post publishing and insights enabled',
    stats: [['9.1K', 'Followers'], ['61K / month', 'Reach'], ['4.8%', 'Engagement']], auto: false,
  },
]

export const SM_AUTO = [
  { label: 'Instagram', val: '8 posts/reels scheduled', icon: 'ig', color: '#e1306c', on: true },
  { label: 'Facebook', val: '7 posts/reels scheduled', icon: 'f', color: '#1877f2', on: true },
  { label: 'Best window', val: 'Tuesday / Thursday · 6–8 PM IST', icon: 'AI', color: '#6D33E7', on: false },
]

export const SM_PERF = [
  { l: 'AVERAGE REACH', v: '18.4K' },
  { l: 'AVERAGE ENGAGEMENT', v: '8.7%' },
  { l: 'LEADS FROM SOCIAL', v: '64' },
  { l: 'BEST REEL', v: '42.8K views' },
]

export const PAGE_META = {
  dash: { title: 'Dashboard', sub: 'Website, chatbot and lead overview.' },
  bot: { title: 'AI Chatbot Customization', sub: 'Create your own services and choose exactly what customer information the chatbot collects.' },
  chatleads: { title: 'Chatbot Leads', sub: 'Leads captured directly by the website chatbot.' },
  links: { title: 'Lead Links', sub: 'Create one link, give it any name, and share it anywhere.' },
  linkleads: { title: 'Link Leads', sub: 'Every generated link keeps its leads separately.' },
  integration: { title: 'Integration', sub: 'Install your AI chatbot on any website with one code snippet.' },
  meeting: { title: 'Meeting Time', sub: 'Set the time slots your chatbot can offer.' },
  subscription: { title: 'Subscription', sub: 'Your yearly plan.' },
  onboard: { title: 'Business Onboard', sub: 'Fill your business information once — it is used everywhere across the panel.' },
  social: { title: 'Social Media Management', sub: 'Pick a monthly plan. We write the content, captions, hashtags and schedule everything for you.' },
}