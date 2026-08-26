import EmptyCell from './empty-cell'
import SlotTile from './slot-tile'

import type { Limits, Slot } from './editor.types'
import type { Hint } from './home-editor.types'

interface HomePageProps {
    page: number
    slots: Slot[]
    limits: Limits
    selection: Set<string>
    hint?: Hint | null
    onSelect: (id: string, additive: boolean) => void
    onContextMenu?: (event: React.MouseEvent, id: string) => void
    onOpen: (id: string) => void
}

export default function HomePage({
    page,
    slots,
    limits,
    selection,
    hint,
    onSelect,
    onOpen,
    onContextMenu,
}: HomePageProps) {
    const blanks = Math.max(0, limits.page - slots.length)

    return (
        <div
            className='grid h-full w-full content-between gap-x-[4%]'
            style={{ gridTemplateColumns: `repeat(${limits.columns}, minmax(0, 1fr))` }}
        >
            {slots.map(slot => (
                <SlotTile
                    key={slot.id}
                    slot={slot}
                    limits={limits}
                    selected={selection.has(slot.id)}
                    dimmed={selection.size > 0 && !selection.has(slot.id)}
                    hint={hint?.id === slot.id ? hint.side : undefined}
                    onSelect={onSelect}
                    onOpen={onOpen}
                    onContextMenu={onContextMenu}
                />
            ))}
            {Array.from({ length: blanks }, (_, offset) => (
                <EmptyCell key={`blank-${offset}`} id={`cell:${page}:${slots.length + offset}`} />
            ))}
        </div>
    )
}
