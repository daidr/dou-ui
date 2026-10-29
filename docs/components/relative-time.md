# RelativeTime 相对时间

用“3 分钟前”“明天”这样的方式显示一个时刻，并随时间自动更新。

## 基础用法

`value` 接受 `Date`、毫秒时间戳或日期字符串。不到 45 秒显示“刚刚”，之后按分钟、小时、天、周、月、年取整数，向零取整：59 分钟前不会显示成“1 小时前”。

<DocDemo src="relative-time/basic" />

文字随时间更新，更新频率按需要来：一小时以内每分钟更新，再往后更新得更少。鼠标悬停时显示完整的日期和时间。

## 显示方式

<DocDemo src="relative-time/options" />

- `numeric` 默认为 `'auto'`，语言里有对应的词时用“昨天”“下周”；设为 `'always'` 一律显示数字。
- `short` 使用简短的单位名称，中文与完整写法基本相同，英文会写成 `3 hr. ago`。
- `absolute-after` 设置一个毫秒数，超过后改为显示日期。日期格式由 `format` 指定，默认取语言包的日期格式（中文为 `YYYY-MM-DD`）。

| 记号                 | 含义                       |
| -------------------- | -------------------------- |
| `YYYY` / `MM` / `DD` | 年、月、日                 |
| `HH` / `hh`          | 24 小时制、12 小时制的小时 |
| `mm` / `ss`          | 分、秒                     |
| `A`                  | 上午 / 下午                |
| `[文字]`             | 原样保留方括号里的文字     |

文字由浏览器的 `Intl.RelativeTimeFormat` 按语言包的 `name` 生成，“刚刚”取自语言包的 `relativeTime.justNow`。

## useNow

`useNow` 返回当前时间的毫秒时间戳，并定时更新，默认每秒一次。`interval` 可以是数值、ref 或 getter，每次更新后都会重新读取：

<DocDemo src="relative-time/use-now" />

```ts
import { useNow } from 'dou-ui'

const now = useNow({ interval: 60_000 })
```

计时只在浏览器里进行，在组件中使用时挂载后才开始；组件卸载或所在的作用域结束时自动停止。

## API

### RelativeTime Props

| 名称             | 说明                                 | 类型                       | 默认值         |
| ---------------- | ------------------------------------ | -------------------------- | -------------- |
| `value`          | 要显示的时刻                         | `Date \| number \| string` | —              |
| `now`            | 作为“现在”的时刻；传入后不再自动更新 | `Date \| number \| string` | 当前时间       |
| `numeric`        | 是否使用“昨天”这类词                 | `'auto' \| 'always'`       | `'auto'`       |
| `short`          | 使用简短的单位名称                   | `boolean`                  | `false`        |
| `absolute-after` | 距离超过这个毫秒数时显示日期         | `number`                   | —              |
| `format`         | 显示日期时的格式                     | `string`                   | 语言包日期格式 |

### useNow

| 参数               | 说明                 | 类型                       | 默认值 |
| ------------------ | -------------------- | -------------------------- | ------ |
| `options.interval` | 两次更新之间的毫秒数 | `MaybeRefOrGetter<number>` | `1000` |

返回 `Readonly<Ref<number>>`。

### 键盘与读屏

- 渲染为 `<time>` 元素，`datetime` 属性是 ISO 格式的完整时刻，`title` 是按语言包格式写出的日期和时间。
- 文字更新时不会打断读屏。
- 服务端渲染时以服务器的当前时间计算；需要两边完全一致时传入 `now`。
