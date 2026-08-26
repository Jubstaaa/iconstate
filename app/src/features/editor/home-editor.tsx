import { DndContext, PointerSensor, pointerWithin, useSensor, useSensors } from '@dnd-kit/core'
import { useCallback, useEffect, useMemo, useState } from 'react'

import DockRow from './dock-row'
import { isFolderSlot } from './editor.types'
import FolderSheet from './folder-sheet'
import HomePage from './home-page'
import { IconsProvider } from './icons.context'
import PageDots from './page-dots'
import PhoneFrame from './phone-frame'
import { parseDropTarget } from './home-editor.types'

import type { DragEndEvent } from '@dnd-kit/core'
import type { FolderSlot, Target } from './editor.types'
import type { HomeEditorProps } from './home-editor.types'

export default function HomeEditor({
    state,
    limits,
    icons,
    wallpaper,
    aspect,
    selection,
    dispatch,
    onSelectionChange,
}: HomeEditorProps) {
    const [page, setPage] = useState(0)
    const [openFolderId, setOpenFolderId] = useState<string | null>(null)

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
    const { layout } = state
    const pageCount = layout.pages.length

    const openFolder = useMemo<FolderSlot | null>(() => {
        if (!openFolderId) return null
        const found = layout.pages.flat().find(slot => slot.id === openFolderId)
        return found && isFolderSlot(found) ? found : null
    }, [layout, openFolderId])

    useEffect(() => {
        if (page > pageCount - 1) setPage(Math.max(0, pageCount - 1))
    }, [page, pageCount])

    const handleSelect = useCallback(
        (id: string, additive: boolean) => {
            if (!additive) {
                onSelectionChange(selection.has(id) && selection.size === 1 ? new Set() : new Set([id]))
                return
            }
            const next = new Set(selection)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            onSelectionChange(next)
        },
        [onSelectionChange, selection]
    )

    const handleDragEnd = useCallback(
        ({ active, over }: DragEndEvent) => {
            if (!over) return
            const target = parseDropTarget(String(over.id))
            if (!target) return

            const dragged = String(active.id)
            const ids = selection.has(dragged) ? [...selection] : [dragged]

            if (target.kind === 'onto') {
                if (target.id === dragged) return
                dispatch({ type: 'combine', ids, ontoId: target.id })
            } else {
                const zone: Target['zone'] =
                    target.kind === 'cell'
                        ? { kind: 'page', page: target.page }
                        : target.kind === 'dock'
                          ? { kind: 'dock' }
                          : { kind: 'folder', id: target.id }
                dispatch({ type: 'move', ids, target: { zone, index: target.index } })
            }
            onSelectionChange(new Set())
        },
        [dispatch, onSelectionChange, selection]
    )

    const handleGroup = useCallback(() => {
        if (selection.size < 2) return
        dispatch({ type: 'group', ids: [...selection], name: 'New Folder' })
        onSelectionChange(new Set())
    }, [dispatch, onSelectionChange, selection])

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.target instanceof HTMLInputElement) return
            if (event.key === 'ArrowRight') setPage(current => Math.min(current + 1, pageCount - 1))
            if (event.key === 'ArrowLeft') setPage(current => Math.max(current - 1, 0))
            if (event.key === 'Escape') {
                setOpenFolderId(null)
                onSelectionChange(new Set())
            }
            if (event.key === 'g' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                handleGroup()
            }
            if (event.key === 'z' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                dispatch({ type: event.shiftKey ? 'redo' : 'undo' })
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [dispatch, handleGroup, onSelectionChange, pageCount])

    return (
        <IconsProvider value={icons}>
            <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
                <div className='flex h-full items-center justify-center gap-6'>
                    <button
                        onClick={() => setPage(current => Math.max(current - 1, 0))}
                        disabled={page === 0}
                        className='rounded-full bg-panel px-3 py-6 text-dim ring-1 ring-hairline transition hover:text-chalk disabled:opacity-30'
                    >
                        ‹
                    </button>

                    <PhoneFrame wallpaper={wallpaper} aspect={aspect}>
                        <div className='relative min-h-0 flex-1 px-[6%] pb-[1%] pt-[10%]'>
                            <HomePage
                                page={page}
                                slots={layout.pages[page] ?? []}
                                limits={limits}
                                selection={selection}
                                onSelect={handleSelect}
                                onOpen={setOpenFolderId}
                            />
                        </div>
                        <div className='px-[6%] pb-[1%]'>
                            <PageDots count={pageCount} active={page} onGo={setPage} />
                        </div>
                        <div className='px-[5%] pb-[5%] pt-[1%]'>
                            <DockRow
                                slots={layout.dock}
                                limits={limits}
                                selection={selection}
                                onSelect={handleSelect}
                            />
                        </div>
                        {openFolder ? (
                            <FolderSheet
                                folder={openFolder}
                                limits={limits}
                                selection={selection}
                                onSelect={handleSelect}
                                onRename={name => dispatch({ type: 'rename', id: openFolder.id, name })}
                                onDissolve={() => {
                                    dispatch({ type: 'dissolve', id: openFolder.id })
                                    setOpenFolderId(null)
                                }}
                                onClose={() => setOpenFolderId(null)}
                            />
                        ) : null}
                    </PhoneFrame>

                    <button
                        onClick={() =>
                            page === pageCount - 1
                                ? dispatch({ type: 'add-page' })
                                : setPage(current => Math.min(current + 1, pageCount - 1))
                        }
                        disabled={page === pageCount - 1 && pageCount >= limits.pages}
                        title={page === pageCount - 1 ? 'Add a page' : 'Next page'}
                        className='rounded-full bg-panel px-3 py-6 text-dim ring-1 ring-hairline transition hover:text-chalk disabled:opacity-30'
                    >
                        {page === pageCount - 1 ? '+' : '›'}
                    </button>
                </div>
            </DndContext>
        </IconsProvider>
    )
}
