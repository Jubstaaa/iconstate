import { motion } from 'motion/react'
import { useEffect, useState } from 'react'

import EmptyCell from './empty-cell'
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
}: FolderSheetProps) {
    const [name, setName] = useState(folder.name)

    useEffect(() => setName(folder.name), [folder.id, folder.name])

    const blanks = Math.max(
        0,
        limits.folderPage - (folder.apps.length % limits.folderPage || limits.folderPage)
    )

    return (
        <motion.div
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(24px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className='absolute inset-0 z-20 flex flex-col justify-center gap-[4%] bg-black/45 px-[8%]'
            onClick={event => {
                if (event.target === event.currentTarget) onClose()
            }}
        >
            <motion.div
                initial={{ scale: 0.55, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.55, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }}
                className='flex flex-col gap-[4%]'
            >
                <input
                    value={name}
                    onChange={event => setName(event.target.value)}
                    onBlur={() => name.trim() && name !== folder.name && onRename(name.trim())}
                    onKeyDown={event => {
                        if (event.key === 'Enter') event.currentTarget.blur()
                        if (event.key === 'Escape') onClose()
                    }}
                    className='mx-auto w-3/4 rounded-lg bg-transparent text-center text-lg font-medium text-white outline-none focus:bg-white/10'
                />
                <div
                    className='grid gap-x-[6%] gap-y-[5%] rounded-[8%] bg-white/10 p-[6%]'
                    style={{
                        gridTemplateColumns: `repeat(${limits.folderColumns}, minmax(0, 1fr))`,
                    }}
                >
                    {folder.apps.map(child => (
                        <SlotTile
                            key={child.id}
                            slot={child}
                            limits={limits}
                            selected={selection.has(child.id)}
                            dimmed={selection.size > 0 && !selection.has(child.id)}
                            hint={hint?.id === child.id ? hint.side : undefined}
                            onSelect={onSelect}
                        />
                    ))}
                    {Array.from({ length: blanks }, (_, offset) => (
                        <EmptyCell
                            key={`folder-blank-${offset}`}
                            id={`infolder:${folder.id}:${folder.apps.length + offset}`}
                        />
                    ))}
                </div>
            </motion.div>
            <div className='flex justify-center gap-3 text-xs'>
                <button
                    onClick={onDissolve}
                    className='rounded-lg bg-white/12 px-3 py-1.5 text-white/90 hover:bg-white/20'
                >
                    Empty this folder onto the page
                </button>
                <button
                    onClick={onClose}
                    className='rounded-lg bg-white/12 px-3 py-1.5 text-white/90 hover:bg-white/20'
                >
                    Done
                </button>
            </div>
        </motion.div>
    )
}
