<script setup>
import { ref } from 'vue'

const regions = [
  {
    value: 'zj',
    label: '浙江',
    children: [
      {
        value: 'hz',
        label: '杭州',
        children: [
          { value: 'xh', label: '西湖区' },
          { value: 'bj', label: '滨江区' },
          { value: 'yh', label: '余杭区' },
        ],
      },
      {
        value: 'nb',
        label: '宁波',
        children: [
          { value: 'hs', label: '海曙区' },
          { value: 'yz', label: '鄞州区' },
        ],
      },
      { value: 'wz', label: '温州', disabled: true },
    ],
  },
  {
    value: 'js',
    label: '江苏',
    children: [
      {
        value: 'nj',
        label: '南京',
        children: [
          { value: 'xw', label: '玄武区' },
          { value: 'gl', label: '鼓楼区' },
        ],
      },
      {
        value: 'sz',
        label: '苏州',
        children: [
          { value: 'gs', label: '姑苏区' },
          { value: 'wz', label: '吴中区' },
        ],
      },
    ],
  },
  {
    value: 'sh',
    label: '上海',
    children: [
      { value: 'pd', label: '浦东新区' },
      { value: 'xh', label: '徐汇区' },
    ],
  },
]
const searched = ref(null)
</script>

<template>
  <DouCascader
    v-model="searched"
    :options="regions"
    filterable
    placeholder="输入地区名称"
    style="width: 260px"
  />
</template>
