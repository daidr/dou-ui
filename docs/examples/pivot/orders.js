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
