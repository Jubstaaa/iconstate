import EmptyCell from './empty-cell'
import { dockId } from './home-editor.types'
import { useScreen } from './screen.context'
import SlotTile from './slot-tile'

import type { Limits, Slot } from './editor.types'
import type { Hint } from './home-editor.types'

interface DockRowProps {
    page: number
    slots: Slot[]
    limits: Limits
    selection: Set<string>
    hint?: Hint | null
    onSelect: (id: string, additive: boolean) => void
    onContextMenu?: (event: React.MouseEvent, id: string) => void
}

export default function DockRow({
    page,
    slots,
    limits,
    selection,
    hint,
    onSelect,
    onContextMenu,
}: DockRowProps) {
    const screen = useScreen()
    const blanks = Math.max(0, limits.dock - slots.length)

    return (
        <div
            className='shrink-0'
            style={{
                height: screen.dockHeight,
                paddingInline: screen.dockInsetX,
                paddingBlock: screen.dockInsetY,
            }}
        >
            <div
                className='flex h-full items-center justify-center bg-white/[0.22] backdrop-blur-xl'
                style={{ borderRadius: screen.dockRadius }}
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
                            hint={hint?.id === dockId(page, slot.id) ? hint.side : undefined}
                            labelled={false}
                            dragId={dockId(page, slot.id)}
                            onSelect={onSelect}
                            onContextMenu={onContextMenu}
                        />
                    ))}
                    {Array.from({ length: blanks }, (_, offset) => (
                        <EmptyCell key={`dock-blank-${offset}`} id={`dock:${slots.length + offset}`} />
                    ))}
                </div>
            </div>
        </div>
    )
}
