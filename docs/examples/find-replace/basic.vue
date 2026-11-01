<script setup lang="ts">
import { LetterCaseIcon, SearchIcon } from '@dou-ui/icons'
import type { FindReplaceInstance } from 'dou-ui'
import { computed, nextTick, ref } from 'vue'

const lines = ref([
  '周一上午 9:30 在上海办公室开周会',
  '周三下午和设计组过一遍新版首页',
  '周五前把上海站的活动页上线',
  '下周一上午整理本周的会议纪要',
])
const open = ref(true)
const search = ref('上海')
const replace = ref('')
const replacing = ref(false)
const caseSensitive = ref(false)
const current = ref(0)
const panel = ref<FindReplaceInstance>()

const fold = (text: string) => (caseSensitive.value ? text : text.toLowerCase())
/** Each match as [line, offset], in order. */
const matches = computed(() => {
  const out: [number, number][] = []
  const wanted = fold(search.value)
  if (!open.value || !wanted) return out
  lines.value.forEach((line, i) => {
    const text = fold(line)
    for (let at = text.indexOf(wanted); at >= 0; at = text.indexOf(wanted, at + wanted.length))
      out.push([i, at])
  })
  return out
})
const index = computed(() => (matches.value.length ? current.value % matches.value.length : -1))

/** Each line cut into plain text and matches, the current match marked. */
const parts = computed(() =>
  lines.value.map((line, i) => {
    const out: { text: string; match?: boolean; current?: boolean }[] = []
    let from = 0
    matches.value.forEach(([row, at], n) => {
      if (row !== i) return
      out.push({ text: line.slice(from, at) })
      from = at + search.value.length
      out.push({ text: line.slice(at, from), match: true, current: n === index.value })
    })
    out.push({ text: line.slice(from) })
    return out
  }),
)

function step(by: number) {
  const n = matches.value.length
  if (n) current.value = (index.value + by + n) % n
}

function replaceOne() {
  const match = matches.value[index.value]
  if (!match) return
  const [i, at] = match
  const line = lines.value[i]!
  lines.value[i] = line.slice(0, at) + replace.value + line.slice(at + search.value.length)
}

function replaceAll() {
  const flags = caseSensitive.value ? 'g' : 'gi'
  const re = new RegExp(search.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags)
  lines.value = lines.value.map((line) => line.replace(re, () => replace.value))
}

/** The panel's own keys only work inside it; opening it is up to the page. */
async function openPanel() {
  open.value = true
  await nextTick()
  panel.value?.focus()
}

function onKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
    event.preventDefault()
    void openPanel()
  }
}
</script>

<template>
  <div class="find-demo" @keydown="onKeydown">
    <DouFindReplace
      v-if="open"
      ref="panel"
      v-model:search="search"
      v-model:replace="replace"
      v-model:replacing="replacing"
      :count="matches.length"
      :current="index"
      @next="step(1)"
      @previous="step(-1)"
      @replace-one="replaceOne"
      @replace-all="replaceAll"
      @close="open = false"
    >
      <template #options>
        <DouTooltip content="区分大小写">
          <DouToggle v-model:pressed="caseSensitive" size="sm" aria-label="区分大小写">
            <LetterCaseIcon />
          </DouToggle>
        </DouTooltip>
      </template>
    </DouFindReplace>
    <DouButton v-else size="sm" @click="openPanel">
      <template #leading><SearchIcon /></template>
      查找
    </DouButton>
    <ul class="find-demo__list" tabindex="0" aria-label="待办">
      <li v-for="(line, i) in parts" :key="i">
        <template v-for="(part, j) in line" :key="j">
          <mark v-if="part.match" :class="['find-demo__match', { 'is-current': part.current }]">{{
            part.text
          }}</mark>
          <template v-else>{{ part.text }}</template>
        </template>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.find-demo {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-start;
  container-type: inline-size;
  width: 100%;
}
.find-demo__list {
  margin: 0;
  padding-left: 20px;
  color: var(--dou-color-text);
  font-size: var(--dou-font-size-md);
  line-height: 1.8;
  border-radius: 4px;
}
.find-demo__match {
  border-radius: 2px;
  background-color: color-mix(in oklab, var(--dou-color-warning) 22%, transparent);
  color: inherit;
}
.find-demo__match.is-current {
  box-shadow: 0 0 0 1px color-mix(in oklab, var(--dou-color-warning-text) 80%, transparent);
}
</style>
