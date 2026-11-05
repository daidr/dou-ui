# Card 卡片

把一组相关内容放在同一个容器中。

## 基础用法

<DocDemo src="card/basic" column style="max-width: 480px" />

## 阴影与可点击

`raised` 为卡片添加阴影，用于需要更突出的卡片。`interactive` 让整张卡片成为一个可点击目标：悬停时描边加深（带阴影的卡片阴影也会加深），配合 `as="a"` 渲染为链接。

`as="button"` 渲染为按钮，外观和其他卡片一样，自带悬停描边和焦点环，默认 `type="button"`。按钮里只能放文字一类的内容，卡片内部的各部分会改用 `span` 渲染；不要在里面再放按钮、链接等可交互的元素。按钮卡片可以 `disabled`，禁用时变淡、不响应悬停。

<DocDemo src="card/shadow" />

## 内边距

`padding` 控制头部、正文与底部的内边距：`none`、`sm`、`md`（默认）、`lg`。`none` 适合把表格或图片直接贴边放进卡片。

<DocDemo src="card/padding" />

## API

### Props

| 名称          | 说明                                | 类型                             | 默认值  |
| ------------- | ----------------------------------- | -------------------------------- | ------- |
| `title`       | 标题                                | `string`                         | —       |
| `description` | 标题下的说明                        | `string`                         | —       |
| `padding`     | 内边距                              | `'none' \| 'sm' \| 'md' \| 'lg'` | `'md'`  |
| `raised`      | 加阴影，浮在页面上                  | `boolean`                        | `false` |
| `interactive` | 可点击：悬停描边加深、有焦点环      | `boolean`                        | `false` |
| `as`          | 根元素，如 `article`、`a`、`button` | `string`                         | `'div'` |

### Slots

| 名称      | 说明                             |
| --------- | -------------------------------- |
| `default` | 正文                             |
| `header`  | 替换标题与说明                   |
| `extra`   | 头部末尾，如菜单、状态标签       |
| `footer`  | 底部操作栏，细线分隔、极淡的底色 |

### CSS 变量

| 变量                 | 说明     |
| -------------------- | -------- |
| `--dou-card-padding` | 内边距   |
| `--dou-card-radius`  | 圆角     |
| `--dou-card-bg`      | 底色     |
| `--dou-card-border`  | 描边颜色 |
| `--dou-card-shadow`  | 阴影     |
