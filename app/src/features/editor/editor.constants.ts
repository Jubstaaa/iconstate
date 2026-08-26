import type { Limits } from './editor.types'

/** iOS keeps roughly this much clear on the left and right of the icon grid. */
const EDGE_SHARE = 0.061

export const DEFAULT_LIMITS: Limits = {
    dock: 4,
    page: 24,
    folderPage: 9,
    pages: 15,
    columns: 4,
    rows: 6,
    folderColumns: 3,
    folderRows: 3,
    iconShare: 68 / 440,
    gapShare: (1 - 2 * EDGE_SHARE - 4 * (68 / 440)) / 3,
    edgeShare: EDGE_SHARE,
}

export interface Metrics {
    homeScreenIconWidth?: number
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

    // The device reports the real icon width and screen width, so the grid is
    // measured rather than guessed: icons come out the size they are on the phone
    // and the gap is whatever is left over.
    const screenWidth = metrics.homeScreenWidth ?? 440
    const iconWidth = pick(metrics.homeScreenIconWidth, 68)
    const iconShare = iconWidth / screenWidth
    const gapShare = columns > 1 ? (1 - 2 * EDGE_SHARE - columns * iconShare) / (columns - 1) : 0

    return {
        dock: pick(metrics.homeScreenIconDockMaxCount, DEFAULT_LIMITS.dock),
        page: rows * columns,
        folderPage: folderRows * folderColumns,
        pages: pick(metrics.homeScreenIconMaxPages, DEFAULT_LIMITS.pages),
        rows,
        columns,
        folderRows,
        folderColumns,
        iconShare,
        gapShare: Math.max(gapShare, 0.02),
        edgeShare: EDGE_SHARE,
    }
}

export const CHROME_HEIGHT = 46
/** Window padding, the gap under the title bar, and the device bezel. */
export const OUTER = 8 * 2 + 9 + 5 * 2

/** Window size that gives the device's own screen its real proportions. */
export const windowSizeFor = (metrics: Metrics | null, width: number) => {
    const screenWidth = metrics?.homeScreenWidth ?? 440
    const screenHeight = metrics?.homeScreenHeight ?? 956
    const inner = width - OUTER
    return { width, height: Math.round((inner * screenHeight) / screenWidth) + OUTER + CHROME_HEIGHT }
}
