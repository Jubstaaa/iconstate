import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

import type {
    Assignments,
    CoreFailure,
    Device,
    DiffSummary,
    IconManifest,
    IconState,
    ProgressEvent,
} from './core.types'

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

export interface PlanOptions {
    assignments?: Assignments
    lookup?: boolean
    country?: string
}

export const planLayout = (serial?: string, options: PlanOptions = {}) =>
    invoke<IconState>('plan_layout', { serial, ...options })

export const diffLayout = (plan: IconState, serial?: string) =>
    invoke<DiffSummary>('diff_layout', { serial, plan })

export const applyLayout = (plan: IconState, serial?: string) =>
    invoke<void>('apply_layout', { serial, plan })

export const listBackups = () => invoke<string[]>('list_backups')

export const restoreBackup = (file?: string, serial?: string) =>
    invoke<void>('restore_backup', { serial, file })

export const fetchIcons = async (serial?: string): Promise<IconManifest> => {
    const manifest = await invoke<IconManifest>('fetch_icons', { serial })
    return Object.fromEntries(Object.entries(manifest).map(([key, path]) => [key, convertFileSrc(path)]))
}

export const fetchWallpaper = async (serial?: string): Promise<string | null> => {
    const result = await invoke<{ path: string }>('fetch_wallpaper', { serial })
    return result.path ? convertFileSrc(result.path) : null
}

export const fetchMetrics = (serial?: string) => invoke<Record<string, number>>('fetch_metrics', { serial })
