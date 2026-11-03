import { vi } from 'vitest'

/**
 * Waits until the clock has moved on by a millisecond, before a test
 * dispatches an event.
 *
 * Vue skips a handler attached later than the event first reached another
 * of its handlers, judged by `Date.now()`. When a component catches the
 * event in the capture phase, an event dispatched in the same millisecond
 * as the render that drew its target never reaches the target's own
 * handler. On a fast machine a test can mount and dispatch within one
 * millisecond; a person can't.
 *
 * With fake timers the clock stands still, so it is moved on instead.
 */
export function later() {
  if (vi.isFakeTimers()) {
    vi.setSystemTime(Date.now() + 1)
    return
  }
  const start = Date.now()
  while (Date.now() === start) {
    // spin: handlers run synchronously, so the wait has to be too
  }
}
