import { useLayoutEffect, useRef, useState } from 'react'

import wallpaper from '../../assets/wallpaper.svg'
import { ScreenProvider, geometryFor } from './screen.context'
import StatusBar from './status-bar'

import type { PhoneFrameProps } from './phone-frame.types'

const SIDE = 'pointer-events-none absolute w-[3px] rounded-full bg-white/20'

/**
 * The device is the window. The bezel is drawn right up to the window edge, so
 * there is no page around it and no gap between the two — the window is
 * transparent and undecorated, and this is the only thing in it.
 */
export default function PhoneFrame({ limits, children }: PhoneFrameProps) {
    const screen = useRef<HTMLDivElement>(null)
    const [size, setSize] = useState({ width: 0, height: 0 })

    useLayoutEffect(() => {
        const node = screen.current
        if (!node) return
        const measure = () => {
            const box = node.getBoundingClientRect()
            setSize({ width: box.width, height: box.height })
        }
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(node)
        return () => observer.disconnect()
    }, [])

    return (
        <div className='relative mx-auto min-h-0 w-full flex-1'>
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

                    <ScreenProvider value={geometryFor(size.width, size.height, limits)}>
                        <div className='relative flex h-full flex-col'>
                            <StatusBar />
                            {children}
                            <div className='pointer-events-none absolute inset-x-0 bottom-[9px] flex justify-center'>
                                <span className='h-[5px] w-[36%] rounded-full bg-white/90' />
                            </div>
                        </div>
                    </ScreenProvider>
                </div>
            </div>
        </div>
    )
}
