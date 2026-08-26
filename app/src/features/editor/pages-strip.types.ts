import type { Limits, Slot } from './editor.types'
import type { Hint } from './home-editor.types'

export interface PagesStripProps {
    pages: Slot[][]
    limits: Limits
    selection: Set<string>
    hint?: Hint | null
    page: number
    onPageChange: (page: number) => void
    onSelect: (id: string, additive: boolean) => void
    onOpen: (id: string) => void
    onContextMenu: (event: React.MouseEvent, id?: string) => void
}
