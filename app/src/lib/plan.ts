import { isFolder } from './core.types'
import { chunk, keyOf } from './icon-state'
import { DOCK, FOLDER_ORDER, RULES } from './rules'

import type { AppIcon, FolderIcon, IconState, IconStateItem, Limits } from './core.types'
import type { UserRules } from './rules'

export const UNSORTED_FOLDER = 'Unsorted'

export interface Plan {
    state: IconState
    unassigned: AppIcon[]
}

export interface PlanRules {
    rules?: Record<string, string>
    dock?: readonly string[]
    order?: readonly string[]
}

/**
 * Folders come out in the hand-tuned order first, then anything the table has
 * never seen, and Unsorted last so it is always the one nearest the end.
 */
const folderOrder = (assigned: Map<string, AppIcon[]>, order: readonly string[]): string[] => {
    const known = order.filter(name => assigned.has(name))
    const extra = [...assigned.keys()]
        .filter(name => !order.includes(name) && name !== UNSORTED_FOLDER)
        .sort()
    const tail = assigned.has(UNSORTED_FOLDER) ? [UNSORTED_FOLDER] : []
    return [...known, ...extra, ...tail]
}

/** Sort a flat pool of apps into the folder layout the rule table describes. */
export const buildPlan = (apps: AppIcon[], limits: Limits, options: PlanRules = {}): Plan => {
    const rules = options.rules ?? RULES
    const dock = options.dock ?? DOCK
    const order = options.order ?? FOLDER_ORDER

    const byKey = new Map(apps.map(app => [keyOf(app), app]))
    const dockItems = dock
        .map(key => byKey.get(key))
        .filter((app): app is AppIcon => app !== undefined)
        .slice(0, limits.dock)
    const docked = new Set(dockItems.map(keyOf))

    // Insertion order of the rule table is the order inside each folder.
    const rank = new Map(Object.keys(rules).map((key, index) => [key, index]))
    const assigned = new Map<string, AppIcon[]>()
    const unassigned: AppIcon[] = []

    for (const app of apps) {
        const key = keyOf(app)
        if (docked.has(key)) continue

        let folder = rules[key]
        if (folder === undefined) {
            unassigned.push(app)
            folder = UNSORTED_FOLDER
        }

        const members = assigned.get(folder)
        if (members) members.push(app)
        else assigned.set(folder, [app])
    }

    const last = rank.size
    for (const [name, members] of assigned) {
        if (name === UNSORTED_FOLDER) continue
        members.sort((left, right) => (rank.get(keyOf(left)) ?? last) - (rank.get(keyOf(right)) ?? last))
    }

    const tiles: IconStateItem[] = folderOrder(assigned, order).map((name): FolderIcon => ({
        displayName: name,
        listType: 'folder',
        iconLists: chunk(assigned.get(name) ?? [], limits.folderPage),
    }))

    return {
        state: [dockItems, ...chunk(tiles, limits.page)],
        unassigned,
    }
}

/** Rebuild a plan with extra bundle-id to folder decisions layered on the table. */
export const planWithAssignments = (
    apps: AppIcon[],
    limits: Limits,
    assignments: Record<string, string>
): Plan => buildPlan(apps, limits, { rules: { ...RULES, ...assignments } })

/**
 * Turn a home screen into a rule table: every folder becomes a name, and every
 * app in it becomes a rule pointing at that name. This is how someone's own
 * layout becomes the thing "Sort into folders" puts back.
 */
export const deriveRules = (state: IconState): UserRules => {
    const rules: Record<string, string> = {}
    const folderOrder: string[] = []

    for (const page of state.slice(1)) {
        for (const item of page) {
            if (!isFolder(item)) continue
            if (!folderOrder.includes(item.displayName)) folderOrder.push(item.displayName)
            for (const app of item.iconLists.flat()) rules[keyOf(app)] = item.displayName
        }
    }

    return {
        dock: (state[0] ?? []).filter(item => !isFolder(item)).map(item => keyOf(item as AppIcon)),
        folderOrder,
        rules,
    }
}
