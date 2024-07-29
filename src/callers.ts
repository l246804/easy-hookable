import type { AnyFn } from '@rhao/types-base'
import type { HookCallback, HookKeys } from './types'
import { createTask } from './utils'

export type HookTaskCaller<HN extends HookKeys<any> = string, Args extends any[] = unknown[]> = (
  name: HN,
  hooks: HookCallback[],
  args: Args,
) => any

const P = Promise.resolve()

/**
 * 执行策略
 */
export enum CallStrategy {
  /** 同步执行任务，并返回最终结果 */
  Sync,

  /** 异步串行执行任务，并返回最终结果 */
  AsyncSerial,

  /** 异步并行执行任务，并返回所有任务结果 */
  AsyncParallel,
}

/**
 * 执行策略实现
 */
export const CALL_STRATEGY: Record<CallStrategy, (tasks: AnyFn[]) => AnyFn> = {
  [CallStrategy.Sync](tasks) {
    return (...args) => tasks.reduce((_, task) => task(...args), undefined)
  },

  [CallStrategy.AsyncSerial](tasks) {
    return (...args) => tasks.reduce((p, task) => p.then(() => task(...args)), P)
  },

  [CallStrategy.AsyncParallel](tasks) {
    return (...args) => Promise.all(tasks.map((task) => task(...args)))
  },
}

function callWithTask(fn: AnyFn, task: ReturnType<typeof createTask>) {
  return (...args) => task.run(() => fn(...args))
}

export function createCaller(strategy: CallStrategy): HookTaskCaller {
  const strategyFn = CALL_STRATEGY[strategy]
  let caller = (name: string, hooks: HookCallback[], args: any[]) => {
    // @ts-expect-error 释放内存
    caller = null

    const task = createTask(name)
    return strategyFn(hooks.map((h) => callWithTask(h, task)))(...args)
  }
  return caller
}

export const syncTaskCaller = createCaller(CallStrategy.Sync)

export const serialTaskCaller = createCaller(CallStrategy.AsyncSerial)

export const parallelTaskCaller = createCaller(CallStrategy.AsyncParallel)
