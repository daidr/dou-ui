<script setup>
import { DouChart, defineChartSeries } from '@dou-ui/chart'

// 棒棒糖图：从 0 画一根细线到数值，顶端一个圆点
const DouChartLollipop = defineChartSeries({
  name: 'lollipop',
  zero: true,
  props: { radius: { type: Number, default: 5 } },
  draw(painter, series, view) {
    const { x, y, horizontal } = view
    const zero = y.map(0)
    const r = series.props.radius
    painter.save()
    painter.strokeStyle = series.color
    painter.fillStyle = series.color
    painter.lineWidth = 2
    painter.beginPath()
    for (let i = 0; i < series.top.length; i++) {
      const value = series.top[i]
      if (Number.isNaN(value)) continue
      const u = x.map(series.x.values[i])
      const v = y.map(value)
      const [x0, y0, x1, y1] = horizontal ? [zero, u, v, u] : [u, zero, u, v]
      painter.moveTo(x0, y0)
      painter.lineTo(x1, y1)
    }
    painter.stroke()
    painter.beginPath()
    for (let i = 0; i < series.top.length; i++) {
      const value = series.top[i]
      if (Number.isNaN(value)) continue
      const u = x.map(series.x.values[i])
      const v = y.map(value)
      const [cx, cy] = horizontal ? [v, u] : [u, v]
      painter.moveTo(cx + r, cy)
      painter.arc(cx, cy, r, 0, Math.PI * 2)
    }
    painter.fill()
    painter.restore()
  },
})

// 各部门本月的加班时长（小时）
const rows = [
  { team: '研发', hours: 46 },
  { team: '设计', hours: 28 },
  { team: '产品', hours: 34 },
  { team: '运营', hours: 19 },
  { team: '客服', hours: 24 },
  { team: '财务', hours: 12 },
]
</script>

<template>
  <DouChart :data="rows" x="team" :height="280">
    <DouChartLollipop y="hours" name="加班时长" />
  </DouChart>
</template>
