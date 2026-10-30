const pad = (n: number) => String(n).padStart(2, '0')

/** A date `offset` days from today, as `YYYY-MM-DD`, so the demos always sit around today. */
export function day(offset: number) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
