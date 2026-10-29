# Upload 上传

点击或拖入文件上传。DouUI 不包含网络请求代码，上传方式由你提供的 `request` 函数决定。

默认是一个描边按钮。文件列表每行显示缩略图、文件名和大小，上传时下方显示进度条，只有失败的文件会使用语气色。

<script setup>
import { ref } from 'vue'

// A fake request that reports progress and fails for names containing "fail".
function fakeRequest({ raw, onProgress, signal }) {
  return new Promise((resolve, reject) => {
    let percent = 0
    const timer = setInterval(() => {
      percent += 8 + Math.random() * 14
      if (percent >= 100) {
        clearInterval(timer)
        if (raw.name.includes('fail')) reject(new Error('服务器拒绝了这个文件'))
        else resolve({ ok: true })
      } else onProgress(percent)
    }, 200)
    signal.addEventListener('abort', () => clearInterval(timer))
  })
}

const files = ref([
  { uid: 'a', name: '项目说明.pdf', size: 1843200, status: 'success', url: '#' },
  { uid: 'b', name: 'avatar-fail.png', size: 238400, status: 'error' },
])
const images = ref([])
const tile = (hue) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 30% 72%)"/><stop offset="1" stop-color="hsl(${hue + 40} 28% 38%)"/></linearGradient></defs><rect width="480" height="480" fill="url(#g)"/><circle cx="340" cy="140" r="56" fill="hsl(${hue} 40% 88%)" opacity=".7"/><path d="M0 400 L130 250 L240 360 L330 280 L480 420 V480 H0Z" fill="hsl(${hue + 20} 25% 28%)" opacity=".8"/></svg>`,
  )}`
const photos = ref([
  { uid: 'p1', name: '外滩.svg', size: 182400, type: 'image/svg+xml', status: 'success', url: tile(210) },
  { uid: 'p2', name: '武康路.svg', size: 204800, type: 'image/svg+xml', status: 'success', url: tile(25) },
  { uid: 'p3', name: '会议纪要.pdf', size: 92160, type: 'application/pdf', status: 'success' },
  { uid: 'p4', name: '陆家嘴.svg', size: 160000, type: 'image/svg+xml', status: 'uploading', percent: 46, url: tile(160) },
])
const manual = ref([])
const upload = ref()
</script>

## 基础用法

用 `v-model` 绑定文件列表，传入 `request` 后选中的文件立即发送。

<div class="demo demo--column">
  <DouUpload v-model="files" :request="fakeRequest" multiple hint="单个文件不超过 10 MB" :max-size="10 * 1024 * 1024" />
</div>

```vue
<script setup lang="ts">
import type { UploadRequest } from 'dou-ui'

const files = ref<UploadFile[]>([])

const request: UploadRequest = async ({ raw, onProgress, signal }) => {
  const body = new FormData()
  body.append('file', raw)
  const response = await fetch('/api/upload', { method: 'POST', body, signal })
  if (!response.ok) throw new Error(response.statusText)
  return response.json()
}
</script>

<template>
  <DouUpload v-model="files" :request="request" multiple hint="单个文件不超过 10 MB" />
</template>
```

`request` 收到 `{ file, raw, onProgress, signal }`：用 `onProgress(0–100)` 报告进度，`signal` 会在文件被移除或调用 `abort()` 时中止。它 resolve 的值存进文件的 `response`，reject 的值存进 `error`，失败的文件可以点重试按钮重新发送。

`fetch` 不会报告上传进度，进度条会停在 0 直到完成；用 `XMLHttpRequest` 的 `upload.onprogress` 可以拿到真实进度。

## 照片墙

`list-type="picture-card"` 把文件排成一排方块，选择按钮是最后一块。悬停在图片上会出现预览和删除按钮，预览用 [Image](./image) 的大图查看，可以在所有图片之间切换；发送中的文件盖一层进度，失败的文件描边带上危险色。到了 `max-count` 时选择块自动隐藏。

<div class="demo demo--column">
  <DouUpload v-model="photos" list-type="picture-card" accept="image/*" multiple :max-count="8" :request="fakeRequest" />
</div>

```vue
<DouUpload
  v-model="files"
  list-type="picture-card"
  accept="image/*"
  multiple
  :max-count="8"
  :request="request"
/>
```

`preview` 事件在打开预览时触发；设 `:preview="false"` 就只发事件，不打开内置预览，方便换成自己的查看方式。

## 拖拽上传

`dropzone` 换成一块可以拖入文件的区域，点击或按 `Enter` / `Space` 同样打开文件选择。拖着文件经过时，虚线变为实线，并显示浅色背景。

<div class="demo demo--column">
  <DouUpload v-model="images" :request="fakeRequest" dropzone multiple accept="image/*" hint="支持 PNG、JPG、WebP" />
</div>

```vue
<DouUpload
  v-model="files"
  :request="request"
  dropzone
  multiple
  accept="image/*"
  hint="支持 PNG、JPG、WebP"
