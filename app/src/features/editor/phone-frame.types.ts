import type { ReactNode } from 'react'
import type { Limits } from './editor.types'

export interface PhoneFrameProps {
    limits: Limits
    aspect: number
    children: ReactNode
}
