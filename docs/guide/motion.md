# 动效

所有组件的动画都取自同一组动效 Token，进场、退场、展开和加载的方式在各组件之间保持一致。这一页说明这些约定，以及如何调整或关闭动画。

## 设计原则

- **用于说明变化**：动画用来表达元素从哪里来、到哪里去、哪里发生了变化，不做装饰性的动画。
- **短而快**：常规交互不超过 300ms，悬停和按下的反馈在 150ms 以内，不让用户等待动画结束。
- **进场减速，退场加速**：出现时先快后慢，停稳在最终位置；消失时先慢后快，并且比进场更短，不挡住下一步操作。
- **从触发处出现**：浮层朝触发元素的方向展开，抽屉从所在的边滑入，折叠内容沿内容方向展开。方向固定，可以预期。
- **幅度小**：位移只有 4px 和 8px 两档，缩放只从 0.98 开始，没有回弹和过冲。唯一的例外是直接操作：手指或指针仍按在元素上时，元素可以用 `spring` 曲线带一点回弹，比如数字输入框在触摸时放大的按键面板。
- **距离越远，时长越长**：跨越整个屏幕的抽屉用较长的时长，但不超过 320ms。
- **可以打断**：动画进行中再次操作，会从当前状态直接过渡到新状态。
- **遵循减少动态效果设置**：系统开启后，只保留短暂的淡入淡出，加载指示放慢，装饰性的循环动画停止。

## 动效 Token

| Token                           | 默认值                              | 用途                                                   |
| ------------------------------- | ----------------------------------- | ------------------------------------------------------ |
| `--dou-motion-duration-instant` | `100ms`                             | 颜色与透明度反馈，减少动效时的淡入淡出                 |
| `--dou-motion-duration-fast`    | `150ms`                             | 悬停、按下、小图标旋转、浮层退场                       |
| `--dou-motion-duration-normal`  | `220ms`                             | 浮层与对话框进场、折叠展开、指示条移动                 |
| `--dou-motion-duration-slow`    | `320ms`                             | 抽屉等跨越屏幕的面板                                   |
| `--dou-motion-easing`           | `cubic-bezier(0.2, 0, 0, 1)`        | 同一元素在两种状态之间的变化                           |
| `--dou-motion-easing-enter`     | `cubic-bezier(0.16, 1, 0.3, 1)`     | 元素出现                                               |
| `--dou-motion-easing-exit`      | `cubic-bezier(0.4, 0, 1, 1)`        | 元素消失                                               |
| `--dou-motion-easing-spring`    | 过冲约 14% 后回稳的 `linear()` 曲线 | 直接操作时的回弹，减少动效时变为 `--dou-motion-easing` |
| `--dou-motion-distance-sm`      | `4px`                               | 浮层进出场的位移                                       |
| `--dou-motion-distance-md`      | `8px`                               | 对话框、轻提示等的位移                                 |
| `--dou-motion-scale`            | `0.98`                              | 进场时的起始缩放                                       |
| `--dou-motion-loop-spin`        | `0.8s`                              | 加载图标旋转一圈                                       |
| `--dou-motion-loop-pulse`       | `1.6s`                              | 呼吸、闪烁、输入中的圆点                               |
| `--dou-motion-loop-sweep`       | `2s`                                | 骨架屏扫光、涟漪                                       |

和其他 Token 一样，可以用 CSS 变量或 `defineTheme` 覆盖（见 [主题与 Token](./theming)）：

```css
:root {
  --dou-motion-duration-normal: 180ms;
}
```

## 过渡预设

以下过渡可以直接用在 Vue 的 `<Transition>` 上，进场用 `normal` 时长和 `enter` 曲线，退场用 `fast` 时长和 `exit` 曲线，也会遵循减少动效设置。

| 名称              | 效果                |
| ----------------- | ------------------- |
| `dou-fade`        | 淡入淡出            |
| `dou-zoom`        | 从 0.98 放大并淡入  |
| `dou-slide-up`    | 向上移动 8px 并淡入 |
| `dou-slide-down`  | 向下移动 8px 并淡入 |
| `dou-slide-left`  | 向左移动 8px 并淡入 |
| `dou-slide-right` | 向右移动 8px 并淡入 |

<DocDemo src="motion/presets" />

高度的展开与收起使用 [`DouCollapseTransition`](../components/collapse#自定义内容的展开动画)。

## 减少与关闭动画

动画有三种模式：

- `auto`：默认，跟随系统的“减少动态效果”设置。
- `reduce`：去掉位移和缩放，过渡缩短为 100ms 的淡入淡出，装饰性的循环动画停止，加载图标放慢。
- `none`：完全关闭动画，适合自动化测试和截图。

使用 [`DouConfigProvider`](../components/config-provider#动效) 的 `motion` 属性或插件选项设置。由于浮层渲染在 `<body>` 下，这个设置作用于整个页面。

<DocDemo src="motion/mode" />

也可以直接在 `<html>` 上写 `data-dou-motion` 属性，服务端渲染时首屏即可生效：

```html
<html data-dou-motion="reduce"></html>
```

## 在脚本中使用

由脚本驱动的动画（例如平滑滚动）可以用下面的函数与组件保持一致：

| 函数                           | 说明                                                                |
| ------------------------------ | ------------------------------------------------------------------- |
| `useReducedMotion()`           | 返回 `ComputedRef<boolean>`，综合 `motion` 配置、页面属性和系统设置 |
| `getMotionDuration(name, el?)` | 读取某个时长 Token 当前的毫秒数，已计入自定义主题与减少动效         |
| `setMotionMode(mode)`          | 直接设置页面的动效模式                                              |
| `useMotionMode(mode)`          | 在组件挂载期间应用某个模式，卸载时恢复原值                          |

```ts
import { useReducedMotion } from 'dou-ui'

const reducedMotion = useReducedMotion()

function toTop() {
  window.scrollTo({ top: 0, behavior: reducedMotion.value ? 'auto' : 'smooth' })
}
```
