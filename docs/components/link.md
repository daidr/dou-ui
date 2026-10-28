# Link 链接

跳转到另一个页面。链接与正文同为墨色，靠一条淡淡的下划线识别，悬停时下划线加深。

## 基础用法

<div class="demo">
  <DouLink href="#">查看文档</DouLink>
  <DouLink href="#" tone="primary">primary</DouLink>
  <DouLink href="#" tone="danger">danger</DouLink>
</div>

```vue
<DouLink href="/docs">查看文档</DouLink>
```

## 下划线

`underline` 控制下划线何时出现：常驻（默认）、仅悬停、从不。

<div class="demo">
  <DouLink href="#">always</DouLink>
  <DouLink href="#" underline="hover">hover</DouLink>
  <DouLink href="#" underline="none">none</DouLink>
</div>

## 外部链接

`external` 会在新标签页打开，自动加上 `rel="noopener noreferrer"`，并在末尾标记一个箭头。

<div class="demo">
  <DouLink href="https://github.com/daidr/dou-ui" external>GitHub</DouLink>
</div>

```vue
<DouLink href="https://github.com/daidr/dou-ui" external>GitHub</DouLink>
```

## 禁用

禁用的链接会移除 `href`，既不能跟随也不能获得焦点，并带有 `aria-disabled`。

<div class="demo">
  <DouLink href="#" disabled>不可用</DouLink>
</div>

## 图标

与按钮一致，用 `leading` / `trailing` 插槽放置图标；`trailing` 会替代外部链接的箭头。

```vue
<DouLink href="/changelog">
  更新日志
  <template #trailing>→</template>
</DouLink>
```

## API

### Props

| 名称        | 说明                                      | 类型                                                           | 默认值      |
| ----------- | ----------------------------------------- | -------------------------------------------------------------- | ----------- |
| `href`      | 目标地址                                  | `string`                                                       | —           |
| `tone`      | 语义                                      | `'neutral' \| 'primary' \| 'success' \| 'warning' \| 'danger'` | `'neutral'` |
| `underline` | 下划线出现的时机                          | `'always' \| 'hover' \| 'none'`                                | `'always'`  |
| `disabled`  | 禁用                                      | `boolean`                                                      | `false`     |
| `external`  | 在新标签页打开，并加上安全的 `rel` 与箭头 | `boolean`                                                      | `false`     |

### Events

| 名称    | 说明                     | 参数                  |
| ------- | ------------------------ | --------------------- |
| `click` | 点击时触发，禁用时不触发 | `(event: MouseEvent)` |

### Slots

| 名称       | 说明                       |
| ---------- | -------------------------- |
| `default`  | 链接文字                   |
| `leading`  | 文字前的内容               |
| `trailing` | 文字后的内容，替代外链箭头 |

### CSS 变量

| 变量                         | 说明             |
| ---------------------------- | ---------------- |
| `--dou-link-tone`            | 文字颜色         |
| `--dou-link-underline`       | 静止时下划线颜色 |
| `--dou-link-underline-hover` | 悬停时下划线颜色 |
