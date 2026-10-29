# Banner 公告条

贴在页面顶部、占满整行的公告，用于维护通知、版本发布等全站消息。

## 基础用法

默认插槽放公告内容，`title` 放在内容前加粗显示。`tone` 决定图标和底色，`show-icon` 设为 `false` 可以不显示图标。

<DocDemo src="banner/basic" column />

## 实色与操作

`variant="solid"` 用语气色填满整条。`action` 插槽放在内容之后，适合放链接或小按钮；实色公告里的链接会跟随文字颜色。

<DocDemo src="banner/solid" column />

## 关闭并记住

`closable` 显示关闭按钮。设置了 `storage-key` 时，关闭状态会写进 `localStorage`，之后访问不再显示；发布新公告时换一个 key 即可。为了和服务端渲染的结果一致，存储只在挂载后读取，已关闭的公告会在首次渲染后才隐藏。

也可以用 `v-model:open` 自己控制显示。

<DocDemo src="banner/closable" column />

## 与 Alert 的区别

[Alert](./alert) 放在内容区里，说明某一块内容的情况；Banner 放在页面最上方，说明整个站点或账户的情况，一个页面通常只有一条。

## API

### Props

| 名称         | 说明                                   | 类型                                                           | 默认值      |
| ------------ | -------------------------------------- | -------------------------------------------------------------- | ----------- |
| `tone`       | 语气，同时决定图标                     | `'neutral' \| 'primary' \| 'success' \| 'warning' \| 'danger'` | `'neutral'` |
| `variant`    | `soft` 浅色底，`solid` 实色            | `'soft' \| 'solid'`                                            | `'soft'`    |
| `title`      | 内容前的标题                           | `string`                                                       | —           |
| `showIcon`   | 显示语气图标                           | `boolean`                                                      | `true`      |
| `closable`   | 显示关闭按钮                           | `boolean`                                                      | `false`     |
| `storageKey` | 记住关闭状态时使用的 `localStorage` 键 | `string`                                                       | —           |
| `open`       | 是否显示，配合 `v-model:open`          | `boolean`                                                      | `true`      |

### Events

| 名称          | 说明         | 参数                  |
| ------------- | ------------ | --------------------- |
| `update:open` | 关闭后触发   | `(open: false)`       |
| `close`       | 点击关闭按钮 | `(event: MouseEvent)` |

### Slots

| 名称      | 说明         |
| --------- | ------------ |
| `default` | 公告内容     |
| `title`   | 替换标题     |
| `icon`    | 替换语气图标 |
| `action`  | 内容后的操作 |
