import { useLocale } from 'dou-ui'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

export interface FlowMessages {
  /** The canvas's accessible description. */
  canvas: string
  /** What a node is called to screen readers. */
  node: string
  /** Describes a node's ports; `{inputs}`, `{outputs}` and `{connected}` are counts. */
  ports: string
  input: string
  output: string
  zoomIn: string
  zoomOut: string
  /** `{value}` is the zoom in percent. */
  zoomLevel: string
  fit: string
  undo: string
  redo: string
  controls: string
  /** Announcements; `{count}` is a number. */
  deleted: string
  undone: string
  redone: string
  status: { wait: string; process: string; finish: string; error: string }
}

const zhCN: FlowMessages = {
  canvas: '流程画布。方向键移动选中的节点，Tab 在节点之间切换，Delete 删除。',
  node: '节点',
  ports: '{inputs} 个输入，{outputs} 个输出，已连接 {connected} 条',
  input: '输入',
  output: '输出',
  zoomIn: '放大',
  zoomOut: '缩小',
  zoomLevel: '缩放 {value}%，点击恢复 100%',
  fit: '适应画布',
  undo: '撤销',
  redo: '重做',
  controls: '画布控制',
  deleted: '已删除 {count} 项',
  undone: '已撤销',
  redone: '已重做',
  status: { wait: '等待', process: '运行中', finish: '已完成', error: '失败' },
}

const zhTW: FlowMessages = {
  canvas: '流程畫布。方向鍵移動選取的節點，Tab 在節點之間切換，Delete 刪除。',
  node: '節點',
  ports: '{inputs} 個輸入，{outputs} 個輸出，已連接 {connected} 條',
  input: '輸入',
  output: '輸出',
  zoomIn: '放大',
  zoomOut: '縮小',
  zoomLevel: '縮放 {value}%，點擊恢復 100%',
  fit: '適應畫布',
  undo: '復原',
  redo: '重做',
  controls: '畫布控制',
  deleted: '已刪除 {count} 項',
  undone: '已復原',
  redone: '已重做',
  status: { wait: '等待', process: '執行中', finish: '已完成', error: '失敗' },
}

const en: FlowMessages = {
  canvas:
    'Flow canvas. Arrow keys move the selected nodes, Tab moves between nodes, Delete removes.',
  node: 'node',
  ports: '{inputs} inputs, {outputs} outputs, {connected} connected',
  input: 'Input',
  output: 'Output',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  zoomLevel: 'Zoom {value}%, click to reset to 100%',
  fit: 'Fit to view',
  undo: 'Undo',
  redo: 'Redo',
  controls: 'Canvas controls',
  deleted: '{count} deleted',
  undone: 'Undone',
  redone: 'Redone',
  status: { wait: 'Waiting', process: 'Running', finish: 'Done', error: 'Failed' },
}

export const flowLocales: Record<string, FlowMessages> = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  en,
}

/**
 * The flow editor's texts, picked by the name of DouUI's current locale.
 * Pass `messages` to override any of them.
 */
export function useFlowMessages(override?: MaybeRefOrGetter<Partial<FlowMessages> | undefined>) {
  const { locale } = useLocale()
  return computed<FlowMessages>(() => {
    const name = locale.value.name
    const base =
      flowLocales[name] ?? flowLocales[name.split('-')[0]!] ?? (name.startsWith('zh') ? zhCN : en)
    const extra = toValue(override)
    return extra ? { ...base, ...extra } : base
  })
}

/** Fills `{name}` placeholders. */
export const format = (text: string, params: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => String(params[key] ?? match))
