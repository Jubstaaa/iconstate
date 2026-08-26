import EmptyCell from './empty-cell'
import { useScreen } from './screen.context'
import SlotTile from './slot-tile'

import type { Limits, Slot } from './editor.types'
import type { Hint } from './home-editor.types'

interface DockRowProps {
    slots: Slot[]
    limits: Limits
    selection: Set<string>
    hint?: Hint | null
    onSelect: (id: string, additive: boolean) => void
    onContextMenu?: (event: React.MouseEvent, id: string) => void
}

export default function DockRow({ slots, limits, selection, hint, onSelect, onContextMenu }: DockRowProps) {
    const screen = useScreen()
    const blanks = Math.max(0, limits.dock - slots.length)

    return (
        <div
            className='mx-auto w-fit rounded-[32px] bg-white/[0.22] backdrop-blur-xl'
            style={{ padding: screen.dockPad }}
        >
            <div
                className='grid'
                style={{
                    gridTemplateColumns: `repeat(${limits.dock}, ${screen.icon}px)`,
                    columnGap: `${screen.gap}px`,
                }}
            >
                {slots.map(slot => (
                    <SlotTile
                        key={slot.id}
                        slot={slot}
                        limits={limits}
                        selected={selection.has(slot.id)}
                        dimmed={selection.size > 0 && !selection.has(slot.id)}
                        hint={hint?.id === slot.id ? hint.side : undefined}
                        labelled={false}
                        onSelect={onSelect}
                        onContextMenu={onContextMenu}
                    />
                ))}
                {Array.from({ length: blanks }, (_, offset) => (
                    <EmptyCell key={`dock-blank-${offset}`} id={`dock:${slots.length + offset}`} />
                ))}
            </div>
        </div>
    )
}
