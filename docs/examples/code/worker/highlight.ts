// 在 worker 里读代码、算颜色：打开很长的文件、跳到很远的地方时，页面照常响应
import { javascript, serveCodeHighlighting } from '@dou-ui/code/worker'

serveCodeHighlighting([javascript])
