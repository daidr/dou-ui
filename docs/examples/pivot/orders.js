// 一家茶饮连锁店 2026 年的订单（编出来的数据，每次生成都一样）
const cities = {
  华东: ['上海', '杭州', '南京', '苏州'],
  华南: ['广州', '深圳', '厦门'],
  华北: ['北京', '天津', '青岛'],
  西南: ['成都', '重庆', '昆明'],
}
const categories = ['果茶', '奶茶', '纯茶', '咖啡']
const channels = ['门店', '外卖', '小程序']

export function makeOrders(count, seed = 2026) {
  let state = seed
  const random = () => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0
    return state / 4294967296
  }
  const regions = Object.keys(cities)
  const orders = Array.from({ length: count })
  for (let i = 0; i < count; i++) {
    const region = regions[Math.floor(random() * regions.length)]
    const list = cities[region]
    const month = 1 + Math.floor(random() * 12)
    const cups = 1 + Math.floor(random() * 4)
    const category = categories[Math.floor(random() * categories.length)]
    const price = category === '咖啡' ? 22 : category === '纯茶' ? 14 : 18
    orders[i] = {
      region,
      city: list[Math.floor(random() * list.length)],
      category,
      channel: channels[Math.floor(random() * channels.length)],
      quarter: `Q${Math.ceil(month / 3)}`,
      month,
      amount: Math.round(cups * price * (0.8 + random() * 0.4) * 100) / 100,
      cups,
      date: new Date(2026, month - 1, 1 + Math.floor(random() * 28)),
    }
  }
  return orders
}

/**
 * 同样的订单按列给出：每个字段一个数组，数字用类型化数组。
 * 百万条记录用这种形式，内存只有对象数组的几分之一。
 * 分段生成：每次 next() 生成 2 万条，生成完时返回全部列。
 */
export function* orderColumnSteps(count, seed = 2026) {
  let state = seed
  const random = () => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0
    return state / 4294967296
  }
  const regions = Object.keys(cities)
  const columns = {
    region: [],
    city: [],
    category: [],
    channel: [],
    quarter: [],
    month: new Float64Array(count),
    amount: new Float64Array(count),
    cups: new Float64Array(count),
  }
  for (let i = 0; i < count; i++) {
    if (i && i % 20000 === 0) yield i
    const region = regions[Math.floor(random() * regions.length)]
    const list = cities[region]
    const month = 1 + Math.floor(random() * 12)
    const cups = 1 + Math.floor(random() * 4)
    const category = categories[Math.floor(random() * categories.length)]
    const price = category === '咖啡' ? 22 : category === '纯茶' ? 14 : 18
    columns.region[i] = region
    columns.city[i] = list[Math.floor(random() * list.length)]
    columns.category[i] = category
    columns.channel[i] = channels[Math.floor(random() * channels.length)]
    columns.quarter[i] = `Q${Math.ceil(month / 3)}`
    columns.month[i] = month
    columns.amount[i] = Math.round(cups * price * (0.8 + random() * 0.4) * 100) / 100
    columns.cups[i] = cups
  }
  return columns
}

export const orders = makeOrders(2400)

export const fields = [
  { name: 'region', label: '大区', order: ['华东', '华南', '华北', '西南'] },
  { name: 'city', label: '城市' },
  { name: 'category', label: '品类' },
  { name: 'channel', label: '渠道' },
  { name: 'quarter', label: '季度' },
  { name: 'date', label: '下单日期', type: 'date' },
  { name: 'month', label: '月份', format: (m) => `${m} 月` },
  {
    name: 'amount',
    label: '销售额',
    type: 'number',
    format: { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 },
  },
  { name: 'cups', label: '杯数', type: 'number' },
]
