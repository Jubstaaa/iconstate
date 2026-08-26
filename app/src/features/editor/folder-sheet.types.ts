import type { FolderSlot, Limits } from './editor.types'
import type { Hint } from './home-editor.types'

export interface FolderSheetProps {
    folder: FolderSlot
    limits: Limits
    selection: Set<string>
    hint?: Hint | null
    onSelect: (id: string, additive: boolean) => void
    onRename: (name: string) => void
    onDissolve: () => void
    onClose: () => void
}
