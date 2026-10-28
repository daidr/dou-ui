/** Time values are `HH:mm` or `HH:mm:ss` strings, with no date and no time zone. */

export type TimeFormat = 'HH:mm' | 'HH:mm:ss'

export interface TimeParts {
  hour: number
  minute: number
  second: number
}

const pad = (value: number) => String(value).padStart(2, '0')

export function formatTime({ hour, minute, second }: TimeParts, format: TimeFormat): string {
  const base = `${pad(hour)}:${pad(minute)}`
  return format === 'HH:mm:ss' ? `${base}:${pad(second)}` : base
}

/** Read what was typed: `9`, `9:5`, `09:05:30`, also with a full-width colon. */
export function parseTime(text: string): TimeParts | null {
  const match = /^\s*(\d{1,2})(?:\s*[:：.]\s*(\d{1,2}))?(?:\s*[:：.]\s*(\d{1,2}))?\s*$/.exec(text)
  if (!match) return null
  const [hour, minute, second] = [match[1], match[2], match[3]].map((part) => Number(part ?? 0))
  if (hour! > 23 || minute! > 59 || second! > 59) return null
  return { hour: hour!, minute: minute!, second: second! }
}

export function now(): TimeParts {
  const date = new Date()
  return { hour: date.getHours(), minute: date.getMinutes(), second: date.getSeconds() }
}

/** Round a part down onto its step, so the value always matches a row in the panel. */
const down = (value: number, step: number) => value - (value % step)

export function snap(parts: TimeParts, steps: [number, number, number]): TimeParts {
  return {
    hour: down(parts.hour, steps[0]),
    minute: down(parts.minute, steps[1]),
    second: down(parts.second, steps[2]),
  }
}
