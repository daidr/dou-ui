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
