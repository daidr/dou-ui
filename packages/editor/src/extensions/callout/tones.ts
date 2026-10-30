import { AlertOctagonIcon, AlertTriangleIcon, InfoIcon, LightbulbIcon } from '@dou-ui/icons'

/** The callout's tones and their icons. */
export const calloutTones = {
  info: InfoIcon,
  tip: LightbulbIcon,
  warning: AlertTriangleIcon,
  danger: AlertOctagonIcon,
}

export type CalloutTone = keyof typeof calloutTones
