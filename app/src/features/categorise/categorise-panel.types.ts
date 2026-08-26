import type { UnsortedApp } from '../../lib/categorise.types'

export interface CategorisePanelProps {
    busy: boolean
    apps: UnsortedApp[]
    onCategorise: (apiKey: string) => void
}
