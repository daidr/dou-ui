# 附件与嵌入

`attachment` 扩展提供附件块，显示文件名、大小和下载按钮；`embed` 扩展提供嵌入块，用来放网页、视频和音频。两者都不在 `editorKit()` 里，需要时单独添加。

<DocDemo src="editor/attachment-embed" column />

## 附件

```ts
import { attachment, editorKit, image } from '@dou-ui/editor'

async function upload(file: File) {
  const body = new FormData()
  body.append('file', file)
  const response = await fetch('/api/upload', { method: 'POST', body })
  const { url } = await response.json()
  return url
}

const extensions = [editorKit(), image({ upload }), attachment({ upload })]
```

在块菜单里输入“附件”插入一个空的附件块，再选择文件。文件也可以直接粘贴或拖进编辑器，每个文件生成一个附件块；同时添加了 `image` 时，图片文件仍然生成图片块，图片和其他文件一起粘贴时按原来的顺序分别生成图片块和附件块。

上传的方式和[图片](./image#上传)相同：`upload` 接收 `File`，返回文件地址。上传期间附件块显示上传状态，完成后才把地址写入文档；上传失败时可以重试。不传 `upload` 时文件以 data URL 保存在文档里，只适合试用。

附件的地址可以是 `http:`、`https:`、`blob:`、相对地址或 data URL，`javascript:` 这类地址会被忽略。`isSafeFileSrc` 可以用来提前检查，`formatFileSize` 把字节数写成 `1.2 MB` 这样的文字。

### 附件块的数据

类型是 `attachment`，没有文字内容，`props` 如下：

| 名称   | 说明                                             | 类型             | 默认值 |
| ------ | ------------------------------------------------ | ---------------- | ------ |
| `src`  | 文件地址                                         | `string`         | `''`   |
| `name` | 文件名，下载时使用                               | `string`         | `''`   |
| `size` | 文件大小，单位是字节                             | `number \| null` | `null` |
| `mime` | 文件类型，例如 `application/pdf`，决定显示的图标 | `string`         | `''`   |

### 选项

| 名称     | 说明                                               | 类型                              | 默认值          |
| -------- | -------------------------------------------------- | --------------------------------- | --------------- |
| `upload` | 保存选择、粘贴或拖入的文件                         | `(file: File) => Promise<string>` | 保存为 data URL |
| `accept` | 选择文件时可选的类型，和文件输入框的 `accept` 一样 | `string`                          | —               |

## 嵌入

在块菜单里输入“嵌入”插入嵌入块，粘贴链接后按 `Enter`。默认规则如下：

- 只接受 `https:` 链接。
- 链接指向视频文件（`.mp4`、`.webm` 等）时用浏览器自带的播放器播放，指向音频文件（`.mp3`、`.m4a` 等）时显示音频播放器。
- 其他网页放在一个受限的 iframe 里显示，默认宽高比是 16:9。iframe 可以运行脚本、在新标签页打开链接和全屏，但不能让上层页面跳转。
- 和编辑器所在页面同源（协议、域名和端口都相同）的网页不会放进 iframe，自定义的 `resolve` 返回这样的地址也一样：iframe 允许运行脚本和读写同源的存储，同源的网页放进去就等于没有隔离。同源的视频和音频可以播放。

不是 https 的链接会提示“只能嵌入 https 开头的链接”，其他不能嵌入的链接提示“无法嵌入这个链接”。嵌入后可以在下方填写说明文字，点说明右侧的按钮可以修改链接。嵌入后可以在下方填写说明文字。

### 自定义规则

很多视频网站的播放页不能直接嵌入，要换成它们的播放器地址。`resolve` 接收用户填写的链接，返回要显示的内容，返回 `null` 表示不能嵌入：

```ts
import { embed, resolveEmbed } from '@dou-ui/editor'

const extensions = [
  editorKit(),
  embed({
    resolve(url) {
      const id = /^https:\/\/video\.example\.com\/watch\/(\w+)$/.exec(url)?.[1]
      if (id) return { kind: 'frame', src: `https://video.example.com/player/${id}` }
      return resolveEmbed(url) // 其余的按默认规则
    },
  }),
]
```

返回值的格式：

| 名称          | 说明                                                | 类型                            |
| ------------- | --------------------------------------------------- | ------------------------------- |
| `kind`        | 显示成网页、视频还是音频                            | `'frame' \| 'video' \| 'audio'` |
| `src`         | 实际加载的地址，必须是 `https:`，否则按不能嵌入处理 | `string`                        |
| `aspectRatio` | 网页或视频的宽高比，默认 `16 / 9`                   | `number`                        |
| `height`      | 网页的固定高度（px），设置后不再使用 `aspectRatio`  | `number`                        |

文档里保存的是用户填写的原始链接，显示和导出时才调用 `resolve`。所以修改规则后，已有的文档也会按新规则显示。

在服务端调用 `blocksToHTML` 时没有页面，无法判断哪些地址同源，所以服务端和浏览器的输出可能不同：浏览器里会去掉的同源 iframe，服务端会照常写出。服务端生成要展示的 HTML 时，请在 `resolve` 里自己拒绝展示页面所在的源：

```ts
const site = 'https://docs.example.com'

embed({
  resolve: (url) => (new URL(url).origin === site ? null : resolveEmbed(url)),
})
```

### 嵌入块的数据

类型是 `embed`，没有文字内容，`props` 是 `src`（原始链接）和 `caption`（说明文字），默认都是空字符串。

## 导入与导出

- HTML：附件写成一个带 `download` 的链接，后面跟着文件大小；嵌入写成 `<figure data-embed="原始链接">`，里面是 iframe 或播放器和说明文字。读入时都能还原。从网页粘贴的 `https:` iframe、`<video>` 和 `<audio>` 也会变成嵌入块。
- Markdown：两者都写成普通链接，文字是文件名或说明文字。
