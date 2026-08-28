import { isFolder } from './core.types'
import { appsOf, foldersOf, keyOf } from './icon-state'

import type { IconState, Limits } from './core.types'

export interface Issue {
    code: string
    message: string
    severity: 'error' | 'warning'
}

export interface ValidationReport {
    ok: boolean
    missing: string[]
    unknown: string[]
    duplicated: string[]
    issues: Issue[]
}

/**
 * Everything SpringBoard would reject, checked before the device is asked. The
 * inventory is what is actually installed: without it only the layout's own
 * consistency can be judged.
 */
export const validate = (
    plan: IconState,
    limits: Limits,
    inventory?: string[] | IconState
): ValidationReport => {
    const issues: Issue[] = []
    const fail = (code: string, message: string) => issues.push({ code, message, severity: 'error' })

    const placed = new Map<string, number>()
    for (const app of appsOf(plan)) {
        const key = keyOf(app)
        placed.set(key, (placed.get(key) ?? 0) + 1)
    }

    const duplicated = [...placed.entries()]
        .filter(([, count]) => count > 1)
        .map(([key]) => key)
        .sort()
    for (const key of duplicated) fail('duplicate-app', `${key} is placed ${placed.get(key)} times`)

    let missing: string[] = []
    let unknown: string[] = []

    if (inventory !== undefined) {
        const available = new Set(
            Array.isArray(inventory) && typeof inventory[0] === 'string'
                ? (inventory as string[])
                : appsOf(inventory as IconState).map(keyOf)
        )

        missing = [...available].filter(key => !placed.has(key)).sort()
        unknown = [...placed.keys()].filter(key => !available.has(key)).sort()

        for (const key of missing) {
            fail('missing-app', `${key} exists on the device but is not in the plan`)
        }
        for (const key of unknown) {
            fail('unknown-app', `${key} is in the plan but not installed on the device`)
        }
    }

    const [dock = [], ...pages] = plan

    if (dock.length > limits.dock) {
        fail('dock-overflow', `dock holds ${dock.length} items, max is ${limits.dock}`)
    }
    for (const item of dock) {
        if (isFolder(item)) {
            issues.push({
                code: 'dock-folder',
                message: `folder '${item.displayName}' in dock is unreliable`,
                severity: 'warning',
            })
        }
    }

    if (pages.length > limits.pages) {
        fail('too-many-pages', `the layout has ${pages.length} pages, max is ${limits.pages}`)
    }
    pages.forEach((page, index) => {
        if (page.length > limits.page) {
            fail('page-overflow', `page ${index + 1} holds ${page.length} items, max is ${limits.page}`)
        }
    })

    for (const folder of foldersOf(plan)) {
        if (!folder.iconLists.flat().length) {
            fail('empty-folder', `folder '${folder.displayName}' is empty`)
        }
        folder.iconLists.forEach((page, index) => {
            if (page.length > limits.folderPage) {
                fail(
                    'folder-page-overflow',
                    `folder '${folder.displayName}' page ${index + 1} holds ${page.length} items, max is ${limits.folderPage}`
                )
            }
        })
    }

    return {
        ok: !issues.some(issue => issue.severity === 'error'),
        missing,
        unknown,
        duplicated,
        issues,
    }
}
