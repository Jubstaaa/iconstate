import { useCallback, useEffect, useRef } from 'react'

import HomePage from './home-page'
import { useScreen } from './screen.context'

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
    const screen = useScreen()
    const strip = useRef<HTMLDivElement>(null)
    const settling = useRef(false)

    const handleScroll = useCallback(() => {
        const node = strip.current
        if (!node || settling.current || !node.clientWidth) return
        const at = Math.max(0, Math.min(Math.round(node.scrollLeft / node.clientWidth), pages.length - 1))
        if (at !== page) onPageChange(at)
    }, [onPageChange, page, pages.length])

    // Also runs when a page is added or removed: the scroller has just grown or
    // shrunk, and the target offset moves with it.
    useEffect(() => {
        const node = strip.current
        if (!node || !node.clientWidth) return

        const wanted = page * node.clientWidth
        if (Math.abs(node.scrollLeft - wanted) < 2) return

        // Mandatory snapping fights a scripted smooth scroll — the browser keeps
        // pulling the offset back to the nearest snap point and the page ends up
        // stranded half way. Lift snapping for the length of the animation.
        settling.current = true
        node.style.scrollSnapType = 'none'
        node.scrollTo({ left: wanted, behavior: 'smooth' })

        const timer = window.setTimeout(() => {
            node.style.scrollSnapType = ''
            settling.current = false
        }, 500)
        return () => {
            window.clearTimeout(timer)
            node.style.scrollSnapType = ''
        }
    }, [page, pages.length])

    return (
        <div
            ref={strip}
            onScroll={handleScroll}
            onContextMenu={event => onContextMenu(event)}
            className='flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
        >
            {pages.map((slots, index) => (
                <div
                    key={index}
                    className='w-full shrink-0 snap-start'
                    style={{ paddingTop: screen.topInset }}
                >
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
