export interface EditorToolbarProps {
    busy: boolean
    dirty: boolean
    selectionCount: number
    canUndo: boolean
    canRedo: boolean
    onGroup: () => void
    onUndo: () => void
    onRedo: () => void
    onReset: () => void
    onReview: () => void
}
