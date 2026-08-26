import type { DiffSummary } from '../../lib/core.types'

export interface DiffReviewProps {
    busy: boolean
    change: DiffSummary
    onApply: () => void
    onCancel: () => void
}
