import { defaultNode, defineNodeType, type DefaultNodeData } from '@dou-ui/flow'
import {
  BellIcon,
  FileTextIcon,
  ImageIcon,
  InboxIcon,
  SendIcon,
  ShieldCheckIcon,
} from '@dou-ui/icons'
import { markRaw, type Component } from 'vue'

// Node types for a submission review flow, all drawn by the default node.
const type = (
  name: string,
  icon: Component,
  group: string,
  data: DefaultNodeData,
  description?: string,
) =>
  defineNodeType<DefaultNodeData>({
    ...defaultNode,
    type: name,
    // Components in a reactive document are kept as they are.
    defaults: () => ({ ...data, icon: markRaw(icon) }),
    palette: { label: data.label as string, icon, group, description },
  })

export const reviewTypes = [
  type('submission', InboxIcon, '开始', { label: '收到投稿', outputs: [{ id: 'out' }] }),
  type(
    'extract',
    FileTextIcon,
    '处理',
    { label: '提取文字', inputs: [{ id: 'in' }], outputs: [{ id: 'out' }] },
    '从正文和附件里取出文字',
  ),
  type(
    'images',
    ImageIcon,
    '处理',
    { label: '识别图片', inputs: [{ id: 'in' }], outputs: [{ id: 'out' }] },
    '给图片打上标签',
  ),
  type('check', ShieldCheckIcon, '处理', {
    label: '判断是否合规',
    inputs: [{ id: 'in' }],
    outputs: [
      { id: 'pass', label: '通过' },
      { id: 'reject', label: '驳回' },
    ],
  }),
  type('publish', SendIcon, '结束', { label: '发布', inputs: [{ id: 'in' }] }),
  type('notify', BellIcon, '结束', { label: '通知作者', inputs: [{ id: 'in' }] }),
]
