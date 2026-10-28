# Typography 排版

给一整段长文——Markdown 渲染出来的文档、文章、帮助说明——加上一致的排版。只需要在外层加上 `dou-prose` 类，里面没有类名的普通元素就会得到样式：标题是墨色，正文浅一级；链接和 [Link](./link) 一样是墨色加淡下划线；代码与其他凹陷的区域同一层淡底色；表格和分割线都是细线。

## 用法

```vue
<article class="dou-prose" v-html="html" />
```

这是一份纯样式，不是组件：引入 `dou-ui/style.css`（或按需引入 `@dou-ui/theme/components/typography.css`）后即可使用。

<div class="demo" style="display: block">
<div class="dou-prose typography-demo">
<h1>部署你的第一个项目</h1>
<p>DouUI 不依赖任何构建插件。安装后在入口文件里注册，就可以在模板中直接使用 <code>DouButton</code> 等组件；完整的步骤见 <a href="#">快速开始</a>。</p>
<h2>准备工作</h2>
<p>开始之前，请确认本地已经安装：</p>
<ul>
<li><strong>Bun</strong> 1.2 或更高版本</li>
<li>一个现代浏览器，支持 <code>@layer</code> 与 <code>color-mix()</code>
<ul><li>Chrome 111+、Safari 16.4+、Firefox 113+</li></ul>
</li>
</ul>
<h3>安装</h3>
<pre><code>bun add dou-ui
bun add -d @dou-ui/theme</code></pre>
<blockquote><p>所有样式都放在级联层里，你自己写的样式无需提高优先级就能覆盖它们。</p></blockquote>
<table>
<thead><tr><th>命令</th><th>作用</th></tr></thead>
<tbody>
<tr><td><code>bun run dev</code></td><td>启动 playground</td></tr>
<tr><td><code>bun run docs:dev</code></td><td>启动文档站</td></tr>
</tbody>
</table>
<hr />
<ol><li>运行测试</li><li>提交代码</li><li>打开合并请求</li></ol>
<div class="demo-inline"><DouButton variant="solid">组件不受排版影响</DouButton> <DouTag>标签</DouTag></div>
</div>
</div>

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

<style>
.typography-demo .demo-inline {
  margin-top: 24px;
}
</style>
