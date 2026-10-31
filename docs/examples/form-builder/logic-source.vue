<script setup lang="ts">
import { DouFormRenderer, type FormDocument, type FormOptionsLoader } from '@dou-ui/form-builder'

// 描述里只写来源的名字和参数，加载函数在代码里注册；省份一变，城市的选项重新加载
const form: FormDocument = {
  version: 1,
  nodes: [
    {
      id: 'province',
      type: 'select',
      name: 'province',
      label: '省份',
      span: { sm: 6 },
      source: { name: 'provinces' },
    },
    {
      id: 'city',
      type: 'select',
      name: 'city',
      label: '城市',
      span: { sm: 6 },
      visibleWhen: 'values.province',
      source: { name: 'cities', arg: 'values.province' },
    },
  ],
}

const cities: Record<string, string[]> = {
  上海: ['浦东新区', '徐汇区', '静安区', '黄浦区'],
  浙江: ['杭州', '宁波', '温州', '绍兴'],
  江苏: ['南京', '苏州', '无锡', '常州'],
}

// 模拟接口的延迟
const wait = () => new Promise((resolve) => setTimeout(resolve, 600))

const sources: Record<string, FormOptionsLoader> = {
  provinces: async () => {
    await wait()
    return Object.keys(cities)
  },
  cities: async (province: string) => {
    await wait()
    return cities[province] ?? []
  },
}
</script>

<template>
  <DouFormRenderer :form="form" :sources="sources" style="max-width: 440px" />
</template>
