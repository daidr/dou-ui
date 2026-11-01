import type { DashboardFilters, DashboardSources } from '@dou-ui/dashboard'

// 示例数据：一家网店 10 月每天的订单（固定种子，每次打开都一样）
interface Row {
  date: string
  channel: string
  region: string
  category: string
  product: string
  amount: number
  orders: number
  visitors: number
}

export const channels = ['App', '小程序', '网页']
export const regions = ['华东', '华北', '华南', '西南']
const products: Record<string, string[]> = {
  数码: ['降噪耳机', '机械键盘', '移动电源'],
  服饰: ['羊毛围巾', '防风外套', '运动袜'],
  食品: ['挂耳咖啡', '坚果礼盒', '燕麦片'],
  家居: ['香薰蜡烛', '收纳箱', '台灯'],
}
export const categories = Object.keys(products)

let seed = 19
const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647

const days = Array.from({ length: 31 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`)
const rows: Row[] = []
for (const [day, date] of days.entries()) {
  // 周末和月底促销时订单更多
  const weekday = new Date(2026, 9, day + 1).getDay()
  const boost = (weekday === 0 || weekday === 6 ? 1.25 : 1) * (day >= 27 ? 1.6 : 1)
  for (const [c, channel] of channels.entries())
    for (const [r, region] of regions.entries())
      for (const [category, names] of Object.entries(products))
        for (const product of names) {
          const orders = Math.round((2 + random() * 6) * boost * (1.4 - c * 0.3) * (1.3 - r * 0.15))
          const price = { 数码: 260, 服饰: 150, 食品: 60, 家居: 90 }[category]!
          rows.push({
            date,
            channel,
            region,
            category,
            product,
            orders,
            amount: Math.round(orders * price * (0.8 + random() * 0.4)),
            visitors: Math.round(orders * (9 + random() * 6)),
          })
        }
}

const sumOf = (list: Row[], key: 'amount' | 'orders' | 'visitors') =>
  list.reduce((total, row) => total + row[key], 0)

function pick(filters: DashboardFilters) {
  const [from, to] = (filters.date as string[] | undefined) ?? []
  return rows.filter(
    (row) =>
      (!filters.channel || row.channel === filters.channel) &&
      (!filters.region || row.region === filters.region) &&
      (!filters.category || row.category === filters.category) &&
      (!from || row.date >= from) &&
      (!to || row.date <= to),
  )
}

/** 按某个字段分组求和，保持 `order` 的顺序 */
function group(list: Row[], key: 'date' | 'channel' | 'category' | 'product', order?: string[]) {
  const map = new Map<string, { amount: number; orders: number }>()
  for (const name of order ?? []) map.set(name, { amount: 0, orders: 0 })
  for (const row of list) {
    const entry = map.get(row[key]) ?? { amount: 0, orders: 0 }
    entry.amount += row.amount
    entry.orders += row.orders
    map.set(row[key], entry)
  }
  return [...map].map(([name, value]) => ({ name, ...value }))
}

// 模拟网络请求：稍等一会儿再返回
const later = <T>(signal: AbortSignal, make: () => T) =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => resolve(make()), 240 + Math.random() * 240)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(signal.reason)
    })
  })

export const sources: DashboardSources = {
  overview: ({ filters, signal }) =>
    later(signal, () => {
      const list = pick(filters)
      const daily = group(list, 'date')
      const half = (from: number, to: number) =>
        daily.slice(from, to).reduce((total, day) => total + day.amount, 0)
      // 最近 7 天和之前 7 天相比
      const recent = half(-7, daily.length)
      const before = half(-14, -7)
      const amount = sumOf(list, 'amount')
      const orders = sumOf(list, 'orders')
      const visitors = sumOf(list, 'visitors')
      return {
        amount,
        orders,
        visitors,
        average: orders ? amount / orders : 0,
        conversion: visitors ? (orders / visitors) * 100 : 0,
        trend: daily.map((day) => day.amount),
        orderTrend: daily.map((day) => day.orders),
        delta: before ? recent / before - 1 : 0,
      }
    }),
  daily: ({ filters, signal }) =>
    later(signal, () =>
      group(pick(filters), 'date').map(({ name, amount, orders }) => ({
        date: name.slice(5),
        amount,
        orders,
      })),
    ),
  channel: ({ filters, signal }) => later(signal, () => group(pick(filters), 'channel', channels)),
  category: ({ filters, signal }) =>
    later(signal, () => group(pick(filters), 'category', categories)),
  records: ({ filters, signal }) => later(signal, () => pick(filters)),
  top: ({ filters, signal }) =>
    later(signal, () =>
      group(pick(filters), 'product')
        // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 8)
        .map((item, index) => ({
          rank: index + 1,
          name: item.name,
          amount: item.amount,
          orders: item.orders,
        })),
    ),
}
