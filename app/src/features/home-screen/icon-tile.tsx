import { isFolder } from '../../lib/core.types'

import type { IconStateItem } from '../../lib/core.types'

export default function IconTile({ item }: { item: IconStateItem }) {
    if (!isFolder(item)) {
        return (
            <div className='tile'>
                <div className='tile-glyph'>{item.displayName.slice(0, 2)}</div>
                <span className='tile-label'>{item.displayName}</span>
            </div>
        )
    }

    const apps = item.iconLists.flat()

    return (
        <div className='tile'>
            <div className='tile-glyph tile-glyph-folder'>
                {apps.slice(0, 9).map(app => (
                    <span key={app.displayIdentifier} className='tile-mini'>
                        {app.displayName.slice(0, 1)}
                    </span>
                ))}
            </div>
            <span className='tile-label'>
                {item.displayName} · {apps.length}
            </span>
        </div>
    )
}
