# 图片

`image` 扩展提供图片块。图片可以从本地上传、粘贴、拖入编辑器，也可以填写图片地址嵌入；插入后可以拖动两侧调整宽度，并在下方填写说明文字。

## 基础用法

```vue
<script setup lang="ts">
import { DouEditor, image, editorKit } from '@dou-ui/editor'

async function upload(file: File) {
  const body = new FormData()
  body.append('file', file)
  const response = await fetch('/api/upload', { method: 'POST', body })
  const { url } = await response.json()
  return url
}

const extensions = [editorKit(), image({ upload })]
</script>

<template>
  <DouEditor :extensions="extensions" />
</template>
```

在块菜单里输入“图片”插入一个空的图片块，再选择上传或嵌入链接。截图、复制的图片文件可以直接粘贴，图片文件也可以拖到编辑器里的任意位置，每个文件生成一个图片块。

<DocDemo src="editor/image" column />

## 上传

`upload` 接收一个 `File`，返回图片的地址。上传期间图片块先显示本地预览和上传状态，上传完成后才把地址写入文档，所以 `v-model` 和协同编辑的其他人不会看到上传到一半的图片。上传失败时，图片块上会显示重新上传的按钮。

不传 `upload` 时，图片以 data URL 的形式保存在文档里。这样不需要服务器就能使用，但文档会变得很大，只适合试用。

## 图片地址

文档只接受以下地址，其他地址（例如 `javascript:`）会被忽略，粘贴来的 HTML 里这样的图片也会被丢弃：

- `http:`、`https:` 和 `blob:` 地址，以及不带协议的相对地址
- 图片类型的 data URL（`data:image/…`）

`upload` 返回的地址也要符合这个规则，否则按上传失败处理。`isSafeImageSrc` 可以用来提前检查一个地址。

## 块的数据

图片块的类型是 `image`，没有文字内容，`props` 如下：

| 名称      | 说明                                             | 类型             | 默认值 |
| --------- | ------------------------------------------------ | ---------------- | ------ |
| `src`     | 图片地址                                         | `string`         | `''`   |
| `alt`     | 替代文字，不设置时使用说明文字                   | `string`         | `''`   |
| `caption` | 图片下方的说明文字                               | `string`         | `''`   |
| `width`   | 宽度，占编辑区域宽度的百分比（20–100），居中显示 | `number \| null` | `null` |

`width` 为 `null` 时图片占满整行。

## 选项

| 名称     | 说明                           | 类型                              | 默认值          |
| -------- | ------------------------------ | --------------------------------- | --------------- |
| `upload` | 保存选择、粘贴或拖入的图片文件 | `(file: File) => Promise<string>` | 保存为 data URL |
