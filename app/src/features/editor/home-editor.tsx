import { DndContext, DragOverlay, PointerSensor, pointerWithin, useSensor, useSensors } from '@dnd-kit/core'
import { AnimatePresence } from 'motion/react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import ContextMenu from './context-menu'
import DockRow from './dock-row'
import { isFolderSlot } from './editor.types'
import FolderSheet from './folder-sheet'
import { SEPARATOR, parseDropTarget, sideOf } from './home-editor.types'
import { IconsProvider } from './icons.context'
import { ScreenProvider, geometryFor } from './screen.context'
import PageDots from './page-dots'
import PagesStrip from './pages-strip'
import PhoneFrame from './phone-frame'
import SlotTile from './slot-tile'

import type { DragEndEvent, DragMoveEvent, DragStartEvent } from '@dnd-kit/core'
import type { ContextMenuState, MenuItem } from './context-menu.types'
import type { FolderSlot, Slot, Target } from './editor.types'
import type { Hint, HomeEditorProps } from './home-editor.types'

export default function HomeEditor({
    state,
    limits,
    icons,
    selection,
    aspect,
    offline,
    commands,
    dispatch,
    onSelectionChange,
}: HomeEditorProps) {
    const [page, setPage] = useState(0)
    const [openFolderId, setOpenFolderId] = useState<string | null>(null)
    const [dragging, setDragging] = useState<Slot | null>(null)
    const [hint, setHint] = useState<Hint | null>(null)
    const [menu, setMenu] = useState<ContextMenuState | null>(null)
    const [size, setSize] = useState({ width: 0, height: 0 })

    // Press and hold to drag; a quick click stays a click, which is what lets a
    // single tap open a folder the way it does on the phone.
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { delay: 170, tolerance: 8 } })
    )
    const geometry = useMemo(() => geometryFor(size.width, size.height, limits), [size, limits])
    const { layout } = state
    const pageCount = layout.pages.length

    const openFolder = useMemo<FolderSlot | null>(() => {
        if (!openFolderId) return null
        const found = layout.pages.flat().find(slot => slot.id === openFolderId)
        return found && isFolderSlot(found) ? found : null
    }, [layout, openFolderId])

    const go = useCallback((next: number) => setPage(Math.max(0, Math.min(next, pageCount - 1))), [pageCount])

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

    const zoneFor = useCallback(
        (id: string): Target['zone'] => {
            if (layout.dock.some(slot => slot.id === id)) return { kind: 'dock' }
            const at = layout.pages.findIndex(slots => slots.some(slot => slot.id === id))
            if (at >= 0) return { kind: 'page', page: at }
            const holder = layout.pages
                .flat()
                .filter(isFolderSlot)
                .find(folder => folder.apps.some(app => app.id === id))
            return holder ? { kind: 'folder', id: holder.id } : { kind: 'page', page }
        },
        [layout, page]
    )

    const handleDragStart = useCallback(
        ({ active }: DragStartEvent) => {
            const id = String(active.id)
            const loose = [...layout.dock, ...layout.pages.flat()].find(slot => slot.id === id)
            const inFolder = layout.pages
                .flat()
                .filter(isFolderSlot)
                .flatMap(folder => folder.apps)
                .find(app => app.id === id)
            setDragging(loose ?? inFolder ?? null)
        },
        [layout]
    )

    const handleDragMove = useCallback(({ active, over }: DragMoveEvent) => {
        const target = over ? parseDropTarget(String(over.id)) : null
        if (!over || target?.kind !== 'onto') {
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
        },
        [dispatch, onSelectionChange, selection, zoneFor]
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
                    onPick: handleGroup,
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
            if (items.length) items.push(SEPARATOR)

            // Adding a page blanks the screen and the cause is not found yet, so the
            // command is held back rather than shipped broken.
            items.push({
                label: 'Add a page',
                disabled: pageCount >= limits.pages,
                onPick: () => dispatch({ type: 'add-page' }),
            })
            items.push({
                label: 'Remove this page',
                disabled: pageCount < 2 || (layout.pages[page]?.length ?? 0) > 0,
                onPick: () => dispatch({ type: 'remove-page', page }),
            })
            items.push({ label: 'Undo', shortcut: '⌘Z', onPick: () => dispatch({ type: 'undo' }) })
            items.push({ label: 'Redo', shortcut: '⇧⌘Z', onPick: () => dispatch({ type: 'redo' }) })
            items.push({ label: 'Discard edits', disabled: !commands.dirty, onPick: commands.onDiscard })
            items.push(SEPARATOR)

            items.push({ label: 'Sort into folders', onPick: () => commands.onPropose(false) })
            items.push({ label: 'Sort, looking up unknown apps', onPick: () => commands.onPropose(true) })
            items.push(SEPARATOR)

            items.push({ label: 'Read from iPhone again', onPick: commands.onReload })
            items.push(SEPARATOR)

            items.push({
                label: 'Review changes…',
                disabled: !commands.dirty,
                onPick: commands.onReview,
            })
            items.push({
                label: 'Undo last write to iPhone',
                danger: true,
                disabled: !commands.canUndoWrite,
                onPick: commands.onUndoWrite,
            })

            setMenu({ x: event.clientX, y: event.clientY, items })
        },
        [commands, dispatch, handleGroup, layout, limits.pages, page, pageCount, selection]
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
    }, [dispatch, go, handleGroup, limits.pages, onSelectionChange, page, pageCount])

    return (
        <IconsProvider value={icons}>
            <ScreenProvider value={geometry}>
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
                    <PhoneFrame aspect={aspect} onMeasure={setSize}>
                        {offline ? (
                            <div className='absolute inset-0 z-30 grid place-items-center bg-black/45 px-10 backdrop-blur-md'>
                                <p className='text-center text-[13px] leading-relaxed text-white/85'>
                                    {offline}
                                </p>
                            </div>
                        ) : null}

                        <PagesStrip
                            pages={layout.pages}
                            limits={limits}
                            selection={selection}
                            hint={hint}
                            page={page}
                            onPageChange={setPage}
                            onSelect={handleSelect}
                            onOpen={setOpenFolderId}
                            onContextMenu={openMenu}
                        />
                        <div className='pb-[10px]'>
                            <PageDots count={pageCount} active={page} onGo={go} />
                        </div>
                        <div onContextMenu={event => openMenu(event)}>
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
                                    onContextMenu={openMenu}
                                />
                            ) : null}
                        </AnimatePresence>
                    </PhoneFrame>

                    <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.32,0.72,0,1)' }}>
                        {dragging ? (
                            <div className='w-[74px] rotate-[2deg] drop-shadow-[0_18px_28px_rgba(0,0,0,0.7)]'>
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
            </ScreenProvider>
        </IconsProvider>
    )
}
