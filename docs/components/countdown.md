# Countdown 倒计时

倒计时，用法与 [Statistic](./statistic) 相同，数值为剩余时间。

<script setup>
import { computed, ref } from 'vue'
import { useCountdown } from 'dou-ui'
const launch = ref(Date.now() + ((2 * 24 + 5) * 3600 + 42 * 60) * 1000)
const sale = ref(Date.now() + 90 * 1000)
const flash = ref(Date.now() + 30 * 1000)
const ended = ref(false)
const resendAt = ref(0)
const { remaining, done } = useCountdown(resendAt)
const seconds = computed(() => Math.ceil(remaining.value / 1000))
function send() {
  resendAt.value = Date.now() + 60 * 1000
}
function restart() {
  sale.value = Date.now() + 90 * 1000
  ended.value = false
}
</script>

## 基础用法

`value` 是结束的时刻（毫秒时间戳或 `Date`）。`format` 默认 `HH:mm:ss`。

<div class="demo" style="gap: 48px; align-items: flex-start">
  <DouCountdown title="距离发布" :value="launch" format="D 天 HH:mm:ss" />
  <DouCountdown title="限时优惠" :value="sale" format="mm:ss" @finish="ended = true">
    <template #footer>
      <DouLink v-if="ended" @click="restart">已结束，重新开始</DouLink>
      <span v-else>结束后自动下架</span>
    </template>
  </DouCountdown>
  <DouCountdown title="秒杀" :value="flash" format="ss.SS" suffix="秒" />
</div>

```vue
<DouCountdown title="距离发布" :value="launch" format="D 天 HH:mm:ss" />
<DouCountdown title="限时优惠" :value="sale" format="mm:ss" @finish="onFinish" />
<DouCountdown title="秒杀" :value="flash" format="ss.SS" suffix="秒" />
```

## 格式

| 记号         | 含义                   |
| ------------ | ---------------------- |
| `D` / `DD`   | 天                     |
| `H` / `HH`   | 时                     |
| `m` / `mm`   | 分                     |
| `s` / `ss`   | 秒                     |
| `S` 到 `SSS` | 十分之一秒到毫秒       |
| `[文字]`     | 原样保留方括号里的文字 |

记号重复一次表示补零。格式里最大的那个单位会吸收溢出：`mm:ss` 在剩 90 分钟时显示 `90:00`，不会丢掉小时。不显示毫秒时按整秒向上取整，所以 60 秒的倒计时从 `60` 开始、到 `0` 时正好结束。

## useCountdown

不需要统计数值的外观时，用组合式函数 `useCountdown` 自己渲染。最常见的就是"重新发送验证码"：

<div class="demo">
  <DouButton :disabled="!done" @click="send">
    {{ done ? '发送验证码' : `${seconds} 秒后重新发送` }}
  </DouButton>
</div>

```ts
import { useCountdown } from 'dou-ui'

const resendAt = ref(0)
const { remaining, done } = useCountdown(resendAt)
const seconds = computed(() => Math.ceil(remaining.value / 1000))

function send() {
  resendAt.value = Date.now() + 60 * 1000
}
```

`remaining` 是剩余毫秒数。默认每逢剩余时间的整秒更新一次，显示秒数时不会跳号；需要更细时传 `{ interval: 50 }`。`onFinish` 在归零时调用。

## API

### Countdown Props

| 名称     | 说明     | 类型             | 默认值       |
| -------- | -------- | ---------------- | ------------ |
| `value`  | 结束时刻 | `number \| Date` | —            |
| `format` | 显示格式 | `string`         | `'HH:mm:ss'` |
| `title`  | 标签     | `string`         | —            |
| `prefix` | 前缀     | `string`         | —            |
| `suffix` | 后缀     | `string`         | —            |

### Countdown Events

| 名称     | 说明                 | 参数                  |
| -------- | -------------------- | --------------------- |
| `finish` | 归零                 | —                     |
| `change` | 剩余时间变化（毫秒） | `(remaining: number)` |

### Countdown Slots

与 [Statistic](./statistic#statistic-slots) 相同：`title`、`prefix`、`suffix`、`footer`。

### 键盘与读屏

- 根元素是 `role="timer"`，读屏不会每秒播报一次；需要在结束时提示，可以在 `finish` 里用 [Toast](./toast)。
- 服务端渲染时先显示零，挂载后才开始计时，避免两边时间不同造成的水合不一致。
