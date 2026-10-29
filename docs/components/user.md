# User 用户

展示用户的头像、名字和简短说明，用于成员列表、评论、账户入口等位置。

## 基础用法

`avatar` 传图片地址；没有图片时头像显示名字的首字。

<DocDemo src="user/basic" />

## 尺寸

`size` 同时决定头像和文字的大小：`sm` 配 24px 头像，`md` 配 32px，`lg` 配 40px。

<DocDemo src="user/size" />

## 头像设置与插槽

`avatar` 也可以是 [Avatar](./avatar) 的属性对象，比如方形头像。`name`、`description`、`avatar` 插槽分别替换对应部分；默认插槽放在一行末尾，适合放操作按钮。

<DocDemo src="user/avatar-slot" column style="max-width: 320px" />

## API

### Props

| 名称          | 说明                             | 类型                    | 默认值 |
| ------------- | -------------------------------- | ----------------------- | ------ |
| `name`        | 名字，也用作头像的首字与读屏名称 | `string`                | —      |
| `description` | 名字下方的一行说明               | `string`                | —      |
| `avatar`      | 头像图片地址，或 Avatar 的属性   | `string \| AvatarProps` | —      |
| `size`        | 尺寸，头像与文字一起变           | `'sm' \| 'md' \| 'lg'`  | `'md'` |

### Slots

| 名称          | 说明                     |
| ------------- | ------------------------ |
| `avatar`      | 替换头像                 |
| `name`        | 替换名字，比如换成链接   |
| `description` | 替换说明                 |
| `default`     | 一行末尾的内容，比如操作 |
