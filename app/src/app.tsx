import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'

import EditorToolbar from './features/editor/editor-toolbar'
import { limitsFrom, screenAspect } from './features/editor/editor.constants'
import { editorReducer, initialEditorState, toIconState } from './features/editor/editor.reducer'
import HomeEditor from './features/editor/home-editor'
import WallpaperPicker from './features/editor/wallpaper-picker'
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
import { checkForUpdate } from './lib/update'
import { readImageFile, readStoredWallpaper, storeWallpaper } from './lib/wallpaper'

import type { Metrics } from './features/editor/editor.constants'
import type { Device, DiffSummary, IconManifest, IconState, ProgressEvent } from './lib/core.types'
import type { UpdateInfo } from './lib/update'

const describe = (event: ProgressEvent): string => {
    switch (event.event) {
        case 'connected':
            return `${event.name} · iOS ${event.ios}`
        case 'icon-state-read':
            return 'read the home screen'
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
            return 'writing to the device'
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
    const [status, setStatus] = useState('')
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const [update, setUpdate] = useState<UpdateInfo | null>(null)
    const [state, dispatch] = useReducer(editorReducer, initialEditorState)
    const [selection, setSelection] = useState<Set<string>>(new Set())

    const serial = devices[0]?.serial
    const shownWallpaper = ownWallpaper ?? wallpaper
    const limits = useMemo(() => limitsFrom(metrics), [metrics])
    const aspect = useMemo(() => screenAspect(metrics), [metrics])
    const edited = useMemo(() => toIconState(state.layout, limits), [state.layout, limits])
    const dirty = useMemo(
        () => (baseline ? JSON.stringify(edited) !== JSON.stringify(baseline) : false),
        [baseline, edited]
    )

    const guard = useCallback(async (work: () => Promise<void>) => {
        setBusy(true)
        setError('')
        try {
            await work()
        } catch (cause) {
            setError(getErrorMessage(cause))
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

    const handleRefresh = useCallback(
        () =>
            guard(async () => {
                const found = await listDevices()
                setDevices(found)
                if (!found.length) setStatus('plug the iPhone in over USB and trust this Mac')
            }),
        [guard]
    )

    const handlePropose = useCallback(
        (lookup: boolean) =>
            guard(async () => {
                dispatch({ type: 'load', state: await planLayout(serial, { lookup }) })
            }),
        [guard, serial]
    )

    const handleGroup = useCallback(() => {
        if (selection.size < 2) return
        dispatch({ type: 'group', ids: [...selection], name: 'New Folder' })
        setSelection(new Set())
    }, [selection])

    const handleReview = useCallback(
        () => guard(async () => setChange(await diffLayout(edited, serial))),
        [edited, guard, serial]
    )

    const handleApply = useCallback(
        () =>
            guard(async () => {
                await applyLayout(edited, serial)
                setChange(null)
                await load(serial)
            }),
        [edited, guard, load, serial]
    )

    const handlePickWallpaper = useCallback(
        (file: File) =>
            guard(async () => {
                const dataUrl = await readImageFile(file)
                storeWallpaper(dataUrl)
                setOwnWallpaper(dataUrl)
            }),
        [guard]
    )

    const handleClearWallpaper = useCallback(() => {
        storeWallpaper(null)
        setOwnWallpaper(null)
    }, [])

    const handleRestore = useCallback(
        () =>
            guard(async () => {
                await restoreBackup(undefined, serial)
                await load(serial)
            }),
        [guard, load, serial]
    )

    useEffect(() => {
        const unlisten = onProgress(event => setStatus(describe(event)))
        handleRefresh()
        checkForUpdate()
            .then(setUpdate)
            .catch(() => setUpdate(null))
        return () => {
            unlisten.then(stop => stop())
        }
    }, [handleRefresh])

    useEffect(() => {
        if (serial && !baseline) load(serial)
    }, [baseline, load, serial])

    return (
        <div className='flex h-full flex-col gap-3 p-4'>
            <header className='flex shrink-0 items-center justify-between gap-4'>
                <div className='flex items-baseline gap-3'>
                    <h1 className='text-base font-semibold tracking-tight'>IconState</h1>
                    <span className='text-xs text-dim'>{status || serial || 'no device'}</span>
                    {error ? <span className='text-xs text-alarm'>{error}</span> : null}
                </div>
                <EditorToolbar
                    busy={busy}
                    dirty={dirty}
                    selectionCount={selection.size}
                    canUndo={state.past.length > 0}
                    canRedo={state.future.length > 0}
                    onGroup={handleGroup}
                    onUndo={() => dispatch({ type: 'undo' })}
                    onRedo={() => dispatch({ type: 'redo' })}
                    onReset={() => baseline && dispatch({ type: 'load', state: baseline })}
                    onReview={handleReview}
                />
            </header>

            <main className='min-h-0 flex-1'>
                {baseline ? (
                    <HomeEditor
                        state={state}
                        limits={limits}
                        icons={icons}
                        wallpaper={shownWallpaper}
                        aspect={aspect}
                        selection={selection}
                        dispatch={dispatch}
                        onSelectionChange={setSelection}
                    />
                ) : (
                    <div className='grid h-full place-items-center text-sm text-dim'>
                        {busy ? 'reading the iPhone…' : 'plug the iPhone in over USB and trust this Mac'}
                    </div>
                )}
            </main>

            <footer className='flex shrink-0 items-center justify-between text-xs text-dim'>
                <div className='flex gap-2'>
                    <button className='hover:text-chalk' onClick={handleRefresh} disabled={busy}>
                        Refresh device
                    </button>
                    <button
                        className='hover:text-chalk'
                        onClick={() => handlePropose(false)}
                        disabled={busy || !baseline}
                    >
                        Propose folders
                    </button>
                    <button
                        className='hover:text-chalk'
                        onClick={() => handlePropose(true)}
                        disabled={busy || !baseline}
                    >
                        Propose + look up unknown apps
                    </button>
                    <button className='hover:text-chalk' onClick={handleRestore} disabled={busy || !serial}>
                        Undo last write
                    </button>
                </div>
                <WallpaperPicker
                    custom={Boolean(ownWallpaper)}
                    stale={Boolean(wallpaper)}
                    onPick={handlePickWallpaper}
                    onClear={handleClearWallpaper}
                />
                {update ? (
                    <a className='text-glow' href={update.url} target='_blank' rel='noreferrer'>
                        version {update.version} is available
                    </a>
                ) : null}
            </footer>

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
