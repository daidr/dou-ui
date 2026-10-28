/** Every category an icon can belong to, in display order, with its label. */
export const categories = {
  arrows: '箭头',
  actions: '操作',
  status: '状态',
  interface: '界面',
  files: '文件',
  communication: '通讯',
  people: '人物',
  media: '媒体',
  time: '时间',
  objects: '物品',
  devices: '设备',
  development: '开发',
  maps: '地图',
  weather: '天气',
} as const

export type IconCategory = keyof typeof categories
