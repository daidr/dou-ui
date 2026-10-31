<script setup>
import { DouChart, defineChartSeries } from '@dou-ui/chart'

// 棒棒糖图：从 0 画一根细线到数值，顶端一个圆点
const DouChartLollipop = defineChartSeries({
  type: 'lollipop',
  zero: true,
  props: { radius: { type: Number, default: 5 } },
  draw(painter, series, view) {
    const { point } = view
    const r = series.props.radius
    painter.save()
    painter.strokeStyle = series.color
    painter.fillStyle = series.color
    painter.lineWidth = 2
    for (let i = 0; i < series.top.length; i++) {
      const value = series.top[i]
      if (Number.isNaN(value)) continue
      // point() 返回 [left, top]，横向图里也一样
      const [x0, y0] = point(series.x.values[i], 0)
      const [x1, y1] = point(series.x.values[i], value)
      painter.beginPath()
      painter.moveTo(x0, y0)
      painter.lineTo(x1, y1)
      painter.stroke()
      painter.beginPath()
      painter.arc(x1, y1, r, 0, Math.PI * 2)
      painter.fill()
    }
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
