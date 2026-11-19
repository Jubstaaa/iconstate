/**
 * The ids dnd-kit carries for drop targets, and how they are read back. Every
 * target is a prefix and the id of what it belongs to: `cell:<page>:<index>`,
 * `page:<page>`, `dock:<index>`, `infolder:<folder id>:<index>`, `onto:<slot id>`.
 */
import type { FolderSlot, Position } from './editor.types'

export type DropTarget =
    | { kind: 'cell'; page: number }
    | { kind: 'dock' }
    | { kind: 'infolder'; id: string }
    | { kind: 'onto'; id: string }

/**
 * Every page draws the same dock, so its tiles would register the same drag and
 * drop ids once per page — dnd-kit keys those by id, so the last page silently
 * took over every dock icon. Scope the dock ids by page and strip the scope back
 * off before anything reaches the reducer.
 */
export const dockId = (page: number, id: string): string => `d${page}/${id}`

/** Targets that cover a whole area, and so must never beat a tile under the pointer. */
export const isWideTarget = (id: string): boolean => id.startsWith('page:') || id.startsWith('infolder:')

export const bareId = (id: string): string => id.replace(/^d\d+\//, '')

export const parseDropTarget = (id: string): DropTarget | null => {
    const [head, ...rest] = id.split(':')
    if (head === 'cell' || head === 'page') return { kind: 'cell', page: Number(rest[0]) }
    if (head === 'dock') return { kind: 'dock' }
    if (head === 'infolder') return { kind: 'infolder', id: rest.slice(0, -1).join(':') }
    if (head === 'onto') return { kind: 'onto', id: rest.join(':') }
    return null
}

/** Drop anywhere in the open folder: the end of its last page. */
export const panelTarget = (folder: FolderSlot): string => `infolder:${folder.id}:${folder.apps.length}`

export interface Box {
    left: number
    width: number
}

/**
 * Which third of the target the dragged icon is over. The edges reorder, the
 * middle combines — the same split iOS uses, and the only way to drop something
 * *between* two icons on a full page.
 */
export const sideOf = (dragged: Box | null, over: Box): Position | 'onto' => {
    if (!dragged) return 'onto'
    const ratio = (dragged.left + dragged.width / 2 - over.left) / over.width
    if (ratio < 0.32) return 'before'
    if (ratio > 0.68) return 'after'
    return 'onto'
}
