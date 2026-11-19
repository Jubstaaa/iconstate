import { describe, expect, it } from 'vitest'

import { LIMITS, app, load } from '../../lib/fixtures'
import { appsOf, keyOf } from '../../lib/icon-state'
import { hasEdits, initialEditorState, makeEditorReducer, toIconState, toLayout } from './editor.reducer'

import type { FolderIcon, IconState } from '../../lib/core.types'
import type { Action, EditorState, Slot } from './editor.types'

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

const reduce = makeEditorReducer(LIMITS)

const run = (state: IconState, ...actions: Action[]): EditorState =>
    actions.reduce(reduce, reduce(initialEditorState, { type: 'load', state }))

const ids = (slots: Slot[] | undefined) => (slots ?? []).map(slot => slot.id)

const folderIn = (state: EditorState, page = 0) =>
    state.layout.pages[page]?.find(slot => slot.kind === 'folder')

const a = app('com.a', 'A')
const b = app('com.b', 'B')
const c = app('com.c', 'C')
const d = app('com.d', 'D')

describe('editing the layout', () => {
    it('moves an app to another page, next to the slot it was dropped by', () => {
        const state = run([[], [a, b], [c]], {
            type: 'move',
            ids: ['com.a'],
            target: { zone: { kind: 'page', page: 1 }, anchorId: 'com.c', position: 'after' },
        })

        expect(ids(state.layout.pages[0])).toEqual(['com.b'])
        expect(ids(state.layout.pages[1])).toEqual(['com.c', 'com.a'])
    })

    it('makes a folder named after the app another one was dropped onto', () => {
        const state = run([[], [a, b, c]], { type: 'combine', ids: ['com.c'], ontoId: 'com.a' })

        const folder = folderIn(state)
        expect(folder?.kind === 'folder' && folder.name).toBe('A')
        expect(folder?.kind === 'folder' && ids(folder.apps)).toEqual(['com.a', 'com.c'])
        expect(state.layout.pages[0]?.map(slot => slot.kind)).toEqual(['folder', 'app'])
    })

    it('files an app dropped onto a folder into it', () => {
        const games: FolderIcon = { displayName: 'Games', listType: 'folder', iconLists: [[a]] }
        const loaded = run([[], [games, b]])
        const folderId = folderIn(loaded)?.id ?? ''

        const state = reduce(loaded, { type: 'combine', ids: ['com.b'], ontoId: folderId })

        const folder = folderIn(state)
        expect(folder?.kind === 'folder' && ids(folder.apps)).toEqual(['com.a', 'com.b'])
        expect(state.layout.pages[0]).toHaveLength(1)
    })

    it('refuses a drop that would overfill the dock', () => {
        const dock = Array.from({ length: LIMITS.dock }, (_, index) => app(`com.dock${index}`, `D${index}`))
        const loaded = run([dock, [a]])

        const state = reduce(loaded, { type: 'move', ids: ['com.a'], target: { zone: { kind: 'dock' } } })

        expect(state).toBe(loaded)
    })

    it('rolls a full page over onto the next one', () => {
        const page = Array.from({ length: LIMITS.page }, (_, index) => app(`com.p${index}`, `P${index}`))
        const state = run([[], page, [a]], {
            type: 'move',
            ids: ['com.a'],
            target: { zone: { kind: 'page', page: 0 } },
        })

        expect(state.layout.pages[0]).toHaveLength(LIMITS.page)
        expect(ids(state.layout.pages[1])).toEqual(['com.a'])
    })

    it('empties a folder back onto its page, where it stood', () => {
        const games: FolderIcon = { displayName: 'Games', listType: 'folder', iconLists: [[a, b]] }
        const loaded = run([[], [c, games, d]])

        const state = reduce(loaded, { type: 'dissolve', id: folderIn(loaded)?.id ?? '' })

        expect(ids(state.layout.pages[0])).toEqual(['com.c', 'com.a', 'com.b', 'com.d'])
    })

    it('drops a folder once its last app is dragged out', () => {
        const games: FolderIcon = { displayName: 'Games', listType: 'folder', iconLists: [[a]] }
        const state = run([[], [games, b]], {
            type: 'move',
            ids: ['com.a'],
            target: { zone: { kind: 'page', page: 0 } },
        })

        expect(ids(state.layout.pages[0])).toEqual(['com.b', 'com.a'])
    })

    it('removes only an empty page', () => {
        const loaded = run([[], [a]], { type: 'add-page' })

        expect(reduce(loaded, { type: 'remove-page', page: 0 })).toBe(loaded)
        expect(reduce(loaded, { type: 'remove-page', page: 1 }).layout.pages).toHaveLength(1)
    })

    it('undoes and redoes an edit', () => {
        const moved = run([[], [a, b]], {
            type: 'move',
            ids: ['com.a'],
            target: { zone: { kind: 'page', page: 0 } },
        })
        const undone = reduce(moved, { type: 'undo' })
        const redone = reduce(undone, { type: 'redo' })

        expect(ids(undone.layout.pages[0])).toEqual(['com.a', 'com.b'])
        expect(ids(redone.layout.pages[0])).toEqual(['com.b', 'com.a'])
    })

    it('never loses or doubles an app while editing a real home screen', () => {
        const baseline = load('state-final2.json')
        const loaded = run(baseline)
        const [first, second] = loaded.layout.pages[0] ?? []

        const edits: Action[] = [
            { type: 'combine', ids: [second?.id ?? ''], ontoId: first?.id ?? '' },
            { type: 'add-page' },
            { type: 'move', ids: [first?.id ?? ''], target: { zone: { kind: 'page', page: 1 } } },
        ]
        const state = edits.reduce(reduce, loaded)

        const before = appsOf(baseline).map(keyOf).sort()
        const after = appsOf(toIconState(state.layout, LIMITS)).map(keyOf).sort()
        expect(after).toEqual(before)
    })
})
