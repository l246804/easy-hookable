import type { AnyFn, ReplaceNever } from '@rhao/types-base'

export enum ExecutionStage {
  init,
  before,
  hook,
  after,
}

export interface HookContext<HC extends AnyFn = AnyFn> {
  /**
   * Hook 名称
   */
  name: string
  /**
   * 执行参数列表
   */
  args: ReplaceNever<Parameters<HC>, unknown[]>
  /**
   * 最新的返回结果，推荐在执行期间使用 `return value` 修改
   * @readonly
   */
  returned?: ReturnType<HC>
  /**
   * 当前的执行阶段
   */
  readonly stage: ExecutionStage
  /**
   * 位于当前执行队列的索引
   */
  readonly currentIndex: number
  /**
   * 当前执行队列总数
   */
  readonly length: number
  /**
   * 是否为当前执行队列首个 `hook`
   */
  readonly isFirst: boolean
  /**
   * 是否为当前执行队列末尾 `hook`
   */
  readonly isEnd: boolean
}
