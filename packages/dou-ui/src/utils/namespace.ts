export const NAMESPACE = 'dou'

const is = (state: string, active = true) => (active ? `is-${state}` : '')

/**
 * Class name helpers following `block__element--modifier`, with `is-*`
 * for runtime state.
 *
 * ```ts
 * const ns = useNamespace('button')
 * ns.b()               // 'dou-button'
 * ns.e('icon')         // 'dou-button__icon'
 * ns.m('primary')      // 'dou-button--primary'
 * ns.is('loading', on) // 'is-loading' | ''
 * ```
 */
export function useNamespace(block: string) {
  const b = () => `${NAMESPACE}-${block}`
  const e = (element: string) => `${b()}__${element}`
  const m = (modifier: string) => `${b()}--${modifier}`
  return { b, e, m, is }
}
