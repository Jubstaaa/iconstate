import { useLayoutEffect, useRef, useState } from 'react'

import wallpaper from '../../assets/wallpaper.svg'
import StatusBar from './status-bar'

import type { PhoneFrameProps } from './phone-frame.types'

const SIDE = 'pointer-events-none absolute w-[3px] rounded-full bg-white/20'

/**
 * The device is sized from the space around it and then taken out of the flow.
 *
 * Sizing it with flex plus aspect-ratio fed back on itself: the dock's height is
 * derived from the measured screen, that height became the frame's content
 * height, which changed the measurement again — so the frame grew without bound
 * as soon as the window was resized. Absolute positioning breaks the loop: what
 * is inside the device can never change how big the device is.
 */
export default function PhoneFrame({ aspect, onMeasure, children }: PhoneFrameProps) {
    const host = useRef<HTMLDivElement>(null)
    const screen = useRef<HTMLDivElement>(null)
    const [box, setBox] = useState({ width: 0, height: 0 })

    useLayoutEffect(() => {
        const node = host.current
        if (!node) return

        const measure = () => {
            const space = node.getBoundingClientRect()
            if (!space.width || !space.height) return
            const height = Math.min(space.height, space.width / aspect)
            setBox({ width: Math.round(height * aspect), height: Math.round(height) })
        }

        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(node)
        return () => observer.disconnect()
    }, [aspect])

    useLayoutEffect(() => {
        const node = screen.current
        if (!node) return
        const rect = node.getBoundingClientRect()
        onMeasure({ width: rect.width, height: rect.height })
    }, [box.width, box.height, onMeasure])

    return (
        <div ref={host} className='relative min-h-0 min-w-0 flex-1'>
            <div
                className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
                style={{ width: box.width, height: box.height }}
            >
                <span className={`${SIDE} -left-[2px] top-[14%] h-[3.5%]`} />
                <span className={`${SIDE} -left-[2px] top-[21%] h-[6.5%]`} />
                <span className={`${SIDE} -left-[2px] top-[29%] h-[6.5%]`} />
                <span className={`${SIDE} -right-[2px] top-[22%] h-[9%]`} />

                <div className='size-full rounded-[54px] bg-[#0b0d11] p-[11px] shadow-[0_6px_16px_-8px_rgba(0,0,0,0.7),inset_0_0_2px_1px_rgba(255,255,255,0.22),0_0_0_1px_rgba(255,255,255,0.08)]'>
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
        </div>
    )
}
