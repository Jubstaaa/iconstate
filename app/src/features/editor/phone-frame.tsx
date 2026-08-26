import StatusBar from './status-bar'

import type { PhoneFrameProps } from './phone-frame.types'

const SIDE_BUTTON = 'absolute w-[3px] rounded-full bg-white/25'

export default function PhoneFrame({ wallpaper, aspect, children }: PhoneFrameProps) {
    return (
        <div className='relative h-full max-w-full' style={{ aspectRatio: aspect }}>
            <span className={`${SIDE_BUTTON} -left-[3px] top-[16%] h-[3.5%]`} />
            <span className={`${SIDE_BUTTON} -left-[3px] top-[23%] h-[6.5%]`} />
            <span className={`${SIDE_BUTTON} -left-[3px] top-[31%] h-[6.5%]`} />
            <span className={`${SIDE_BUTTON} -right-[3px] top-[24%] h-[9%]`} />

            <div className='size-full overflow-hidden rounded-[13%/6.2%] bg-[#0a0c10] p-[3px] shadow-[0_40px_90px_-24px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.16)]'>
                <div className='relative size-full overflow-hidden rounded-[12.4%/5.9%] bg-ink'>
                    {wallpaper ? (
                        <img
                            src={wallpaper}
                            alt=''
                            draggable={false}
                            className='no-drag absolute inset-0 size-full object-cover'
                        />
                    ) : (
                        <div className='absolute inset-0 bg-gradient-to-b from-[#1e2740] to-[#05070c]' />
                    )}
                    <div className='absolute inset-0 bg-black/10' />

                    <div className='absolute left-1/2 top-[1.4%] z-10 h-[3.4%] w-[30%] -translate-x-1/2 rounded-full bg-black' />

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
