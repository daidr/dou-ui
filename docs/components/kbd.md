# Kbd 键盘按键

展示键盘按键，例如快捷键说明。

## 基础用法

<DocDemo src="kbd/basic" />

组合键由多个按键拼出，连接符由使用者决定：

<DocDemo src="kbd/basic-2" />

## 快捷键

`keys` 接收和 [`useHotkey`](../guide/composables#usehotkey) 相同的写法，并按平台显示按键名称：`mod+k` 在 macOS 上显示为 ⌘ K，在其他系统上显示为 Ctrl K。用空格分隔的按键序列分组显示。

<DocDemo src="kbd/keys" />

## 尺寸

`sm`（18px）用于正文与菜单里，`md`（20px，默认）单独出现时使用。

## API

### Props

| 名称   | 说明                                   | 类型           | 默认值 |
| ------ | -------------------------------------- | -------------- | ------ |
| `size` | 尺寸                                   | `'sm' \| 'md'` | `'md'` |
| `keys` | 按平台显示的快捷键，传入后替代默认插槽 | `string`       | —      |

### Slots

| 名称      | 说明 |
| --------- | ---- |
| `default` | 按键 |
