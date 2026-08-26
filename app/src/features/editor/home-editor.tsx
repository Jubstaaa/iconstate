import { DndContext, DragOverlay, PointerSensor, pointerWithin, useSensor, useSensors } from '@dnd-kit/core'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import ContextMenu from './context-menu'
import DockRow from './dock-row'
import { isFolderSlot } from './editor.types'
import FolderSheet from './folder-sheet'
import { parseDropTarget, sideOf } from './home-editor.types'
import HomePage from './home-page'
import { IconsProvider } from './icons.context'
import PageDots from './page-dots'
import PhoneFrame from './phone-frame'
import SlotTile from './slot-tile'

import type { DragEndEvent, DragMoveEvent, DragStartEvent } from '@dnd-kit/core'
import type { FolderSlot, Slot, Target } from './editor.types'
import type { ContextMenuState, MenuItem } from './context-menu.types'
import type { Hint, HomeEditorProps } from './home-editor.types'

/** Apple's standard ease-out; the page glide is the whole reason it feels native. */
const GLIDE = { duration: 0.38, ease: [0.32, 0.72, 0, 1] as const }

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
    const [[page, direction], setPage] = useState<[number, number]>([0, 0])
    const [openFolderId, setOpenFolderId] = useState<string | null>(null)
    const [dragging, setDragging] = useState<Slot | null>(null)
    const [hint, setHint] = useState<Hint | null>(null)
    const [menu, setMenu] = useState<ContextMenuState | null>(null)
    const wheelLock = useRef(0)

    // Press and hold to drag; a quick click stays a click, which is what lets a
    // single tap open a folder the way it does on the phone.
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { delay: 170, tolerance: 8 } })
    )
    const { layout } = state
    const pageCount = layout.pages.length

    const go = useCallback(
        (next: number) =>
            setPage(([current]) => {
                const clamped = Math.max(0, Math.min(next, pageCount - 1))
                return [clamped, clamped > current ? 1 : clamped < current ? -1 : 0]
            }),
        [pageCount]
    )

    const openFolder = useMemo<FolderSlot | null>(() => {
        if (!openFolderId) return null
        const found = layout.pages.flat().find(slot => slot.id === openFolderId)
        return found && isFolderSlot(found) ? found : null
    }, [layout, openFolderId])

    useEffect(() => {
        if (page > pageCount - 1) go(pageCount - 1)
    }, [go, page, pageCount])

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

    const handleDragStart = useCallback(
        ({ active }: DragStartEvent) => {
            const id = String(active.id)
            const found = [...layout.dock, ...layout.pages.flat()].find(slot => slot.id === id)
            const inFolder = layout.pages
                .flat()
                .filter(isFolderSlot)
                .flatMap(folder => folder.apps)
                .find(app => app.id === id)
            setDragging(found ?? inFolder ?? null)
        },
        [layout]
    )

    const handleDragMove = useCallback(({ active, over }: DragMoveEvent) => {
        if (!over) {
            setHint(null)
            return
        }
        const target = parseDropTarget(String(over.id))
        if (target?.kind !== 'onto') {
            setHint(null)
            return
        }
        setHint({ id: target.id, side: sideOf(active.rect.current.translated, over.rect) })
    }, [])

    const handleDragEnd = useCallback(
        ({ active, over }: DragEndEvent) => {
            setDragging(null)
            setHint(null)
            if (!over) return

            const target = parseDropTarget(String(over.id))
            if (!target) return

            const dragged = String(active.id)
            const ids = selection.has(dragged) ? [...selection] : [dragged]

            if (target.kind === 'onto') {
                if (target.id === dragged) return
                const side = sideOf(active.rect.current.translated, over.rect)
                if (side === 'onto') dispatch({ type: 'combine', ids, ontoId: target.id })
                else
                    dispatch({
                        type: 'move',
                        ids,
                        target: { zone: zoneFor(target.id), anchorId: target.id, position: side },
                    })
            } else {
                const zone: Target['zone'] =
                    target.kind === 'cell'
                        ? { kind: 'page', page: target.page }
                        : target.kind === 'dock'
                          ? { kind: 'dock' }
                          : { kind: 'folder', id: target.id }
                dispatch({ type: 'move', ids, target: { zone } })
            }
            onSelectionChange(new Set())

            function zoneFor(id: string): Target['zone'] {
                if (layout.dock.some(slot => slot.id === id)) return { kind: 'dock' }
                const at = layout.pages.findIndex(slots => slots.some(slot => slot.id === id))
                if (at >= 0) return { kind: 'page', page: at }
                const holder = layout.pages
                    .flat()
                    .filter(isFolderSlot)
                    .find(folder => folder.apps.some(app => app.id === id))
                return holder ? { kind: 'folder', id: holder.id } : { kind: 'page', page }
            }
        },
        [dispatch, layout, onSelectionChange, page, selection]
    )

    const handleGroup = useCallback(() => {
        if (selection.size < 2) return
        dispatch({ type: 'group', ids: [...selection], name: 'New Folder' })
        onSelectionChange(new Set())
    }, [dispatch, onSelectionChange, selection])

    const openMenu = useCallback(
        (event: React.MouseEvent, id?: string) => {
            event.preventDefault()
            event.stopPropagation()

            const slot = id
                ? [...layout.dock, ...layout.pages.flat()].find(item => item.id === id)
                : undefined
            const chosen = id && selection.has(id) ? [...selection] : id ? [id] : [...selection]
            const items: MenuItem[] = []

            if (chosen.length > 1) {
                items.push({
                    label: `New folder from ${chosen.length} apps`,
                    shortcut: '⌘G',
                    onPick: () => {
                        dispatch({ type: 'group', ids: chosen, name: 'New Folder' })
                        onSelectionChange(new Set())
                    },
                })
            }

            if (slot && isFolderSlot(slot)) {
                items.push({ label: 'Open folder', onPick: () => setOpenFolderId(slot.id) })
                items.push({
                    label: 'Empty onto this page',
                    onPick: () => dispatch({ type: 'dissolve', id: slot.id }),
                })
            }

            if (slot && !isFolderSlot(slot) && chosen.length === 1) {
                items.push({
                    label: 'Put in a new folder',
                    onPick: () => dispatch({ type: 'group', ids: chosen, name: slot.app.displayName }),
                })
            }

            items.push({
                label: 'Add a page',
                disabled: pageCount >= limits.pages,
                onPick: () => dispatch({ type: 'add-page' }),
            })
            items.push({
                label: 'Select nothing',
                disabled: !selection.size,
                onPick: () => onSelectionChange(new Set()),
            })
            items.push({ label: 'Undo', shortcut: '⌘Z', onPick: () => dispatch({ type: 'undo' }) })

            setMenu({ x: event.clientX, y: event.clientY, items })
        },
        [dispatch, layout, limits.pages, onSelectionChange, pageCount, selection]
    )

    const handleWheel = useCallback(
        (event: React.WheelEvent) => {
            if (Math.abs(event.deltaX) < Math.abs(event.deltaY) || Math.abs(event.deltaX) < 24) return
            const now = event.timeStamp
            if (now - wheelLock.current < 420) return
            wheelLock.current = now
            go(page + (event.deltaX > 0 ? 1 : -1))
        },
        [go, page]
    )

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.target instanceof HTMLInputElement) return
            if (event.key === 'ArrowRight') go(page + 1)
            if (event.key === 'ArrowLeft') go(page - 1)
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
    }, [dispatch, go, handleGroup, onSelectionChange, page])

    const arrow =
        'rounded-full bg-panel px-3 py-6 text-dim ring-1 ring-hairline transition hover:text-chalk disabled:opacity-25'

    return (
        <IconsProvider value={icons}>
            <DndContext
                sensors={sensors}
                collisionDetection={pointerWithin}
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragEnd={handleDragEnd}
                onDragCancel={() => {
                    setDragging(null)
                    setHint(null)
                }}
            >
                <div className='flex h-full items-center justify-center gap-6'>
                    <button onClick={() => go(page - 1)} disabled={page === 0} className={arrow}>
                        ‹
                    </button>

                    <PhoneFrame wallpaper={wallpaper} aspect={aspect}>
                        <div
                            className='relative min-h-0 flex-1 overflow-hidden'
                            onWheel={handleWheel}
                            onContextMenu={event => openMenu(event)}
                        >
                            <AnimatePresence initial={false} custom={direction} mode='popLayout'>
                                <motion.div
                                    key={page}
                                    custom={direction}
                                    initial={{ x: direction === 0 ? 0 : `${direction * 100}%` }}
                                    animate={{ x: 0 }}
                                    exit={{ x: `${direction * -100}%` }}
                                    transition={GLIDE}
                                    className='absolute inset-0 px-[6%] pb-[1%] pt-[3%]'
                                >
                                    <HomePage
                                        page={page}
                                        slots={layout.pages[page] ?? []}
                                        limits={limits}
                                        selection={selection}
                                        hint={hint}
                                        onSelect={handleSelect}
                                        onOpen={setOpenFolderId}
                                        onContextMenu={openMenu}
                                    />
                                </motion.div>
                            </AnimatePresence>
                        </div>
                        <div className='px-[6%] pb-[1%]'>
                            <PageDots count={pageCount} active={page} onGo={go} />
                        </div>
                        <div className='px-[5%] pb-[2%] pt-[1%]'>
                            <DockRow
                                slots={layout.dock}
                                limits={limits}
                                selection={selection}
                                hint={hint}
                                onSelect={handleSelect}
                                onContextMenu={openMenu}
                            />
                        </div>
                        <AnimatePresence>
                            {openFolder ? (
                                <FolderSheet
                                    folder={openFolder}
                                    limits={limits}
                                    selection={selection}
                                    hint={hint}
                                    onSelect={handleSelect}
                                    onRename={name => dispatch({ type: 'rename', id: openFolder.id, name })}
                                    onDissolve={() => {
                                        dispatch({ type: 'dissolve', id: openFolder.id })
                                        setOpenFolderId(null)
                                    }}
                                    onClose={() => setOpenFolderId(null)}
                                />
                            ) : null}
                        </AnimatePresence>
                    </PhoneFrame>

                    <button
                        onClick={() =>
                            page === pageCount - 1 ? dispatch({ type: 'add-page' }) : go(page + 1)
                        }
                        disabled={page === pageCount - 1 && pageCount >= limits.pages}
                        title={page === pageCount - 1 ? 'Add a page' : 'Next page'}
                        className={arrow}
                    >
                        {page === pageCount - 1 ? '+' : '›'}
                    </button>
                </div>

                <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.32,0.72,0,1)' }}>
                    {dragging ? (
                        <div className='w-[76px] rotate-[2deg] drop-shadow-[0_18px_28px_rgba(0,0,0,0.65)]'>
                            <SlotTile
                                slot={dragging}
                                limits={limits}
                                selected={false}
                                dimmed={false}
                                onSelect={() => {}}
                            />
                        </div>
                    ) : null}
                </DragOverlay>

                <AnimatePresence>
                    {menu ? <ContextMenu menu={menu} onClose={() => setMenu(null)} /> : null}
                </AnimatePresence>
            </DndContext>
        </IconsProvider>
    )
}
