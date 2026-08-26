import wallpaper from '../../assets/wallpaper.svg'
import StatusBar from './status-bar'

import type { PhoneFrameProps } from './phone-frame.types'

const SIDE = 'pointer-events-none absolute w-[3px] rounded-full bg-white/20'

/**
 * The device is the window. The bezel is drawn right up to the window edge, so
 * there is no page around it and no gap between the two — the window is
 * transparent and undecorated, and this is the only thing in it.
 */
export default function PhoneFrame({ children }: PhoneFrameProps) {
    return (
        <div className='relative mx-auto min-h-0 w-full flex-1'>
            <span className={`${SIDE} -left-[2px] top-[14%] h-[3.5%]`} />
            <span className={`${SIDE} -left-[2px] top-[21%] h-[6.5%]`} />
            <span className={`${SIDE} -left-[2px] top-[29%] h-[6.5%]`} />
            <span className={`${SIDE} -right-[2px] top-[22%] h-[9%]`} />

            <div className='size-full rounded-[46px] bg-[#0d1015] p-[5px] shadow-[0_6px_16px_-8px_rgba(0,0,0,0.7),inset_0_0_3px_1px_rgba(255,255,255,0.2)]'>
                <div className='relative size-full overflow-hidden rounded-[41px] bg-ink'>
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
                        <div className='pointer-events-none flex justify-center pb-[1.2%]'>
                            <span className='h-[4px] w-[34%] rounded-full bg-white/85' />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
