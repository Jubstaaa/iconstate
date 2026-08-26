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
    dockHeight: number
    dockRadius: number
    dockInsetX: number
    dockInsetY: number
    labelGap: number
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
    dockHeight: 0,
    dockRadius: 0,
    dockInsetX: 0,
    dockInsetY: 0,
    labelGap: 0,
}

const ScreenContext = createContext<ScreenGeometry>(FALLBACK)

export const ScreenProvider = ScreenContext.Provider

export const useScreen = (): ScreenGeometry => useContext(ScreenContext)

/**
 * Percentages in CSS resolve against the containing block, but the device
 * reports its grid against the screen — chaining the two shrank every icon.
 * Measure the screen once and hand out pixels instead.
 */
/*
 * Measured off Apple's iOS 26 UI kit, on its 393x852 iPhone home screen:
 *   status bar 54 tall · first icon row at y=90 · row pitch 98
 *   icons 60 square on a 90.33 pitch, 31 clear at each edge
 *   dock 393x122 at y=730, radius 41, inner plate 371x98 inset 11/12
 */
const ROW_STEP = 98 / 393
const STATUS_BAR = 54 / 852
const TOP_INSET = 36 / 852
const DOCK_HEIGHT = 122 / 852
const DOCK_RADIUS = 41 / 393
const DOCK_INSET_X = 11 / 393
const DOCK_INSET_Y = 12 / 852
const LABEL_GAP = 6 / 393

export const geometryFor = (width: number, height: number, limits: Limits): ScreenGeometry => ({
    width,
    height,
    icon: width * limits.iconShare,
    gap: width * limits.gapShare,
    edge: width * limits.edgeShare,
    rowStep: width * ROW_STEP,
    statusBar: height * STATUS_BAR,
    topInset: height * TOP_INSET,
    dockHeight: height * DOCK_HEIGHT,
    dockRadius: width * DOCK_RADIUS,
    dockInsetX: width * DOCK_INSET_X,
    dockInsetY: height * DOCK_INSET_Y,
    labelGap: width * LABEL_GAP,
})
