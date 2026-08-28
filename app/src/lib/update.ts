import { relaunch } from '@tauri-apps/plugin-process'
import { check } from '@tauri-apps/plugin-updater'

export interface PendingUpdate {
    version: string
    /** Fetch it, swap it in, and come back up on the new one. */
    install: (onProgress: (fraction: number) => void) => Promise<void>
}

/**
 * Updates are signed with the project's own key and installed in place, so this
 * does not go through the browser — and so it never picks up the quarantine flag
 * that makes a downloaded build look damaged.
 */
export const checkForUpdate = async (): Promise<PendingUpdate | null> => {
    const found = await check()
    if (!found) return null

    return {
        version: found.version,
        install: async onProgress => {
            let total = 0
            let done = 0

            await found.downloadAndInstall(event => {
                if (event.event === 'Started') total = event.data.contentLength ?? 0
                if (event.event === 'Progress') {
                    done += event.data.chunkLength
                    if (total) onProgress(Math.min(done / total, 1))
                }
            })

            await relaunch()
        },
    }
}
