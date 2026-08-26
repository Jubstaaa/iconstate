import { useDraggable, useDroppable } from '@dnd-kit/core'
import { motion } from 'motion/react'

import AppGlyph from './app-glyph'
import { isFolderSlot } from './editor.types'

import type { Limits, Slot } from './editor.types'

interface SlotTileProps {
    slot: Slot
    limits: Limits
    selected: boolean
    dimmed: boolean
    labelled?: boolean
    hint?: 'before' | 'after' | 'onto'
    onSelect: (id: string, additive: boolean) => void
    onOpen?: (id: string) => void
    onContextMenu?: (event: React.MouseEvent, id: string) => void
}

export default function SlotTile({
    slot,
    limits,
    selected,
    dimmed,
    labelled = true,
    hint,
    onSelect,
    onOpen,
    onContextMenu,
}: SlotTileProps) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: slot.id })
    const { setNodeRef: setDropRef } = useDroppable({ id: `onto:${slot.id}` })

    const ring = selected
        ? 'ring-2 ring-glow'
        : hint === 'onto'
          ? 'ring-2 ring-white'
          : 'ring-1 ring-white/10'

    return (
        <motion.div
            layout='position'
            transition={{ type: 'spring', stiffness: 520, damping: 42, mass: 0.6 }}
            ref={node => {
                setNodeRef(node)
                setDropRef(node)
            }}
            {...attributes}
            {...listeners}
            className={`no-drag relative flex w-full flex-col items-center gap-[4px] outline-none transition-opacity ${
                isDragging ? 'opacity-0' : dimmed ? 'opacity-35' : 'opacity-100'
            }`}
            onClick={event => {
                const additive = event.metaKey || event.shiftKey
                if (!additive && isFolderSlot(slot) && onOpen) onOpen(slot.id)
                else onSelect(slot.id, additive)
            }}
            onContextMenu={event => onContextMenu?.(event, slot.id)}
        >
            {hint === 'before' || hint === 'after' ? (
                <span
                    className={`absolute inset-y-0 w-[3px] rounded-full bg-white ${
                        hint === 'before' ? '-left-[7%]' : '-right-[7%]'
                    }`}
                />
            ) : null}
            {isFolderSlot(slot) ? (
                <div
                    className={`grid aspect-square w-full gap-[4%] overflow-hidden rounded-[22%] bg-white/20 p-[7%] backdrop-blur-md ${ring}`}
                    style={{
                        gridTemplateColumns: `repeat(${limits.folderColumns}, minmax(0, 1fr))`,
                        gridTemplateRows: `repeat(${limits.folderRows}, minmax(0, 1fr))`,
                    }}
                >
                    {slot.apps.slice(0, limits.folderPage).map(child => (
                        <AppGlyph
                            key={child.id}
                            app={child.app}
                            className='aspect-square w-full self-start rounded-[24%]'
                        />
                    ))}
                </div>
            ) : (
                <AppGlyph app={slot.app} className={`aspect-square w-full rounded-[22%] ${ring}`} />
            )}
            {labelled ? (
                <span className='w-full truncate text-center text-[10px] leading-none text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.95)]'>
                    {isFolderSlot(slot) ? slot.name : slot.app.displayName}
                </span>
            ) : null}
        </motion.div>
    )
}
