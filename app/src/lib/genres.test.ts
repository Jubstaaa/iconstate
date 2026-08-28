import { describe, expect, it } from 'vitest'

import { assignmentsFromGenres, folderForGenres } from './genres'

describe('genre mapping', () => {
    it('lets a specific genre beat the app own primary one', () => {
        expect(folderForGenres(['Photo & Video', 'Social Networking'])).toBe('Social')
        expect(folderForGenres(['Lifestyle', 'Social Networking'])).toBe('Social')
    })

    it('maps a single genre straight through', () => {
        expect(folderForGenres(['Food & Drink'])).toBe('Food')
        expect(folderForGenres(['Games'])).toBe('Games')
    })

    it('still lands a generic genre somewhere', () => {
        expect(folderForGenres(['Lifestyle'])).toBe('Shopping')
        expect(folderForGenres(['Utilities'])).toBe('Utilities')
    })

    it('leaves an app the store does not know unplaced', () => {
        expect(folderForGenres([])).toBeNull()
        expect(folderForGenres(['Nonsense'])).toBeNull()
    })

    it('turns only the resolvable ones into assignments', () => {
        expect(assignmentsFromGenres({ 'com.a': ['Games'], 'com.b': [], 'com.c': ['Nonsense'] })).toEqual({
            'com.a': 'Games',
        })
    })
})
