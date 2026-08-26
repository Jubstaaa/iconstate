import type { IconManifest } from '../../lib/core.types'
import type { Action, EditorState, Limits, Position } from './editor.types'

export interface HomeEditorProps {
    state: EditorState
    limits: Limits
    icons: IconManifest
    wallpaper: string | null
    aspect: number
    selection: Set<string>
    dispatch: (action: Action) => void
    onSelectionChange: (selection: Set<string>) => void
}

export type DropTarget =
    | { kind: 'cell'; page: number }
    | { kind: 'dock' }
    | { kind: 'infolder'; id: string }
    | { kind: 'onto'; id: string }

export interface Hint {
    id: string
    side: Position | 'onto'
}

export const parseDropTarget = (id: string): DropTarget | null => {
    const [head, ...rest] = id.split(':')
    if (head === 'cell') return { kind: 'cell', page: Number(rest[0]) }
    if (head === 'dock') return { kind: 'dock' }
    if (head === 'infolder') return { kind: 'infolder', id: rest.slice(0, -1).join(':') }
    if (head === 'onto') return { kind: 'onto', id: rest.join(':') }
    return null
}

/**
 * Which third of the target the dragged icon is over. The edges reorder, the
 * middle combines — the same split iOS uses, and the only way to drop something
 * *between* two icons on a full page.
 */
export interface Box {
    left: number
    width: number
}

export const sideOf = (dragged: Box | null, over: Box): Position | 'onto' => {
    if (!dragged) return 'onto'
    const ratio = (dragged.left + dragged.width / 2 - over.left) / over.width
    if (ratio < 0.32) return 'before'
    if (ratio > 0.68) return 'after'
    return 'onto'
}
