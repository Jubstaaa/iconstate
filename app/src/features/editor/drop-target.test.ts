import { describe, expect, it } from 'vitest'

import { bareId, dockId, isWideTarget, panelTarget, parseDropTarget, sideOf } from './drop-target'

import type { FolderSlot } from './editor.types'

describe('drop target ids', () => {
    it('reads every kind of target back', () => {
        expect(parseDropTarget('cell:2:7')).toEqual({ kind: 'cell', page: 2 })
        expect(parseDropTarget('page:3')).toEqual({ kind: 'cell', page: 3 })
        expect(parseDropTarget('dock:1')).toEqual({ kind: 'dock' })
        expect(parseDropTarget('onto:com.apple.mobilesafari')).toEqual({
            kind: 'onto',
            id: 'com.apple.mobilesafari',
        })
        expect(parseDropTarget('nonsense')).toBeNull()
    })

    it('keeps the colons inside a folder id', () => {
        const folder: FolderSlot = { id: 'folder:12', kind: 'folder', name: 'Games', apps: [] }
        expect(parseDropTarget(panelTarget(folder))).toEqual({ kind: 'infolder', id: 'folder:12' })
        expect(parseDropTarget('onto:folder:12')).toEqual({ kind: 'onto', id: 'folder:12' })
    })

    it('strips the per-page scope off a dock tile', () => {
        expect(bareId(dockId(4, 'com.apple.mobilephone'))).toBe('com.apple.mobilephone')
        expect(bareId('com.apple.mobilephone')).toBe('com.apple.mobilephone')
    })

    it('treats whole pages and folder panels as wide targets, tiles as narrow', () => {
        expect(isWideTarget('page:0')).toBe(true)
        expect(isWideTarget('infolder:folder:1:3')).toBe(true)
        expect(isWideTarget('onto:com.x')).toBe(false)
    })
})

describe('which side of a tile a drop lands on', () => {
    const over = { left: 100, width: 60 }
    const at = (centre: number) => ({ left: centre - 10, width: 20 })

    it('reorders on the outer thirds and combines in the middle', () => {
        expect(sideOf(at(110), over)).toBe('before')
        expect(sideOf(at(130), over)).toBe('onto')
        expect(sideOf(at(150), over)).toBe('after')
    })

    it('combines when the dragged box is unknown', () => {
        expect(sideOf(null, over)).toBe('onto')
    })
})
