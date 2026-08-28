import { getCurrentWindow } from '@tauri-apps/api/window'
import { Toaster } from 'sonner'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'

import { deviceAspect, limitsFrom } from './features/editor/editor.constants'
import { editorReducer, initialEditorState, toIconState } from './features/editor/editor.reducer'
import HomeEditor from './features/editor/home-editor'
import DiffReview from './features/diff-review/diff-review'
import { notifyDone, notifyFailed, notifyIdle, notifyProgress } from './lib/notify'
import {
    applyLayout,
    diffLayout,
    fetchIcons,
    fetchMetrics,
    getErrorMessage,
    listDevices,
    onProgress,
    planLayout,
    readIconState,
    restoreBackup,
} from './lib/core'

import type { Metrics } from './features/editor/editor.constants'
import type { EditorCommands } from './features/editor/home-editor.types'
import type { Device, DiffSummary, IconManifest, IconState, ProgressEvent } from './lib/core.types'

/** Progress events are machine names; the user gets a sentence. */
const describe = (event: ProgressEvent): string => {
    switch (event.event) {
        case 'connecting':
            return 'Looking for your iPhone'
        case 'connected':
            return `Connected to ${event.name}`
        case 'icon-state-read':
            return 'Reading the home screen'
        case 'icons-wanted':
            return `Fetching ${event.count} app icons`
        case 'icon':
            return `Fetching app icons — ${event.done} of ${event.total}`
        case 'icons-ready':
            return 'App icons ready'
        case 'looking-up':
            return `Asking the App Store about ${event.count} apps`
        case 'looked-up':
            return `Asking the App Store — ${event.done} of ${event.total}`
        case 'looked-up-done':
            return `The App Store sorted ${event.resolved} apps`
        case 'unassigned':
            return `${event.count} apps had no rule and went to Unsorted`
        case 'backed-up':
            return 'Backed up your current layout'
        case 'writing':
            return 'Writing to your iPhone'
        case 'written':
            return 'Written to your iPhone'
        case 'reading-file':
            return 'Reading the saved layout'
        case 'saved':
            return 'Saved'
        case 'error':
            return String(event.message)
        default:
            return ''
    }
}

export default function App() {
    const [devices, setDevices] = useState<Device[]>([])
    const [baseline, setBaseline] = useState<IconState | null>(null)
    const [metrics, setMetrics] = useState<Metrics | null>(null)
    const [icons, setIcons] = useState<IconManifest>({})
    const [change, setChange] = useState<DiffSummary | null>(null)
    const [status, setStatus] = useState('')
    const [busy, setBusy] = useState(false)
    const working = useRef(false)
    const [state, dispatch] = useReducer(editorReducer, initialEditorState)
    const [selection, setSelection] = useState<Set<string>>(new Set())
    const [device, setDevice] = useState('')
    const [system, setSystem] = useState('not connected')

    const serial = devices[0]?.serial
    const limits = useMemo(() => limitsFrom(metrics), [metrics])
    const aspect = useMemo(() => deviceAspect(metrics), [metrics])
    const edited = useMemo(() => toIconState(state.layout, limits), [state.layout, limits])
    const dirty = useMemo(
        () => (baseline ? JSON.stringify(edited) !== JSON.stringify(baseline) : false),
        [baseline, edited]
    )

    const guard = useCallback(async (work: () => Promise<void>) => {
        setBusy(true)
        working.current = true
        try {
            await work()
            notifyIdle()
        } catch (cause) {
            notifyFailed(getErrorMessage(cause))
        } finally {
            working.current = false
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
            }),
        [guard]
    )

    const handleReload = useCallback(() => load(serial), [load, serial])

    const commands: EditorCommands = {
        busy,
        dirty,
        canUndoWrite: Boolean(serial),
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

    useEffect(() => {
        const unlisten = onProgress(event => {
            if (event.event === 'connected') {
                setDevice(String(event.name))
                setSystem(`iOS ${event.ios}`)
            }
            const message = describe(event)
            if (!message) return
            setStatus(message)
            if (!working.current) return
            if (event.event === 'error') notifyFailed(message)
            else if (event.event === 'written') notifyDone('Written to the iPhone')
            else notifyProgress(message)
        })
        return () => {
            unlisten.then(stop => stop())
        }
    }, [])

    useEffect(() => {
        if (serial && !baseline) load(serial)
    }, [baseline, load, serial])

    // Nothing tells us when a cable goes in, so watch for one while there is no
    // device — quietly, without the spinner or a toast.
    useEffect(() => {
        if (serial) return

        let watching = true
        const look = async () => {
            try {
                const found = await listDevices()
                if (watching && found.length) setDevices(found)
            } catch {
                // still nothing plugged in
            }
        }

        look()
        const timer = window.setInterval(look, 3000)
        return () => {
            watching = false
            window.clearInterval(timer)
        }
    }, [serial])

    useEffect(() => {
        getCurrentWindow().setTitle(device ? `${device} — ${system}` : 'IconState')
    }, [device, system])

    return (
        <>
            <HomeEditor
                state={state}
                limits={limits}
                icons={icons}
                selection={selection}
                aspect={aspect}
                offline={
                    baseline
                        ? ''
                        : busy
                          ? status || 'Reading your iPhone…'
                          : 'No iPhone connected.\nPlug one in over USB and tap Trust on the phone.'
                }
                commands={commands}
                dispatch={dispatch}
                onSelectionChange={setSelection}
            />

            <Toaster
                position='bottom-center'
                theme='dark'
                offset={118}
                gap={8}
                toastOptions={{
                    style: {
                        background: 'rgba(28,31,38,0.92)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: '#e9edf3',
                        borderRadius: '999px',
                        fontSize: '12px',
                        backdropFilter: 'blur(24px)',
                    },
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
        </>
    )
}
