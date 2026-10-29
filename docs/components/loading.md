# Loading 加载遮罩

在正在加载的内容上显示遮罩和加载图标。

## 基础用法

把要遮住的内容放进 `DouLoading`，用 `loading` 控制。`text` 是转圈下面的一行字，同时作为读屏标签。

<DocDemo src="loading/basic" column />

## 指令

不想多包一层时，用 `v-loading` 直接盖在元素上。值可以是布尔值，也可以是带 `text`、`size`、`delay` 的对象。全量注册 DouUI 时指令已经注册好；按需使用时导入 `vLoading`。

<DocDemo src="loading/directive" column />

指令会给元素加上 `position: relative`（如果它原本是静态定位），并在遮罩显示期间设置 `aria-busy="true"`。

## 全屏

`fullscreen` 盖住整个窗口，层级在所有浮层之上，期间页面不能滚动。

<DocDemo src="loading/fullscreen" />

## 延迟显示

很快就能结束的操作，遮罩一闪而过反而让人不安。`delay` 让遮罩在加载持续这么久之后才出现；加载结束时总是立刻撤掉。

```vue
<DouLoading :loading="loading" :delay="200">…</DouLoading>
```

## 读屏

遮罩里的转圈带 `role="status"`，标签取 `text`，没有时取语言包里的“加载中”；被遮住的容器带 `aria-busy="true"`。

## API

### Props

| 名称         | 说明                           | 类型                   | 默认值                  |
| ------------ | ------------------------------ | ---------------------- | ----------------------- |
| `loading`    | 是否显示遮罩                   | `boolean`              | `false`                 |
| `text`       | 转圈下方的文字，同时是读屏标签 | `string`               | —                       |
| `fullscreen` | 盖住整个窗口                   | `boolean`              | `false`                 |
| `delay`      | 加载持续这么多毫秒后才显示     | `number`               | `0`                     |
| `size`       | 转圈尺寸                       | `'sm' \| 'md' \| 'lg'` | `'md'`，全屏时为 `'lg'` |

### Slots

| 名称      | 说明         |
| --------- | ------------ |
| `default` | 被遮住的内容 |

### 指令

| 写法                                         | 说明                                      |
| -------------------------------------------- | ----------------------------------------- |
| `v-loading="boolean"`                        | 是否显示遮罩                              |
| `v-loading="{ loading, text, size, delay }"` | 同组件的同名属性；`loading` 缺省为 `true` |

### CSS 变量

| 变量                   | 说明                                           |
| ---------------------- | ---------------------------------------------- |
| `--dou-loading-veil`   | 遮罩颜色                                       |
| `--dou-loading-radius` | 遮罩圆角；组件默认为容器圆角，指令跟随元素自身 |
