# Tag 标签

标记状态、分类等信息。

## 变体与语气

<DocDemo src="tag/variant" />

<DocDemo src="tag/variant-2" />

## 尺寸与圆角

<DocDemo src="tag/size-radius" />

## 图标

`leading` 插槽放置图标，图标一侧的内边距会略微收窄。

<DocDemo src="tag/icon" />

## 可移除

`closable` 显示一个移除按钮，点击时触发 `close`，由使用者决定是否真的移除。按钮的读屏标签来自 [全局配置](./config-provider) 的语言包。

<DocDemo src="tag/removable" />

## 长文本

标签最宽不超过所在的容器，放不下的文字以省略号结尾，鼠标悬停时显示完整内容。[InputTag](./input-tag)、[Select](./select) 多选等用标签展示已选值的组件也是如此，长标签不会撑宽输入框。

<DocDemo src="tag/long" />

## API

### Props

| 名称       | 说明         | 类型                                                           | 默认值      |
| ---------- | ------------ | -------------------------------------------------------------- | ----------- |
| `variant`  | 视觉权重     | `'soft' \| 'outline' \| 'solid'`                               | `'soft'`    |
| `tone`     | 语义         | `'neutral' \| 'primary' \| 'success' \| 'warning' \| 'danger'` | `'neutral'` |
| `size`     | 尺寸         | `'sm' \| 'md' \| 'lg'`                                         | `'md'`      |
| `closable` | 显示移除按钮 | `boolean`                                                      | `false`     |
| `round`    | 两端完全圆角 | `boolean`                                                      | `false`     |

### Events

| 名称    | 说明         | 参数                  |
| ------- | ------------ | --------------------- |
| `close` | 点击移除按钮 | `(event: MouseEvent)` |

### Slots

| 名称      | 说明                         |
| --------- | ---------------------------- |
| `default` | 标签文字                     |
| `leading` | 文字前的内容，如图标、状态点 |

### CSS 变量

| 变量                  | 说明               |
| --------------------- | ------------------ |
| `--dou-tag-tone`      | 基础色             |
| `--dou-tag-tone-on`   | 实心背景上的前景色 |
| `--dou-tag-height`    | 高度               |
| `--dou-tag-padding-x` | 水平内边距         |
| `--dou-tag-radius`    | 圆角               |
