const pad = (n: number) => String(n).padStart(2, '0')

/** A date `offset` days from today, as `YYYY-MM-DD`, so the demos always sit around today. */
export function day(offset: number) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Like `day`, counting working days (Monday to Friday) from the first one on or after today. */
export function workday(offset: number) {
  const date = new Date()
  while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() + 1)
  for (let left = offset; left > 0;) {
    date.setDate(date.getDate() + 1)
    if (date.getDay() !== 0 && date.getDay() !== 6) left--
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
