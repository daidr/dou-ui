<script setup lang="ts">
import { useNamespace } from 'dou-ui'
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon } from '@dou-ui/icons'
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
import { visibleViewport } from './view/viewport'
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

function fire(key: CodeKey) {
  run(key.command ?? typeText(key.text ?? key.label))
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

/**
 * The stick at the end of the bar moves the cursor. Pressed, it grows into a
 * round pad over the bar, the way a number field's keys do, so a thumb has
 * room to lean it: past its rest it steps the way it leans, and the further,
 * the faster. Lifted, it shrinks back.
 */
const STICK_REACH = 26
const STICK_REST = 8
/** The pad's radius once grown, and the room it keeps from the window's edge. */
const PAD_RADIUS = 52
const PAD_MARGIN = 4
const MOVES = {
  left: cursorCharLeft,
  right: cursorCharRight,
  up: cursorLineUp,
  down: cursorLineDown,
} as const
type Lean = keyof typeof MOVES
const thumb = ref({ x: 0, y: 0 })
const held = ref(false)
/** How far the pad moves in from the window's edge to fit, in px. */
const padShift = ref({ x: 0, y: 0 })
let stick: {
  pointer: number
  x: number
  y: number
  timer: number
  lean: Lean | null
  far: number
} | null = null

function leanOf(x: number, y: number): Lean | null {
  if (Math.hypot(x, y) < STICK_REST) return null
  return Math.abs(x) >= Math.abs(y) ? (x < 0 ? 'left' : 'right') : y < 0 ? 'up' : 'down'
}

/** Steps while the stick leans: slowly near its rest, fast pushed all the way and beyond. */
function stepStick() {
  if (!stick?.lean) return
  run(MOVES[stick.lean])
  stick.timer = window.setTimeout(stepStick, 280 - stick.far * 240)
}

function onStickDown(event: PointerEvent) {
  if (event.button !== 0) return
  event.preventDefault()
  endStick()
  const el = event.currentTarget as HTMLElement
  el.setPointerCapture?.(event.pointerId)
  // Grown from its middle, the pad moves in as it grows wherever it would reach past the window's edge.
  const box = el.getBoundingClientRect()
  const cx = box.left + box.width / 2
  const cy = box.top + box.height / 2
  const room = PAD_RADIUS + PAD_MARGIN
  const view = visibleViewport()
  padShift.value = {
    x: Math.min(0, view.left + view.width - room - cx) + Math.max(0, view.left + room - cx),
    y: Math.min(0, view.top + view.height - room - cy) + Math.max(0, view.top + room - cy),
  }
  held.value = true
  stick = {
    pointer: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    timer: 0,
    lean: null,
    far: 0,
  }
}

function onStickMove(event: PointerEvent) {
  if (!stick || event.pointerId !== stick.pointer) return
  const x = event.clientX - stick.x
  const y = event.clientY - stick.y
  const d = Math.hypot(x, y)
  const k = d > STICK_REACH ? STICK_REACH / d : 1
  thumb.value = { x: x * k, y: y * k }
  stick.far = Math.min(1, Math.max(0, d - STICK_REST) / (STICK_REACH * 1.5 - STICK_REST))
  const lean = leanOf(x, y)
  if (lean === stick.lean) return
  clearTimeout(stick.timer)
  stick.lean = lean
  // A new way steps at once, then goes on.
  stepStick()
}

function endStick() {
  if (stick) clearTimeout(stick.timer)
  stick = null
  held.value = false
  thumb.value = { x: 0, y: 0 }
}

/** With the stick focused, the arrow keys move the cursor. */
function onStickKey(event: KeyboardEvent) {
  const lean = (
    { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' } as const
  )[event.key as 'ArrowLeft']
  if (!lean) return
  event.preventDefault()
  // From the keyboard, the focus stays on the stick, for the next arrow.
  run(MOVES[lean], false)
}

function run(command: CodeCommand, focus = true) {
  const { editor } = props
  if (!editor) return
  editor.run(command)
  // A key pressed while the editor is away (beside it on a desktop) brings the cursor back into view.
  if (focus) editor.focus?.()
}

onBeforeUnmount(() => {
  stop()
  endStick()
})
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
        type="button"
        :class="[ns.e('stick'), ns.is('held', held)]"
        :aria-label="messages.moveCursor"
        :title="messages.moveCursor"
        aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
        @pointerdown="onStickDown"
        @pointermove="onStickMove"
        @pointerup="endStick"
        @pointercancel="endStick"
        @lostpointercapture="endStick"
        @keydown="onStickKey"
      >
        <span
          :class="ns.e('pad')"
          :style="held ? { translate: `${padShift.x}px ${padShift.y}px` } : undefined"
          aria-hidden="true"
        >
          <ChevronUpIcon :class="[ns.e('way'), ns.is('up', true)]" />
          <ChevronRightIcon :class="[ns.e('way'), ns.is('right', true)]" />
          <ChevronDownIcon :class="[ns.e('way'), ns.is('down', true)]" />
          <ChevronLeftIcon :class="[ns.e('way'), ns.is('left', true)]" />
          <span
            :class="ns.e('thumb')"
            :style="{ transform: `translate(${thumb.x}px, ${thumb.y}px)` }"
          />
        </span>
      </button>
    </div>
  </div>
</template>
