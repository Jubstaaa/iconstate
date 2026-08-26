export interface AppIcon {
    bundleIdentifier?: string
    bundleVersion?: string
    displayIdentifier: string
    displayName: string
    iconModDate?: string
}

export interface FolderIcon {
    displayName: string
    listType: 'folder'
    iconLists: AppIcon[][]
}

export type IconStateItem = AppIcon | FolderIcon

export type IconState = IconStateItem[][]

export interface Device {
    serial: string
    connection: string
    device_id: number
}

export interface ProgressEvent {
    event: string
    [key: string]: unknown
}

export interface CoreFailure {
    message: string
    events: ProgressEvent[]
}

export const isFolder = (item: IconStateItem): item is FolderIcon =>
    (item as FolderIcon).listType === 'folder'
