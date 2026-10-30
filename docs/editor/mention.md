# 提及

`mention` 扩展用来在文字中提及某个人。输入 `@` 后弹出候选列表，继续输入会按输入的文字搜索，选中后插入一个提及。

## 基础用法

```vue
<script setup lang="ts">
import { DouEditor, mention, starterKit } from '@dou-ui/editor'

async function search(query: string) {
  const response = await fetch(`/api/users?q=${encodeURIComponent(query)}`)
  return response.json()
}

const extensions = [starterKit(), mention({ search })]
</script>

<template>
  <DouEditor :extensions="extensions" />
</template>
```

<DocDemo src="editor/mention" column />

候选列表可以用 `↑` `↓` 切换，`Enter` 或 `Tab` 选中，`Esc` 关闭。输入空格、删掉 `@` 或把光标移出时列表也会关闭。`@` 紧跟在字母、数字之后时（例如输入邮箱地址）不会弹出列表，代码块和行内代码里也不会。

## 搜索

`search` 接收 `@` 之后输入的文字（刚输入 `@` 时为空字符串），返回候选列表，可以是 Promise。每次输入都会重新搜索，较早发出、较晚返回的结果会被忽略，所以不需要自己处理请求的先后顺序。列表最多显示 50 项。

候选项的结构如下：

| 名称          | 说明                                    | 类型     |
| ------------- | --------------------------------------- | -------- |
| `id`          | 保存在文档里的标识                      | `string` |
| `label`       | 显示在 `@` 之后的名字，同样保存在文档里 | `string` |
| `description` | 显示在名字下方的说明，例如团队或邮箱    | `string` |
| `avatar`      | 头像地址                                | `string` |

## 文档中的数据

提及是一个行内节点，在块的 `content` 里表示为：

```ts
{ type: 'inline', name: 'mention', props: { id: 'aqing', label: '阿青' } }
```

名字和 `id` 一起保存，显示时不需要再查询。如果名字之后有变化，可以在读取文档时按 `id` 替换。

输出的 HTML 是 `<span data-mention="aqing">@阿青</span>`，粘贴带有 `data-mention` 的 HTML 时会还原成提及。

## 选项

| 名称     | 说明             | 类型                                                         | 默认值 |
| -------- | ---------------- | ------------------------------------------------------------ | ------ |
| `search` | 按输入的文字搜索 | `(query: string) => MentionItem[] \| Promise<MentionItem[]>` | —      |
