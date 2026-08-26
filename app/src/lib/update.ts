import { getVersion } from '@tauri-apps/api/app'

const LATEST_RELEASE = 'https://api.github.com/repos/Jubstaaa/iconstate/releases/latest'

export interface UpdateInfo {
    version: string
    url: string
}

export const checkForUpdate = async (): Promise<UpdateInfo | null> => {
    const [current, response] = await Promise.all([getVersion(), fetch(LATEST_RELEASE)])
    if (!response.ok) return null

    const release = (await response.json()) as { tag_name?: string; html_url?: string }
    const latest = release.tag_name?.replace(/^v/, '')
    if (!latest || !release.html_url || latest === current) return null

    return { version: latest, url: release.html_url }
}
