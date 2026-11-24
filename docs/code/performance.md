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

编辑器默认在绘制阶段同步分析当前位置前最多 2000 行（`syncHighlightLines`），更远的位置先显示为普通文字，再在 Worker 或浏览器空闲时间片中继续处理。修改后从改动的行开始重新处理，通常只需要重新处理一两行。

在多文件 Diff 列表快速滚动、或使用重型语法（如 Shiki）的场景中，可以将 `syncHighlightLines` 设为 `0`：首屏先绘制纯文本，词法高亮统一交给 Worker 或浏览器空闲时间片异步完成，避免渲染帧被同步分词阻塞。

```vue
<template>
  <DouCodeEditor v-model:doc="doc" :language="javascript" worker :sync-highlight-lines="0" />
</template>
```

当组件滚出浏览器视口或卸载时，未执行的 Worker 与空闲时间片高亮任务会自动中止；滚回视口时再恢复高亮。

## 在 worker 中分析语法

加上 `worker` 后，语法分析在 Web Worker 中进行，`DouCodeDiff` 也会把 `worker` 与 `syncHighlightLines` 透传给内部编辑器，并在文本合计行数超过 `syncDiffLines`（默认 `500`）时将 `diffText` 移入 Worker 异步计算。

<DocDemo src="code/diff-worker" column />

```vue
<template>
  <DouCodeEditor v-model:doc="doc" :language="javascript" worker />
  <DouCodeDiff
    v-model="modified"
    :original="original"
    :language="javascript"
    worker
    :sync-highlight-lines="0"
  />
</template>
```

自带的 `worker` 使用按需懒启动的 Worker 池，支持所有内置语言与异步 Diff 计算，会在真正需要高亮或计算差异时按并发量动态创建（默认上限 2–4 个）并在空闲后自动回收。它以 `blob:` 地址启动，站点设置了内容安全策略（CSP）时，需要在 `worker-src` 中允许 `blob:`。

### 使用 Worker 池与自定义 worker

使用自定义语言、Shiki 离主线程高亮，或者不能允许 `blob:` 时，推荐使用 `createCodeWorkerPool` 创建按需懒启动的 Worker 池，供多个 `DouCodeEditor` / `DouCodeDiff` 共享，并在列表滚动期间保持热 Worker 复用：

```ts
// highlight.worker.ts
import { javascript, serveCodeHighlighting } from '@dou-ui/code/worker'
import { myLanguage } from './my-language'

serveCodeHighlighting([javascript, myLanguage])
```

```vue
<script setup lang="ts">
import { createCodeWorkerPool, DouCodeEditor } from '@dou-ui/code'
import { onBeforeUnmount } from 'vue'

const pool = createCodeWorkerPool(
  () => new Worker(new URL('./highlight.worker.ts', import.meta.url), { type: 'module' }),
  { maxWorkers: 3 },
)
onBeforeUnmount(() => pool.dispose())
</script>

<template>
  <DouCodeEditor
    v-model:doc="doc"
    :language="myLanguage"
    :worker="pool"
    :sync-highlight-lines="0"
  />
</template>
```

也可以直接给 `worker` 传入单个工厂函数 `() => Worker`（挂载时创建，最后一个使用者卸载时终止）。

- `worker` 只在浏览器挂载后生效，服务端渲染时不会创建 worker。
- 状态为纯数据的语言通过检查点协议回传；状态无法跨线程克隆的语言（例如 Shiki 的 TextMate `StateStack`）会自动切换为行级 Token 协议，由 Worker 持有状态并直接返回可见行的扁平 Token 数组。
- `serveCodeHighlighting` 还支持 `{ languages, resolve }` 选项，在 Worker 内按需异步加载语言（如 Shiki 语法）。
- worker 无法启动，或缺少编辑器使用的语言时，编辑器改为在页面中空闲时处理，开发环境下会在控制台提示原因。

## 小地图

`minimap` 在右侧显示整份代码的缩略图，并标出可见的部分。点击缩略图跳到对应位置，拖动标记滚动。编辑器窄于 480px 时不显示。
