import { isFolder } from '../../lib/core.types'

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
import { isFolderSlot } from './editor.types'

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

    return [write(layout.dock), ...layout.pages.map(write)]
}

const zoneKey = (zone: Zone): string =>
    zone.kind === 'page' ? `page:${zone.page}` : zone.kind === 'dock' ? 'dock' : `folder:${zone.id}`

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

const insert = (layout: Layout, zone: Zone, index: number, slots: Slot[]): Layout => {
    const place = <T>(list: T[], items: T[]): T[] => {
        const at = Math.max(0, Math.min(index, list.length))
        return [...list.slice(0, at), ...items, ...list.slice(at)]
    }

    if (zone.kind === 'dock') {
        return {
            ...layout,
            dock: place(
                layout.dock,
                slots.filter(slot => !isFolderSlot(slot))
            ),
        }
    }

    if (zone.kind === 'page') {
        return {
            ...layout,
            pages: layout.pages.map((page, at) => (at === zone.page ? place(page, slots) : page)),
        }
    }

    const apps = slots.flatMap(slot => (isFolderSlot(slot) ? slot.apps : [slot]))
    return {
        ...layout,
        pages: layout.pages.map(page =>
            page.map(slot =>
                isFolderSlot(slot) && slot.id === zone.id ? { ...slot, apps: place(slot.apps, apps) } : slot
            )
        ),
    }
}

const prune = (layout: Layout): Layout => {
    const pages = layout.pages.map(page => page.filter(slot => !isFolderSlot(slot) || slot.apps.length > 0))
    const trimmed = [...pages]
    while (trimmed.length > 1 && trimmed[trimmed.length - 1].length === 0) trimmed.pop()
    return { ...layout, pages: trimmed }
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

const move = (layout: Layout, ids: string[], target: Target): Layout => {
    const moving = ids.map(id => findSlot(layout, id)).filter((slot): slot is Slot => slot !== undefined)
    if (!moving.length) return layout

    const origin = zoneOf(layout, moving[0].id)
    const sameZone = origin && zoneKey(origin.zone) === zoneKey(target.zone)
    const shift = sameZone && origin.index < target.index ? moving.length : 0

    const emptied = withoutIds(layout, new Set(ids))
    return prune(insert(emptied, target.zone, target.index - shift, moving))
}

const combine = (layout: Layout, ids: string[], ontoId: string): Layout => {
    const onto = findSlot(layout, ontoId)
    if (!onto || ids.includes(ontoId)) return layout

    if (isFolderSlot(onto))
        return move(layout, ids, { zone: { kind: 'folder', id: onto.id }, index: onto.apps.length })

    const where = zoneOf(layout, ontoId)
    if (!where || where.zone.kind !== 'page') return layout

    const moving = ids.map(id => findSlot(layout, id)).filter((slot): slot is Slot => slot !== undefined)
    const members = [onto, ...moving].flatMap(slot => (isFolderSlot(slot) ? slot.apps : [slot as AppSlot]))
    const folder: FolderSlot = {
        id: nextId('folder'),
        kind: 'folder',
        name: members[0]?.app.displayName ?? 'Folder',
        apps: members,
    }

    const emptied = withoutIds(layout, new Set([...ids, ontoId]))
    return prune(insert(emptied, where.zone, where.index, [folder]))
}

const group = (layout: Layout, ids: string[], name: string): Layout => {
    const moving = ids.map(id => findSlot(layout, id)).filter((slot): slot is Slot => slot !== undefined)
    if (!moving.length) return layout

    const members = moving.flatMap(slot => (isFolderSlot(slot) ? slot.apps : [slot as AppSlot]))
    const where = zoneOf(layout, moving[0].id)
    const page = where?.zone.kind === 'page' ? where.zone.page : 0
    const index = where?.zone.kind === 'page' ? where.index : (layout.pages[page]?.length ?? 0)

    const folder: FolderSlot = { id: nextId('folder'), kind: 'folder', name, apps: members }
    const emptied = withoutIds(layout, new Set(ids))
    return prune(insert(emptied, { kind: 'page', page }, index, [folder]))
}

const dissolve = (layout: Layout, id: string): Layout => {
    const where = zoneOf(layout, id)
    const folder = findSlot(layout, id)
    if (!where || !folder || !isFolderSlot(folder) || where.zone.kind !== 'page') return layout

    const emptied = withoutIds(layout, new Set([id]))
    return prune(insert(emptied, where.zone, where.index, folder.apps))
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
