<template>
  <div class="dou-prose">
    <h1>部署你的第一个项目</h1>
    <p>
      DouUI 不依赖任何构建插件。安装后在入口文件里注册，就可以在模板中直接使用
      <code>DouButton</code> 等组件；完整的步骤见 <a href="#">快速开始</a>。
    </p>
    <h2>准备工作</h2>
    <p>开始之前，请确认本地已经安装：</p>
    <ul>
      <li><strong>Bun</strong> 1.2 或更高版本</li>
      <li>
        一个现代浏览器，支持 <code>@layer</code> 与 <code>color-mix()</code>
        <ul>
          <li>Chrome 111+、Safari 16.4+、Firefox 113+</li>
        </ul>
      </li>
    </ul>
    <h3>安装</h3>
    <pre><code>bun add dou-ui
bun add -d @dou-ui/theme</code></pre>
    <blockquote>
      <p>所有样式都放在级联层里，你自己写的样式无需提高优先级就能覆盖它们。</p>
    </blockquote>
    <table>
      <thead>
        <tr>
          <th>命令</th>
          <th>作用</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>bun run dev</code></td>
          <td>启动 playground</td>
        </tr>
        <tr>
          <td><code>bun run docs:dev</code></td>
          <td>启动文档站</td>
        </tr>
      </tbody>
    </table>
    <hr />
    <ol>
      <li>运行测试</li>
      <li>提交代码</li>
      <li>打开合并请求</li>
    </ol>
    <div style="margin-top: 24px">
      <DouButton variant="solid">组件不受排版影响</DouButton> <DouTag>标签</DouTag>
    </div>
  </div>
</template>
