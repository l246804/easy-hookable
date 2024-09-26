import type { AnyFn } from '@rhao/types-base'
import type { NestedHooks } from './types'
import { CALL_STRATEGY, type CallStrategy } from './callers'

/**
 * 扁平化嵌套的 hooks
 * @param configHooks 嵌套的 hooks
 * @param hooks 扁平化后的 hooks
 * @param parentName 父级名称
 *
 * @example
 * ```ts
 * flatHooks({
 *   a: {
 *     b: {
 *       c: () => {}
 *     },
 *     e: () => {}
 *   }
 * })
 * // => { 'a:b:c': () => {}, 'a:e': () => {} }
 * ```
 */
export function flatHooks<T>(configHooks: NestedHooks<T>, hooks: T = {} as T, parentName?: string) {
  for (const key in configHooks) {
    const subHook: T = configHooks[key]
    const name = parentName ? `${parentName}:${key}` : key
    if (typeof subHook === 'object' && subHook != null) {
      flatHooks(subHook, hooks, name)
    }
    else if (typeof subHook === 'function') {
      hooks[name] = subHook
    }
  }
  return hooks
}

/**
 * 合并 hooks
 * @param hooks hooks 配置集合
 * @param strategy 执行策略
 *
 * @example
 * ```ts
 * mergeHooks(
 *   [{ a: () => console.log(1) }, { a: () => console.log(2) }],
 *   CallStrategy.Sync
 * )
 * // => { a: () => {...} }
 * ```
 */
export function mergeHooks<T>(hooks: NestedHooks<T>[], strategy: CallStrategy) {
  const finalHooks = {} as any

  for (const hook of hooks) {
    const hooks = flatHooks(hook)
    for (const key in hooks) {
      if (finalHooks[key]) {
        finalHooks[key].push(hooks[key])
      }
      else {
        finalHooks[key] = [hooks[key]]
      }
    }
  }

  for (const key in finalHooks) {
    if (finalHooks[key].length > 1) {
      const array = finalHooks[key]
      finalHooks[key] = CALL_STRATEGY[strategy](array)
    }
    else {
      finalHooks[key] = finalHooks[key][0]
    }
  }

  return finalHooks as T
}

const defaultTask = { run: (fn: AnyFn) => fn() }
const _createTask: typeof console.createTask = () => defaultTask
export const createTask
  = typeof console.createTask !== 'undefined' ? console.createTask : _createTask

export function callEachWith(callbacks: AnyFn[], e?: any) {
  for (const callback of callbacks) {
    callback(e)
  }
}

export function noop() {}
