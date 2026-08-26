import EmptyCell from './empty-cell'
import SlotTile from './slot-tile'

import type { Limits, Slot } from './editor.types'

interface DockRowProps {
    slots: Slot[]
    limits: Limits
    selection: Set<string>
    onSelect: (id: string, additive: boolean) => void
}

export default function DockRow({ slots, limits, selection, onSelect }: DockRowProps) {
    const blanks = Math.max(0, limits.dock - slots.length)

    return (
        <div className='rounded-[13%] bg-white/15 p-[3%] backdrop-blur-xl'>
            <div
                className='grid gap-x-[4%]'
                style={{ gridTemplateColumns: `repeat(${limits.dock}, minmax(0, 1fr))` }}
            >
                {slots.map(slot => (
                    <SlotTile
                        key={slot.id}
                        slot={slot}
                        limits={limits}
                        selected={selection.has(slot.id)}
                        dimmed={selection.size > 0 && !selection.has(slot.id)}
                        labelled={false}
                        onSelect={onSelect}
                    />
                ))}
                {Array.from({ length: blanks }, (_, offset) => (
                    <EmptyCell key={`dock-blank-${offset}`} id={`dock:${slots.length + offset}`} />
                ))}
            </div>
        </div>
    )
}
