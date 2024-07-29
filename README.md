# easy-hookable

Forked from [hookable](https://www.npmjs.com/package/hookable)

更改项：
- 重命名为 `easy-hookable`.
- `removeHooks` 支持仅传递 hook 名称
- 支持 ESM、CJS、UMD 格式
- 新增执行上下文对象，并通过 `hookable.getContext` 获取
- 新增 `callHookSync` 执行方法
- 更好的类型提示
- 更好的性能表现

## 代码示例

### `callHookSync`

> 同步执行 hooks 并返回最终结果，可通过 `ctx.returned` 获取上一个 hook 的返回结果！

```ts
interface MyHooks {
  test: (val: number) => number
}

const hooks = createHooks<MyHooks>()

hooks.hook('test', (val) => {
  console.log('val1:', val)
  return val + 1
})

hooks.hook('test', (val) => {
  console.log('val2:', val)

  // 获取执行上下文，传入 hookName 用于获取指定 hook 类型感知
  const ctx = hooks.getContext('test')
  console.log('latest results:', ctx.returned)

  // 优先使用已存在的结果值
  val = ctx.returned == null ? val : ctx.returned

  return val + 1
})

hooks.callHookSync(1)
// logs:
//   val1: 1
//   val2: 1
//   latest results: 2

// results: 3
```

### `callHook`

> 异步串行执行 hooks，可通过 `ctx.returned` 获取上一个 hook 的返回结果！

```ts
interface MyHooks {
  test: (val: number) => number
}

// 线程睡眠
function sleep(ms) {
  const { promise, resolve } = Promise.withResolvers()
  setTimeout(resolver, ms)
  return promise
}

const hooks = createHooks<MyHooks>()

hooks.hook('test', async (val) => {
  console.log('val1:', val)

  // 睡眠 3s
  sleep(3000)

  return val + 1
})

hooks.hook('test', (val) => {
  console.log('val2:', val)

  // 获取执行上下文，传入 hookName 用于获取指定 hook 类型感知
  const ctx = hooks.getContext('test')
  console.log('latest results:', ctx.returned)

  // 优先使用已存在的结果值
  val = ctx.returned == null ? val : ctx.returned

  return val + 1
})

async function run() {
  await hooks.callHook(1)
}

run()
// logs:
//   val1: 1
//   val2: 1
//   latest results: 2

// results: 3
```

### `callHookParallel`

> 异步并行执行 hooks，返回所有 hook 的执行结果列表！

```ts
interface MyHooks {
  test: (val: number) => number
}

// 线程睡眠
function sleep(ms) {
  const { promise, resolve } = Promise.withResolvers()
  setTimeout(resolver, ms)
  return promise
}

const hooks = createHooks<MyHooks>()

hooks.hook('test', async (val) => {
  console.log('val1:', val)

  // 睡眠 3s
  sleep(3000)

  return val + 1
})

hooks.hook('test', (val) => {
  console.log('val2:', val)

  // 获取执行上下文，传入 hookName 用于获取指定 hook 类型感知
  const ctx = hooks.getContext('test')
  console.log('latest results:', ctx.returned)

  // 优先使用已存在的结果值
  val = ctx.returned == null ? val : ctx.returned

  return val + 1
})

async function run() {
  await hooks.callHookParallel(1)
}

run()
// logs:
//   val2: 1
//   latest results: undefined
//   val1: 1

// results: [2, 2]
```
