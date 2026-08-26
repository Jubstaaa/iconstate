import type { PhoneFrameProps } from './phone-frame.types'

export default function PhoneFrame({ wallpaper, aspect, children }: PhoneFrameProps) {
    return (
        <div
            className='relative h-full overflow-hidden rounded-[42px] bg-panel shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/15'
            style={{ aspectRatio: aspect }}
        >
            {wallpaper ? (
                <img
                    src={wallpaper}
                    alt=''
                    draggable={false}
                    className='no-drag absolute inset-0 size-full object-cover'
                />
            ) : (
                <div className='absolute inset-0 bg-gradient-to-b from-[#1b2233] to-[#070a10]' />
            )}
            <div className='absolute inset-0 bg-black/15' />
            <div className='absolute left-1/2 top-[10px] h-[26px] w-[96px] -translate-x-1/2 rounded-full bg-black/85' />
            <div className='relative flex h-full flex-col'>{children}</div>
        </div>
    )
}
