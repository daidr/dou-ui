# Kbd 键盘按键

标出键盘上的一个键。画成一个小键帽：细描边，底边稍重一点，像真实按键下方的阴影；等宽字体，一串按键能对齐。

## 基础用法

<div class="demo">
  <DouKbd>⌘</DouKbd>
  <DouKbd>K</DouKbd>
  <DouKbd>Shift</DouKbd>
  <DouKbd>Enter</DouKbd>
  <DouKbd>Esc</DouKbd>
  <DouKbd>↑</DouKbd>
</div>

组合键由多个按键拼出，连接符由使用者决定：

<div class="demo">
  <DouText variant="secondary">打开命令面板 <DouKbd size="sm">⌘</DouKbd> <DouKbd size="sm">K</DouKbd></DouText>
  <DouText variant="secondary">保存 <DouKbd size="sm">Ctrl</DouKbd> + <DouKbd size="sm">S</DouKbd></DouText>
</div>

```vue
<DouKbd size="sm">⌘</DouKbd>
<DouKbd size="sm">K</DouKbd>
```

## 尺寸

`sm`（18px）用于正文与菜单里，`md`（20px，默认）单独出现时使用。

## API

### Props

| 名称   | 说明 | 类型           | 默认值 |
| ------ | ---- | -------------- | ------ |
| `size` | 尺寸 | `'sm' \| 'md'` | `'md'` |

### Slots

| 名称      | 说明 |
| --------- | ---- |
| `default` | 按键 |