/>
```

图片会生成本地预览作为缩略图，文件移除或组件卸载时释放。

## 手动发送

`auto-upload` 为 `false` 时文件先停在列表里，调用 `submit()` 才发送所有未发送和失败的文件。没有传 `request` 时文件也一直停在列表里，适合放进表单和其他字段一起提交。

<div class="demo demo--column">
  <DouUpload ref="upload" v-model="manual" :request="fakeRequest" :auto-upload="false" multiple />
  <DouButton size="sm" variant="solid" :disabled="!manual.length" style="align-self: flex-start" @click="upload.submit()">开始上传</DouButton>
</div>

## 限制

- `accept`：原生的 `accept`，拖入的文件也会按它检查。
- `max-size`：单个文件的最大字节数。
- `max-count`：列表最多容纳的文件数，超出的部分触发 `exceed`，列表满了按钮会禁用。
- `before-upload`：加入列表前调用，返回 `false` 跳过这个文件，返回一个 `File` 则用它代替，比如压缩后的图片。

被 `accept` 或 `max-size` 拒绝的文件不会进入列表，而是触发 `reject(file, reason)`，`reason` 为 `'type'` 或 `'size'`，提示文案由你决定，比如配合 [Toast](./toast)。

不加 `multiple` 时一次只能有一个文件，新选的文件替换旧的。

## 自定义

默认插槽替换按钮，点击里面的任何地方都会打开文件选择；`file` 插槽替换列表的一行，参数为 `{ file, remove, retry }`；`show-list` 为 `false` 时不显示列表，可以自己用 `v-model` 的数据渲染。

```vue
<DouUpload v-model="avatar" :request="request" accept="image/*" :show-list="false">
  <DouAvatar :src="avatar[0]?.url" size="lg" />
</DouUpload>
```

## 在表单中

放在 `DouFormItem` 里时，标签指向按钮或拖拽区域，校验信息通过 `aria-describedby` 关联，文件变化时触发 `change` 校验。`required` 规则会把空数组视为未填写。

## 键盘与读屏

按钮和拖拽区域都可以用 `Tab` 聚焦、用 `Enter` / `Space` 打开文件选择；原生的 `<input type="file">` 隐藏且不在 `Tab` 顺序里。`hint` 通过 `aria-describedby` 关联到触发器。列表的移除和重试按钮带上文件名作为标签（"移除 项目说明.pdf"），上传状态的文字在 `aria-live` 区域里，进度条带 `role="progressbar"`。

## API

### Props

| 名称           | 说明                           | 类型                                                    | 默认值   |
| -------------- | ------------------------------ | ------------------------------------------------------- | -------- |
| `modelValue`   | 文件列表，配合 `v-model`       | `UploadFile[]`                                          | `[]`     |
| `request`      | 发送一个文件                   | `(options: UploadRequestOptions) => Promise<unknown>`   | —        |
| `autoUpload`   | 选中后立即发送                 | `boolean`                                               | `true`   |
| `accept`       | 允许的类型，如 `image/*,.pdf`  | `string`                                                | —        |
| `multiple`     | 允许多个文件                   | `boolean`                                               | `false`  |
| `maxSize`      | 单个文件最大字节数             | `number`                                                | —        |
| `maxCount`     | 最多文件数                     | `number`                                                | —        |
| `beforeUpload` | 加入列表前调用                 | `(file: File) => boolean \| File \| void \| Promise<…>` | —        |
| `dropzone`     | 使用拖拽区域代替按钮           | `boolean`                                               | `false`  |
| `hint`         | 触发器下方的说明               | `string`                                                | —        |
| `showList`     | 显示文件列表                   | `boolean`                                               | `true`   |
| `listType`     | 列表样式：文件行，或照片墙方块 | `'text' \| 'picture-card'`                              | `'text'` |
| `preview`      | 照片墙里点预览时打开大图       | `boolean`                                               | `true`   |
| `disabled`     | 禁用                           | `boolean`                                               | `false`  |
| `size`         | 尺寸，默认取表单或全局配置     | `'sm' \| 'md' \| 'lg'`                                  | `'md'`   |

### UploadFile

| 名称       | 说明                                 | 类型                                             |
| ---------- | ------------------------------------ | ------------------------------------------------ |
| `uid`      | 列表内唯一                           | `string`                                         |
| `name`     | 文件名                               | `string`                                         |
| `size`     | 字节数                               | `number`                                         |
| `type`     | MIME 类型                            | `string`                                         |
| `status`   | 状态                                 | `'ready' \| 'uploading' \| 'success' \| 'error'` |
| `percent`  | 进度，0–100                          | `number`                                         |
| `raw`      | 选中的文件，服务器上已有的文件没有它 | `File`                                           |
| `url`      | 图片的本地预览，或服务器给的链接     | `string`                                         |
| `response` | `request` resolve 的值               | `unknown`                                        |
| `error`    | `request` reject 的值                | `unknown`                                        |

### Events

| 名称                | 说明                              | 参数                                     |
| ------------------- | --------------------------------- | ---------------------------------------- |
| `update:modelValue` | 列表变化                          | `(files: UploadFile[])`                  |
| `change`            | 文件加入、移除或状态变化          | `(files: UploadFile[])`                  |
| `reject`            | 文件被 `accept` 或 `maxSize` 拒绝 | `(file: File, reason: 'type' \| 'size')` |
| `exceed`            | 超出 `maxCount` 的文件            | `(files: File[])`                        |
| `success`           | 发送成功                          | `(file: UploadFile, response: unknown)`  |
| `error`             | 发送失败                          | `(file: UploadFile, error: unknown)`     |
| `remove`            | 用户移除了文件                    | `(file: UploadFile)`                     |
| `preview`           | 照片墙里点了预览                  | `(file: UploadFile)`                     |

### Slots

| 名称      | 说明                                             |
| --------- | ------------------------------------------------ |
| `default` | 替换按钮，点击时打开文件选择                     |
| `hint`    | 替换 `hint`                                      |
| `file`    | 替换列表的一行，参数为 `{ file, remove, retry }` |

### Exposes

| 名称     | 说明                         | 类型                     |
| -------- | ---------------------------- | ------------------------ |
| `open`   | 打开文件选择                 | `() => void`             |
| `submit` | 发送所有未发送和失败的文件   | `() => void`             |
| `abort`  | 中止一个文件，不传则中止全部 | `(uid?: string) => void` |
| `retry`  | 重新发送失败的文件           | `(uid: string) => void`  |
| `remove` | 移除文件，正在发送的会被中止 | `(uid: string) => void`  |
