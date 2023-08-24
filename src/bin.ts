#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
spawnSync(
  process.execPath,
  [
    '--require',
    (0, require.resolve)('../register.js'),
    '--require',
    (0, require.resolve)('./prepare.js'),
    '--loader',
    (0, require.resolve)('../loader.js'),
    ...args,
  ],
  {
    stdio: 'inherit',
  },
)
