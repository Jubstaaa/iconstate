import { useDroppable } from '@dnd-kit/core'

export default function EmptyCell({ id }: { id: string }) {
    const { setNodeRef, isOver } = useDroppable({ id })

    return (
        <div
            ref={setNodeRef}
            className={`aspect-square w-full self-start rounded-[23%] transition ${
                isOver ? 'bg-white/25 ring-2 ring-white/70' : 'bg-transparent'
            }`}
        />
    )
}
