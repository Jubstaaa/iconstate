export interface MenuItem {
    label: string
    shortcut?: string
    danger?: boolean
    disabled?: boolean
    onPick: () => void
}

export interface ContextMenuState {
    x: number
    y: number
    items: MenuItem[]
}

export interface ContextMenuProps {
    menu: ContextMenuState
    onClose: () => void
}
