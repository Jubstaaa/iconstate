import { describe, expect, it } from 'vitest'

import { diffStates } from './diff'
import { LIMITS, app, load } from './fixtures'
import { appsOf } from './icon-state'
import { buildPlan } from './plan'

import type { FolderIcon, IconState } from './core.types'

const folder = (name: string, ...pages: FolderIcon['iconLists']): FolderIcon => ({
    displayName: name,
    listType: 'folder',
    iconLists: pages,
})

const FIXTURES = ['iconstate-original.json', 'state-c3.json', 'state-cur2.json', 'state-final2.json']

describe('diffing', () => {
    it.each(FIXTURES)('reports no change between %s and itself', name => {
        const state = load(name)
        expect(diffStates(state, state).empty).toBe(true)
    })

    it('reports flattening nine pages as moves, not as apps coming and going', () => {
        const current = load('iconstate-original.json')
        const change = diffStates(current, buildPlan(appsOf(current), LIMITS).state)

        expect(change.empty).toBe(false)
        expect(change.moves.length).toBeGreaterThan(0)
        expect(change.addedApps).toEqual([])
        expect(change.removedApps).toEqual([])
    })

    it('names both ends of a single move', () => {
        const x = app('com.x', 'X')
        const before: IconState = [[], [folder('A', [x])]]
        const after: IconState = [[], [folder('B', [x])]]

        const change = diffStates(before, after)
        expect(change.moves).toEqual([{ key: 'com.x', displayName: 'X', before: 'A', after: 'B' }])
        expect(change.addedFolders).toEqual(['B'])
        expect(change.removedFolders).toEqual(['A'])
    })

    it('reports an app that left the device as removed', () => {
        const before = load('state-final2.json')
        const after = load('state-final2.json')
        after[1].pop()

        const change = diffStates(before, after)
        expect(change.removedApps.length).toBeGreaterThan(0)
        expect(change.addedApps).toEqual([])
    })

    it('counts every move and every arrival as touched', () => {
        const before = load('state-final2.json')
        const after = load('state-final2.json')
        after[1].pop()

        const change = diffStates(before, after)
        expect(change.touched).toBe(change.moves.length + change.removedApps.length)
    })
})
