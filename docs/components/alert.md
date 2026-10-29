# Alert 提示条

在页面中展示需要用户注意的信息，例如操作结果、即将到期的提醒。

<script setup>
const log = () => {}
</script>

## 语气

`tone` 决定含义与图标：`neutral`（默认）、`primary`、`success`、`warning`、`danger`。

<div class="demo demo--column">
  <DouAlert>预览部署会在分支合并 30 天后自动清理。</DouAlert>
  <DouAlert tone="primary">新的构建镜像已可用，下次部署时自动启用。</DouAlert>
  <DouAlert tone="success">dou-ui.dev 已更新到 main · 39dc86b。</DouAlert>
  <DouAlert tone="warning">构建缓存将在 3 天后过期。</DouAlert>
  <DouAlert tone="danger">类型检查未通过，详见构建日志。</DouAlert>
</div>

```vue
<DouAlert tone="success">dou-ui.dev 已更新到 main · 39dc86b。</DouAlert>
```

## 标题、操作与关闭

`title` 是正文上方的粗体标题；`action` 插槽放在行尾；`closable` 显示关闭按钮，按下后提示条隐藏自己并触发 `close`。

<div class="demo demo--column">
  <DouAlert tone="danger" title="构建失败">
    类型检查未通过，详见构建日志。
    <template #action><DouButton size="sm" variant="outline" @click="log">查看日志</DouButton></template>
  </DouAlert>
  <DouAlert tone="warning" title="配额即将用尽" closable>本月的构建时长已用去 92%。</DouAlert>
</div>

```vue
<DouAlert tone="danger" title="构建失败">
  类型检查未通过，详见构建日志。
  <template #action>
    <DouButton size="sm" variant="outline">查看日志</DouButton>
  </template>
</DouAlert>
```

## 图标

`icon` 插槽替换默认图标，`:show-icon="false"` 去掉图标。

## 读屏

`warning` 与 `danger` 带 `role="alert"`，其余为 `role="status"`。动态插入页面时，前者会立即被读出，后者等读屏空闲时读出。

## API

### Props

| 名称       | 说明           | 类型      | 默认值      |
| ---------- | -------------- | --------- | ----------- |
| `tone`     | 含义，决定图标 | `Tone`    | `'neutral'` |
| `title`    | 标题           | `string`  | —           |
| `closable` | 显示关闭按钮   | `boolean` | `false`     |
| `showIcon` | 显示图标       | `boolean` | `true`      |

### Events

| 名称    | 说明         | 参数                  |
| ------- | ------------ | --------------------- |
| `close` | 按下关闭按钮 | `(event: MouseEvent)` |

### Slots

| 名称      | 说明               |
| --------- | ------------------ |
| `default` | 正文               |
| `title`   | 标题，替代 `title` |
| `icon`    | 替换默认图标       |
| `action`  | 行尾的操作         |

### CSS 变量

| 变量                 | 说明     |
| -------------------- | -------- |
| `--dou-alert-tone`   | 语气色   |
| `--dou-alert-bg`     | 底色     |
| `--dou-alert-border` | 描边颜色 |
| `--dou-alert-radius` | 圆角     |
