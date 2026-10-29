import type { LocaleMessagePath, TranslateParams } from '../config-provider/use-config'

type Translate = (path: LocaleMessagePath, params?: TranslateParams) => string

/** "Thought for 12 s", or with minutes once it runs past one. */
export function formatDuration(seconds: number, t: Translate): string {
  const total = Math.max(0, Math.round(seconds))
  if (total < 60) return t('chat.thoughtSeconds', { seconds: total })
  return t('chat.thoughtMinutes', { minutes: Math.floor(total / 60), seconds: total % 60 })
}
