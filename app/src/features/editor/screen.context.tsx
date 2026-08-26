import { createContext, useContext } from 'react'

import type { Limits } from './editor.types'

export interface ScreenGeometry {
    /** Measured size of the phone screen in CSS pixels. */
    width: number
    height: number
    icon: number
    gap: number
    edge: number
    /** Distance from one row of icons to the next. */
    rowStep: number
    statusBar: number
    /** Clear space between the status bar and the first row. */
    topInset: number
    dockPad: number
    dockBottom: number
}

const FALLBACK: ScreenGeometry = {
    width: 0,
    height: 0,
    icon: 0,
    gap: 0,
    edge: 0,
    rowStep: 0,
    statusBar: 0,
    topInset: 0,
    dockPad: 0,
    dockBottom: 0,
}

const ScreenContext = createContext<ScreenGeometry>(FALLBACK)

export const ScreenProvider = ScreenContext.Provider

export const useScreen = (): ScreenGeometry => useContext(ScreenContext)

/**
 * Percentages in CSS resolve against the containing block, but the device
 * reports its grid against the screen — chaining the two shrank every icon.
 * Measure the screen once and hand out pixels instead.
 */
/** iOS home screen proportions, taken against the 440x956 point screen. */
const ROW_STEP = 112 / 440
const STATUS_BAR = 54 / 956
const TOP_INSET = 46 / 956
const DOCK_PAD = 14 / 440
const DOCK_BOTTOM = 34 / 956

export const geometryFor = (width: number, height: number, limits: Limits): ScreenGeometry => ({
    width,
    height,
    icon: width * limits.iconShare,
    gap: width * limits.gapShare,
    edge: width * limits.edgeShare,
    rowStep: width * ROW_STEP,
    statusBar: height * STATUS_BAR,
    topInset: height * TOP_INSET,
    dockPad: width * DOCK_PAD,
    dockBottom: height * DOCK_BOTTOM,
})
