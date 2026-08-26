export interface ChromeAction {
    label: string
    icon: 'sort' | 'review' | 'reload'
    disabled?: boolean
    onPick: () => void
}

export interface SimulatorChromeProps {
    device: string
    system: string
    actions: ChromeAction[]
}
