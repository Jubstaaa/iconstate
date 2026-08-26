import { useCallback, useEffect, useRef } from 'react'

import HomePage from './home-page'

import type { PagesStripProps } from './pages-strip.types'

/**
 * Every page laid out side by side behind one native horizontal scroller.
 * Scroll snapping is the browser's own: real swipe, real momentum, and no
 * hand-rolled transition to get subtly wrong.
 */
export default function PagesStrip({
    pages,
    limits,
    selection,
    hint,
    page,
    onPageChange,
    onSelect,
    onOpen,
    onContextMenu,
}: PagesStripProps) {
    const strip = useRef<HTMLDivElement>(null)
    const settling = useRef(false)

    const handleScroll = useCallback(() => {
        const node = strip.current
        if (!node || settling.current) return
        const at = Math.round(node.scrollLeft / node.clientWidth)
        if (at !== page) onPageChange(at)
    }, [onPageChange, page])

    useEffect(() => {
        const node = strip.current
        if (!node) return
        const wanted = page * node.clientWidth
        if (Math.abs(node.scrollLeft - wanted) < 2) return
        settling.current = true
        node.scrollTo({ left: wanted, behavior: 'smooth' })
        const timer = window.setTimeout(() => (settling.current = false), 420)
        return () => window.clearTimeout(timer)
    }, [page])

    return (
        <div
            ref={strip}
            onScroll={handleScroll}
            onContextMenu={event => onContextMenu(event)}
            className='flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
        >
            {pages.map((slots, index) => (
                <div key={index} className='w-full shrink-0 snap-center px-[6%] pb-[1%] pt-[7%]'>
                    <HomePage
                        page={index}
                        slots={slots}
                        limits={limits}
                        selection={selection}
                        hint={hint}
                        onSelect={onSelect}
                        onOpen={onOpen}
                        onContextMenu={onContextMenu}
                    />
                </div>
            ))}
        </div>
    )
}
