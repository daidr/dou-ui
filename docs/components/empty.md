# Empty 空状态

没有数据时显示的占位提示。

## 基础用法

<DocDemo src="empty/basic" column />

不传标题和说明时，标题取语言包里的"暂无数据"。

## 标题、说明与操作

<DocDemo src="empty/title-description" column />

## 紧凑尺寸

`size="sm"` 用在表格、列表、菜单里面。

<DocDemo src="empty/compact" column />

## API

### Props

| 名称          | 说明                                         | 类型           | 默认值 |
| ------------- | -------------------------------------------- | -------------- | ------ |
| `title`       | 标题；与说明都不传时取语言包的"暂无数据"     | `string`       | —      |
| `description` | 说明为什么是空的，或接下来该做什么           | `string`       | —      |
| `size`        | `sm` 用在表格、列表里，`md` 用在整页或卡片里 | `'sm' \| 'md'` | `'md'` |

### Slots

| 名称          | 说明           |
| ------------- | -------------- |
| `default`     | 文字下方的操作 |
| `icon`        | 替换图标       |
| `title`       | 替换标题       |
| `description` | 替换说明       |
