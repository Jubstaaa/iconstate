import { motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'

import EmptyCell from './empty-cell'
import PageDots from './page-dots'
import SlotTile from './slot-tile'

import type { FolderSheetProps } from './folder-sheet.types'

export default function FolderSheet({
    folder,
    limits,
    selection,
    hint,
    onSelect,
    onRename,
    onClose,
    onContextMenu,
}: FolderSheetProps) {
    const [name, setName] = useState(folder.name)
    const [page, setPage] = useState(0)
    const strip = useRef<HTMLDivElement>(null)

    useEffect(() => setName(folder.name), [folder.id, folder.name])

    // A folder holds one 3x3 grid per page, and pages sit side by side, exactly
    // as they do on the home screen.
    const pages = useMemo(() => {
        const out: (typeof folder.apps)[] = []
        for (let start = 0; start < folder.apps.length; start += limits.folderPage) {
            out.push(folder.apps.slice(start, start + limits.folderPage))
        }
        return out.length ? out : [[]]
    }, [folder.apps, limits.folderPage])

    useEffect(() => {
        const node = strip.current
        if (!node) return
        node.scrollTo({ left: page * node.clientWidth, behavior: 'smooth' })
    }, [page])

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className='absolute inset-0 z-20 flex flex-col bg-black/35 backdrop-blur-2xl'
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
                className='mx-auto mt-[12%] w-3/4 shrink-0 rounded-lg bg-transparent text-center text-[17px] font-semibold text-white outline-none focus:bg-white/10'
            />

            <motion.div
                initial={{ scale: 0.72, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.72, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 460, damping: 36, mass: 0.7 }}
                className='mt-[6%] flex min-h-0 flex-col'
                style={{ paddingInline: `${limits.edgeShare * 100}%` }}
            >
                <div
                    ref={strip}
                    onScroll={event => {
                        const node = event.currentTarget
                        setPage(Math.round(node.scrollLeft / node.clientWidth))
                    }}
                    className='flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-[9%] bg-white/[0.14] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
                >
                    {pages.map((apps, index) => (
                        <div
                            key={index}
                            className='grid w-full shrink-0 snap-center gap-y-[6%] p-[7%]'
                            style={{
                                gridTemplateColumns: `repeat(${limits.folderColumns}, minmax(0, 1fr))`,
                                columnGap: `${limits.gapShare * 100}%`,
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

                {pages.length > 1 ? (
                    <div className='mt-[5%]'>
                        <PageDots count={pages.length} active={page} onGo={setPage} />
                    </div>
                ) : null}
            </motion.div>
        </motion.div>
    )
}
