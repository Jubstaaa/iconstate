import { isFolder } from '../../lib/core.types'
import { isFolderSlot } from './editor.types'

import type { AppIcon, IconState } from '../../lib/core.types'
import type {
    Action,
    AppSlot,
    EditorState,
    FolderSlot,
    Layout,
    Limits,
    Slot,
    Target,
    Zone,
} from './editor.types'

let counter = 0
const nextId = (prefix: string) => `${prefix}:${(counter += 1)}`

const appSlot = (app: AppIcon): AppSlot => ({
    id: app.bundleIdentifier ?? app.displayIdentifier,
    kind: 'app',
    app,
})

export const toLayout = (state: IconState): Layout => {
    const read = (items: IconState[number]): Slot[] =>
        items.map(item =>
            isFolder(item)
                ? {
                      id: nextId('folder'),
                      kind: 'folder' as const,
                      name: item.displayName,
                      apps: item.iconLists.flat().map(appSlot),
                  }
                : appSlot(item)
        )

    const [dock = [], ...pages] = state
    return { dock: read(dock), pages: pages.length ? pages.map(read) : [[]] }
}

const chunk = <T>(items: T[], size: number): T[][] => {
    const out: T[][] = []
    for (let start = 0; start < items.length; start += size) out.push(items.slice(start, start + size))
    return out.length ? out : [[]]
}

export const toIconState = (layout: Layout, limits: Limits): IconState => {
    const write = (slots: Slot[]): IconState[number] =>
        slots.map(slot =>
            isFolderSlot(slot)
                ? {
                      displayName: slot.name,
                      listType: 'folder' as const,
                      iconLists: chunk(
                          slot.apps.map(child => child.app),
                          limits.folderPage
                      ),
                  }
                : slot.app
        )

    const pages = layout.pages.filter(page => page.length > 0)
    return [write(layout.dock), ...(pages.length ? pages : [[]]).map(write)]
}

const findSlot = (layout: Layout, id: string): Slot | undefined => {
    for (const slot of [...layout.dock, ...layout.pages.flat()]) {
        if (slot.id === id) return slot
        if (isFolderSlot(slot)) {
            const child = slot.apps.find(app => app.id === id)
            if (child) return child
        }
    }
    return undefined
}

const zoneOf = (layout: Layout, id: string): { zone: Zone; index: number } | undefined => {
    const inDock = layout.dock.findIndex(slot => slot.id === id)
    if (inDock >= 0) return { zone: { kind: 'dock' }, index: inDock }

    for (const [page, slots] of layout.pages.entries()) {
        const at = slots.findIndex(slot => slot.id === id)
        if (at >= 0) return { zone: { kind: 'page', page }, index: at }
        for (const slot of slots) {
            if (!isFolderSlot(slot)) continue
            const child = slot.apps.findIndex(app => app.id === id)
            if (child >= 0) return { zone: { kind: 'folder', id: slot.id }, index: child }
        }
    }
    return undefined
}

const withoutIds = (layout: Layout, ids: Set<string>): Layout => ({
    dock: layout.dock.filter(slot => !ids.has(slot.id)),
    pages: layout.pages.map(page =>
        page
            .filter(slot => !ids.has(slot.id))
            .map(slot =>
                isFolderSlot(slot) ? { ...slot, apps: slot.apps.filter(app => !ids.has(app.id)) } : slot
            )
    ),
})

/**
 * Resolve where slots land against the anchor slot, in the list the moved slots
 * have already been removed from. Indices computed before the removal go stale
 * the moment more than one slot moves, so the anchor is the thing that survives.
 */
const place = <T extends { id: string }>(list: T[], slots: T[], target: Target): T[] => {
    const anchor = target.anchorId ? list.findIndex(item => item.id === target.anchorId) : -1
    const at = anchor < 0 ? list.length : target.position === 'after' ? anchor + 1 : anchor
    return [...list.slice(0, at), ...slots, ...list.slice(at)]
}

const insert = (layout: Layout, target: Target, slots: Slot[]): Layout => {
    const { zone } = target

    if (zone.kind === 'dock') return { ...layout, dock: place(layout.dock, slots, target) }

    if (zone.kind === 'page') {
        return {
            ...layout,
            pages: layout.pages.map((page, at) => (at === zone.page ? place(page, slots, target) : page)),
        }
    }

    // A folder holds apps, never other folders — SpringBoard has no nesting.
    const apps = slots.filter((slot): slot is AppSlot => !isFolderSlot(slot))
    if (!apps.length) return layout

    return {
        ...layout,
        pages: layout.pages.map(page =>
            page.map(slot =>
                isFolderSlot(slot) && slot.id === zone.id
                    ? { ...slot, apps: place(slot.apps, apps, target) }
                    : slot
            )
        ),
    }
}

/**
 * Drop folders that have been emptied out. Empty *pages* stay: one is usually
 * there because someone just added it to drag things onto.
 */
const prune = (layout: Layout): Layout => ({
    ...layout,
    pages: layout.pages.map(page => page.filter(slot => !isFolderSlot(slot) || slot.apps.length > 0)),
})

