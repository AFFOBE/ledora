const SM_PLANS = [
  {
    id: 'basic', name: 'Basic', price: 2999, posts: 10, reels: 5, tag: 'Great Start', tone: '#2563eb',
    feats: ['10 social posts every month', '5 AI presenter reels every month', 'Caption + hashtag writing', '30 day content calendar', 'Up to 4 platforms', 'Email support within 24h', 'Monthly performance report'],
  },
  {
    id: 'advance', name: 'Advance', price: 4999, posts: 15, reels: 6, tag: 'Most Popular', tone: '#6d5dfc',
    feats: ['15 social posts every month', '6 AI presenter reels every month', 'Caption + hashtag writing', 'Reel script + shot list included', '30 day content calendar', 'Up to 6 platforms', 'Hashtag research report', 'Priority chat support'],
  },
  {
    id: 'premium', name: 'Premium', price: 6999, posts: 30, reels: 8, tag: 'Best Value', tone: '#039855',
    feats: ['30 social posts every month', '8 AI presenter reels every month', 'Caption + hashtag writing', 'Reel script + shot list included', '30 day content calendar', 'All platforms supported', 'Hashtag research report', 'Competitor & trend analysis', 'Design + thumbnail support', 'Dedicated account manager'],
  },
]

const SM_PLATFORMS = [
  { id: 'instagram', name: 'Instagram', icon: 'IG', color: '#e1306c', len: 2200 },
  { id: 'facebook', name: 'Facebook', icon: 'FB', color: '#1877f2', len: 63206 },
  { id: 'linkedin', name: 'LinkedIn', icon: 'IN', color: '#0a66c2', len: 3000 },
  { id: 'youtube', name: 'YouTube', icon: 'YT', color: '#ff0000', len: 5000 },
  { id: 'x', name: 'X (Twitter)', icon: 'X', color: '#101828', len: 280 },
  { id: 'pinterest', name: 'Pinterest', icon: 'PI', color: '#e60023', len: 500 },
  { id: 'whatsapp', name: 'WhatsApp Business', icon: 'WA', color: '#25d366', len: 4096 },
]

const SM_CATS = ['Digital Marketing', 'Web Design & Development', 'Real Estate', 'Interior Design', 'Fitness & Gym', 'Education & Coaching', 'Restaurant & Cafe', 'Clinic & Healthcare', 'Clothing & Apparel', 'Automobile Service', 'Beauty & Salon', 'Construction & Interior', 'Travel & Tourism', 'IT & Software', 'Finance & Accounting', 'Manufacturing']

const SM_AUDS = ['Small business owners', 'Startups & founders', 'Working professionals', 'Families', 'Students', 'Local customers', 'Shop owners', 'First-time home buyers', 'Parents (30-50)', 'Young adults (18-30)']

const SM_TONES = ['Professional & expert', 'Friendly & warm', 'Fun & playful', 'Bold & motivational', 'Minimal & clean', 'Storytelling & emotional', 'Inspirational']

const SM_GOALS = ['Increase brand awareness', 'Generate leads / enquiries', 'Boost engagement & followers', 'Drive website traffic', 'Promote a new offer', 'Build trust & credibility', 'Sell a product online']

const SM_HOOKS = ['Stop scrolling if you are looking for {cat}', '3 quick reasons to choose {biz}', 'Save this for your next {cat} decision', 'Nobody tells you this about {cat}', 'We asked 50 customers about {cat}', 'The honest truth about {cat}', 'One habit that fixes 80% of {cat} problems', 'Before you spend money on {cat}, read this']

