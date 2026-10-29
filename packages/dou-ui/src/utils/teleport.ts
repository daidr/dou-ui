import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { useGlobalConfig } from '../components/config-provider/use-config'

export type TeleportTarget = string | HTMLElement | false

/**
 * Where a floating layer renders: its own `teleport` prop, else the
 * configured default, else `<body>`. `false` keeps it in place.
 */
export function useTeleport(
  own: () => TeleportTarget | undefined,
): ComputedRef<{ to: string | HTMLElement; disabled: boolean }> {
  const config = useGlobalConfig()
  return computed(() => {
    const target = own() ?? config.value.teleport
    return { to: target || 'body', disabled: target === false }
  })
}
