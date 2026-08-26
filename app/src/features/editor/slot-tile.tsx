import { useDraggable, useDroppable } from '@dnd-kit/core'

import AppGlyph from './app-glyph'
import { isFolderSlot } from './editor.types'

import type { Limits, Slot } from './editor.types'

interface SlotTileProps {
    slot: Slot
    limits: Limits
    selected: boolean
    dimmed: boolean
    labelled?: boolean
    onSelect: (id: string, additive: boolean) => void
    onOpen?: (id: string) => void
}

export default function SlotTile({
    slot,
    limits,
    selected,
    dimmed,
    labelled = true,
    onSelect,
    onOpen,
}: SlotTileProps) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: slot.id })
    const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `onto:${slot.id}` })

    const ring = selected ? 'ring-2 ring-glow' : isOver ? 'ring-2 ring-white' : 'ring-1 ring-white/10'

    return (
        <div
            ref={node => {
                setNodeRef(node)
                setDropRef(node)
            }}
            {...attributes}
            {...listeners}
            className={`no-drag flex w-full flex-col items-center gap-[4px] outline-none transition-opacity ${
                isDragging || dimmed ? 'opacity-35' : 'opacity-100'
            }`}
            onClick={event => onSelect(slot.id, event.metaKey || event.shiftKey)}
            onDoubleClick={() => onOpen?.(slot.id)}
        >
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
        </div>
    )
}
