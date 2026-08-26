import { useEffect, useState } from 'react'

import EmptyCell from './empty-cell'
import SlotTile from './slot-tile'

import type { FolderSheetProps } from './folder-sheet.types'

export default function FolderSheet({
    folder,
    limits,
    selection,
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
        <div
            className='absolute inset-0 z-20 flex flex-col justify-center gap-[4%] bg-black/45 px-[8%] backdrop-blur-2xl'
            onClick={event => {
                if (event.target === event.currentTarget) onClose()
            }}
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
        </div>
    )
}
