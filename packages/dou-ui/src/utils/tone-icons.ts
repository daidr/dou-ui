import { AlertCircleIcon, AlertTriangleIcon, CheckCircleIcon, InfoIcon } from '@dou-ui/icons'
import { h } from 'vue'
import type { VNode } from 'vue'
import type { Tone } from './types'

/** The icon that stands for each tone in alerts and toasts. */
export function toneIcon(tone: Tone): VNode {
  switch (tone) {
    case 'success':
      return h(CheckCircleIcon)
    case 'warning':
      return h(AlertTriangleIcon)
    case 'danger':
      return h(AlertCircleIcon)
    default:
      return h(InfoIcon)
  }
}
