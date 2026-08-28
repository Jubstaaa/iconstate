import { isFolder } from './core.types'
import { appsOf, foldersOf, keyOf } from './icon-state'

import type { AppIcon, DiffSummary, IconState, Move } from './core.types'

const DOCK_LOCATION = 'Dock'

/** Where each app sits, named the way a person would say it. */
const locations = (state: IconState): Map<string, string> => {
    const found = new Map<string, string>()

    state.forEach((page, index) => {
        const label = index === 0 ? DOCK_LOCATION : `Page ${index}`
        for (const item of page) {
            if (isFolder(item)) {
                for (const app of item.iconLists.flat()) found.set(keyOf(app), item.displayName)
            } else {
                found.set(keyOf(item), label)
            }
        }
    })

    return found
}

const byKey = (state: IconState): Map<string, AppIcon> => new Map(appsOf(state).map(app => [keyOf(app), app]))

const named = (app: AppIcon) => ({ key: keyOf(app), displayName: app.displayName })

const byName = (left: { displayName: string }, right: { displayName: string }) =>
    left.displayName.localeCompare(right.displayName)

export const diffStates = (before: IconState, after: IconState): DiffSummary => {
    const wasAt = locations(before)
    const isAt = locations(after)
    const old = byKey(before)
    const fresh = byKey(after)

    const addedApps = [...fresh.entries()]
        .filter(([key]) => !old.has(key))
        .map(([, app]) => named(app))
        .sort(byName)

    const removedApps = [...old.entries()]
        .filter(([key]) => !fresh.has(key))
        .map(([, app]) => named(app))
        .sort(byName)

    const moves: Move[] = []
    for (const [key, app] of fresh) {
        if (!old.has(key)) continue
        const before_ = wasAt.get(key) ?? ''
        const after_ = isAt.get(key) ?? ''
        if (before_ !== after_) {
            moves.push({ key, displayName: app.displayName, before: before_, after: after_ })
        }
    }
    moves.sort((left, right) => left.after.localeCompare(right.after) || byName(left, right))

    const oldFolders = new Set(foldersOf(before).map(folder => folder.displayName))
    const newFolders = new Set(foldersOf(after).map(folder => folder.displayName))
    const addedFolders = [...newFolders].filter(name => !oldFolders.has(name)).sort()
    const removedFolders = [...oldFolders].filter(name => !newFolders.has(name)).sort()

    const touched = moves.length + addedApps.length + removedApps.length

    return {
        empty:
            !moves.length &&
            !addedFolders.length &&
            !removedFolders.length &&
            !addedApps.length &&
            !removedApps.length,
        touched,
        moves,
        addedFolders,
        removedFolders,
        addedApps,
        removedApps,
    }
}
