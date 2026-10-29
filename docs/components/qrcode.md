# QRCode 二维码

把文本（通常是链接）生成二维码，不依赖第三方库。

<script setup>
import { ref } from 'vue'
const text = ref('https://ui.daidr.me')
const status = ref('expired')
function refresh() {
  status.value = 'loading'
  setTimeout(() => (status.value = 'active'), 1200)
}
const logo = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#1f1f22"/><text x="16" y="22" font-family="system-ui" font-size="16" font-weight="700" text-anchor="middle" fill="#fff">D</text></svg>')
</script>

## 基础用法

<div class="demo">
  <DouQrcode :value="text" />
  <DouInput v-model="text" style="max-width: 280px" placeholder="输入文字或链接" />
</div>

```vue
<DouQrcode value="https://ui.daidr.me" />
```

`size` 是边长（像素），`margin` 是四周留白的模块数（默认 2，外面还有一圈内边距）。文字太长装不下时会抛出错误。

## 纠错等级与图标

`level` 决定能容忍多少遮挡：`L` 约 7%、`M` 约 15%（默认）、`Q` 约 25%、`H` 约 30%。在相同尺寸还有余量时会自动提高等级。传 `icon` 在中间放一张图，此时自动使用 `H`。

<div class="demo">
  <DouQrcode value="https://ui.daidr.me" level="L" :size="120" />
  <DouQrcode value="https://ui.daidr.me" level="H" :size="120" />
  <DouQrcode value="https://ui.daidr.me" :icon="logo" :size="120" />
</div>

```vue
<DouQrcode value="https://ui.daidr.me" level="H" :size="120" />
<DouQrcode value="https://ui.daidr.me" icon="/logo.svg" :size="120" />
```

## 颜色

`color` 与 `bg-color` 换颜色。换色时请保持足够的明暗对比，深色在前、浅色在后，否则有的扫码器认不出来。

<div class="demo">
  <DouQrcode value="https://ui.daidr.me" color="#1d4ed8" bg-color="#eff6ff" :size="120" />
</div>

## 状态

登录码这类会过期的二维码，用 `status` 盖一层磨砂：`expired` 显示提示和刷新按钮（触发 `refresh`），`loading` 显示加载圈。`status` 插槽可以换成自己的内容。

<div class="demo">
  <DouQrcode value="https://ui.daidr.me/login?t=8f2c" :status="status" expired-text="登录码已过期" @refresh="refresh" />
</div>

```vue
<DouQrcode :value="loginUrl" :status="status" expired-text="登录码已过期" @refresh="refresh" />
```

## 只要数据

`encodeQr(text, level)` 返回 `{ version, level, size, modules }`，`modules[y][x]` 为 `true` 是深色模块，可以自己画到 Canvas 或别处。

```ts
import { encodeQr } from 'dou-ui'

const { size, modules } = encodeQr('https://ui.daidr.me', 'M')
```

## API

### Qrcode Props

| 名称          | 说明               | 类型                                 | 默认值       |
| ------------- | ------------------ | ------------------------------------ | ------------ |
| `value`       | 要编码的文字       | `string`                             | —            |
| `size`        | 边长（像素）       | `number`                             | `160`        |
| `level`       | 纠错等级           | `'L' \| 'M' \| 'Q' \| 'H'`           | `'M'`        |
| `margin`      | 四周留白（模块数） | `number`                             | `2`          |
| `color`       | 深色模块的颜色     | `string`                             | 近黑         |
| `bgColor`     | 底色               | `string`                             | 白色         |
| `icon`        | 中间的图片地址     | `string`                             | —            |
| `iconSize`    | 图片边长（像素）   | `number`                             | `size` / 5   |
| `status`      | 状态               | `'active' \| 'expired' \| 'loading'` | `'active'`   |
| `expiredText` | 过期时的提示       | `string`                             | 二维码已过期 |

### Qrcode Events

| 名称      | 说明               | 参数 |
| --------- | ------------------ | ---- |
| `refresh` | 点击过期状态的刷新 | —    |

### Qrcode Slots

| 名称     | 说明                                           |
| -------- | ---------------------------------------------- |
| `status` | 替换过期 / 加载时的遮罩内容，参数 `{ status }` |

### 读屏

二维码是一张 `role="img"` 的图，标签为"二维码：" 加上编码的文字。
