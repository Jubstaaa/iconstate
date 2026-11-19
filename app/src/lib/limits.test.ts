import { describe, expect, it } from 'vitest'

import { DEFAULT_LIMITS, deviceAspect, limitsFrom } from './limits'

describe('the grid the phone reports', () => {
    it('falls back to a six by four iPhone before the phone has answered', () => {
        expect(limitsFrom(null)).toBe(DEFAULT_LIMITS)
        expect(deviceAspect(null)).toBeCloseTo(440 / 956)
    })

    it('takes the counts the phone reports, rounded', () => {
        const limits = limitsFrom({
            homeScreenIconRows: 7,
            homeScreenIconColumns: 5,
            homeScreenIconFolderRows: 4,
            homeScreenIconFolderColumns: 4,
            homeScreenIconDockMaxCount: 4.0,
            homeScreenIconMaxPages: 20,
        })

        expect(limits).toMatchObject({ rows: 7, columns: 5, page: 35, folderPage: 16, dock: 4, pages: 20 })
    })

    it('ignores a count that is missing, zero or negative', () => {
        const limits = limitsFrom({ homeScreenIconRows: 0, homeScreenIconColumns: -3 })

        expect(limits.rows).toBe(DEFAULT_LIMITS.rows)
        expect(limits.columns).toBe(DEFAULT_LIMITS.columns)
        expect(limits.dock).toBe(DEFAULT_LIMITS.dock)
    })

    it('sizes icons from the measured widths and leaves the rest to the gaps', () => {
        const limits = limitsFrom({ homeScreenWidth: 400, homeScreenIconWidth: 60, homeScreenIconColumns: 4 })

        expect(limits.iconShare).toBeCloseTo(60 / 400)
        const row = 2 * limits.edgeShare + 4 * limits.iconShare + 3 * limits.gapShare
        expect(row).toBeCloseTo(1)
    })

    it('never lets the gap collapse when the icons would overfill the row', () => {
        expect(limitsFrom({ homeScreenWidth: 100, homeScreenIconWidth: 60 }).gapShare).toBe(0.02)
    })
})
