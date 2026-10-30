# 断点

断点是布局随视口宽度变化的分界线。DouUI 的组件、主题和组合式函数都使用同一组断点。

## 断点一览

| 名称   | 起始宽度 | 常见设备               |
| ------ | -------- | ---------------------- |
| `base` | 0        | 竖屏手机               |
| `sm`   | 640px    | 横屏手机、小尺寸平板   |
| `md`   | 768px    | 竖屏平板               |
| `lg`   | 1024px   | 横屏平板、小尺寸笔记本 |
| `xl`   | 1280px   | 笔记本与台式机显示器   |

每个断点从它的起始宽度开始生效，直到下一个更大的断点为止。`base` 不需要写媒体查询，是所有样式的起点。

## 设计原则

- **从窄到宽**：先写最窄屏幕上的样式，再用 `min-width` 在更宽的断点上覆盖。窄屏的布局通常更简单，往上叠加比往下拆分更容易维护。
- **断点数量少而固定**：四个断点足以覆盖常见设备。不建议为某个具体机型单独加断点，内容放不下时，先考虑让元素换行或按容器宽度自适应。
- **按内容需要切换**：断点只说明“从这个宽度起有了更多空间”，具体在哪个断点切换布局，取决于内容在什么宽度开始显得拥挤。
- **不只依赖视口**：放在侧栏、卡片里的组件，应根据自身容器的宽度调整。DouUI 的组件内部会用容器查询处理这类情况，例如日历视图里事件块变窄时隐藏时间。

## 在组件中使用

支持响应式的属性都可以写成按断点取值的对象，没写的断点沿用比它小的那个：

```vue
<DouGrid :cols="{ base: 1, md: 2, xl: 4 }" />
```

目前使用断点的组件：

- [Grid](../components/grid)：`cols`、`span`、`start` 按断点取值。
- [Masonry](../components/masonry)：`columns` 按断点取值。
- [Layout](../components/layout)：`DouLayoutAside` 的 `breakpoint` 可以写断点名称，视口窄于它时侧栏变成抽屉。
- [Banner](../components/banner)：窄于 `sm` 时减小左右内边距，内容改为靠左排列。

## 在 CSS 中使用

媒体查询不能读取 CSS 变量，所以断点没有对应的 CSS 变量，在样式中直接写数值：

```css
.toolbar {
  flex-direction: column;
}

@media (min-width: 768px) {
  .toolbar {
    flex-direction: row;
  }
}
```

需要在构建工具或脚本中读取时，可以从 `@dou-ui/theme`（也从 `dou-ui` 重新导出）导入 `breakpoints`：

```ts
import { breakpoints } from '@dou-ui/theme'

breakpoints.md // 768
```

## 在脚本中使用

`useBreakpoints()` 返回一个响应式对象：`sm`、`md`、`lg`、`xl` 表示视口是否达到对应宽度，`current` 是当前达到的最大断点，窄于 `sm` 时为 `base`。

```ts
import { useBreakpoints } from 'dou-ui'

const screen = useBreakpoints()
const columns = computed(() => (screen.lg ? 3 : screen.md ? 2 : 1))
```

<DocDemo src="breakpoints/use-breakpoints" />

为了让服务端渲染的结果与客户端首次渲染一致，这些值在组件挂载后才开始读取视口，在此之前都为 `false`，`current` 为 `base`。能用 CSS 实现的响应式布局，优先写在样式里。
