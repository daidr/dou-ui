# Typography 排版

为一整段长文本统一排版，例如 Markdown 渲染出的文档、文章和帮助说明。

## 用法

```vue
<article class="dou-prose" v-html="html" />
```

这是一份纯样式，不是组件：引入 `dou-ui/style.css`（或按需引入 `@dou-ui/theme/components/typography.css`）后即可使用。

<DocDemo src="typography/usage" style="display: block" />

## 不受影响的内容

排版规则在遇到 DouUI 组件（任何带 `dou-` 类名的元素）时就停止，所以混在文章里的按钮、提示条、实时示例都保持它们自己的样子。其他不想被排版影响的区域，加上 `dou-not-prose`：

```html
<article class="dou-prose">
  <h2>示例</h2>
  <div class="dou-not-prose">
    <!-- 这里面的元素不会被排版 -->
  </div>
</article>
```

所有规则的优先级都是 0（`:where()`），所以你给某个元素加的任何类都能直接覆盖它。

## 尺寸

正文 16px、行高 1.75；一级到三级标题分别是 30、22、18px，二级标题上方有一道细线把章节分开；代码块 13px 等宽字体。需要更紧凑时，覆盖 `.dou-prose` 的 `font-size` 即可，段落间距会跟着正文行高走。
