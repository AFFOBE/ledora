import { SM_CREATIVE, SM_GRADS, SM_HOOKS, SM_CTA, SM_REEL_CTA, SM_POST, SM_REEL_IDEA, SM_REEL_SCRIPT } from '../data/mock'

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

export function smGenTags(biz) {
  const n = (biz.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const base = BASE_TAGS[biz.cat] || ['#SmallBusiness', '#Growth', '#Business']
  const firstWord = String(biz.cat || '').split(' ')[0].replace(/&/g, '')
  const set = new Set([`#${n}`, `#${firstWord}`, ...base, '#SocialMediaMarketing', '#ContentCreation', '#TrendingNow', '#MarketingTips'])
  return [...set].slice(0, 9).join(' ')
}

export function smGenerate(biz) {
  const tags = smGenTags(biz)
  return SM_CREATIVE.map((c, i) => {
    const type = c.y
    const ord = type === 'reel' ? i : i - 8
    const sched = type === 'reel' ? ord < 5 : ord < 4
    const hook = SM_HOOKS[(i * 3 + 1) % SM_HOOKS.length].replace('{cat}', (biz.cat || '').toLowerCase()).replace('{biz}', biz.name || '')
    const cta = SM_CTA[(i * 5 + 2) % SM_CTA.length].replace('{cat}', (biz.cat || '').toLowerCase())
    const rcta = SM_REEL_CTA[(i * 7 + 3) % SM_REEL_CTA.length].replace('{cat}', (biz.cat || '').toLowerCase())
    const caption = type === 'post'
      ? SM_POST[i % SM_POST.length]
          .replace('{hook}', hook)
          .replace('{biz}', biz.name || '')
          .replace('{cat}', (biz.cat || '').toLowerCase())
          .replace('{aud}', (biz.aud || '').toLowerCase())
          .replace('{n}', String(12 + i * 7))
          .replace('{cta}', cta)
      : `${SM_REEL_IDEA[i % SM_REEL_IDEA.length].replace('{cat}', (biz.cat || '').toLowerCase()).replace('{biz}', biz.name || '')}\n\n${cta}`

    return {
      id: 'sm' + i,
      day: i + 1,
      no: i + 1,
      title: c.t,
      dstr: c.d,
      dow: '',
      date: '',
      type,
      caption,
      hashtags: tags,
      media: type === 'post' ? 'Brand graphic with text overlay · 1080x1080' : 'Vertical 9:16 video, trending audio',
      script: type === 'reel'
        ? SM_REEL_SCRIPT.replace('{hook}', hook).replace('{cta}', rcta).replace('{cat}', (biz.cat || '').toLowerCase())
        : 'Image / carousel graphic as per brand kit',
      cta: type === 'reel' ? rcta : cta,
      platform: 'instagram',
      handle: '@affobe',
      platformLabel: 'Instagram + Facebook',
      status: sched ? 'Scheduled' : 'Draft',
      note: '',
      grad: SM_GRADS[i % SM_GRADS.length],
    }
  })
}

export function smHandle(name) {
  const n = (name || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  return n ? '@' + n : '@affobe'
}

export function bizInitials(name) {
  return String(name || '')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}