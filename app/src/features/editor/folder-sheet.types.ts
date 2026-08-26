import type { FolderSlot, Limits } from './editor.types'

export interface FolderSheetProps {
    folder: FolderSlot
    limits: Limits
    selection: Set<string>
    onSelect: (id: string, additive: boolean) => void
    onRename: (name: string) => void
    onDissolve: () => void
    onClose: () => void
}
