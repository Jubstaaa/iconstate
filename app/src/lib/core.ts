import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

import type { CoreFailure, Device, IconManifest, IconState, ProgressEvent } from './core.types'

export const PROGRESS_EVENT = 'iconstate://progress'

export const getErrorMessage = (error: unknown): string => {
    const failure = error as CoreFailure | undefined
    if (failure?.message) return failure.message
    return error instanceof Error ? error.message : String(error)
}

export const onProgress = (handler: (event: ProgressEvent) => void) =>
    listen<ProgressEvent>(PROGRESS_EVENT, ({ payload }) => handler(payload))

export const listDevices = () => invoke<Device[]>('list_devices')

export const readIconState = (serial?: string) => invoke<IconState>('read_icon_state', { serial })

/** Everything installed, whether or not it is on a page. */
export const installedApps = (serial?: string) =>
    invoke<Record<string, Record<string, unknown>>>('installed_apps', { serial })

export const lookupGenres = (bundleIds: string[], country?: string) =>
    invoke<Record<string, string[]>>('lookup_genres', { bundleIds, country })

export const applyLayout = (plan: IconState, serial?: string) =>
    invoke<IconState>('apply_layout', { serial, plan })

export const listBackups = () => invoke<string[]>('list_backups')

export const restoreBackup = (file?: string, serial?: string) =>
    invoke<IconState>('restore_backup', { serial, file })

export const fetchIcons = async (keys?: string[], serial?: string): Promise<IconManifest> => {
    const manifest = await invoke<IconManifest>('fetch_icons', { serial, keys })
    return Object.fromEntries(Object.entries(manifest).map(([key, path]) => [key, convertFileSrc(path)]))
}

export const fetchMetrics = (serial?: string) => invoke<Record<string, number>>('fetch_metrics', { serial })
