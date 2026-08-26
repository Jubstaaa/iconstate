import { useDroppable } from '@dnd-kit/core'

import { useScreen } from './screen.context'

export default function EmptyCell({ id }: { id: string }) {
    const screen = useScreen()
    const { setNodeRef, isOver } = useDroppable({ id })

    return (
        <div
            ref={setNodeRef}
            style={{ width: screen.icon, height: screen.icon }}
            className={`shrink-0 self-start rounded-[23%] transition ${
                isOver ? 'bg-white/25 ring-2 ring-white/70' : 'bg-transparent'
            }`}
        />
    )
}
