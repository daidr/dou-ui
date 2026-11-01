# 大文件

编辑器只绘制可见的行，十万行以上的文件也可以直接打开和编辑。

## 基础用法

<DocDemo src="code/large" column />

文件很大时，建议使用 `v-model:doc` 代替 `v-model`。`v-model` 每次修改都要把全部文本拼成一个字符串，`v-model:doc` 则直接交回 `CodeText`。

```ts
import { CodeText } from '@dou-ui/code'
import { shallowRef } from 'vue'

const doc = shallowRef(CodeText.of(source))
// 需要字符串时再调用 doc.value.toString()
```

`CodeText` 是不可变的，每次修改得到一个新的 `CodeText`，未改动的部分与旧的共享，用 `shallowRef` 保存即可。

只需要最终结果时，也可以使用 `v-model.lazy`，在编辑器失去焦点时才更新字符串。

## 语法着色

编辑器先给可见的行着色，其余的行在浏览器空闲时继续处理。修改后从改动的行开始重新处理，通常只需要重新处理一两行。

直接跳到还没处理到的位置时，那里的代码先显示为普通文字，处理完成后再着色。

## 在 worker 中分析语法

加上 `worker` 后，语法分析在 Web Worker 中进行，页面只处理可见的几行。

```vue
<template>
  <DouCodeEditor v-model:doc="doc" :language="javascript" worker />
</template>
```

自带的 worker 支持所有内置语言，多个编辑器共用一个，最后一个编辑器卸载时结束。它以 `blob:` 地址启动，站点设置了内容安全策略（CSP）时，需要在 `worker-src` 中允许 `blob:`。

### 使用自己的 worker

使用自定义语言，或者不能允许 `blob:` 时，`worker` 传入一个创建 worker 的函数。在 worker 文件中调用 `serveCodeHighlighting`，列出要支持的语言：

```ts
// highlight.ts
import { javascript, serveCodeHighlighting } from '@dou-ui/code/worker'
import { myLanguage } from './my-language'

serveCodeHighlighting([javascript, myLanguage])
```

```vue
<script setup lang="ts">
const createWorker = () =>
  new Worker(new URL('./highlight.ts', import.meta.url), { type: 'module' })
</script>

<template>
  <DouCodeEditor v-model:doc="doc" :language="myLanguage" :worker="createWorker" />
</template>
```

- 函数在编辑器挂载后才调用，服务端渲染时不会创建 worker。
- 编辑器卸载或更换 `worker` 时会结束它创建的 worker，所以函数每次都要返回新的 worker。
- `@dou-ui/code/worker` 只包含语言和语法分析，不会引入 Vue。包含其他语言的语言要在 `nested` 中列出它们。
- worker 无法启动，或缺少编辑器使用的语言时，编辑器改为在页面中空闲时处理，开发环境下会在控制台提示原因。

## 小地图

`minimap` 在右侧显示整份代码的缩略图，并标出可见的部分。点击缩略图跳到对应位置，拖动标记滚动。编辑器窄于 480px 时不显示。
