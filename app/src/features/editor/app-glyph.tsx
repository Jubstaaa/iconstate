import { useState } from 'react'

import { useIcon } from './icons.context'

import type { CSSProperties } from 'react'
import type { AppIcon } from '../../lib/core.types'

interface AppGlyphProps {
    app: AppIcon
    className?: string
    style?: CSSProperties
}

export default function AppGlyph({ app, className = '', style }: AppGlyphProps) {
    const src = useIcon(app.bundleIdentifier ?? app.displayIdentifier)
    const [broken, setBroken] = useState(false)

    if (!src || broken) {
        return (
            <span
                className={`grid place-items-center bg-white/15 text-[9px] font-semibold text-white/70 ${className}`}
                style={style}
            >
                {app.displayName.slice(0, 2)}
            </span>
        )
    }

    return (
        <img
            className={`no-drag object-cover ${className}`}
            style={style}
            src={src}
            alt=''
            draggable={false}
            onError={() => setBroken(true)}
        />
    )
}
