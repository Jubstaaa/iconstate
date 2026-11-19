import { describe, expect, it } from 'vitest'

import { LIMITS, load } from '../../lib/fixtures'
import { hasEdits, toIconState, toLayout } from './editor.reducer'

const FIXTURES = ['iconstate-original.json', 'state-c3.json', 'state-cur2.json', 'state-final2.json']

describe('telling an edit from the layout the phone sent', () => {
    it.each(FIXTURES)('sees no edit in %s straight after loading it', name => {
        const baseline = load(name)
        expect(hasEdits(baseline, toIconState(toLayout(baseline), LIMITS))).toBe(false)
    })

    it('sees a reordered page as an edit', () => {
        const baseline = load('state-final2.json')
        const layout = toLayout(baseline)
        layout.pages[0] = [...(layout.pages[0] ?? [])].reverse()

        expect(hasEdits(baseline, toIconState(layout, LIMITS))).toBe(true)
    })
})
