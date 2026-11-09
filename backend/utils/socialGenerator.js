const {
  SM_PLANS,
  SM_CREATIVE,
  SM_GRADS,
  SM_HOOKS,
  SM_CTA,
  SM_REEL_CTA,
  SM_POST,
  SM_REEL_IDEA,
  SM_REEL_SCRIPT,
} = require('../data/socialContent')

const BASE_TAGS = {
  'Digital Marketing': ['#DigitalMarketing', '#Marketing', '#MarketingStrategy'],
  'Web Design & Development': ['#WebDesign', '#WebDevelopment', '#WebsiteDesign'],
  'Real Estate': ['#RealEstate', '#PropertyForSale', '#RealEstateAgent'],
  'Interior Design': ['#InteriorDesign', '#HomeDecor', '#InteriorDesigner'],
  'Fitness & Gym': ['#Fitness', '#Gym', '#FitnessMotivation'],
  'Education & Coaching': ['#Education', '#OnlineLearning', '#Coaching'],
  'Restaurant & Cafe': ['#FoodLovers', '#Cafe', '#Foodie'],
  'Clinic & Healthcare': ['#Healthcare', '#Wellness', '#SkinCare'],
  'Clothing & Apparel': ['#Fashion', '#FashionDesign', '#Clothing'],
  'Automobile Service': ['#AutoService', '#CarService', '#Automotive'],
  'Beauty & Salon': ['#Beauty', '#Salon', '#BeautyTips'],
  'Construction & Interior': ['#Construction', '#Builders', '#Architecture'],
  'Travel & Tourism': ['#Travel', '#TravelGram', '#Wanderlust'],
  'IT & Software': ['#TechNews', '#Software', '#WebDevelopment'],
  'Finance & Accounting': ['#Finance', '#Accounting', '#MoneyTips'],
  'Manufacturing': ['#Manufacturing', '#Factory', '#Industry'],
}

const genTags = (biz) => {
  const n = String(biz.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const base = BASE_TAGS[biz.cat] || ['#SmallBusiness', '#Growth', '#Business']
  const firstWord = String(biz.cat || '').split(' ')[0].replace(/&/g, '')
  const set = new Set([`#${n}`, `#${firstWord}`, ...base, '#SocialMediaMarketing', '#ContentCreation', '#TrendingNow', '#MarketingTips'])
  return [...set].slice(0, 9).join(' ')
}

const fill = (s, ctx) =>
  String(s)
    .replace(/\{cat\}/g, ctx.cat)
    .replace(/\{biz\}/g, ctx.name)
    .replace(/\{aud\}/g, ctx.aud)
    .replace(/\{hook\}/g, ctx.hook || '')
    .replace(/\{cta\}/g, ctx.cta || '')
    .replace(/\{n\}/g, String(ctx.n || 0))

const makeTitle = (raw, ctx) => {
  const s = fill(raw, ctx).replace(/\s+/g, ' ').trim()
  const sentence = s.split(/[.!?]/)[0].trim().replace(/,$/, '')
  const out = sentence.length >= 12 ? sentence : s
  if (out.length <= 60) return out
  const cut = out.slice(0, 58)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 25 ? cut.slice(0, lastSpace) : cut).trim() + '...'
}

const extraTitle = (i, type, ctx) => {
  const raw =
    type === 'reel' ? SM_REEL_IDEA[i % SM_REEL_IDEA.length] : SM_POST[i % SM_POST.length]
  return makeTitle(raw, ctx)
}

const extraDate = (i) => {
  const d = new Date(2026, 9, 7)
  d.setDate(d.getDate() + (i - SM_CREATIVE.length + 1))
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} · 6:30 PM`
}

const generateItems = (biz, count) => {
  const tags = genTags(biz)
  const cat = String(biz.cat || '').toLowerCase()
  const name = biz.name || ''
  const aud = String(biz.aud || '').toLowerCase()
  const items = []
  const total = Math.max(count || SM_CREATIVE.length, 1)

  for (let i = 0; i < total; i++) {
    const tpl = SM_CREATIVE[i % SM_CREATIVE.length]
    const isExtra = i >= SM_CREATIVE.length
    const type = isExtra ? (i % 3 === 0 ? 'reel' : 'post') : tpl.y
    const ord = type === 'reel' ? i : i - 8
    const sched = isExtra ? i % 2 === 0 : type === 'reel' ? ord < 5 : ord < 4

    const hook = SM_HOOKS[(i * 3 + 1) % SM_HOOKS.length].replace('{cat}', cat).replace('{biz}', name)
    const cta = SM_CTA[(i * 5 + 2) % SM_CTA.length].replace('{cat}', cat)
    const rcta = SM_REEL_CTA[(i * 7 + 3) % SM_REEL_CTA.length].replace('{cat}', cat)
    const ctx = { cat, name, aud, hook, cta, n: 12 + i * 7 }

    const caption =
      type === 'post' ? fill(SM_POST[i % SM_POST.length], ctx) : `${fill(SM_REEL_IDEA[i % SM_REEL_IDEA.length], ctx)}\n\n${cta}`

    items.push({
      id: 'sm' + i,
      day: i + 1,
      no: i + 1,
      title: isExtra ? extraTitle(i, type, ctx) : tpl.t,
      dstr: isExtra ? extraDate(i) : tpl.d,
      dow: '',
      date: '',
      type,
      caption,
      hashtags: tags,
      media: type === 'post' ? 'Brand graphic with text overlay · 1080x1080' : 'Vertical 9:16 video, trending audio',
      script:
        type === 'reel'
          ? SM_REEL_SCRIPT.replace('{hook}', hook).replace('{cta}', rcta).replace('{cat}', cat)
          : 'Image / carousel graphic as per brand kit',
      cta: type === 'reel' ? rcta : cta,
      platform: 'instagram',
      handle: '@affobe',
      platformLabel: 'Instagram + Facebook',
      status: sched ? 'Scheduled' : 'Draft',
      note: '',
      grad: SM_GRADS[i % SM_GRADS.length],
    })
  }
  return items
}

const buildSocialPayload = (biz, planId) => {
  const plan = SM_PLANS.find((p) => p.id === planId) || SM_PLANS[1]
  const items = generateItems(biz, plan.posts)
  return {
    plan: { id: plan.id, name: plan.name, price: plan.price },
    items,
    grad: SM_GRADS,
  }
}

module.exports = { buildSocialPayload, generateItems, SM_PLANS }