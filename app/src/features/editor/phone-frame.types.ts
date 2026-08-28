import type { ReactNode } from 'react'

export interface PhoneFrameProps {
    aspect: number
    label: string
    onMeasure?: (size: { width: number; height: number }) => void
    children: ReactNode
}
