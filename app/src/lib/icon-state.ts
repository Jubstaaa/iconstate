import { isFolder } from './core.types'

import type { AppIcon, FolderIcon, IconState, IconStateItem } from './core.types'

/**
 * Bundle identifiers are what everything is keyed by. A handful of system icons
 * ship without one, so the display identifier stands in — it is unique too, just
 * uglier.
 */
export const keyOf = (app: AppIcon): string => app.bundleIdentifier ?? app.displayIdentifier

export const appsIn = (item: IconStateItem): AppIcon[] => (isFolder(item) ? item.iconLists.flat() : [item])

export const itemsOf = (state: IconState): IconStateItem[] => state.flat()

export const appsOf = (state: IconState): AppIcon[] => itemsOf(state).flatMap(appsIn)

export const foldersOf = (state: IconState): FolderIcon[] => itemsOf(state).filter(isFolder)

export const chunk = <T>(items: T[], size: number): T[][] => {
    const out: T[][] = []
    for (let start = 0; start < items.length; start += size) out.push(items.slice(start, start + size))
    return out.length ? out : [[]]
}
