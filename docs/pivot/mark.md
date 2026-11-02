---
wide: true
---

# 条件格式

`mark` 按数值的大小给格子上色。

## 基础用法

<DocDemo src="pivot/mark" />

- `'bar'` 在数字下面画一条数据条；
- `'scale'` 按大小给格子铺上深浅不同的底色。

上色的只有最内层的格子，小计和总计不上色，最小值和最大值也只在这些格子里找。有负数时，数据条从 0 开始向两边画。

## 颜色

颜色默认是中性色，写成对象可以换成别的语气色：

```ts
values: [{ field: 'cups', mark: { type: 'scale', tone: 'success' } }]
```

颜色的深浅可以用 CSS 变量调整：`--dou-pivot-scale-strength` 是色阶最深时语气色的比例，`--dou-pivot-bar-strength` 和 `--dou-pivot-bar-strength-dark` 是浅色、深色主题下数据条的比例。

## API

### PivotMark

| 名称   | 说明         | 类型                                                           | 默认值      |
| ------ | ------------ | -------------------------------------------------------------- | ----------- |
| `type` | 数据条或色阶 | `'bar' \| 'scale'`                                             | —           |
| `tone` | 语气色       | `'neutral' \| 'primary' \| 'success' \| 'warning' \| 'danger'` | `'neutral'` |
