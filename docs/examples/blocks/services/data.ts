import type { DashboardSources } from '@dou-ui/dashboard'

// 示例数据：每 5 秒一个采样点，数值由服务和时间算出，刷新时会往前走
export const services = [
  { id: 'gateway', name: '网关', base: 38, errors: 0.2, rps: 2400 },
  { id: 'user', name: '用户', base: 52, errors: 0.3, rps: 820 },
  { id: 'order', name: '订单', base: 86, errors: 0.6, rps: 460 },
  { id: 'pay', name: '支付', base: 120, errors: 0.4, rps: 210 },
  // 搜索这段时间偏慢
  { id: 'search', name: '搜索', base: 240, errors: 1.1, rps: 640 },
  { id: 'recommend', name: '推荐', base: 150, errors: 2.6, rps: 380 },
]
export const serviceNames: Record<string, string> = Object.fromEntries(
  services.map((service) => [service.id, service.name]),
)

const STEP = 5000
const POINTS = 36

/** 0–1 之间的伪随机数，同样的参数总是同样的结果 */
function noise(a: number, b: number) {
  let x = (a * 374761393 + b * 668265263) | 0
  x = Math.imul(x ^ (x >>> 13), 1274126177)
  return ((x ^ (x >>> 16)) >>> 0) / 4294967295
}

function sample(index: number, tick: number) {
  const service = services[index]!
  const wave = Math.sin(tick / 6 + index) * 0.15
  const latency = service.base * (1 + wave + noise(index, tick) * 0.35)
  return {
    p50: Math.round(latency),
    p95: Math.round(latency * (1.8 + noise(index + 50, tick) * 0.6)),
    errorRate: Math.max(0, service.errors * (0.6 + noise(index + 100, tick) * 0.9)),
    rps: Math.round(service.rps * (1 + wave + (noise(index + 150, tick) - 0.5) * 0.2)),
  }
}

/** 选中的服务；没有选中时是全部 */
const pickIndexes = (service: unknown) =>
  services.flatMap((item, index) => (!service || item.id === service ? [index] : []))

function statusOf(p95: number, errorRate: number) {
  if (errorRate >= 2) return 'danger'
  if (p95 >= 400) return 'warning'
  return 'success'
}

const now = () => Math.floor(Date.now() / STEP)

/** 按请求量加权合并几个服务在同一时刻的数值 */
function merge(indexes: number[], tick: number) {
  let rps = 0
  let p95 = 0
  let errors = 0
  for (const index of indexes) {
    const point = sample(index, tick)
    rps += point.rps
    p95 += point.p95 * point.rps
    errors += point.errorRate * point.rps
  }
  return { rps, p95: rps ? p95 / rps : 0, errorRate: rps ? errors / rps : 0 }
}

const clock = (tick: number) => new Date(tick * STEP).toLocaleTimeString('zh-CN', { hour12: false })

const endpoints = ['GET /list', 'GET /detail', 'POST /create', 'PUT /update', 'GET /search']

export const sources: DashboardSources = {
  services: {
    filters: [],
    interval: STEP,
    load: () => {
      const tick = now()
      return services.map((service, index) => {
        const point = sample(index, tick)
        return {
          id: service.id,
          name: service.name,
          ...point,
          status: statusOf(point.p95, point.errorRate),
        }
      })
    },
  },
  summary: {
    filters: ['service'],
    interval: STEP,
    load: ({ filters }) => {
      const indexes = pickIndexes(filters.service)
      const tick = now()
      const history = Array.from({ length: POINTS }, (_, i) =>
        merge(indexes, tick - POINTS + 1 + i),
      )
      const last = history[history.length - 1]!
      const first = history[0]!
      return {
        rps: last.rps,
        p95: Math.round(last.p95),
        errorRate: last.errorRate,
        // 一个采样点里错误率低于 2% 算作可用
        availability: (history.filter((point) => point.errorRate < 2).length / POINTS) * 100,
        rpsTrend: history.map((point) => point.rps),
        p95Trend: history.map((point) => Math.round(point.p95)),
        errorTrend: history.map((point) => point.errorRate),
        rpsDelta: first.rps ? last.rps / first.rps - 1 : 0,
      }
    },
  },
  latency: {
    filters: ['service'],
    interval: STEP,
    load: ({ filters }) => {
      const indexes = pickIndexes(filters.service)
      const tick = now()
      return Array.from({ length: POINTS }, (_, i) => {
        const at = tick - POINTS + 1 + i
        let p50 = 0
        let rps = 0
        for (const index of indexes) {
          const point = sample(index, at)
          p50 += point.p50 * point.rps
          rps += point.rps
        }
        return {
          time: clock(at),
          p50: Math.round(p50 / rps),
          p95: Math.round(merge(indexes, at).p95),
        }
      })
    },
  },
  errors: {
    filters: ['service'],
    interval: STEP * 2,
    load: ({ filters }) => {
      const indexes = pickIndexes(filters.service)
      const tick = now()
      return endpoints.map((name, e) => ({
        name,
        count: indexes.reduce(
          (total, index) =>
            total +
            Math.round(sample(index, tick).errorRate * (6 - e) * (1 + noise(index * 7 + e, tick))),
          0,
        ),
      }))
    },
  },
  incidents: {
    filters: ['service'],
    load: ({ filters }) =>
      [
        {
          time: '10-31 14:20',
          service: 'recommend',
          title: '错误率超过 2%',
          state: '处理中',
        },
        {
          time: '10-31 13:05',
          service: 'search',
          title: 'P95 延迟超过 400 ms',
          state: '观察中',
        },
        {
          time: '10-31 09:40',
          service: 'pay',
          title: '上海机房网络抖动',
          state: '已恢复',
        },
        {
          time: '10-30 22:12',
          service: 'order',
          title: '数据库连接数告警',
          state: '已恢复',
        },
        {
          time: '10-30 18:30',
          service: 'gateway',
          title: '证书即将到期',
          state: '已恢复',
        },
      ]
        .filter((item) => !filters.service || item.service === filters.service)
        .map((item) => ({ ...item, service: serviceNames[item.service] })),
  },
}
