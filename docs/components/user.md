# User 用户

头像加上名字和一行说明，用在成员列表、评论、顶栏的账户入口。名字承担分量，说明降一级字号和颜色，两行读起来是一个整体；文字太长时以省略号结尾，不会把一行撑宽。

<script setup>
import { MoreHorizontalIcon } from '@dou-ui/icons'
</script>

## 基础用法

`avatar` 传图片地址；没有图片时头像显示名字的首字。

<div class="demo">
  <DouUser name="陈晓" description="前端工程师" />
  <DouUser name="Ada Lovelace" description="ada@example.com" />
  <DouUser name="林青" />
</div>

```vue
<DouUser name="陈晓" description="前端工程师" />
<DouUser name="Ada Lovelace" description="ada@example.com" />
```

## 尺寸

`size` 同时决定头像和文字的大小：`sm` 配 24px 头像，`md` 配 32px，`lg` 配 40px。

<div class="demo">
  <DouUser v-for="size in ['sm', 'md', 'lg']" :key="size" :size="size" name="陈晓" description="前端工程师" />
</div>

## 头像设置与插槽

`avatar` 也可以是 [Avatar](./avatar) 的属性对象，比如方形头像。`name`、`description`、`avatar` 插槽分别替换对应部分；默认插槽放在一行末尾，适合放操作按钮。

<div class="demo demo--column" style="max-width: 320px">
  <DouUser name="DouUI" description="组织 · 12 名成员" :avatar="{ shape: 'square' }" style="width: 100%">
    <DouButton variant="ghost" size="sm" aria-label="更多">
      <template #leading><MoreHorizontalIcon /></template>
    </DouButton>
  </DouUser>
  <DouUser name="陈晓" style="width: 100%">
    <template #description>
      <DouLink href="#">@chenxiao</DouLink>
    </template>
  </DouUser>
</div>

```vue
<DouUser name="DouUI" description="组织 · 12 名成员" :avatar="{ shape: 'square' }">
  <DouButton variant="ghost" size="sm" aria-label="更多">…</DouButton>
</DouUser>
```

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
