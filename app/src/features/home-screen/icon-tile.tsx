import { useState } from 'react'

import { isFolder } from '../../lib/core.types'
import { useIcon } from './icons.context'

import type { AppIcon, IconStateItem } from '../../lib/core.types'

function AppGlyph({ app, small }: { app: AppIcon; small?: boolean }) {
    const src = useIcon(app.bundleIdentifier ?? app.displayIdentifier)
    const [broken, setBroken] = useState(false)
    const className = small ? 'tile-mini' : 'tile-glyph'

    if (!src || broken) {
        return <span className={className}>{app.displayName.slice(0, small ? 1 : 2)}</span>
    }

    return <img className={className} src={src} alt='' loading='lazy' onError={() => setBroken(true)} />
}

export default function IconTile({ item }: { item: IconStateItem }) {
    if (!isFolder(item)) {
        return (
            <div className='tile'>
                <AppGlyph app={item} />
                <span className='tile-label'>{item.displayName}</span>
            </div>
        )
    }

    const apps = item.iconLists.flat()

    return (
        <div className='tile'>
            <div className='tile-glyph tile-glyph-folder'>
                {apps.slice(0, 9).map(app => (
                    <AppGlyph key={app.displayIdentifier} app={app} small />
                ))}
            </div>
            <span className='tile-label'>
                {item.displayName} · {apps.length}
            </span>
        </div>
    )
}
