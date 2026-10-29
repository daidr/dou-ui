<script setup>
import { ref } from 'vue'

const current = ref('')
const items = [
  { href: '#anchor-demo-a', title: '准备工作' },
  {
    href: '#anchor-demo-b',
    title: '安装',
    children: [
      { href: '#anchor-demo-b1', title: '用 Bun 安装' },
      { href: '#anchor-demo-b2', title: '按需引入样式' },
    ],
  },
  { href: '#anchor-demo-c', title: '主题' },
  { href: '#anchor-demo-d', title: '下一步' },
]
</script>

<template>
  <div class="anchor-demo vp-raw">
    <div id="anchor-demo-scroll" class="anchor-demo__body">
      <section
        v-for="s in [items[0], items[1], ...items[1].children, items[2], items[3]]"
        :key="s.href"
      >
        <h4 :id="s.href.slice(1)">{{ s.title }}</h4>
        <p>
          这一节的正文。滚动右边这块区域，目录会高亮当前读到的那一节；点击目录里的链接，区域会平滑滚到对应的位置。
        </p>
      </section>
    </div>
    <DouAnchor
      v-model="current"
      :items="items"
      target="#anchor-demo-scroll"
      :offset="8"
      :update-hash="false"
    />
  </div>
  <DouText variant="tertiary" size="sm">当前：{{ current || '—' }}</DouText>
</template>

<style>
.anchor-demo {
  display: grid;
  grid-template-columns: 1fr 180px;
  gap: 24px;
  width: 100%;
}
.anchor-demo__body {
  height: 240px;
  overflow: auto;
  padding-right: 16px;
  border-right: 1px solid var(--dou-color-border);
}
.anchor-demo__body h4 {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
}
.anchor-demo__body p {
  margin: 0 0 32px;
  color: var(--dou-color-text-secondary);
  font-size: 14px;
  line-height: 1.7;
}
.anchor-demo__body section:last-child p {
  margin-bottom: 120px;
}
</style>
