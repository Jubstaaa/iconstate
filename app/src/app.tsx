import { getCurrentWindow } from '@tauri-apps/api/window'
import { openUrl } from '@tauri-apps/plugin-opener'
import { Toaster, toast } from 'sonner'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'

import { deviceAspect, limitsFrom } from './features/editor/editor.constants'
import { initialEditorState, makeEditorReducer, toIconState } from './features/editor/editor.reducer'
import HomeEditor from './features/editor/home-editor'
import DiffReview from './features/diff-review/diff-review'
import { notifyDone, notifyFailed, notifyIdle, notifyProgress } from './lib/notify'
import { checkForUpdate } from './lib/update'
import {
    applyLayout,
    fetchIcons,
    fetchMetrics,
    getErrorMessage,
    listDevices,
    lookupGenres,
    saveRules,
    onProgress,
    readIconState,
    restoreBackup,
    userRules,
} from './lib/core'
import { diffStates } from './lib/diff'
import { assignmentsFromGenres } from './lib/genres'
import { appsOf, keyOf } from './lib/icon-state'
import { buildPlan, deriveRules } from './lib/plan'
import { FOLDER_ORDER, RULES } from './lib/rules'

import { isFolder } from './lib/core.types'

import type { AppIcon } from './lib/core.types'
import type { Metrics } from './features/editor/editor.constants'
import type { UserRules } from './lib/rules'
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
    const limits = useMemo(() => limitsFrom(metrics), [metrics])
    // The grid the phone reports decides what fits, so the reducer is built
    // around it rather than being handed the limits on every action.
    const [state, dispatch] = useReducer(
        useMemo(() => makeEditorReducer(limits), [limits]),
        initialEditorState
    )
    const [selection, setSelection] = useState<Set<string>>(new Set())
    const [mine, setMine] = useState<UserRules | null>(null)
    const [device, setDevice] = useState('')
    const [system, setSystem] = useState('not connected')

    const serial = devices[0]?.serial
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
                setIcons(await fetchIcons(appsOf(read).map(keyOf), target))
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
                    if (!baseline) return
                    const apps = appsOf(baseline)
                    // The dock is a personal choice, so a sort keeps it as it is.
                    const dock = baseline[0]
                        .filter(item => !isFolder(item))
                        .map(item => keyOf(item as AppIcon))
                    // Anything this machine has learned from its own home screen
                    // sits on top of the handful of rules that ship with the app.
                    const table = { ...RULES, ...(mine?.rules ?? {}) }
                    const order = mine?.folderOrder.length ? mine.folderOrder : FOLDER_ORDER
                    const proposed = buildPlan(apps, limits, { dock, rules: table, order })

                    // Only apps the table has never heard of are worth asking
                    // the store about. Asking about every app would let a store
                    // category overrule a folder someone chose by hand.
                    const wanted = proposed.unassigned.map(keyOf)
                    if (!lookUp || !wanted.length) {
                        dispatch({ type: 'load', state: proposed.state })
                        if (wanted.length) {
                            setStatus(`${wanted.length} apps had no rule and went to Unsorted`)
                        }
                        return
                    }

                    const found = assignmentsFromGenres(await lookupGenres(wanted))
                    const settled = buildPlan(apps, limits, {
                        dock,
                        order,
                        rules: { ...table, ...found },
                    })
                    dispatch({ type: 'load', state: settled.state })

                    const left = settled.unassigned.length
                    setStatus(
                        left
                            ? `${left} apps are still unsorted — the store did not know them`
                            : `the App Store sorted ${Object.keys(found).length} apps`
                    )
                }),
            [baseline, guard, limits, mine]
        ),
        // The plan and what the phone last said are both here, so the review
        // needs no trip to the device.
        onReview: useCallback(
            () => setChange(baseline ? diffStates(baseline, edited) : null),
            [baseline, edited]
        ),
        onDiscard: useCallback(() => baseline && dispatch({ type: 'load', state: baseline }), [baseline]),
        onSaveRules: useCallback(
            () =>
                guard(async () => {
                    const table = deriveRules(edited)
                    await saveRules(table)
                    setMine(table)
                    setStatus(
                        `${Object.keys(table.rules).length} apps remembered across ${table.folderOrder.length} folders`
                    )
                }),
            [edited, guard]
        ),
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

    useEffect(() => {
        userRules()
            .then(setMine)
            .catch(() => {})
    }, [])

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

    // Asked once, on the way in. A failure here is never worth a word to anyone.
    useEffect(() => {
        checkForUpdate()
            .then(found => {
                if (!found) return
                toast(`IconState ${found.version} is out`, {
                    duration: Infinity,
                    action: { label: 'Get it', onClick: () => openUrl(found.url) },
                })
            })
            .catch(() => {})
    }, [])

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
