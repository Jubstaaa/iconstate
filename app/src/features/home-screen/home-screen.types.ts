import type { IconState } from '../../lib/core.types'

export interface HomeScreenProps {
    state: IconState
}

export interface PageProps {
    title: string
    items: IconState[number]
}
