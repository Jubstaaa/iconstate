import { useRef } from 'react'

import type { WallpaperPickerProps } from './wallpaper-picker.types'

export default function WallpaperPicker({ custom, stale, onPick, onClear }: WallpaperPickerProps) {
    const input = useRef<HTMLInputElement>(null)

    return (
        <div className='flex items-center gap-2 text-xs text-dim'>
            {stale && !custom ? (
                <span title='iOS only hands out an old copy of the wallpaper over this service, so it may not be the one you are using now.'>
                    wallpaper may be out of date
                </span>
            ) : null}
            <button className='hover:text-chalk' onClick={() => input.current?.click()}>
                {custom ? 'Change wallpaper' : 'Use my own wallpaper'}
            </button>
            {custom ? (
                <button className='hover:text-chalk' onClick={onClear}>
                    Use the phone's
                </button>
            ) : null}
            <input
                ref={input}
                type='file'
                accept='image/*'
                className='hidden'
                onChange={event => {
                    const file = event.target.files?.[0]
                    if (file) onPick(file)
                    event.target.value = ''
                }}
            />
        </div>
    )
}
