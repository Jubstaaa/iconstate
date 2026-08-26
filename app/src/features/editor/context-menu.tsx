import { motion } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import type { ContextMenuProps } from './context-menu.types'

export default function ContextMenu({ menu, onClose }: ContextMenuProps) {
    const box = useRef<HTMLDivElement>(null)
    const [at, setAt] = useState({ x: menu.x, y: menu.y })

    useLayoutEffect(() => {
        const rect = box.current?.getBoundingClientRect()
        if (!rect) return
        setAt({
            x: Math.min(menu.x, window.innerWidth - rect.width - 8),
            y: Math.min(menu.y, window.innerHeight - rect.height - 8),
        })
    }, [menu.x, menu.y])

    useEffect(() => {
        const dismiss = () => onClose()
        window.addEventListener('pointerdown', dismiss)
        window.addEventListener('resize', dismiss)
        return () => {
            window.removeEventListener('pointerdown', dismiss)
            window.removeEventListener('resize', dismiss)
        }
    }, [onClose])

    return (
        <motion.div
            ref={box}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.12, ease: [0.32, 0.72, 0, 1] }}
            style={{ left: at.x, top: at.y }}
            onPointerDown={event => event.stopPropagation()}
            className='fixed z-40 min-w-52 origin-top-left rounded-xl border border-white/10 bg-[#1c1f26]/95 p-1 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8)] backdrop-blur-xl'
        >
            {menu.items.map(item => (
                <button
                    key={item.label}
                    disabled={item.disabled}
                    onClick={() => {
                        item.onPick()
                        onClose()
                    }}
                    className={`flex w-full items-center justify-between gap-6 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition ${
                        item.disabled
                            ? 'cursor-default text-dim/50'
                            : item.danger
                              ? 'text-alarm hover:bg-alarm/15'
                              : 'text-chalk hover:bg-white/10'
                    }`}
                >
                    {item.label}
                    {item.shortcut ? <span className='text-[11px] text-dim'>{item.shortcut}</span> : null}
                </button>
            ))}
        </motion.div>
    )
}
