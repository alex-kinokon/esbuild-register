import { dirname, extname } from 'node:path'
import { transformSync, TransformOptions } from 'esbuild'
import { addHook } from 'pirates'
import fs from 'node:fs'
import { Module } from 'node:module'
import { getEsbuildOptions, getOptions, inferPackageFormat } from './options'
import { registerTsconfigPaths } from './tsconfig-paths'
import { debug } from './debug'

const IMPORT_META_URL_VARIABLE_NAME = '__esbuild_register_import_meta_url__'

function installSourceMapSupport() {
  ;(process as any).setSourceMapsEnabled(true)
}

type CompileFn = (
  code: string,
  filename: string,
  format?: 'cjs' | 'esm',
) => string

/**
 * Patch the Node CJS loader to suppress the ESM error
 * https://github.com/nodejs/node/blob/069b5df/lib/internal/modules/cjs/loader.js#L1125
 *
 * As per https://github.com/standard-things/esm/issues/868#issuecomment-594480715
 */
function patchCommonJsLoader(compile: CompileFn) {
  // @ts-expect-error
  const extensions = Module._extensions
  const jsHandler = extensions['.js']

  extensions['.js'] = function (module: any, filename: string) {
    try {
      return jsHandler.call(this, module, filename)
    } catch (error: any) {
      if (error.code !== 'ERR_REQUIRE_ESM') {
        throw error
      }

      let content = fs.readFileSync(filename, 'utf8')
      content = compile(content, filename, 'cjs')
      module._compile(content, filename)
    }
  }

  return () => {
    extensions['.js'] = jsHandler
  }
}

type LOADERS = 'js' | 'jsx' | 'ts' | 'tsx'
const FILE_LOADERS: Record<string, LOADERS> = {
  '.js': 'js',
  '.jsx': 'jsx',
  '.ts': 'ts',
  '.tsx': 'tsx',
  '.mjs': 'js',
  '.mts': 'ts',
  '.cts': 'ts',
}

type EXTENSIONS = keyof typeof FILE_LOADERS

const DEFAULT_EXTENSIONS = Object.keys(FILE_LOADERS)

const getLoader = (filename: string): LOADERS =>
  FILE_LOADERS[extname(filename) as EXTENSIONS]

interface RegisterOptions extends TransformOptions {
  extensions?: EXTENSIONS[]
  /**
   * Auto-ignore node_modules. Independent of any matcher.
   * @default true
   */
  hookIgnoreNodeModules?: boolean
  /**
   * A matcher function, will be called with path to a file. Should return truthy if the file should be hooked, falsy otherwise.
   */
  hookMatcher?(fileName: string): boolean
}

const importMetaBanner = `const ${IMPORT_META_URL_VARIABLE_NAME} = require('url').pathToFileURL(__filename).href;`

export function register(esbuildOptions: RegisterOptions = {}): Disposable {
  const {
    extensions = DEFAULT_EXTENSIONS,
    hookIgnoreNodeModules = true,
    hookMatcher,
    ...rest
  } = esbuildOptions

  const compile: CompileFn = function compile(code, filename, format) {
    // For some reason if the code is already compiled by esbuild-register
    // just return it as is
    if (code.includes(importMetaBanner)) {
      return code
    }

    const dir = dirname(filename)
    const compilerOptions = getOptions(dir)
    format = format ?? inferPackageFormat(dir, filename)

    const { banner, ...overrides } = rest
    const esbuildOptions = getEsbuildOptions(dir)
    if (esbuildOptions != null) {
      Object.assign(overrides, esbuildOptions)
    }

    const result = transformSync(code, {
      sourcefile: filename,
      loader: getLoader(filename),
      sourcemap: 'both',
      tsconfigRaw: { compilerOptions },
      format,
      define: {
        'import.meta.url': IMPORT_META_URL_VARIABLE_NAME,
        ...overrides.define,
      },
      banner: importMetaBanner + (banner || ''),
      ...overrides,
    })

    const js = result.code
    debug('compiled %s', filename)
    debug('%s', js)

    const warnings = result.warnings
    if (warnings?.length) {
      for (const warning of warnings) {
        console.log(warning.location)
        console.log(warning.text)
      }
    }
    if (format === 'esm') return js
    return js
  }

  const revert = addHook(compile, {
    exts: extensions,
    ignoreNodeModules: hookIgnoreNodeModules,
    matcher: hookMatcher,
  })

  installSourceMapSupport()
  const unpatchCommonJsLoader = patchCommonJsLoader(compile)
  const unregisterTsconfigPaths = registerTsconfigPaths()

  return {
    [Symbol.dispose]() {
      revert()
      unpatchCommonJsLoader()
      unregisterTsconfigPaths()
    },
  }
}
