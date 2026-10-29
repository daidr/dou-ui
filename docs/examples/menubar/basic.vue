<script setup>
import { ref } from 'vue'

const grid = ref(true)
const rulers = ref(false)
const zoom = ref(100)
const last = ref('')

function onSelect(value, menu) {
  if (value !== undefined) last.value = `${menu} · ${value}`
}
</script>

<template>
  <div class="app">
    <DouMenubar @select="onSelect">
      <DouMenubarMenu label="文件">
        <DouDropdownItem value="新建" shortcut="mod+n">新建</DouDropdownItem>
        <DouDropdownItem value="打开" shortcut="mod+o">打开…</DouDropdownItem>
        <DouDropdownSub title="最近打开">
          <DouDropdownItem value="首页改版.dou">首页改版.dou</DouDropdownItem>
          <DouDropdownItem value="图标草稿.dou">图标草稿.dou</DouDropdownItem>
        </DouDropdownSub>
        <DouDropdownItem value="保存" shortcut="mod+s" divided>保存</DouDropdownItem>
        <DouDropdownSub title="导出为">
          <DouDropdownItem value="PNG">PNG</DouDropdownItem>
          <DouDropdownItem value="SVG">SVG</DouDropdownItem>
          <DouDropdownItem value="PDF">PDF</DouDropdownItem>
        </DouDropdownSub>
      </DouMenubarMenu>
      <DouMenubarMenu label="编辑">
        <DouDropdownItem value="撤销" shortcut="mod+z">撤销</DouDropdownItem>
        <DouDropdownItem value="重做" shortcut="shift+mod+z">重做</DouDropdownItem>
        <DouDropdownItem value="剪切" shortcut="mod+x" divided>剪切</DouDropdownItem>
        <DouDropdownItem value="复制" shortcut="mod+c">复制</DouDropdownItem>
        <DouDropdownItem value="粘贴" shortcut="mod+v">粘贴</DouDropdownItem>
        <DouDropdownItem value="删除" tone="danger" divided>删除</DouDropdownItem>
      </DouMenubarMenu>
      <DouMenubarMenu label="视图">
        <DouDropdownItem v-model:checked="grid" value="网格">显示网格</DouDropdownItem>
        <DouDropdownItem v-model:checked="rulers" value="标尺" shortcut="shift+mod+r">
          显示标尺
        </DouDropdownItem>
        <DouDropdownRadioGroup v-model="zoom">
          <DouDropdownItem :value="50" divided>缩放 50%</DouDropdownItem>
          <DouDropdownItem :value="100" shortcut="mod+0">缩放 100%</DouDropdownItem>
          <DouDropdownItem :value="200">缩放 200%</DouDropdownItem>
        </DouDropdownRadioGroup>
      </DouMenubarMenu>
      <DouMenubarMenu label="插件" disabled />
    </DouMenubar>
    <DouText variant="tertiary" size="sm">
      网格{{ grid ? '开' : '关' }} · 标尺{{ rulers ? '开' : '关' }} · 缩放 {{ zoom }}%
      <template v-if="last"> · 上次选择：{{ last }}</template>
    </DouText>
  </div>
</template>

<style scoped>
.app {
  display: grid;
  gap: 12px;
  width: 100%;
}
</style>