const SM_POST = [
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

const SM_CTA = ['DM us "INFO" and we will call you today.', 'Tap the link in bio to book a free slot.', 'Comment "START" and our team will reach out.', 'Save this post so you do not forget it.', 'Share this with someone who needs it.', 'Book a free 15 minute call this week.', 'Send us a WhatsApp message on the number in bio.']

const SM_REEL_IDEA = ['30 second {cat} explained in 60 seconds', 'Day in the life inside {biz}', '3 mistakes people make in {cat}', 'Before and after: our best {cat} project', 'Meet the team behind {biz}', 'Real customer reaction', 'Quick tip: {cat} in 30 seconds', 'How we plan a {cat} month', '5 questions to ask before hiring', 'Our favourite tool for {cat}']

const SM_REEL_CTA = ['Follow for daily {cat} tips.', 'Save this reel for later.', 'Share with a friend who needs this.', 'DM us to get started today.', 'Comment "GUIDE" for the full checklist.', 'Follow for more reels like this.', 'Tap bio link - limited slots this month.']

const SM_REEL_SCRIPT = 'HOOK (0-3s): "{hook}"\n\nPROBLEM (3-10s): Show the mistake your customer is making right now.\n\nSOLUTION (10-22s): Show your process in 3 quick cuts - problem, method, result.\n\nPROOF (22-27s): Paste a real result, review or number on screen.\n\nCTA (27-30s): "{cta}"\n\nSHOTS NEEDED:\n1. Close-up hook text on screen\n2. Wide shot of the work / team\n3. 3 quick screen recordings\n4. Customer smile or result shot\n5. Logo end card + handle'

const SM_TIMES = ['09:30 AM', '11:00 AM', '01:15 PM', '04:00 PM', '06:30 PM', '08:45 PM']

const SM_CREATIVE = [
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

const SM_GRADS = [
  'linear-gradient(135deg,#2563eb,#6d5dfc)', 'linear-gradient(135deg,#e1306c,#ff8a5b)',
  'linear-gradient(135deg,#039855,#6ce9a6)', 'linear-gradient(135deg,#f79009,#fdb022)',
  'linear-gradient(135deg,#7a5af8,#c7b3ff)', 'linear-gradient(135deg,#0a66c2,#38bdf8)',
  'linear-gradient(135deg,#d92d20,#fda29b)', 'linear-gradient(135deg,#0e9384,#5fe1c4)',
  'linear-gradient(135deg,#b54708,#fdb022)', 'linear-gradient(135deg,#5925dc,#9e77ed)',
  'linear-gradient(135deg,#175cd3,#7c9cff)', 'linear-gradient(135deg,#027a48,#a6f4c5)',
  'linear-gradient(135deg,#c11574,#f9a8d4)', 'linear-gradient(135deg,#3538cd,#a5b4fc)',
  'linear-gradient(135deg,#b42318,#fecaca)',
]

const SM_ACCOUNTS = [
  { id: 'facebook', name: 'Facebook', icon: 'f', color: '#1877f2', desc: 'Facebook Page · Connected', sub: '@affobe · Page publishing and insights enabled', stats: [['12.8K', 'Followers'], ['92K / month', 'Page Reach'], ['8.7%', 'Engagement']], auto: true },
  { id: 'instagram', name: 'Instagram', icon: 'ig', color: '#e1306c', desc: 'Instagram Professional Account · Connected', sub: 'AFFOBE · Media publishing, reels and insights enabled', stats: [['18.4K', 'Followers'], ['184K / month', 'Reach'], ['8 this month', 'Reels']], auto: true },
  { id: 'linkedin', name: 'LinkedIn', icon: 'in', color: '#0a66c2', desc: 'Company Page · Connected', sub: '@affobe · Page publishing and insights enabled', stats: [['6.2K', 'Followers'], ['28K / month', 'Page Reach'], ['5.4%', 'Engagement']], auto: true },
  { id: 'x', name: 'X (Twitter)', icon: 'X', color: '#101828', desc: 'Business Account · Connected', sub: '@affobe · Post publishing and insights enabled', stats: [['9.1K', 'Followers'], ['61K / month', 'Reach'], ['4.8%', 'Engagement']], auto: false },
]

const SM_AUTO = [
  { label: 'Instagram', val: '8 posts/reels scheduled', icon: 'ig', color: '#e1306c', on: true },
  { label: 'Facebook', val: '7 posts/reels scheduled', icon: 'f', color: '#1877f2', on: true },
  { label: 'Best window', val: 'Tuesday / Thursday · 6–8 PM IST', icon: 'AI', color: '#7a5af8', on: false },
]

const SM_PERF = [
  { l: 'AVERAGE REACH', v: '18.4K' },
  { l: 'AVERAGE ENGAGEMENT', v: '8.7%' },
  { l: 'LEADS FROM SOCIAL', v: '64' },
  { l: 'BEST REEL', v: '42.8K views' },
]

const CHATBOT_PLANS = [
  { id: 'yearly', name: 'AI Chatbot — Yearly', price: 2999, status: 'active' },
]

module.exports = {
  SM_PLANS,
  SM_PLATFORMS,
  SM_CATS,
  SM_AUDS,
  SM_TONES,
  SM_GOALS,
  SM_HOOKS,
  SM_POST,
  SM_CTA,
  SM_REEL_IDEA,
  SM_REEL_CTA,
  SM_REEL_SCRIPT,
  SM_TIMES,
  SM_CREATIVE,
  SM_GRADS,
  SM_ACCOUNTS,
  SM_AUTO,
  SM_PERF,
  CHATBOT_PLANS,
}