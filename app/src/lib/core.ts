import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

import type { CoreFailure, Device, IconState, ProgressEvent } from './core.types'

export const PROGRESS_EVENT = 'iconstate://progress'

export const getErrorMessage = (error: unknown): string => {
    const failure = error as CoreFailure | undefined
    if (failure?.message) return failure.message
    return error instanceof Error ? error.message : String(error)
}

export const onProgress = (handler: (event: ProgressEvent) => void) =>
    listen<ProgressEvent>(PROGRESS_EVENT, ({ payload }) => handler(payload))

export const coreVersion = () => invoke<string>('core_version')

export const listDevices = () => invoke<Device[]>('list_devices')

export const readIconState = (serial?: string) => invoke<IconState>('read_icon_state', { serial })
