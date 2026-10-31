<script setup lang="ts">
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon } from '@dou-ui/icons'
import { useNamespace } from 'dou-ui'
import { computed, onBeforeUnmount, ref } from 'vue'
import {
  type CodeCommand,
  cursorCharLeft,
  cursorCharRight,
  cursorLineDown,
  cursorLineUp,
  typeText,
} from './core/commands'
import { defaultCodeKeys, keyName } from './code-keys'
import { useCodeMessages } from './locale'
import type { CodeKey, CodeKeysProps } from './types'

defineOptions({ name: 'DouCodeKeys' })

const props = withDefaults(defineProps<CodeKeysProps>(), {
  editor: undefined,
  keys: undefined,
  messages: undefined,
})

const ns = useNamespace('code-keys')
const messages = useCodeMessages(() => props.messages)

/** Keys that scroll; a string is a key that types itself. */
const symbolKeys = computed<CodeKey[]>(() =>
  (props.keys ?? defaultCodeKeys).map((key) => (typeof key === 'string' ? { label: key } : key)),
)

/** Moving the cursor, always at hand at the end of the bar. */
const arrowKeys = computed<CodeKey[]>(() => {
  const m = messages.value
  return [
    { label: m.cursorLeft, icon: ChevronLeftIcon, command: cursorCharLeft, repeat: true },
    { label: m.cursorUp, icon: ChevronUpIcon, command: cursorLineUp, repeat: true },
    { label: m.cursorDown, icon: ChevronDownIcon, command: cursorLineDown, repeat: true },
    { label: m.cursorRight, icon: ChevronRightIcon, command: cursorCharRight, repeat: true },
  ]
})

function fire(key: CodeKey) {
  const command: CodeCommand = key.command ?? typeText(key.text ?? key.label)
  const { editor } = props
  if (!editor) return
  editor.run(command)
  // A key pressed while the editor is away (beside it on a desktop) brings the cursor back into view.
  editor.focus?.()
}

/** How far a finger may slide on a key before it counts as scrolling the bar. */
const SLOP = 8
const pressed = ref<string | null>(null)
let press: {
  id: string
  key: CodeKey
  pointer: number
  x: number
  y: number
  timer: number
  /** It already repeated, so lifting the finger types nothing more. */
  fired: boolean
} | null = null

function stop() {
  if (press) {
    clearTimeout(press.timer)
    clearInterval(press.timer)
  }
  press = null
  pressed.value = null
}

function onPointerDown(event: PointerEvent, key: CodeKey, id: string) {
  if (event.button !== 0) return
  stop()
  pressed.value = id
  press = {
    id,
    key,
    pointer: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    timer: 0,
    fired: false,
  }
  if (!key.repeat) return
  // Held, a key goes on: after a pause, then quickly.
  press.timer = window.setTimeout(() => {
    if (!press) return
    press.fired = true
    fire(key)
    press.timer = window.setInterval(() => fire(key), 60)
  }, 400)
}

function onPointerMove(event: PointerEvent) {
  if (!press || event.pointerId !== press.pointer || press.fired) return
  if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > SLOP) stop()
}

function onPointerUp(event: PointerEvent) {
  if (!press || event.pointerId !== press.pointer) return
  const { key, fired } = press
  stop()
  if (!fired) fire(key)
}

// A key pressed from the keyboard clicks with no pointer behind it.
function onClick(event: MouseEvent, key: CodeKey) {
  if (event.detail === 0) fire(key)
}

onBeforeUnmount(stop)
</script>

<template>
  <div
    :class="ns.b()"
    role="toolbar"
    :aria-label="messages.keys"
    @mousedown.prevent
    @contextmenu.prevent
  >
    <div :class="ns.e('scroll')">
      <button
        v-for="(key, i) in symbolKeys"
        :key="`s${i}`"
        type="button"
        :class="[ns.e('key'), ns.is('pressed', pressed === `s${i}`), ns.is('icon', !!key.icon)]"
        :aria-label="keyName(key, messages)"
        :title="key.icon ? keyName(key, messages) : undefined"
        @pointerdown="onPointerDown($event, key, `s${i}`)"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="stop"
        @pointerleave="stop"
        @click="onClick($event, key)"
      >
        <component :is="key.icon" v-if="key.icon" />
        <template v-else>{{ key.label }}</template>
      </button>
    </div>
    <div :class="ns.e('arrows')">
      <button
        v-for="(key, i) in arrowKeys"
        :key="`a${i}`"
        type="button"
        :class="[ns.e('key'), ns.is('pressed', pressed === `a${i}`), ns.is('icon', true)]"
        :aria-label="key.label"
        :title="key.label"
        @pointerdown="onPointerDown($event, key, `a${i}`)"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="stop"
        @pointerleave="stop"
        @click="onClick($event, key)"
      >
        <component :is="key.icon" />
      </button>
    </div>
  </div>
</template>
