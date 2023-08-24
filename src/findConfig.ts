import * as fs from 'node:fs'
import { resolve, basename, dirname } from 'node:path'
import { jsoncParse } from './utils'

function findUp(files: string[], cwd: string): string | null {
  if (basename(cwd) === 'node_modules' || dirname(cwd) === cwd) {
    return null
  }

  for (const filename of files) {
    const file = resolve(cwd, filename)
    if (fs.existsSync(file)) {
      return file
    }
  }

  return findUp(files, dirname(cwd))
}

export function findConfig(files: string[], cwd: string) {
  const path = findUp(files, resolve(cwd))
  if (!path) return {}

  return {
    path,
    data: jsoncParse(fs.readFileSync(path, 'utf8')),
  }
}
