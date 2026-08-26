import { LogicalSize, getCurrentWindow } from '@tauri-apps/api/window'
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'

import { limitsFrom, windowSizeFor } from './features/editor/editor.constants'
import { editorReducer, initialEditorState, toIconState } from './features/editor/editor.reducer'
import HomeEditor from './features/editor/home-editor'
import SimulatorChrome from './features/editor/simulator-chrome'
import DiffReview from './features/diff-review/diff-review'
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
    const [change, setChange] = useState<DiffSummary | null>(null)
    const [status, setStatus] = useState('looking for an iPhone')
    const [busy, setBusy] = useState(false)
    const [state, dispatch] = useReducer(editorReducer, initialEditorState)
    const [selection, setSelection] = useState<Set<string>>(new Set())
    const [device, setDevice] = useState('')
    const [system, setSystem] = useState('not connected')

    const serial = devices[0]?.serial
    const limits = useMemo(() => limitsFrom(metrics), [metrics])
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
            setStatus(describe(event))
        })
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

    useEffect(() => {
        if (!metrics) return
        const window_ = getCurrentWindow()
        window_.innerSize().then(async size => {
            const factor = await window_.scaleFactor()
            const logical = size.toLogical(factor)
            const wanted = windowSizeFor(metrics, Math.round(logical.width))
            if (Math.abs(wanted.height - Math.round(logical.height)) > 2) {
                await window_.setSize(new LogicalSize(wanted.width, wanted.height))
            }
        })
    }, [metrics])

    return (
        <>
            <SimulatorChrome
                device={device}
                system={system}
                actions={[
                    { label: 'Sort into folders', icon: 'sort', onPick: () => commands.onPropose(false) },
                    { label: 'Read from iPhone again', icon: 'reload', onPick: handleReload },
                    { label: 'Review changes', icon: 'review', disabled: !dirty, onPick: commands.onReview },
                ]}
            />
            {baseline ? (
                <HomeEditor
                    state={state}
                    limits={limits}
                    icons={icons}
                    selection={selection}
                    status={status}
                    commands={commands}
                    dispatch={dispatch}
                    onSelectionChange={setSelection}
                />
            ) : (
                <div className='grid min-h-0 flex-1 place-items-center'>
                    <p className='max-w-64 text-center text-[13px] leading-relaxed text-dim'>{status}</p>
                </div>
            )}

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
