export interface WallpaperPickerProps {
    custom: boolean
    stale: boolean
    onPick: (file: File) => void
    onClear: () => void
}
