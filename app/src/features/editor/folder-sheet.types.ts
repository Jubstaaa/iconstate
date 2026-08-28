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
    onContextMenu: (event: React.MouseEvent, id?: string) => void
}

/** Drop anywhere in the open folder: the end of its last page. */
export const panelTarget = (folder: FolderSlot): string => `infolder:${folder.id}:${folder.apps.length}`
