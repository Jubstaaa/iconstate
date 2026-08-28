import { describe, expect, it } from 'vitest'

import { LIMITS, app, load } from './fixtures'
import { appsOf, foldersOf, keyOf } from './icon-state'
import { UNSORTED_FOLDER, buildPlan, planWithAssignments } from './plan'
import { RULES } from './rules'
import { validate } from './validate'

const folderNames = (state: ReturnType<typeof buildPlan>['state']) =>
    foldersOf(state).map(folder => folder.displayName)

describe('planning', () => {
    it('puts the apps it knows where the table says, and the rest in Unsorted', () => {
        const current = load('state-final2.json')
        const plan = buildPlan(appsOf(current), LIMITS)

        const placed = foldersOf(plan.state).flatMap(folder =>
            folder.iconLists.flat().map(app => [keyOf(app), folder.displayName] as const)
        )
        for (const [key, folder] of placed) {
            if (key.startsWith('com.apple.')) expect(folder).toBe(RULES[key] ?? UNSORTED_FOLDER)
            else expect(folder).toBe(UNSORTED_FOLDER)
        }

        expect(validate(plan.state, LIMITS, current).ok).toBe(true)
    })

    it('leaves the dock alone', () => {
        const current = load('state-final2.json')
        const dock = current[0].map(item => ('iconLists' in item ? item.displayName : keyOf(item)))
        const plan = buildPlan(appsOf(current), LIMITS, {
            dock: current[0].map(item => keyOf(item as never)),
        })

        expect(plan.state[0].map(item => ('iconLists' in item ? item.displayName : keyOf(item)))).toEqual(
            dock
        )
    })

    it('is idempotent', () => {
        const current = load('state-final2.json')
        const once = buildPlan(appsOf(current), LIMITS).state
        const twice = buildPlan(appsOf(once), LIMITS).state

        expect(twice).toEqual(once)
    })

    it('drops an app with no rule into Unsorted and reports it', () => {
        const current = load('state-final2.json')
        const pool = [...appsOf(current), app('com.brand.new', 'Brand New')]
        const plan = buildPlan(pool, LIMITS)

        expect(plan.unassigned.map(keyOf)).toContain('com.brand.new')
        expect(folderNames(plan.state)).toContain(UNSORTED_FOLDER)

        const unsorted = foldersOf(plan.state).find(folder => folder.displayName === UNSORTED_FOLDER)
        expect(unsorted?.iconLists.flat().map(keyOf)).toContain('com.brand.new')
        expect(validate(plan.state, LIMITS, pool.map(keyOf)).ok).toBe(true)
    })

    it('takes an app out of Unsorted once it is assigned', () => {
        const current = load('state-final2.json')
        const pool = [...appsOf(current), app('com.brand.new', 'Brand New')]
        const plan = planWithAssignments(pool, LIMITS, { 'com.brand.new': 'Games' })

        expect(plan.unassigned.map(keyOf)).not.toContain('com.brand.new')

        const games = foldersOf(plan.state).find(folder => folder.displayName === 'Games')
        expect(games?.iconLists.flat().map(keyOf)).toContain('com.brand.new')
    })

    it('never puts more than a page of nine in a folder', () => {
        const plan = buildPlan(appsOf(load('state-final2.json')), LIMITS)

        for (const folder of foldersOf(plan.state)) {
            for (const page of folder.iconLists) expect(page.length).toBeLessThanOrEqual(9)
        }
    })

    it('keeps the dock the device already had', () => {
        const current = load('state-final2.json')
        const plan = buildPlan(appsOf(current), LIMITS)

        expect(plan.state[0].length).toBeLessThanOrEqual(LIMITS.dock)
    })

    it('places every app exactly once', () => {
        const current = load('state-final2.json')
        const plan = buildPlan(appsOf(current), LIMITS)

        const placed = appsOf(plan.state).map(keyOf)
        expect(new Set(placed).size).toBe(placed.length)
        expect(placed.length).toBe(new Set(appsOf(current).map(keyOf)).size)
    })
})
