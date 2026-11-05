<script setup>
import { DouCodeEditor, defineCodeExtension, javascript } from '@dou-ui/code'
import { computed, h, ref } from 'vue'

const code = ref(`// 戴兜的周报脚本：汇总本周完成的任务
var tasks = loadTasks('戴兜')
var done = tasks.filter((task) => task.done)

// TODO: 下周把阿青的任务也算进来
console.log(\`本周完成 \${done.length} 项\`)
`)

// 找出 var 声明，给出“改成 let”的快速修复
const noVar = defineCodeExtension({
  name: 'no-var',
  lint(editor) {
    const text = editor.doc.toString()
    return [...text.matchAll(/\bvar\b/g)].map((match) => ({
      from: match.index,
      to: match.index + 3,
      severity: 'warning',
      message: '用 let 或 const 代替 var',
      source: 'no-var',
      actions: [
        {
          label: '改成 let',
          run: (context, problem) =>
            context.transact((tr) => tr.replace(problem.from, problem.to, 'let')),
        },
      ],
    }))
  },
})

// 把注释里的 TODO 标出来，只看可见的行
const todo = defineCodeExtension({
  name: 'todo',
  decorations(editor) {
    const out = []
    for (let n = editor.visible.from; n <= editor.visible.to; n++) {
      const line = editor.doc.line(n)
      const at = line.text.indexOf('TODO')
      if (at >= 0)
        out.push({ type: 'mark', from: line.from + at, to: line.from + at + 4, class: 'demo-todo' })
    }
    return out
  },
})

// 点击行号左侧设置断点，设了断点的行加上底色
const breakpoints = ref(new Set([3]))
const breakpoint = defineCodeExtension({
  name: 'breakpoint',
  gutters: [
    {
      name: 'breakpoint',
      // 断点常驻；其余的行上放一个悬停才出现的空心点，键盘也能加断点
      markers: () =>
        [...breakpoints.value].map((line) => ({
          line,
          class: 'demo-breakpoint',
          title: `移除第 ${line} 行的断点`,
        })),
      hoverMarker: { class: 'demo-breakpoint is-ghost', title: (line) => `在第 ${line} 行加断点` },
      onPress(line) {
        const next = new Set(breakpoints.value)
        if (next.has(line)) next.delete(line)
        else next.add(line)
        breakpoints.value = next
      },
    },
  ],
  decorations: () =>
    [...breakpoints.value].map((line) => ({ type: 'line', line, class: 'demo-breakpoint-line' })),
})

// 底部的状态栏：问题数和断点数
const editor = ref()
const status = defineCodeExtension({
  name: 'status',
  panels: (context) => [
    {
      name: 'status',
      render: () =>
        h('div', { class: 'demo-status' }, [
          `${context.diagnostics.length} 个问题`,
          ' · ',
          `${breakpoints.value.size} 个断点`,
        ]),
    },
  ],
})

const extensions = computed(() => [noVar, todo, breakpoint, status])
</script>

<template>
  <DouCodeEditor
    ref="editor"
    v-model="code"
    :language="javascript"
    :extensions="extensions"
    aria-label="扩展示例"
  />
</template>

<style scoped>
:deep(.demo-todo) {
  border-radius: 2px;
  background-color: color-mix(in oklab, var(--dou-color-warning) 20%, transparent);
}
:deep(.demo-breakpoint)::before {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--dou-color-danger);
  content: '';
}
:deep(.demo-breakpoint.is-ghost)::before {
  border: 1px solid var(--dou-color-danger);
  background-color: transparent;
}
:deep(.demo-breakpoint-line) {
  background-color: color-mix(in oklab, var(--dou-color-danger) 8%, transparent);
}
:deep(.demo-status) {
  padding: 4px 12px;
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-sm);
}
</style>
