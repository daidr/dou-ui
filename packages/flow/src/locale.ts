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
  tidy: string
  minimap: string
  undo: string
  redo: string
  controls: string
  /** The context menu and the floating toolbar. */
  menu: string
  toolbar: string
  copy: string
  cut: string
  paste: string
  duplicate: string
  delete: string
  selectAll: string
  more: string
  /** Editing an edge's text. */
  editLabel: string
  label: string
  /** The list offered when an edge is dropped on the canvas. */
  search: string
  noTypes: string
  /** Announcements; `{count}` is a number. */
  deleted: string
  tidied: string
  undone: string
  redone: string
  connected: string
  /** `{node}` is the new node's name. */
  added: string
  /** While connecting from the keyboard; `{node}` and `{port}` are names. */
  connectTo: string
  noTarget: string
  /** `{count}` edges no longer fit their ports. */
  stale: string
  /** Why an edge was refused, announced when it is dropped. */
  refused: {
    direction: string
    self: string
    type: string
    duplicate: string
    cycle: string
    custom: string
  }
  status: { wait: string; process: string; finish: string; error: string }
}

const zhCN: FlowMessages = {
  canvas: '流程画布。方向键移动选中的节点，Tab 在节点之间切换，C 从选中的节点连线，Delete 删除。',
  node: '节点',
  ports: '{inputs} 个输入，{outputs} 个输出，已连接 {connected} 条',
  input: '输入',
  output: '输出',
  zoomIn: '放大',
  zoomOut: '缩小',
  zoomLevel: '缩放 {value}%，点击恢复 100%',
  fit: '适应画布',
  tidy: '整理',
  minimap: '小地图，点击或拖动移动画布',
  undo: '撤销',
  redo: '重做',
  controls: '画布控制',
  menu: '菜单',
  toolbar: '选中节点的操作',
  copy: '复制',
  cut: '剪切',
  paste: '粘贴',
  duplicate: '复制一份',
  delete: '删除',
  selectAll: '全选',
  more: '更多',
  editLabel: '编辑标签',
  label: '连线标签',
  search: '搜索节点',
  noTypes: '没有能接上的节点',
  deleted: '已删除 {count} 项',
  tidied: '已整理 {count} 个节点',
  undone: '已撤销',
  redone: '已重做',
  connected: '已连接',
  added: '已添加{node}',
  connectTo: '连接到 {node} 的 {port}，方向键换一个，Enter 确认',
  noTarget: '没有可以连接的端口',
  stale: '{count} 条连线的端口类型已经对不上',
  refused: {
    direction: '只能从输出连到输入',
    self: '不能连到同一个节点',
    type: '端口类型不匹配',
    duplicate: '这两个端口已经连上了',
    cycle: '这样会连成环',
    custom: '不能连到这个端口',
  },
  status: { wait: '等待', process: '运行中', finish: '已完成', error: '失败' },
}

const zhTW: FlowMessages = {
  canvas: '流程畫布。方向鍵移動選取的節點，Tab 在節點之間切換，C 從選取的節點連線，Delete 刪除。',
  node: '節點',
  ports: '{inputs} 個輸入，{outputs} 個輸出，已連接 {connected} 條',
  input: '輸入',
  output: '輸出',
  zoomIn: '放大',
  zoomOut: '縮小',
  zoomLevel: '縮放 {value}%，點擊恢復 100%',
  fit: '適應畫布',
  tidy: '整理',
  minimap: '小地圖，點擊或拖曳移動畫布',
  undo: '復原',
  redo: '重做',
  controls: '畫布控制',
  menu: '選單',
  toolbar: '選取節點的操作',
  copy: '複製',
  cut: '剪下',
  paste: '貼上',
  duplicate: '複製一份',
  delete: '刪除',
  selectAll: '全選',
  more: '更多',
  editLabel: '編輯標籤',
  label: '連線標籤',
  search: '搜尋節點',
  noTypes: '沒有能接上的節點',
  deleted: '已刪除 {count} 項',
  tidied: '已整理 {count} 個節點',
  undone: '已復原',
  redone: '已重做',
  connected: '已連接',
  added: '已新增{node}',
  connectTo: '連接到 {node} 的 {port}，方向鍵換一個，Enter 確認',
  noTarget: '沒有可以連接的連接埠',
  stale: '{count} 條連線的連接埠類型已經對不上',
  refused: {
    direction: '只能從輸出連到輸入',
    self: '不能連到同一個節點',
    type: '連接埠類型不符',
    duplicate: '這兩個連接埠已經連上了',
    cycle: '這樣會連成環',
    custom: '不能連到這個連接埠',
  },
  status: { wait: '等待', process: '執行中', finish: '已完成', error: '失敗' },
}

