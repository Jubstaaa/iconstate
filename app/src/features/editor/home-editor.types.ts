import type { IconManifest } from '../../lib/core.types'
import type { Action, EditorState, Limits } from './editor.types'

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
    | { kind: 'cell'; page: number; index: number }
    | { kind: 'dock'; index: number }
    | { kind: 'infolder'; id: string; index: number }
    | { kind: 'onto'; id: string }

export const parseDropTarget = (id: string): DropTarget | null => {
    const [head, ...rest] = id.split(':')
    if (head === 'cell') return { kind: 'cell', page: Number(rest[0]), index: Number(rest[1]) }
    if (head === 'dock') return { kind: 'dock', index: Number(rest[0]) }
    if (head === 'infolder')
        return { kind: 'infolder', id: rest.slice(0, -1).join(':'), index: Number(rest.at(-1)) }
    if (head === 'onto') return { kind: 'onto', id: rest.join(':') }
    return null
}
