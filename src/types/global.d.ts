import type { AnyFn } from '@rhao/types-base'

declare global {
  interface Console {
    createTask: (name: string) => { run: (fn: AnyFn) => void }
  }
}

export {}
