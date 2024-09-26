import type { AnyFn } from '@rhao/types-base'
import type { HookContext } from './Context'
import type { HookKeys } from './types'
import { ExecutionStage } from './Context'

let currentContext: HookContext | null = null

export class ContextHelper {
  static create = (name: string, args: any[], length: number) => {
    return {
      name,
      args,
      length,
      currentIndex: -1,
      stage: ExecutionStage.init,
    } as HookContext
  }

  static get = <HT extends Record<string, any>, HN extends HookKeys<HT>>() => {
    return currentContext as HookContext<HT[HN]> | null
  }

  static set = (ctx: HookContext) => {
    currentContext = ctx
    return ctx
  }

  static drop = () => {
    currentContext = null
  }

  static with = <T extends AnyFn>(fn: T, ctx: HookContext, index: number) => {
    let _fn = (...args: any[]) => {
      // @ts-expect-error 释放内存
      _fn = null

      try {
        this.set(ctx)
        this.updateCurrentIndex(ctx, index)

        const result = fn(...args)
        if (result instanceof Promise) {
          result.then((value) => {
            ctx.returned = value
          })
        }
        else {
          ctx.returned = result
        }

        return result
      }
      finally {
        this.drop()
      }
    }
    return _fn as T
  }

  static updateStage = (ctx: HookContext, stage: ExecutionStage) => {
    Object.assign(ctx, { stage })
  }

  static updateCurrentIndex = (ctx: HookContext, index: number) => {
    Object.assign(ctx, {
      currentIndex: index,
      isFirst: index === 0,
      isEnd: index === ctx.length - 1,
    })
  }
}
