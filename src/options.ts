import { findConfig } from './findConfig'
import type { CommonOptions } from 'esbuild'

type EsbuildCompilerOptions = NonNullable<
  Exclude<CommonOptions['tsconfigRaw'], string | undefined>['compilerOptions']
>

export const getOptions = (cwd: string): EsbuildCompilerOptions => {
  const { data, path } = findConfig(['tsconfig.json', 'jsconfig.json'], cwd)

  if (path && data) {
    return data.compilerOptions ?? {}
  }

  return {}
}

export const inferPackageFormat = (
  cwd: string,
  filename: string,
): 'esm' | 'cjs' => {
  if (filename.endsWith('.mjs')) {
    return 'esm'
  }
  if (filename.endsWith('.cjs')) {
    return 'cjs'
  }
  const { data } = findConfig(['package.json'], cwd)
  return data?.type === 'module' && /\.m?js$/.test(filename) ? 'esm' : 'cjs'
}
