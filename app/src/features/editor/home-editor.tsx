import { DndContext, DragOverlay, PointerSensor, pointerWithin, useSensor, useSensors } from '@dnd-kit/core'
import { AnimatePresence } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { LogicalSize, currentMonitor, getCurrentWindow } from '@tauri-apps/api/window'

import ContextMenu from './context-menu'
import DockRow from './dock-row'
import { isFolderSlot } from './editor.types'
import FolderSheet from './folder-sheet'
import { SEPARATOR, bareId, isWideTarget, parseDropTarget, sideOf } from './home-editor.types'
import { IconsProvider } from './icons.context'
import { ScreenProvider, geometryFor } from './screen.context'
import HomePage from './home-page'
import PhoneFrame from './phone-frame'
import SlotTile from './slot-tile'

import type { CollisionDetection, DragEndEvent, DragMoveEvent, DragStartEvent } from '@dnd-kit/core'
import type { ContextMenuState, MenuItem } from './context-menu.types'
import type { FolderSlot, Slot, Target } from './editor.types'
import type { Hint, HomeEditorProps } from './home-editor.types'

/**
 * Follow the row of devices with the window, up to what the display can hold —
 * the overflow stays reachable by scrolling. The amount is measured off the
 * scroller rather than worked out from an icon size, which is what let a single
 * added page throw the window a thousand points wide.
 */
const fitWindow = async (overflow: number) => {
    const window_ = getCurrentWindow()
    const factor = await window_.scaleFactor()
    const outer = (await window_.outerSize()).toLogical(factor)
    const monitor = await currentMonitor()
    const room = monitor ? monitor.size.toLogical(factor).width - 40 : outer.width + overflow

    const width = Math.round(Math.max(360, Math.min(outer.width + overflow, room)))
    if (width === Math.round(outer.width)) return
    await window_.setSize(new LogicalSize(width, Math.round(outer.height)))
}

