# Card 卡片

把一组相关内容放在同一个容器中。

## 基础用法

<div class="demo demo--column" style="max-width: 480px">
  <DouCard title="dou-ui.dev" description="最近一次部署于 3 分钟前完成，所有检查均已通过。">
    <template #extra><DouTag tone="success" round>运行中</DouTag></template>
    <DouText variant="secondary" size="sm" mono>main · 39dc86b</DouText>
    <template #footer>
      <DouButton variant="ghost" size="sm">日志</DouButton>
      <DouButton variant="outline" size="sm">回滚</DouButton>
      <DouButton size="sm">访问</DouButton>
    </template>
  </DouCard>
</div>

```vue
<DouCard title="dou-ui.dev" description="最近一次部署于 3 分钟前完成。">
  <template #extra><DouTag tone="success" round>运行中</DouTag></template>
  main · 39dc86b
  <template #footer>
    <DouButton variant="outline" size="sm">回滚</DouButton>
    <DouButton size="sm">访问</DouButton>
  </template>
</DouCard>
```

## 阴影与可点击

`raised` 为卡片添加阴影，用于需要更突出的卡片。`interactive` 让整张卡片成为一个可点击目标：悬停时描边加深（带阴影的卡片阴影也会加深），配合 `as="a"` 渲染为链接。

<div class="demo">
  <DouCard style="width: 220px" title="平铺" description="只有细描边" />
  <DouCard style="width: 220px" raised title="带阴影" description="描边加阴影" />
  <DouCard style="width: 220px" interactive as="a" href="#阴影与可点击" title="可点击" description="悬停时描边加深" />
</div>

```vue
<DouCard raised title="带阴影" />
<DouCard interactive as="a" href="/projects/dou-ui" title="dou-ui" />
```

## 内边距

`padding` 控制头部、正文与底部的内边距：`none`、`sm`、`md`（默认）、`lg`。`none` 适合把表格或图片直接贴边放进卡片。

<div class="demo">
  <DouCard style="width: 200px" padding="sm" title="sm">12px</DouCard>
  <DouCard style="width: 200px" title="md">20px</DouCard>
  <DouCard style="width: 200px" padding="lg" title="lg">28px</DouCard>
</div>

## API

### Props

| 名称          | 说明                           | 类型                             | 默认值  |
| ------------- | ------------------------------ | -------------------------------- | ------- |
| `title`       | 标题                           | `string`                         | —       |
| `description` | 标题下的说明                   | `string`                         | —       |
| `padding`     | 内边距                         | `'none' \| 'sm' \| 'md' \| 'lg'` | `'md'`  |
| `raised`      | 加阴影，浮在页面上             | `boolean`                        | `false` |
| `interactive` | 可点击：悬停描边加深、有焦点环 | `boolean`                        | `false` |
| `as`          | 根元素，如 `article`、`a`      | `string`                         | `'div'` |

### Slots

| 名称      | 说明                             |
| --------- | -------------------------------- |
| `default` | 正文                             |
| `header`  | 替换标题与说明                   |
| `extra`   | 头部末尾，如菜单、状态标签       |
| `footer`  | 底部操作栏，细线分隔、极淡的底色 |

### CSS 变量

| 变量                 | 说明     |
| -------------------- | -------- |
| `--dou-card-padding` | 内边距   |
| `--dou-card-radius`  | 圆角     |
| `--dou-card-bg`      | 底色     |
| `--dou-card-border`  | 描边颜色 |
| `--dou-card-shadow`  | 阴影     |
