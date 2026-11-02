import { computed, ref } from 'vue'
import type { GanttLink, GanttTask } from '../core/model'
import type { GanttDocument } from '../core/transaction'

/** A chart's `v-model`, with its tasks and links to read and replace on their own. */
export function planRef(tasks: GanttTask[], links: GanttLink[] = []) {
  const doc = ref<GanttDocument>({ version: 1, tasks, links })
  const part = <K extends 'tasks' | 'links'>(key: K) =>
    computed({
      get: () => doc.value[key],
      set: (value: GanttDocument[K]) => (doc.value = { ...doc.value, [key]: value }),
    })
  return { doc, tasks: part('tasks'), links: part('links') }
}

/** The props binding `doc` to a chart with `v-model`. */
export const bind = (doc: { value: GanttDocument }) => ({
  modelValue: doc.value,
  'onUpdate:modelValue': (value: GanttDocument) => (doc.value = value),
})