/** The px-1 breathing room either side of the row, and the gap-5 between. */
const EDGES = 8
const GAP = 20

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
    const [openFolderId, setOpenFolderId] = useState<string | null>(null)
    const [dragging, setDragging] = useState<Slot | null>(null)
    const [hint, setHint] = useState<Hint | null>(null)
    const [menu, setMenu] = useState<ContextMenuState | null>(null)
    const [size, setSize] = useState({ width: 0, height: 0 })
    const scroller = useRef<HTMLDivElement>(null)
    const drawn = useRef(0)

    // Press and hold to drag; a quick click stays a click, which is what lets a
    // single tap open a folder the way it does on the phone.
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { delay: 170, tolerance: 8 } })
    )
    const geometry = useMemo(() => geometryFor(size.width, size.height, limits), [size, limits])
    const { layout } = state
    const pageCount = layout.pages.length

    const openFolderPage = useMemo(
        () => layout.pages.findIndex(slots => slots.some(slot => slot.id === openFolderId)),
        [layout, openFolderId]
    )

    const openFolder = useMemo<FolderSlot | null>(() => {
        if (!openFolderId) return null
        const found = layout.pages.flat().find(slot => slot.id === openFolderId)
        return found && isFolderSlot(found) ? found : null
    }, [layout, openFolderId])

    /**
     * An open folder sits above the page, but collisions are settled by where
     * the pointer is, not by what is on top — so missing a tile inside the
     * folder used to drop the icon onto the page behind it. Inside the panel,
     * only the folder's own targets count.
     */
    const collisionDetection = useCallback<CollisionDetection>(
        args => {
            const hits = pointerWithin(args)

            const narrow = (found: typeof hits) => {
                const tight = found.filter(hit => !isWideTarget(String(hit.id)))
                return tight.length ? tight : found
            }

            if (!openFolder) return narrow(hits)

            const held = new Set(openFolder.apps.map(app => `onto:${app.id}`))
            const inside = hits.filter(hit => {
                const id = String(hit.id)
                return held.has(id) || id.startsWith(`infolder:${openFolder.id}:`)
            })

            return inside.length ? narrow(inside) : []
        },
        [openFolder]
    )

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
            return holder ? { kind: 'folder', id: holder.id } : { kind: 'page', page: 0 }
        },
        [layout]
    )

    const handleDragStart = useCallback(
        ({ active }: DragStartEvent) => {
            const id = bareId(String(active.id))
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

            const dragged = bareId(String(active.id))
            const ids = selection.has(dragged) ? [...selection] : [dragged]

            if (target.kind === 'onto') {
                const ontoId = bareId(target.id)
                if (ontoId === dragged) return
                const side = sideOf(active.rect.current.translated, over.rect)
                if (side === 'onto') dispatch({ type: 'combine', ids, ontoId })
                else
                    dispatch({
                        type: 'move',
                        ids,
                        target: { zone: zoneFor(ontoId), anchorId: ontoId, position: side },
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
        (event: React.MouseEvent, id?: string, page?: number) => {
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

            items.push({
                label: 'Add a page',
                disabled: pageCount >= limits.pages,
                onPick: () => dispatch({ type: 'add-page' }),
            })
            const which = page ?? pageCount - 1
            items.push({
                label: 'Remove this page',
                disabled: pageCount < 2 || (layout.pages[which]?.length ?? 0) > 0,
                onPick: () => dispatch({ type: 'remove-page', page: which }),
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
        [commands, dispatch, handleGroup, layout, limits.pages, pageCount, selection]
    )

    // The row of devices changed width, so the window follows it and the newest
    // page is scrolled into view.
    useEffect(() => {
        const node = scroller.current
        if (!node) return

        const grew = pageCount > drawn.current
        drawn.current = pageCount

        // Every device is the same width, so the row is measured off the first
        // one. A page that has just appeared has not been measured yet — asking
        // the row itself would read the new device as nothing at all.
        const frame = node.firstElementChild?.getBoundingClientRect().width ?? 0
        if (!frame) return

        const width = pageCount * frame + (pageCount - 1) * GAP + EDGES
        const overflow = Math.round(width - node.clientWidth)

        // Widen for a page that does not fit, give the space back when a page
        // goes — but never claw back room the window was widened by hand. The
        // scroll waits for the window, or it drags the first device off screen.
        const settle = async () => {
            if (grew && overflow > 2) await fitWindow(overflow)
            if (!grew && overflow < -2) await fitWindow(overflow)
            if (grew) node.scrollTo({ left: node.scrollWidth, behavior: 'smooth' })
        }
        void settle()
    }, [pageCount])

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.target instanceof HTMLInputElement) return
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
    }, [dispatch, handleGroup, onSelectionChange])

    return (
        <IconsProvider value={icons}>
            <ScreenProvider value={geometry}>
                <DndContext
                    sensors={sensors}
                    collisionDetection={collisionDetection}
                    onDragStart={handleDragStart}
                    onDragMove={handleDragMove}
                    onDragEnd={handleDragEnd}
                    onDragCancel={() => {
                        setDragging(null)
                        setHint(null)
                    }}
                >
                    <div
                        ref={scroller}
                        className='flex h-full min-h-0 gap-5 overflow-x-auto px-1 [scrollbar-width:thin]'
                    >
                        {layout.pages.map((slots, index) => (
                            <PhoneFrame
                                key={index}
                                aspect={aspect}
                                label={
                                    slots.length
                                        ? `Page ${index + 1}`
                                        : `Page ${index + 1} · empty, not written`
                                }
                                onMeasure={index === 0 ? setSize : undefined}
                            >
                                <div
                                    className='min-h-0 flex-1 pt-[7%]'
                                    onContextMenu={event => openMenu(event, undefined, index)}
                                >
                                    <HomePage
                                        page={index}
                                        slots={slots}
                                        limits={limits}
                                        selection={selection}
                                        hint={hint}
                                        onSelect={handleSelect}
                                        onOpen={setOpenFolderId}
                                        onContextMenu={(event, slotId) => openMenu(event, slotId, index)}
                                    />
                                </div>
                                <div onContextMenu={event => openMenu(event, undefined, index)}>
                                    <DockRow
                                        page={index}
                                        slots={layout.dock}
                                        limits={limits}
                                        selection={selection}
                                        hint={hint}
                                        onSelect={handleSelect}
                                        onContextMenu={(event, slotId) => openMenu(event, slotId, index)}
                                    />
                                </div>

                                {offline && index === 0 ? (
                                    <div className='absolute inset-0 z-30 grid place-items-center bg-black/45 px-10 backdrop-blur-md'>
                                        <p className='text-center text-[13px] leading-relaxed whitespace-pre-line text-white/85'>
                                            {offline}
                                        </p>
                                    </div>
                                ) : null}

                                <AnimatePresence>
                                    {openFolder && openFolderPage === index ? (
                                        <FolderSheet
                                            folder={openFolder}
                                            limits={limits}
                                            selection={selection}
                                            hint={hint}
                                            onSelect={handleSelect}
                                            onRename={name =>
                                                dispatch({ type: 'rename', id: openFolder.id, name })
                                            }
                                            onDissolve={() => {
                                                dispatch({ type: 'dissolve', id: openFolder.id })
                                                setOpenFolderId(null)
                                            }}
                                            onClose={() => setOpenFolderId(null)}
                                            onContextMenu={(event, slotId) => openMenu(event, slotId, index)}
                                        />
                                    ) : null}
                                </AnimatePresence>
                            </PhoneFrame>
                        ))}
                    </div>

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