const move = (layout: Layout, ids: string[], target: Target): Layout => {
    const moving = ids
        .filter(id => id !== target.anchorId)
        .map(id => findSlot(layout, id))
        .filter((slot): slot is Slot => slot !== undefined)
    if (!moving.length) return layout

    // Dropping a folder into a folder must not quietly spill its contents.
    if (target.zone.kind === 'folder' && moving.some(isFolderSlot)) return layout

    const emptied = withoutIds(layout, new Set(moving.map(slot => slot.id)))
    return prune(insert(emptied, target, moving))
}

const combine = (layout: Layout, ids: string[], ontoId: string): Layout => {
    const onto = findSlot(layout, ontoId)
    const where = zoneOf(layout, ontoId)
    if (!onto || !where || ids.includes(ontoId)) return layout

    const moving = ids.map(id => findSlot(layout, id)).filter((slot): slot is Slot => slot !== undefined)
    if (!moving.length) return layout

    // Folder onto folder would have to merge or nest, and neither is what anyone
    // means by the gesture — treat it as a reorder and leave both folders whole.
    if (moving.some(isFolderSlot)) {
        return move(layout, ids, { zone: where.zone, anchorId: ontoId, position: 'before' })
    }

    if (isFolderSlot(onto)) return move(layout, ids, { zone: { kind: 'folder', id: onto.id } })
    if (where.zone.kind !== 'page') return layout

    const members = [onto as AppSlot, ...(moving as AppSlot[])]
    const folder: FolderSlot = {
        id: nextId('folder'),
        kind: 'folder',
        name: members[0]?.app.displayName ?? 'Folder',
        apps: members,
    }

    const emptied = withoutIds(layout, new Set([...ids, ontoId]))
    const after = layout.pages[where.zone.page]?.[where.index + 1]?.id
    return prune(insert(emptied, { zone: where.zone, anchorId: after, position: 'before' }, [folder]))
}

const group = (layout: Layout, ids: string[], name: string): Layout => {
    const moving = ids.map(id => findSlot(layout, id)).filter((slot): slot is Slot => slot !== undefined)
    if (!moving.length) return layout

    const members = moving.flatMap(slot => (isFolderSlot(slot) ? slot.apps : [slot as AppSlot]))
    const where = zoneOf(layout, moving[0].id)
    const page = where?.zone.kind === 'page' ? where.zone.page : 0
    const anchorId = where?.zone.kind === 'page' ? layout.pages[page]?.[where.index + 1]?.id : undefined

    const folder: FolderSlot = { id: nextId('folder'), kind: 'folder', name, apps: members }
    const emptied = withoutIds(layout, new Set(ids))
    return prune(insert(emptied, { zone: { kind: 'page', page }, anchorId, position: 'before' }, [folder]))
}

const dissolve = (layout: Layout, id: string): Layout => {
    const where = zoneOf(layout, id)
    const folder = findSlot(layout, id)
    if (!where || !folder || !isFolderSlot(folder) || where.zone.kind !== 'page') return layout

    const after = layout.pages[where.zone.page]?.[where.index + 1]?.id
    const emptied = withoutIds(layout, new Set([id]))
    return prune(insert(emptied, { zone: where.zone, anchorId: after, position: 'before' }, folder.apps))
}

const remember = (state: EditorState, layout: Layout): EditorState =>
    layout === state.layout ? state : { layout, past: [...state.past, state.layout].slice(-50), future: [] }

export const initialEditorState: EditorState = { layout: { dock: [], pages: [[]] }, past: [], future: [] }

export const editorReducer = (state: EditorState, action: Action): EditorState => {
    switch (action.type) {
        case 'load':
            return { layout: toLayout(action.state), past: [], future: [] }
        case 'move':
            return remember(state, move(state.layout, action.ids, action.target))
        case 'combine':
            return remember(state, combine(state.layout, action.ids, action.ontoId))
        case 'group':
            return remember(state, group(state.layout, action.ids, action.name))
        case 'rename':
            return remember(state, {
                ...state.layout,
                pages: state.layout.pages.map(page =>
                    page.map(slot =>
                        isFolderSlot(slot) && slot.id === action.id ? { ...slot, name: action.name } : slot
                    )
                ),
            })
        case 'dissolve':
            return remember(state, dissolve(state.layout, action.id))
        case 'add-page':
            return remember(state, { ...state.layout, pages: [...state.layout.pages, []] })
        case 'remove-page': {
            if (state.layout.pages.length < 2 || state.layout.pages[action.page]?.length) return state
            return remember(state, {
                ...state.layout,
                pages: state.layout.pages.filter((_, at) => at !== action.page),
            })
        }
        case 'undo': {
            const previous = state.past[state.past.length - 1]
            if (!previous) return state
            return {
                layout: previous,
                past: state.past.slice(0, -1),
                future: [state.layout, ...state.future],
            }
        }
        case 'redo': {
            const [next, ...rest] = state.future
            if (!next) return state
            return { layout: next, past: [...state.past, state.layout], future: rest }
        }
    }
}
