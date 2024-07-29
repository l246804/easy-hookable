import type { AnyFn, AssertKeyOf, Promisify, ReplaceNever } from '@rhao/types-base'
import { flatHooks, noop } from './utils'
import type { HookTaskCaller } from './callers'
import { parallelTaskCaller, serialTaskCaller, syncTaskCaller } from './callers'
import type { DeprecatedHook, HookCallback, HookKeys, NestedHooks } from './types'
import type { HookContext } from './Context'
import { ContextHelper } from './ContextHelper'
import { ExecutionStage } from './Context'

export type InferCallback<HT, HN extends HookKeys<HT>> = HT[AssertKeyOf<
  HN,
  HT
>] extends HookCallback
  ? // `never` 是所有类型的子类，所以需要避免 `HT[HN]` 为 `never`
  ReplaceNever<HT[AssertKeyOf<HN, HT>], AnyFn>
  : AnyFn
export type InferCallbackParams<HT, HN extends HookKeys<HT>> = Parameters<InferCallback<HT, HN>>
export type InferCallbackReturn<HT, HN extends HookKeys<HT>> = ReturnType<InferCallback<HT, HN>>

export class Hookable<
  HooksT extends Record<string, any> = Record<string, HookCallback>,
  HookNameT extends HookKeys<HooksT> = HookKeys<HooksT>,
