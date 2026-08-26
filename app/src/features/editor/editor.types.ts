import type { AppIcon, IconState } from '../../lib/core.types'

export interface AppSlot {
    id: string
    kind: 'app'
    app: AppIcon
}

export interface FolderSlot {
    id: string
    kind: 'folder'
    name: string
    apps: AppSlot[]
}

export type Slot = AppSlot | FolderSlot

export interface Layout {
    dock: Slot[]
    pages: Slot[][]
}

export interface Limits {
    dock: number
    page: number
    folderPage: number
    pages: number
    columns: number
    rows: number
    folderColumns: number
    folderRows: number
    /** Icon width as a share of screen width, straight from the device. */
    iconShare: number
    /** Gap between columns, derived so the row adds up to the screen. */
    gapShare: number
    edgeShare: number
}

export type Zone = { kind: 'page'; page: number } | { kind: 'dock' } | { kind: 'folder'; id: string }

export type Position = 'before' | 'after'

export interface Target {
    zone: Zone
    /** Drop next to this slot. Without one the slots go to the end of the zone. */
    anchorId?: string
    position?: Position
}

export type Action =
    | { type: 'load'; state: IconState }
    | { type: 'move'; ids: string[]; target: Target }
    | { type: 'combine'; ids: string[]; ontoId: string }
    | { type: 'group'; ids: string[]; name: string }
    | { type: 'rename'; id: string; name: string }
    | { type: 'dissolve'; id: string }
    | { type: 'add-page' }
    | { type: 'remove-page'; page: number }
    | { type: 'undo' }
    | { type: 'redo' }

export interface EditorState {
    layout: Layout
    past: Layout[]
    future: Layout[]
}

export const isFolderSlot = (slot: Slot): slot is FolderSlot => slot.kind === 'folder'
