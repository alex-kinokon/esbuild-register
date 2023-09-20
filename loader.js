import { register } from 'node:module'

register('./dist/loader.js', import.meta.url)
