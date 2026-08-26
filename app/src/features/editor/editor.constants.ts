import type { Limits } from './editor.types'

export const DEFAULT_LIMITS: Limits = {
    dock: 4,
    page: 24,
    folderPage: 9,
    pages: 15,
    columns: 4,
    rows: 6,
    folderColumns: 3,
    folderRows: 3,
}

export interface Metrics {
    homeScreenIconDockMaxCount?: number
    homeScreenIconMaxPages?: number
    homeScreenIconFolderMaxPages?: number
    homeScreenIconRows?: number
    homeScreenIconColumns?: number
    homeScreenIconFolderRows?: number
    homeScreenIconFolderColumns?: number
    homeScreenWidth?: number
    homeScreenHeight?: number
}

export const limitsFrom = (metrics: Metrics | null): Limits => {
    if (!metrics) return DEFAULT_LIMITS

    const pick = (value: number | undefined, fallback: number) =>
        typeof value === 'number' && value > 0 ? Math.round(value) : fallback

    const rows = pick(metrics.homeScreenIconRows, DEFAULT_LIMITS.rows)
    const columns = pick(metrics.homeScreenIconColumns, DEFAULT_LIMITS.columns)
    const folderRows = pick(metrics.homeScreenIconFolderRows, DEFAULT_LIMITS.folderRows)
    const folderColumns = pick(metrics.homeScreenIconFolderColumns, DEFAULT_LIMITS.folderColumns)

    return {
        dock: pick(metrics.homeScreenIconDockMaxCount, DEFAULT_LIMITS.dock),
        page: rows * columns,
        folderPage: folderRows * folderColumns,
        pages: pick(metrics.homeScreenIconMaxPages, DEFAULT_LIMITS.pages),
        rows,
        columns,
        folderRows,
        folderColumns,
    }
}

export const screenAspect = (metrics: Metrics | null): number => {
    const width = metrics?.homeScreenWidth ?? 440
    const height = metrics?.homeScreenHeight ?? 956
    return width / height
}
