const STORAGE_KEY = 'iconstate.wallpaper'
const MAX_BYTES = 8_000_000

export const readStoredWallpaper = (): string | null => {
    try {
        return localStorage.getItem(STORAGE_KEY)
    } catch {
        return null
    }
}

export const storeWallpaper = (dataUrl: string | null): void => {
    try {
        if (dataUrl) localStorage.setItem(STORAGE_KEY, dataUrl)
        else localStorage.removeItem(STORAGE_KEY)
    } catch {
        // storage is full or disabled; the picked wallpaper just will not survive a restart
    }
}

export const readImageFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            reject(new Error('that is not an image'))
            return
        }
        if (file.size > MAX_BYTES) {
            reject(new Error('that image is larger than 8MB'))
            return
        }
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('could not read that file'))
        reader.readAsDataURL(file)
    })
