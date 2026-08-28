import { describe, expect, it } from 'vitest'

import { LIMITS, app, load } from './fixtures'
import { keyOf } from './icon-state'
import { validate } from './validate'

import type { FolderIcon, IconState } from './core.types'

const folder = (name: string, ...pages: FolderIcon['iconLists']): FolderIcon => ({
    displayName: name,
    listType: 'folder',
    iconLists: pages,
})

const many = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, index) => app(`com.${prefix}${index}`, `${prefix}${index}`))

describe('validation', () => {
    it('passes a device state against itself', () => {
        const state = load('iconstate-original.json')
        const report = validate(state, LIMITS, state)
        expect(report.ok, JSON.stringify(report.issues)).toBe(true)
    })

    it('reports an app the device has but the plan forgot', () => {
        const inventory = load('iconstate-original.json')
        const plan = load('iconstate-original.json')
        plan[1].pop()

        const report = validate(plan, LIMITS, inventory)
        expect(report.ok).toBe(false)
        expect(report.missing.length).toBeGreaterThan(0)
    })

    it('reports an app that is planned but not installed', () => {
        const plan: IconState = [[], [app('com.ghost', 'Ghost')]]
        const report = validate(plan, LIMITS, ['com.real'])

        expect(report.unknown).toEqual(['com.ghost'])
        expect(report.missing).toEqual(['com.real'])
    })

    it('reports the same app placed twice', () => {
        const twice = app('com.a', 'A')
        const report = validate([[twice], [twice]], LIMITS)
        expect(report.duplicated).toEqual(['com.a'])
    })

    it('enforces every capacity the device reports', () => {
        const plan: IconState = [
            many('dock', 5),
            many('page', 25),
            [folder('Big', many('f', 10)), folder('Empty')],
        ]

        const codes = new Set(validate(plan, LIMITS).issues.map(issue => issue.code))
        for (const code of ['dock-overflow', 'page-overflow', 'folder-page-overflow', 'empty-folder']) {
            expect(codes).toContain(code)
        }
    })

    it('warns about a folder in the dock without failing', () => {
        const plan: IconState = [[folder('Docked', [app('com.a', 'A')])], []]
        const report = validate(plan, LIMITS)

        expect(report.issues.some(issue => issue.code === 'dock-folder')).toBe(true)
        expect(report.ok).toBe(true)
    })

    it('keys apps by bundle identifier, falling back to the display one', () => {
        expect(keyOf({ displayIdentifier: 'com.only', displayName: 'Only' })).toBe('com.only')
        expect(keyOf(app('com.bundle', 'B'))).toBe('com.bundle')
    })
})
