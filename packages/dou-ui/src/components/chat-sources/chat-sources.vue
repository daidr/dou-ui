<script setup lang="ts">
import { GlobeIcon } from '@dou-ui/icons'
import { computed, ref } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { checkedUrl, opensNewTab } from '../../utils/safe-url'
import { useLocale } from '../config-provider/use-config'
import { sourceSite } from './chat-sources'
import type { ChatSourcesProps, ChatSourcesSlots } from './chat-sources'

defineOptions({ name: 'DouChatSources' })

const props = withDefaults(defineProps<ChatSourcesProps>(), {
  items: () => [],
})
defineSlots<ChatSourcesSlots>()

const ns = useNamespace('chat-sources')
const { t } = useLocale()

const expanded = ref(false)
const visible = computed(() =>
  props.max === undefined || expanded.value ? props.items : props.items.slice(0, props.max),
)
const hidden = computed(() => props.items.length - visible.value.length)
// unsafe addresses such as `javascript:` are shown without a link
const hrefs = computed(() =>
  visible.value.map((source) => checkedUrl('DouChatSources', source.url)),
)
</script>

<template>
  <div :class="ns.b()">
    <ol :class="ns.e('list')" :aria-label="t('chat.sources')">
      <li v-for="(source, index) in visible" :key="source.key ?? index" :class="ns.e('item')">
        <component
          :is="hrefs[index] ? 'a' : 'span'"
          :class="ns.e('link')"
          :href="hrefs[index]"
          :target="hrefs[index] && opensNewTab(hrefs[index]) ? '_blank' : undefined"
          :rel="hrefs[index] && opensNewTab(hrefs[index]) ? 'noopener noreferrer' : undefined"
          :title="source.title"
        >
          <slot name="item" :source="source" :index="index">
            <span :class="ns.e('index')">{{ index + 1 }}</span>
            <img v-if="source.icon" :class="ns.e('favicon')" :src="source.icon" alt="" />
            <GlobeIcon v-else :class="ns.e('favicon')" />
            <span :class="ns.e('site')">{{ sourceSite(source) || source.title }}</span>
            <span v-if="sourceSite(source)" :class="ns.e('title')">{{ source.title }}</span>
          </slot>
        </component>
      </li>
      <li v-if="hidden > 0">
        <button type="button" :class="[ns.e('link'), ns.e('more')]" @click="expanded = true">
          +{{ hidden }}
        </button>
      </li>
    </ol>
  </div>
</template>
