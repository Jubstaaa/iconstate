import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { DEFAULT_LIMITS } from '../features/editor/editor.constants'

import type { AppIcon, IconState, Limits } from './core.types'

const FIXTURES = fileURLToPath(new URL('../../../reference/fixtures/', import.meta.url))

export const load = (name: string): IconState => JSON.parse(readFileSync(`${FIXTURES}${name}`, 'utf8'))

export const LIMITS: Limits = DEFAULT_LIMITS

export const app = (identifier: string, name: string): AppIcon => ({
    bundleIdentifier: identifier,
    displayIdentifier: identifier,
    displayName: name,
})
