import type { UnsortedApp } from '../../lib/core.types'

export interface UnsortedPanelProps {
    busy: boolean
    apps: UnsortedApp[]
    onLookUp: () => void
}
