import type { DashboardFilters, DashboardSources } from '@dou-ui/dashboard'
import { ref } from 'vue'

interface Row {
  date: string
  region: string
  city: string
  cityName: string
  amount: number
  orders: number
}

// 演示用的订单数据：最近 30 天，各城市每天的销售额
// 城市用代码表示，显示时换成名字
const regions: Record<string, [code: string, name: string][]> = {
  华东: [
    ['sh', '上海'],
    ['hz', '杭州'],
    ['nj', '南京'],
  ],
  华北: [
    ['bj', '北京'],
    ['tj', '天津'],
  ],
  华南: [
    ['gz', '广州'],
    ['sz', '深圳'],
  ],
  西南: [
    ['cd', '成都'],
    ['cq', '重庆'],
  ],
}
export const regionNames = Object.keys(regions)
/** 城市代码对应的名字 */
export const cityNames: Record<string, string> = Object.fromEntries(
  Object.values(regions).flatMap((cities) => cities),
)

const days = Array.from({ length: 30 }, (_, i) => {
  const date = new Date(2026, 9, 2 + i)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `2026-${mm}-${dd}`
})

let seed = 7
const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
const rows: Row[] = []
for (const [region, cities] of Object.entries(regions))
  for (const [index, [city, cityName]] of cities.entries())
    for (const [day, date] of days.entries())
      rows.push({
        date,
        region,
        city,
        cityName,
        amount: Math.round((3 - index * 0.6) * (800 + day * 20 + random() * 600)),
        orders: Math.round(6 + random() * 10),
      })

/** 已经发出的请求次数，用来看出同一个数据源只请求一次 */
export const loads = ref(0)

// 模拟网络请求：等一会儿再返回，被取消时立即停止
function request<T>(filters: DashboardFilters, signal: AbortSignal, pick: (list: Row[]) => T) {
  loads.value++
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => {
        const [from, to] = (filters.date as string[] | undefined) ?? []
        const keyword = (filters.keyword as string | undefined) ?? ''
        const list = rows.filter(
          (row) =>
            (!filters.region || row.region === filters.region) &&
            (!filters.city || row.city === filters.city) &&
            (!from || row.date >= from) &&
            (!to || row.date <= to) &&
            row.cityName.includes(keyword),
        )
        resolve(pick(list))
      },
      400 + Math.random() * 400,
    )
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('aborted', 'AbortError'))
    })
  })
}

// 每一行带上筛选用的值 code 和显示用的名字 name
function groupBy(list: Row[], key: 'region' | 'city') {
  const totals = new Map<string, { code: string; name: string; value: number }>()
  for (const row of list) {
    const code = row[key]
    const total = totals.get(code) ?? { code, name: key === 'city' ? row.cityName : code, value: 0 }
    total.value += row.amount
    totals.set(code, total)
  }
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
  return [...totals.values()].sort((a, b) => b.value - a.value)
}

const sumOf = (part: number[]) => part.reduce((total, value) => total + value, 0)

export const sources: DashboardSources = {
  summary: ({ filters, signal }) =>
    request(filters, signal, (list) => ({
      amount: list.reduce((sum, row) => sum + row.amount, 0),
      orders: list.reduce((sum, row) => sum + row.orders, 0),
    })),
  trend: ({ filters, signal }) =>
    request(filters, signal, (list) => {
      const totals = new Map<string, number>()
      for (const row of list) totals.set(row.date, (totals.get(row.date) ?? 0) + row.amount)
      return [...totals.values()]
    }),
  // 合计、每日走势和后半月比前半月的变化
  overview: ({ filters, signal }) =>
    request(filters, signal, (list) => {
      const daily = new Map<string, number>()
      for (const row of list) daily.set(row.date, (daily.get(row.date) ?? 0) + row.amount)
      const trend = [...daily.values()]
      const half = Math.floor(trend.length / 2)
      const before = sumOf(trend.slice(0, half))
      return {
        amount: sumOf(trend),
        orders: list.reduce((total, row) => total + row.orders, 0),
        trend,
        delta: before ? sumOf(trend.slice(half)) / before - 1 : 0,
      }
    }),
  // 每个城市每天一行的明细
  orders: ({ filters, signal }) =>
    request(filters, signal, (list) =>
      list.map((row) => ({
        date: row.date,
        region: row.region,
        city: row.city,
        cityName: row.cityName,
        amount: row.amount,
        orders: row.orders,
      })),
    ),
  region: ({ filters, signal }) => request(filters, signal, (list) => groupBy(list, 'region')),
  city: ({ filters, signal }) =>
    request(filters, signal, (list) => groupBy(list, 'city').slice(0, 5)),
}