> {
  private _hooks: Map<string, HookCallback[]>
  private _before?: HookCallback[]
  private _after?: HookCallback[]
  private _deprecatedHooks: Record<string, DeprecatedHook<HooksT>>
  private _deprecatedMessages?: Set<string>

  constructor() {
    this._hooks = new Map()
    this._before = undefined
    this._after = undefined
    this._deprecatedMessages = undefined
    this._deprecatedHooks = {}

    this.removeHooks = this.removeHooks.bind(this)
  }

  hook = <NameT extends HookNameT>(
    name: NameT,
    fn: InferCallback<HooksT, NameT>,
    options: { allowDeprecated?: boolean } = {},
  ) => {
    if (!name || typeof fn !== 'function') {
      return noop
    }

    const originalName = name
    let dep: DeprecatedHook<HooksT> | undefined
    while (this._deprecatedHooks[name]) {
      dep = this._deprecatedHooks[name]
      name = dep.to as NameT
    }
    if (dep && !options.allowDeprecated) {
      let message = dep.message
      if (!message) {
        message = `${originalName} hook has been deprecated${
          dep.to ? `, please use ${dep.to}` : ''
        }`
      }
      if (!this._deprecatedMessages) {
        this._deprecatedMessages = new Set()
      }
      if (!this._deprecatedMessages.has(message)) {
        console.warn(message)
        this._deprecatedMessages.add(message)
      }
    }

    // Add name to hook for better debugging experience
    if (!fn.name) {
      try {
        Object.defineProperty(fn, 'name', {
          get: () => `_${name.replace(/\W+/g, '_')}_hook_cb`,
          configurable: true,
        })
      }
      catch {}
    }

    if (!this._hooks.has(name)) {
      this._hooks.set(name, [])
    }

    const hooks = this._hooks.get(name)!
    hooks.push(fn)

    return () => {
      if (fn) {
        this.removeHook(name, fn)
        // @ts-expect-error 释放内存
        fn = undefined
      }
    }
  }

  hookOnce = <NameT extends HookNameT>(name: NameT, fn: InferCallback<HooksT, NameT>) => {
    let _un: ReturnType<typeof this.hook> | undefined
    let _fn = (...args: any[]) => {
      if (_un) {
        _un()
      }
      _un = undefined
      // @ts-expect-error 释放内存
      _fn = undefined
      return fn(...args)
    }
    _un = this.hook(name, _fn as typeof fn)
    return _un
  }

  removeHook = <NameT extends HookNameT>(name: NameT, fn: InferCallback<HooksT, NameT>) => {
    const hooks = this._hooks.get(name)
    if (hooks) {
      const index = hooks.indexOf(fn)
      if (index !== -1) {
        hooks.splice(index, 1)
      }

      if (hooks.length === 0) {
        this._hooks.delete(name)
      }
    }
  }

  deprecateHook = <NameT extends HookNameT>(
    name: NameT,
    deprecated: HookKeys<HooksT> | DeprecatedHook<HooksT>,
  ) => {
    this._deprecatedHooks[name] = typeof deprecated === 'string' ? { to: deprecated } : deprecated
    const hooks = this._hooks.get(name) || []
    this._hooks.delete(name)
    for (const hook of hooks) {
      this.hook(name, hook as any)
    }
  }

  deprecateHooks = (deprecatedHooks: Partial<Record<HookNameT, DeprecatedHook<HooksT>>>) => {
    Object.assign(this._deprecatedHooks, deprecatedHooks)
    for (const name in deprecatedHooks) {
      this.deprecateHook(name, deprecatedHooks[name] as DeprecatedHook<HooksT>)
    }
  }

  /**
   * 添加 hooks
   */
  addHooks = (configHooks: NestedHooks<HooksT>) => {
    const hooks = flatHooks<HooksT>(configHooks)
    let removeFns = Object.keys(hooks).map((key) => this.hook(key as HookNameT, hooks[key]))

    return () => {
      for (const rm of removeFns) {
        rm()
      }
      removeFns = []
    }
  }

  removeHooks<NameT extends HookNameT>(name: NameT | NameT[]): void
  removeHooks(configHooks: NestedHooks<HooksT>): void
  removeHooks(nameOrConfigHooks: any) {
    if (typeof nameOrConfigHooks === 'string') {
      nameOrConfigHooks = [nameOrConfigHooks]
    }
    if (Array.isArray(nameOrConfigHooks)) {
      nameOrConfigHooks.forEach((name) => this._hooks.delete(name))
      return
    }

    const hooks = flatHooks<HooksT>(nameOrConfigHooks)
    for (const key in hooks) {
      this.removeHook(key as any, hooks[key])
    }
  }

  removeAllHooks = () => {
    this._hooks = new Map()
  }

  /**
   * 同步执行 hooks，并返回最终结果
   */
  callHookSync = <NameT extends HookNameT>(
    name: NameT,
    ...args: InferCallbackParams<HooksT, NameT>
  ) => {
    return this.callHookWith(syncTaskCaller, name, ...args) as InferCallbackReturn<HooksT, NameT>
  }

  /**
   * 异步串行执行 hooks，并返回最终结果
   */
  callHook = <NameT extends HookNameT>(
    name: NameT,
    ...args: InferCallbackParams<HooksT, NameT>
  ) => {
    return this.callHookWith(serialTaskCaller, name, ...args) as Promisify<
      InferCallbackReturn<HooksT, NameT>
    >
  }

  /**
   * 异步并行执行 hooks，并返回结果列表
   */
  callHookParallel = <NameT extends HookNameT>(
    name: NameT,
    ...args: InferCallbackParams<HooksT, NameT>
  ) => {
    return this.callHookWith(parallelTaskCaller, name, ...args) as Promisify<
      InferCallbackReturn<HooksT, NameT>[]
    >
  }

  /**
   * 根据指定 Caller 执行 hooks
   */
  callHookWith = <
    NameT extends HookNameT,
    Caller extends HookTaskCaller<NameT, InferCallbackParams<HooksT, NameT>>,
  >(
    caller: Caller,
    name: NameT,
    ...args: InferCallbackParams<HooksT, NameT>
  ): ReturnType<Caller> => {
    let hooks = this._hooks.get(name) || []

    // init ctx
    let ctx: HookContext = ContextHelper.create(name, args, hooks.length)
    ContextHelper.set(ctx)

    // run before hooks
    callEachWith(ExecutionStage.before, this._before)

    // run hooks
    ContextHelper.updateStage(ctx, ExecutionStage.hook)
    const result = caller(
      name,
      hooks.map((h, i) => ContextHelper.with(h, ctx, i)),
      args,
    )

    // run after hooks
    // 处理返回值为 Promise 的情况
    if (result instanceof Promise) {
      return result.finally(() => callEachWith(ExecutionStage.after, this._after)) as any
    }
    callEachWith(ExecutionStage.after, this._after)

    return result

    function callEachWith(stage: ExecutionStage, callbacks?: AnyFn[]) {
      if (callbacks) {
        ContextHelper.updateStage(ctx, stage)

        const len = callbacks.length
        for (let i = 0; i < len; i++) {
          ContextHelper.updateCurrentIndex(ctx, i)
          callbacks[i](ctx)
        }
      }

      if (stage === ExecutionStage.after) {
        freeMem()
      }
    }

    function freeMem() {
      Promise.resolve().finally(() => {
        // @ts-expect-error 释放内存
        caller = null
        // @ts-expect-error 释放内存
        ctx = null
        // @ts-expect-error 释放内存
        hooks = null
      })
    }
  }

  beforeEach = (fn: (ctx: HookContext<HooksT[HookNameT]>) => void) => {
    this._before = this._before || []
    this._before.push(fn)
    return () => {
      if (this._before) {
        const index = this._before.indexOf(fn)
        if (index !== -1) {
          this._before.splice(index, 1)
        }
      }
    }
  }

  afterEach = (fn: (ctx: HookContext<HooksT[HookNameT]>) => void) => {
    this._after = this._after || []
    this._after.push(fn)
    return () => {
      if (this._after) {
        const index = this._after.indexOf(fn)
        if (index !== -1) {
          this._after.splice(index, 1)
        }
      }
    }
  }

  /**
   * 获取 Hook 执行上下文
   *
   * ***注意：仅支持在 Hook 内顶级作用域同步获取！***
   *
   * @param hookName Hook 名称，用于获取指定 hook 的类型提示，推荐传入
   *
   * @example
   * ```ts
   * hooks.hook('test', () => {
   *   const ctx = hooks.getContext('test')!
   *   // => HookContext { ... }
   * })
   * ```
   */
  // @ts-expect-error hookName 用于智能感知
  // eslint-disable-next-line unused-imports/no-unused-vars
  getContext = <NameT extends HookNameT>(hookName?: NameT) => {
    return ContextHelper.get<HooksT, NameT>()
  }
}

export function createHooks<T extends Record<string, any>>(): Hookable<T> {
  return new Hookable<T>()
}
