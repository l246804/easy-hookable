import { resolve } from 'node:path'
import type { ExternalOption, OutputOptions } from 'rollup'
import type { UserConfig } from 'vite'
import { defineConfig } from 'vite'
import Dts from 'vite-plugin-dts'
import pkg from './package.json'

// 输出格式后缀
const esmExt = '.js'
const cjsExt = '.cjs'

// 代码压缩
const minify = false
// 代码树摇
const treeshake = true

// 输出目录
const outDir = resolve(__dirname, 'dist')

// 入口目录
const entryDir = resolve(__dirname, 'src')
const entryFile = 'src/index'

// 生成外部依赖配置
function genExternals() {
  const { peerDependencies = {}, dependencies = {} } = pkg as any
  return [
    /^node(:.+)?$/,
    ...new Set([...Object.keys(peerDependencies), ...Object.keys(dependencies)]),
  ].map((p) => p instanceof RegExp ? p : new RegExp(`^${p}$|^${p}/.+`)) as ExternalOption
}

// 生成模块输出配置
function genOutput(format: 'cjs' | 'esm') {
  return {
    // 输出的代码格式
    format,
    // 是否保留源码文件结构
    preserveModules: true,
    // 源码根目录
    preserveModulesRoot: entryDir,
    // 入口文件名
    entryFileNames: (info) =>
      `${/node_modules/.test(info.name) ? info.name.split('node_modules/').at(-1)! : '[name]'}${
        format === 'esm' ? esmExt : cjsExt
      }`,
    // 导出模式
    exports: 'named',
  } as OutputOptions
}

// 生成 UMD 输出配置
function genUMDOutput() {
  const pkgName = pkg.name.slice(pkg.name.lastIndexOf('/') + 1)
  const name = pkgName
    .replace(/\.|_/g, '-')
    .replace(/-(?=\d)/g, '')
    .replace(/^[A-Z]|(?<=\d)[A-Z]/gi, (m) => m.toUpperCase())
    .replace(/-[A-Z]/gi, (m) => m[1].toUpperCase())

  return {
    // 输出的代码格式
    format: 'umd',
    // 暴露模块名
    name,
    // 外部依赖引用
    globals: {
      // eg: 'lodash': '_'
    },
    // 入口文件名
    entryFileNames: `${pkgName.replace(/\.js$/, '')}.min.js`,
  } as OutputOptions
}

export default defineConfig(() => {
  return {
    build: {
      outDir,
      minify,
      sourcemap: true,
      lib: {
        entry: entryFile,
      },
      rollupOptions: {
        treeshake,
        external: genExternals(),
        output: [genOutput('esm'), genOutput('cjs'), genUMDOutput()],
      },
    },
    resolve: {
      alias: {
        '@': entryDir,
      },
    },
    plugins: [
      Dts({ include: [entryDir] }),
    ],
  } as UserConfig
})
