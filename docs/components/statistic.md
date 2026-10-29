# Statistic 统计数值

展示统计数值，适合仪表盘、数据概览等场景。

<script setup>
import { ref } from 'vue'
const loading = ref(true)
setTimeout(() => (loading.value = false), 2000)
const duration = (seconds) => `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`
</script>

## 基础用法

<div class="demo" style="gap: 48px">
  <DouStatistic title="活跃用户" :value="38214" />
  <DouStatistic title="本月收入" :value="1284530.5" :precision="2" prefix="¥" />
  <DouStatistic title="存储用量" :value="72.4" suffix="GB" />
</div>

```vue
<DouStatistic title="活跃用户" :value="38214" />
<DouStatistic title="本月收入" :value="1284530.5" :precision="2" prefix="¥" />
<DouStatistic title="存储用量" :value="72.4" suffix="GB" />
```

数字按三位分组（`group-separator`，传 `''` 关闭），`precision` 固定小数位数并四舍五入。`value` 为 `null` 时显示"—"，传字符串则原样显示。

## 趋势

`trend` 在数字前加一个箭头。默认"上升是好事"，上升为成功色、下降为危险色；对耗时、错误数这类越少越好的指标，设置 `:up-is-good="false"` 把颜色反过来。`footer` 插槽放在数字下方，适合写对比。

<div class="demo" style="gap: 48px">
  <DouStatistic title="本月收入" :value="1284530.5" :precision="2" prefix="¥" trend="up">
    <template #footer>比上月 +12.4%</template>
  </DouStatistic>
  <DouStatistic title="平均响应" :value="182" suffix="ms" trend="up" :up-is-good="false">
    <template #footer>比上周 +18ms</template>
  </DouStatistic>
  <DouStatistic title="错误数" :value="3" trend="down" :up-is-good="false">
    <template #footer>比昨天 −9</template>
  </DouStatistic>
</div>

```vue
<DouStatistic title="平均响应" :value="182" suffix="ms" trend="up" :up-is-good="false">
  <template #footer>比上周 +18ms</template>
</DouStatistic>
```

## 自定义格式与加载

`formatter` 把数字整个换成别的文字；`loading` 时用一条占位块代替数字，高度不变，数据回来时页面不跳。

<div class="demo" style="gap: 48px">
  <DouStatistic title="平均时长" :value="347" :formatter="duration" />
  <DouStatistic title="转化率" :value="4.62" suffix="%" :loading="loading" />
</div>

```vue
<DouStatistic
  title="平均时长"
  :value="347"
  :formatter="(s) => `${Math.floor(s / 60)} 分 ${s % 60} 秒`"
/>
<DouStatistic title="转化率" :value="4.62" suffix="%" :loading="loading" />
```

## 大小

数字的字号来自 CSS 变量 `--dou-statistic-value-size`（默认 28px），前后缀和小数按比例缩小：

```vue
<DouStatistic style="--dou-statistic-value-size: 40px" title="今日订单" :value="1024" />
```

## API

### Statistic Props

| 名称               | 说明                         | 类型                        | 默认值  |
| ------------------ | ---------------------------- | --------------------------- | ------- |
| `title`            | 标签                         | `string`                    | —       |
| `value`            | 数值；字符串原样显示         | `number \| string \| null`  | —       |
| `precision`        | 小数位数                     | `number`                    | —       |
| `groupSeparator`   | 千分位分隔符                 | `string`                    | `','`   |
| `decimalSeparator` | 小数点                       | `string`                    | `'.'`   |
| `prefix`           | 前缀                         | `string`                    | —       |
| `suffix`           | 后缀                         | `string`                    | —       |
| `trend`            | 趋势箭头                     | `'up' \| 'down'`            | —       |
| `upIsGood`         | 上升是否是好事，决定箭头颜色 | `boolean`                   | `true`  |
| `formatter`        | 自定义格式                   | `(value: number) => string` | —       |
| `loading`          | 显示占位块                   | `boolean`                   | `false` |

### Statistic Slots

| 名称     | 说明         |
| -------- | ------------ |
| `title`  | 替换标签     |
| `prefix` | 替换前缀     |
| `suffix` | 替换后缀     |
| `footer` | 数字下方内容 |
