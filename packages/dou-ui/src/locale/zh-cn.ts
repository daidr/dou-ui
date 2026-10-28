import type { Locale } from './types'

export const zhCN: Locale = {
  name: 'zh-CN',
  input: {
    clear: '清空',
  },
  tag: {
    remove: '移除',
  },
  inputNumber: {
    increase: '增加',
    decrease: '减少',
  },
  slider: {
    start: '起始值',
    end: '结束值',
  },
  alert: {
    close: '关闭',
  },
  dialog: {
    close: '关闭',
  },
  drawer: {
    close: '关闭',
  },
  select: {
    placeholder: '请选择',
    empty: '无匹配项',
    clear: '清空',
  },
  spinner: {
    loading: '加载中',
  },
  toast: {
    region: '通知',
    close: '关闭',
  },
  empty: {
    title: '暂无数据',
  },
  breadcrumb: {
    label: '面包屑',
    expand: '显示完整路径',
  },
  pagination: {
    label: '分页',
    prev: '上一页',
    next: '下一页',
    page: '第 {page} 页',
    total: '共 {total} 条',
    pageSize: '{size} 条/页',
    pageSizeLabel: '每页条数',
  },
  table: {
    selectAll: '选择全部',
    selectRow: '选择此行',
  },
  upload: {
    choose: '选择文件',
    drop: '将文件拖到这里，或',
    browse: '点击选择',
    list: '文件列表',
    remove: '移除',
    retry: '重试',
    uploading: '上传中',
    error: '上传失败',
  },
  form: {
    optional: '可选',
    required: '此项为必填项',
    minLength: '至少需要 {min} 个字符',
    maxLength: '不能超过 {max} 个字符',
    minItems: '至少选择 {min} 项',
    maxItems: '最多选择 {max} 项',
    min: '不能小于 {min}',
    max: '不能大于 {max}',
    pattern: '格式不正确',
    email: '请输入有效的邮箱地址',
    url: '请输入有效的网址',
    invalid: '此项不符合要求',
  },
}
