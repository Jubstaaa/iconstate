import type { IconManifest } from '../../lib/core.types'
import type { Action, EditorState, Limits, Position } from './editor.types'

export interface EditorCommands {
    busy: boolean
    dirty: boolean
    canUndoWrite: boolean
    onReload: () => void
    onPropose: (lookUp: boolean) => void
    onReview: () => void
    onDiscard: () => void
    onSaveRules: () => void
    onUndoWrite: () => void
}

export interface HomeEditorProps {
    state: EditorState
    limits: Limits
    icons: IconManifest
    selection: Set<string>
    aspect: number
    offline: string
    commands: EditorCommands
    dispatch: (action: Action) => void
    onSelectionChange: (selection: Set<string>) => void
}

export interface Hint {
    id: string
    side: Position | 'onto'
}
