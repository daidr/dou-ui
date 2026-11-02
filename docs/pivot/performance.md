---
wide: true
---

# 大量数据

透视表可以汇总上百万条记录。下面的表格有 10 万条记录，可以切换到 100 万条。

## 基础用法

<DocDemo src="pivot/large" />

表格只渲染视口里看得到的行和列，滚动时不会重新计算。汇总时每个字段只读取一次，读成数字数组后缓存，之后调整布局只读取新用到的字段。

使用大量数据时：

- 把数据放在 `shallowRef` 里，或用 `markRaw` 标记，避免 Vue 为每一条记录创建响应式代理。
- 更新时替换整个数组，不要原地修改。缓存按数组本身区分，原地修改的数组不会重新读取。
- `fields` 写在 `script` 里而不是模板里。模板里的数组每次渲染都是新的，会让字段重新读取。

## 按列给出数据

`data` 也可以按列给出：每个字段一个数组，数字可以用类型化数组。百万条记录用这种形式，内存只有对象数组的几分之一，读取也更快：

```ts
const data = shallowRef({
  region: ['华东', '华南' /* … */],
  city: ['上海', '广州' /* … */],
  amount: new Float64Array([128, 96 /* … */]),
})
```

所有列的长度应当相同。`cellClick` 的 `records()` 会按下标把各列的值拼成对象。

## 在 worker 中汇总

记录超过 10 万条时，表格自动在 worker 中汇总，汇总时页面照常响应：

- 页面把需要的字段分片读取，每片不超过几毫秒，读好后整块交给 worker，不会占用或修改你传入的数组；
- 之后调整布局只发送配置；
- 汇总超过 120 毫秒时，表格保留上一次的结果，盖一层浅色并显示“正在汇总…”，新的结果出来后替换。

`:worker="true"` 不论多少条都用 worker，`:worker="false"` 总是在页面中汇总。不支持 worker 的环境（服务端渲染、测试）总是在页面中汇总。

### 内容安全策略

表格自带的 worker 打包在组件里，以 `blob:` 地址启动。站点设置了内容安全策略（CSP）时，需要在 `worker-src` 中允许 `blob:`。

如果不能放开，可以用 `:worker="false"` 在页面中汇总，或者像下面这样用 `createPivotWorker` 加载自己的 worker 文件。自带的 worker 无法启动时，表格会在控制台给出提示，并改为在页面中汇总。

### 自己的 worker

自定义的汇总方式是函数，不能发送给 worker。用到它们时，自己写一个 worker 文件，在里面用 `servePivot` 注册，再用 `createPivotWorker` 传给表格：

```ts
// pivot.worker.ts
import { servePivot } from '@dou-ui/pivot/worker'
import { weightedPrice } from './aggregators'

servePivot({ aggregators: [weightedPrice] })
```

```vue
<script setup>
import { createPivotWorker } from '@dou-ui/pivot/worker'
import PivotWorker from './pivot.worker?worker'

const engine = createPivotWorker(() => new PivotWorker())
</script>

<template>
  <DouPivot :data="data" :engine="engine" :aggregators="[weightedPrice]" />
</template>
```

页面上的 `aggregators` 仍然要传，表头需要用它们的名字。

## 在服务端汇总

`engine` 可以是任何带 `compute` 方法的对象，比如把配置发给服务端。服务端用[内核](./engine)汇总，把结果打包成 JSON 返回，页面再还原：

```ts
// 服务端
import { computePivot, PivotSource } from '@dou-ui/pivot/engine'

const result = computePivot(new PivotSource(orders, { fields }), config)
return JSON.stringify(result.pack({ plain: true }))
```

```ts
// 页面
import { PivotResult } from '@dou-ui/pivot/engine'

const engine = {
  async compute(source, config, { signal }) {
    const response = await fetch('/api/pivot', {
      method: 'POST',
      body: JSON.stringify(config),
      signal,
    })
    return PivotResult.unpack(await response.json(), source, config)
  },
}
```

这时 `data` 只需要给出字段，例如 `{ region: [], amount: [] }` 配合 `fields`，用来显示字段名和格式。`cellClick` 的 `records()` 拿不到服务端的记录，按 `row` 和 `column` 向服务端查询即可。

## API

### Worker 与引擎

| 名称                                          | 说明                                                            |
| --------------------------------------------- | --------------------------------------------------------------- |
| `createPivotWorker(worker)`                   | 用一个 worker（或创建它的函数）做汇总，返回给 `engine` 用的对象 |
| `servePivot({ aggregators? })`                | 在 worker 文件里调用，`aggregators` 注册自定义的汇总方式        |
| `result.pack({ plain? })`                     | 把结果打包成数据；`plain: true` 得到能写成 JSON 的普通数组      |
| `PivotResult.unpack(packet, source, config?)` | 从打包的数据还原结果，`source` 提供字段的名字和格式             |

### PivotEngine

| 名称                                | 说明                                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| `compute(source, config, request?)` | 汇总，返回 `Promise<PivotResult>`；`request` 里有 `signal` 和 `aggregators`（按名字索引） |
| `dispose()`                         | 可选，释放占用的资源                                                                      |

有新的配置时，旧的请求会收到 `signal` 的中止。表格自己创建的 worker 会在卸载时关闭；传入的 `engine` 不再使用时，由你调用 `dispose()`。
