import { useLayoutEffect, useRef, useState } from 'react'

import wallpaper from '../../assets/wallpaper.svg'
import StatusBar from './status-bar'

import type { PhoneFrameProps } from './phone-frame.types'

const SIDE = 'pointer-events-none absolute w-[3px] rounded-full bg-white/20'

/**
 * One device per page, side by side.
 *
 * Everything inside is absolutely positioned so it cannot feed back into the
 * frame's size — deriving the dock's height from the measured screen while the
 * screen was sized by its content made the frame grow without bound.
 */
export default function PhoneFrame({ aspect, label, onMeasure, children }: PhoneFrameProps) {
    const host = useRef<HTMLDivElement>(null)
    const screen = useRef<HTMLDivElement>(null)
    const [width, setWidth] = useState(0)

    // Width comes from the row's height, measured on the row itself — asking the
    // frame for its own size is what let it feed back on itself before.
    useLayoutEffect(() => {
        const node = host.current?.parentElement
        if (!node) return

        const measure = () => setWidth(Math.round(node.getBoundingClientRect().height * aspect))
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(node)
        return () => observer.disconnect()
    }, [aspect])

    useLayoutEffect(() => {
        const node = screen.current
        if (!node || !onMeasure) return

        const measure = () => {
            const rect = node.getBoundingClientRect()
            if (rect.width) onMeasure({ width: rect.width, height: rect.height })
        }

        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(node)
        return () => observer.disconnect()
    }, [onMeasure])

    return (
        <div
            ref={host}
            className='flex h-full min-h-0 shrink-0 flex-col items-center gap-2'
            style={{ width }}
        >
            <div className='relative w-full min-h-0 flex-1'>
                <span className={`${SIDE} -left-[2px] top-[14%] h-[3.5%]`} />
                <span className={`${SIDE} -left-[2px] top-[21%] h-[6.5%]`} />
                <span className={`${SIDE} -left-[2px] top-[29%] h-[6.5%]`} />
                <span className={`${SIDE} -right-[2px] top-[22%] h-[9%]`} />

                <div className='absolute inset-0 rounded-[54px] bg-[#0b0d11] p-[11px] shadow-[0_6px_16px_-8px_rgba(0,0,0,0.7),inset_0_0_2px_1px_rgba(255,255,255,0.22),0_0_0_1px_rgba(255,255,255,0.08)]'>
                    <div ref={screen} className='relative size-full overflow-hidden rounded-[44px] bg-ink'>
                        <img
                            src={wallpaper}
                            alt=''
                            draggable={false}
                            className='no-drag absolute inset-0 size-full object-cover'
                        />

                        <div className='absolute left-1/2 top-[1.3%] z-10 h-[3.3%] w-[29%] -translate-x-1/2 rounded-full bg-black' />

                        <div className='relative flex h-full flex-col'>
                            <StatusBar />
                            {children}
                            <div className='pointer-events-none absolute inset-x-0 bottom-[9px] flex justify-center'>
                                <span className='h-[5px] w-[36%] rounded-full bg-white/90' />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <span className='shrink-0 text-[11px] text-dim'>{label}</span>
        </div>
    )
}
