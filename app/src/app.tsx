import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'

import { limitsFrom, screenAspect } from './features/editor/editor.constants'
import { editorReducer, initialEditorState, toIconState } from './features/editor/editor.reducer'
import HomeEditor from './features/editor/home-editor'
import DiffReview from './features/diff-review/diff-review'
import {
    applyLayout,
    diffLayout,
    fetchIcons,
    fetchMetrics,
    fetchWallpaper,
    getErrorMessage,
    listDevices,
    onProgress,
    planLayout,
    readIconState,
    restoreBackup,
} from './lib/core'
import { readImageFile, readStoredWallpaper, storeWallpaper } from './lib/wallpaper'

import type { Metrics } from './features/editor/editor.constants'
import type { EditorCommands } from './features/editor/home-editor.types'
import type { Device, DiffSummary, IconManifest, IconState, ProgressEvent } from './lib/core.types'

const describe = (event: ProgressEvent): string => {
    switch (event.event) {
        case 'connected':
            return `${event.name} · iOS ${event.ios}`
        case 'icon-state-read':
            return 'reading the home screen'
        case 'icon':
            return `icon ${event.done} of ${event.total}`
        case 'looking-up':
            return `asking the App Store about ${event.count} apps`
        case 'looked-up-done':
            return `the App Store placed ${event.resolved} apps`
        case 'unassigned':
            return `${event.count} apps had no rule`
        case 'backed-up':
            return 'backed up'
        case 'writing':
            return 'writing to the iPhone'
        case 'written':
            return 'written'
        case 'error':
            return String(event.message)
        default:
            return event.event
    }
}

export default function App() {
    const [devices, setDevices] = useState<Device[]>([])
    const [baseline, setBaseline] = useState<IconState | null>(null)
    const [metrics, setMetrics] = useState<Metrics | null>(null)
    const [icons, setIcons] = useState<IconManifest>({})
    const [wallpaper, setWallpaper] = useState<string | null>(null)
    const [ownWallpaper, setOwnWallpaper] = useState<string | null>(readStoredWallpaper)
    const [change, setChange] = useState<DiffSummary | null>(null)
    const [status, setStatus] = useState('looking for an iPhone')
    const [busy, setBusy] = useState(false)
    const [state, dispatch] = useReducer(editorReducer, initialEditorState)
    const [selection, setSelection] = useState<Set<string>>(new Set())
    const picker = useRef<HTMLInputElement>(null)

    const serial = devices[0]?.serial
    const limits = useMemo(() => limitsFrom(metrics), [metrics])
    const aspect = useMemo(() => screenAspect(metrics), [metrics])
    const edited = useMemo(() => toIconState(state.layout, limits), [state.layout, limits])
    const dirty = useMemo(
        () => (baseline ? JSON.stringify(edited) !== JSON.stringify(baseline) : false),
        [baseline, edited]
    )

    const guard = useCallback(async (work: () => Promise<void>) => {
        setBusy(true)
        try {
            await work()
        } catch (cause) {
            setStatus(getErrorMessage(cause))
        } finally {
            setBusy(false)
        }
    }, [])

    const load = useCallback(
        (target?: string) =>
            guard(async () => {
                const [read, grid] = await Promise.all([readIconState(target), fetchMetrics(target)])
                setBaseline(read)
                setMetrics(grid)
                dispatch({ type: 'load', state: read })
                setIcons(await fetchIcons(target))
                setWallpaper(await fetchWallpaper(target).catch(() => null))
            }),
        [guard]
    )

    const handleReload = useCallback(() => load(serial), [load, serial])

    const commands: EditorCommands = {
        busy,
        dirty,
        canUndoWrite: Boolean(serial),
        hasOwnWallpaper: Boolean(ownWallpaper),
        onReload: handleReload,
        onPropose: useCallback(
            (lookUp: boolean) =>
                guard(async () => {
                    dispatch({ type: 'load', state: await planLayout(serial, { lookup: lookUp }) })
                }),
            [guard, serial]
        ),
        onReview: useCallback(
            () => guard(async () => setChange(await diffLayout(edited, serial))),
            [edited, guard, serial]
        ),
        onDiscard: useCallback(() => baseline && dispatch({ type: 'load', state: baseline }), [baseline]),
        onUndoWrite: useCallback(
            () =>
                guard(async () => {
                    await restoreBackup(undefined, serial)
                    await load(serial)
                }),
            [guard, load, serial]
        ),
        onPickWallpaper: useCallback(() => picker.current?.click(), []),
        onClearWallpaper: useCallback(() => {
            storeWallpaper(null)
            setOwnWallpaper(null)
        }, []),
    }

    const handleApply = useCallback(
        () =>
            guard(async () => {
                await applyLayout(edited, serial)
                setChange(null)
                await load(serial)
            }),
        [edited, guard, load, serial]
    )

    const handleWallpaperFile = useCallback(
        (file: File) =>
            guard(async () => {
                const dataUrl = await readImageFile(file)
                storeWallpaper(dataUrl)
                setOwnWallpaper(dataUrl)
            }),
        [guard]
    )

    useEffect(() => {
        const unlisten = onProgress(event => setStatus(describe(event)))
        guard(async () => {
            const found = await listDevices()
            setDevices(found)
            if (!found.length) setStatus('plug the iPhone in over USB and trust this Mac')
        })
        return () => {
            unlisten.then(stop => stop())
        }
    }, [guard])

    useEffect(() => {
        if (serial && !baseline) load(serial)
    }, [baseline, load, serial])

    return (
        <div className='grid h-full place-items-center p-3 pt-7'>
            {baseline ? (
                <HomeEditor
                    state={state}
                    limits={limits}
                    icons={icons}
                    wallpaper={ownWallpaper ?? wallpaper}
                    aspect={aspect}
                    selection={selection}
                    status={status}
                    commands={commands}
                    dispatch={dispatch}
                    onSelectionChange={setSelection}
                />
            ) : (
                <p className='max-w-64 text-center text-[13px] leading-relaxed text-dim'>{status}</p>
            )}

            <input
                ref={picker}
                type='file'
                accept='image/*'
                className='hidden'
                onChange={event => {
                    const file = event.target.files?.[0]
                    if (file) handleWallpaperFile(file)
                    event.target.value = ''
                }}
            />

            {change ? (
                <DiffReview
                    busy={busy}
                    change={change}
                    onApply={handleApply}
                    onCancel={() => setChange(null)}
                />
            ) : null}
        </div>
    )
}
