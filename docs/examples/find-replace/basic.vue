<script setup lang="ts">
import { LetterCaseIcon } from '@dou-ui/icons'
import { computed, ref } from 'vue'

const lines = ref([
  '周一上午 9:30 在上海办公室开周会',
  '周三下午和设计组过一遍新版首页',
  '周五前把上海站的活动页上线',
  '下周一上午整理本周的会议纪要',
])
const search = ref('上海')
const replace = ref('')
const replacing = ref(false)
const caseSensitive = ref(false)
const current = ref(0)

const fold = (text: string) => (caseSensitive.value ? text : text.toLowerCase())
/** Each match as [line, offset], in order. */
const matches = computed(() => {
  const out: [number, number][] = []
  const wanted = fold(search.value)
  if (!wanted) return out
  lines.value.forEach((line, i) => {
    const text = fold(line)
    for (let at = text.indexOf(wanted); at >= 0; at = text.indexOf(wanted, at + wanted.length))
      out.push([i, at])
  })
  return out
})
const index = computed(() => (matches.value.length ? current.value % matches.value.length : -1))

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
</script>

<template>
  <div class="find-demo">
    <DouFindReplace
      v-model:search="search"
      v-model:replace="replace"
      v-model:replacing="replacing"
      :count="matches.length"
      :current="index"
      @next="step(1)"
      @previous="step(-1)"
      @replace="replaceOne"
      @replace-all="replaceAll"
      @close="search = ''"
    >
      <template #options>
        <DouTooltip content="区分大小写">
          <DouToggle v-model:pressed="caseSensitive" size="sm" aria-label="区分大小写">
            <LetterCaseIcon />
          </DouToggle>
        </DouTooltip>
      </template>
    </DouFindReplace>
    <ul class="find-demo__list">
      <li v-for="(line, i) in lines" :key="i">
        <DouHighlight :text="line" :keywords="search" :case-sensitive="caseSensitive" />
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
}
</style>
