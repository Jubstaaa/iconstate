export interface UnsortedApp {
    key: string
    displayName: string
}

export interface CategoriseRequest {
    apiKey: string
    apps: UnsortedApp[]
    folders: string[]
}

export type Assignments = Record<string, string>
