import type { ReactNode } from 'react'

export interface PhoneFrameProps {
    aspect: number
    onMeasure: (size: { width: number; height: number }) => void
    children: ReactNode
}
