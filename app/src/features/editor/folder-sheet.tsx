import { motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import EmptyCell from './empty-cell'
import PageDots from './page-dots'
import { useScreen } from './screen.context'
import SlotTile from './slot-tile'

import type { FolderSheetProps } from './folder-sheet.types'

export default function FolderSheet({
    folder,
    limits,
    selection,
    hint,
    onSelect,
    onRename,
    onDissolve,
    onClose,
    onContextMenu,
}: FolderSheetProps) {
    const [name, setName] = useState(folder.name)
    const [page, setPage] = useState(0)
    const strip = useRef<HTMLDivElement>(null)
    const screen = useScreen()

    useEffect(() => setName(folder.name), [folder.id, folder.name])

    // One 3x3 grid per page, side by side behind a native scroller — the same
    // shape as the home screen.
    const pages = useMemo(() => {
        const out: (typeof folder.apps)[] = []
        for (let start = 0; start < folder.apps.length; start += limits.folderPage) {
            out.push(folder.apps.slice(start, start + limits.folderPage))
        }
        return out.length ? out : [[]]
    }, [folder.apps, limits.folderPage])

    const go = useCallback((next: number) => {
        const node = strip.current
        if (!node) return
        node.scrollTo({ left: next * node.clientWidth, behavior: 'smooth' })
        setPage(next)
    }, [])

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className='absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/40 backdrop-blur-2xl'
            onClick={event => {
                if (event.target === event.currentTarget) onClose()
            }}
            onContextMenu={event => onContextMenu(event)}
        >
            <input
                value={name}
                onChange={event => setName(event.target.value)}
                onBlur={() => name.trim() && name !== folder.name && onRename(name.trim())}
                onKeyDown={event => {
                    if (event.key === 'Enter') event.currentTarget.blur()
                    if (event.key === 'Escape') onClose()
                }}
                className='w-3/4 shrink-0 rounded-lg bg-transparent text-center text-[17px] font-semibold text-white outline-none focus:bg-white/10'
            />

            <motion.div
                initial={{ scale: 0.72, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.72, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 460, damping: 36, mass: 0.7 }}
                className='w-full shrink-0'
                style={{ paddingInline: screen.edge }}
            >
                <div
                    ref={strip}
                    onScroll={event => {
                        const node = event.currentTarget
                        setPage(Math.round(node.scrollLeft / node.clientWidth))
                    }}
                    className='flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-[9%] bg-white/[0.16] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
                >
                    {pages.map((apps, index) => (
                        <div
                            key={index}
                            className='grid w-full shrink-0 snap-center justify-center gap-y-4 p-[7%]'
                            style={{
                                gridTemplateColumns: `repeat(${limits.folderColumns}, ${screen.icon}px)`,
                                columnGap: `${screen.gap}px`,
                            }}
                        >
                            {apps.map(child => (
                                <SlotTile
                                    key={child.id}
                                    slot={child}
                                    limits={limits}
                                    selected={selection.has(child.id)}
                                    dimmed={selection.size > 0 && !selection.has(child.id)}
                                    hint={hint?.id === child.id ? hint.side : undefined}
                                    onSelect={onSelect}
                                    onContextMenu={onContextMenu}
                                />
                            ))}
                            {Array.from(
                                { length: Math.max(0, limits.folderPage - apps.length) },
                                (_, offset) => (
                                    <EmptyCell
                                        key={`folder-blank-${offset}`}
                                        id={`infolder:${folder.id}:${index * limits.folderPage + apps.length + offset}`}
                                    />
                                )
                            )}
                        </div>
                    ))}
                </div>
            </motion.div>

            {pages.length > 1 ? <PageDots count={pages.length} active={page} onGo={go} /> : null}

            <button
                onClick={onDissolve}
                className='shrink-0 rounded-full bg-white/15 px-4 py-1.5 text-[12px] text-white/90 transition hover:bg-white/25'
            >
                Empty onto the page
            </button>
        </motion.div>
    )
}
