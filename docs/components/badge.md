# Badge 徽标

显示在按钮、图标右上角的数字或圆点，用于提示未读消息或待处理事项。

## 计数

<script setup>
import { ref } from 'vue'
const count = ref(5)
</script>

<div class="demo">
  <DouBadge :value="count">
    <DouButton variant="outline">消息</DouButton>
  </DouBadge>
  <DouBadge :value="128">
    <DouAvatar name="Ada Lovelace" shape="square" />
  </DouBadge>
  <DouBadge :value="3" tone="danger">
    <DouButton variant="outline">错误</DouButton>
  </DouBadge>
  <DouButton variant="ghost" size="sm" @click="count++">+1</DouButton>
  <DouButton variant="ghost" size="sm" @click="count = 0">清零</DouButton>
</div>

```vue
<DouBadge :value="count">
  <DouButton variant="outline">消息</DouButton>
</DouBadge>
<DouBadge :value="3" tone="danger">…</DouBadge>
```

超过 `max`（默认 99）的数字显示为 `99+`。值为 `0` 时默认隐藏，`show-zero` 让它显示出来。

## 圆点

`dot` 只表示"有新东西"，不关心数量。

<div class="demo">
  <DouBadge dot>
    <DouAvatar name="林小满" />
  </DouBadge>
  <DouBadge dot tone="success" placement="bottom-end">
    <DouAvatar name="Grace Hopper" />
  </DouBadge>
  <DouBadge dot tone="primary">
    <DouLink href="#圆点">更新日志</DouLink>
  </DouBadge>
</div>

## 独立使用

没有默认插槽时，徽标作为一个行内元素出现，适合放在菜单项、标签页的文字后面。

<div class="demo">
  <DouText>收件箱 <DouBadge :value="12" /></DouText>
  <DouText>失败 <DouBadge :value="2" tone="danger" /></DouText>
  <DouText>版本 <DouBadge value="new" tone="primary" /></DouText>
</div>

## 读屏

徽标里的数字会被原样读出。只读一个"5"往往语义不足，用 `label` 给出完整说法，如"5 条未读消息"。圆点没有 `label` 时对读屏隐藏。

## API

### Props

| 名称        | 说明                 | 类型                                                           | 默认值      |
| ----------- | -------------------- | -------------------------------------------------------------- | ----------- |
| `value`     | 数字或简短文字       | `number \| string`                                             | —           |
| `max`       | 超过后显示为 `max+`  | `number`                                                       | `99`        |
| `dot`       | 显示为圆点           | `boolean`                                                      | `false`     |
| `tone`      | 语义                 | `'neutral' \| 'primary' \| 'success' \| 'warning' \| 'danger'` | `'neutral'` |
| `showZero`  | 值为 `0` 时仍显示    | `boolean`                                                      | `false`     |
| `hidden`    | 隐藏徽标，保留内容   | `boolean`                                                      | `false`     |
| `placement` | 钉在哪个角           | `'top-end' \| 'bottom-end'`                                    | `'top-end'` |
| `label`     | 读屏文字，替代裸数字 | `string`                                                       | —           |

### Slots

| 名称      | 说明                               |
| --------- | ---------------------------------- |
| `default` | 徽标所在的内容；不传时徽标独立显示 |
| `content` | 替换数字                           |
