import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

import type { CoreFailure, Device, IconManifest, IconState, ProgressEvent } from './core.types'
import type { UserRules } from './rules'

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

/** The rule table built from this machine's own home screen, if there is one. */
export const userRules = () => invoke<UserRules | null>('user_rules')

export const saveRules = (rules: UserRules) => invoke<string>('save_rules', { rules })

export const lookupGenres = (bundleIds: string[], country?: string) =>
    invoke<Record<string, string[]>>('lookup_genres', { bundleIds, country })

export const applyLayout = (plan: IconState, serial?: string) =>
    invoke<IconState>('apply_layout', { serial, plan })

export const restoreBackup = (file?: string, serial?: string) =>
    invoke<IconState>('restore_backup', { serial, file })

export const fetchIcons = async (keys?: string[], serial?: string): Promise<IconManifest> => {
    const manifest = await invoke<IconManifest>('fetch_icons', { serial, keys })
    return Object.fromEntries(Object.entries(manifest).map(([key, path]) => [key, convertFileSrc(path)]))
}

export const fetchMetrics = (serial?: string) => invoke<Record<string, number>>('fetch_metrics', { serial })
