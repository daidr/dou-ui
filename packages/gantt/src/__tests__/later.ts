/**
 * Waits until the clock has moved on by a millisecond. Vue skips a handler
 * that was attached later than the event first reached another of its
 * handlers, judged by `Date.now()`; the timeline catches presses in the
 * capture phase, so a press dispatched in the same millisecond as the render
 * that drew its target never reaches the target's own handler. On a fast
 * machine a test can mount and press within one millisecond; a person can't.
 */
export function later() {
  const start = Date.now()
  while (Date.now() === start) {
    // spin: the handlers run synchronously, so the wait has to be too
  }
}
