# Highlight 关键词高亮

在一段文字中标出关键词，常用于搜索结果和筛选列表。

## 基础用法

传入 `text` 与 `keywords`，所有匹配处都会包在 `<mark>` 里。默认不区分大小写，关键词按普通文字匹配，不是正则。

<DocDemo src="highlight/basic" column />

## 多个关键词与整词匹配

`keywords` 可以是数组，重叠时较长的关键词优先。`whole-word` 只匹配完整的词，前后紧挨字母或数字的不算；中文没有词间空格，一般不需要这个选项。

<DocDemo src="highlight/keywords" column />

## 自定义标记

`mark` 插槽替换每个匹配部分的渲染。

<DocDemo src="highlight/slot" />

## 在自己的组件中使用

切分逻辑单独导出为 `splitHighlight`，返回 `{ text, match }[]`，可以用在需要自己渲染的地方。Autocomplete 与 Tree 的筛选高亮用的也是它。

```ts
import { splitHighlight } from 'dou-ui'

splitHighlight('上海市浦东新区', ['上海', '浦东'])
// [{ text: '上海', match: true }, { text: '市', match: false }, ...]
```

## API

### Props

| 名称            | 说明               | 类型                 | 默认值  |
| --------------- | ------------------ | -------------------- | ------- |
| `text`          | 要显示的文字       | `string`             | `''`    |
| `keywords`      | 关键词，一个或多个 | `string \| string[]` | —       |
| `caseSensitive` | 区分大小写         | `boolean`            | `false` |
| `wholeWord`     | 只匹配完整的词     | `boolean`            | `false` |

### Slots

| 名称   | 说明             | 参数               |
| ------ | ---------------- | ------------------ |
| `mark` | 替换每个匹配部分 | `{ text: string }` |
