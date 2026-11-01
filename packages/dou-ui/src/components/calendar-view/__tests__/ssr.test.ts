// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { computed, createSSRApp, h, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { DouCalendarView, expandRepeats, visibleRange } from '../../../index'
import type { CalendarRange, RepeatingEvent } from '../../../index'

describe('DouCalendarView on the server', () => {
  it('renders repeating events when range starts from visibleRange', async () => {
    const app = createSSRApp({
      setup() {
        const series = ref<RepeatingEvent[]>([
          { id: 's', title: '站会', start: '2026-11-02 09:30', repeat: { every: 'day' } },
        ])
        const range = ref<CalendarRange>(visibleRange('2026-11-01', 'agenda'))
        const events = computed(() =>
          expandRepeats(series.value, range.value.start, range.value.end),
        )
        return () =>
          h(DouCalendarView, {
            view: 'agenda',
            month: '2026-11',
            events: events.value,
            onRangeChange: (next: CalendarRange) => (range.value = next),
          })
      },
    })
    const html = await renderToString(app)
    expect(html).toContain('站会')
    expect(html).not.toContain('agenda-empty')
  })
})