const en: FlowMessages = {
  canvas:
    'Flow canvas. Arrow keys move the selected nodes, Tab moves between nodes, C draws an edge from the selected node, Delete removes.',
  node: 'node',
  ports: '{inputs} inputs, {outputs} outputs, {connected} connected',
  input: 'Input',
  output: 'Output',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  zoomLevel: 'Zoom {value}%, click to reset to 100%',
  fit: 'Fit to view',
  tidy: 'Tidy up',
  minimap: 'Minimap; click or drag to move the canvas',
  undo: 'Undo',
  redo: 'Redo',
  controls: 'Canvas controls',
  menu: 'Menu',
  toolbar: 'Selected node actions',
  copy: 'Copy',
  cut: 'Cut',
  paste: 'Paste',
  duplicate: 'Duplicate',
  delete: 'Delete',
  selectAll: 'Select all',
  more: 'More',
  editLabel: 'Edit label',
  label: 'Edge label',
  search: 'Search nodes',
  noTypes: 'No node can take this edge',
  deleted: '{count} deleted',
  tidied: '{count} nodes tidied up',
  undone: 'Undone',
  redone: 'Redone',
  connected: 'Connected',
  added: 'Added {node}',
  connectTo: 'Connect to {port} of {node}; arrow keys pick another, Enter confirms',
  noTarget: 'No port to connect to',
  stale: '{count} edges no longer match their ports',
  refused: {
    direction: 'Edges go from an output to an input',
    self: 'A node can’t connect to itself',
    type: 'The port types don’t match',
    duplicate: 'These ports are already connected',
    cycle: 'This would make a cycle',
    custom: 'Can’t connect to this port',
  },
  status: { wait: 'Waiting', process: 'Running', finish: 'Done', error: 'Failed' },
}

export const flowLocales: Record<string, FlowMessages> = { 'zh-CN': zhCN, 'zh-TW': zhTW, en }

/** Texts to change; nested groups are merged, so only the ones given are replaced. */
export type FlowMessagesOverride = {
  [K in keyof FlowMessages]?: FlowMessages[K] extends string ? string : Partial<FlowMessages[K]>
}

/**
 * The flow editor's texts, picked by the name of DouUI's current locale.
 * Pass `messages` to override any of them.
 */
export function useFlowMessages(override?: MaybeRefOrGetter<FlowMessagesOverride | undefined>) {
  const { locale } = useLocale()
  return computed<FlowMessages>(() => {
    const name = locale.value.name
    const base =
      flowLocales[name] ?? flowLocales[name.split('-')[0]!] ?? (name.startsWith('zh') ? zhCN : en)
    const extra = toValue(override)
    if (!extra) return base
    const out = { ...base } as Record<string, unknown>
    for (const [key, value] of Object.entries(extra)) {
      if (value === undefined) continue
      const own = out[key]
      out[key] = typeof own === 'object' && own ? { ...own, ...(value as object) } : value
    }
    return out as unknown as FlowMessages
  })
}

/** Fills `{name}` placeholders. */
export const format = (text: string, params: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => String(params[key] ?? match))
