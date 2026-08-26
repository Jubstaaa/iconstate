import { useCallback, useEffect, useMemo, useState } from 'react'

import CategorisePanel from './features/categorise/categorise-panel'
import DiffReview from './features/diff-review/diff-review'
import HomeScreen from './features/home-screen/home-screen'
import {
    applyLayout,
    coreVersion,
    diffLayout,
    fetchIcons,
    getErrorMessage,
    listDevices,
    onProgress,
    planLayout,
    readIconState,
    restoreBackup,
} from './lib/core'
import { categorise } from './lib/categorise'
import { checkForUpdate } from './lib/update'

import type { Assignments, UnsortedApp } from './lib/categorise.types'
import type { Device, DiffSummary, IconManifest, IconState, ProgressEvent } from './lib/core.types'
import type { UpdateInfo } from './lib/update'

import { isFolder } from './lib/core.types'

type View = 'current' | 'plan'

const UNSORTED = 'Unsorted'

const unsortedApps = (state: IconState | null): UnsortedApp[] => {
    if (!state) return []
    const folder = state
        .flat()
        .filter(isFolder)
        .find(item => item.displayName === UNSORTED)
    return (folder?.iconLists.flat() ?? []).map(app => ({
        key: app.bundleIdentifier ?? app.displayIdentifier,
        displayName: app.displayName,
    }))
}

const folderNames = (state: IconState | null): string[] =>
    (state ?? [])
        .flat()
        .filter(isFolder)
        .map(item => item.displayName)
        .filter(name => name !== UNSORTED)

export default function App() {
    const [version, setVersion] = useState('')
    const [devices, setDevices] = useState<Device[]>([])
    const [current, setCurrent] = useState<IconState | null>(null)
    const [plan, setPlan] = useState<IconState | null>(null)
    const [change, setChange] = useState<DiffSummary | null>(null)
    const [icons, setIcons] = useState<IconManifest>({})
    const [assignments, setAssignments] = useState<Assignments>({})
    const [view, setView] = useState<View>('current')
    const [status, setStatus] = useState('')
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const [update, setUpdate] = useState<UpdateInfo | null>(null)

    const serial = devices[0]?.serial

    const describe = useCallback((event: ProgressEvent) => {
        if (event.event === 'connected') return `connected to ${event.name} · iOS ${event.ios}`
        if (event.event === 'icon-state-read') return 'read the home screen'
        if (event.event === 'icon') return `icon ${event.done} of ${event.total}`
        if (event.event === 'unassigned') return `${event.count} apps had no rule and went to Unsorted`
        if (event.event === 'backed-up') return `backed up to ${event.path}`
        if (event.event === 'writing') return 'writing to the device'
        if (event.event === 'written') return 'written'
        if (event.event === 'error') return String(event.message)
        return event.event
    }, [])

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

    const handleRefresh = useCallback(
        () =>
            guard(async () => {
                const found = await listDevices()
                setDevices(found)
                if (!found.length) setStatus('plug the iPhone in over USB and trust this Mac')
            }),
        [guard]
    )

    const handleRead = useCallback(
        () =>
            guard(async () => {
                setCurrent(await readIconState(serial))
                setPlan(null)
                setChange(null)
                setAssignments({})
                setView('current')
                setIcons(await fetchIcons(serial))
            }),
        [guard, serial]
    )

    const propose = useCallback(
        async (decisions: Assignments) => {
            const wanted = Object.keys(decisions).length ? decisions : undefined
            const proposed = await planLayout(serial, wanted)
            setPlan(proposed)
            setChange(await diffLayout(proposed, serial))
            setView('plan')
            return proposed
        },
        [serial]
    )

    const handlePlan = useCallback(
        () => guard(async () => void (await propose(assignments))),
        [assignments, guard, propose]
    )

    const handleCategorise = useCallback(
        (apiKey: string) =>
            guard(async () => {
                const apps = unsortedApps(plan)
                if (!apps.length) return
                setStatus(`asking Claude about ${apps.length} apps`)
                const decided = await categorise({ apiKey, apps, folders: folderNames(plan) })
                const merged = { ...assignments, ...decided }
                setAssignments(merged)
                setStatus(`Claude placed ${Object.keys(decided).length} apps`)
                await propose(merged)
            }),
        [assignments, guard, plan, propose]
    )

    const handleApply = useCallback(
        () =>
            guard(async () => {
                if (!plan) return
                await applyLayout(plan, serial)
                setCurrent(await readIconState(serial))
                setPlan(null)
                setChange(null)
                setView('current')
            }),
        [guard, plan, serial]
    )

    const handleRestore = useCallback(
        () =>
            guard(async () => {
                await restoreBackup(undefined, serial)
                setCurrent(await readIconState(serial))
                setPlan(null)
                setChange(null)
                setView('current')
            }),
        [guard, serial]
    )

    const handleCancel = useCallback(() => {
        setPlan(null)
        setChange(null)
        setView('current')
    }, [])

    useEffect(() => {
        const unlisten = onProgress(event => setStatus(describe(event)))
        coreVersion()
            .then(setVersion)
            .catch(cause => setError(getErrorMessage(cause)))
        handleRefresh()
        checkForUpdate()
            .then(setUpdate)
            .catch(() => setUpdate(null))
        return () => {
            unlisten.then(stop => stop())
        }
    }, [describe, handleRefresh])

    const shown = view === 'plan' ? plan : current
    const pending = useMemo(() => unsortedApps(plan), [plan])

    return (
        <main>
            <header>
                <div>
                    <h1>IconState</h1>
                    <p>{serial ?? 'no device'}</p>
                </div>
                <div className='actions'>
                    <button onClick={handleRefresh} disabled={busy}>
                        Refresh
                    </button>
                    <button onClick={handleRead} disabled={busy || !serial}>
                        Read home screen
                    </button>
                    <button onClick={handlePlan} disabled={busy || !current}>
                        Propose folders
                    </button>
                    <button onClick={handleRestore} disabled={busy || !serial}>
                        Undo last apply
                    </button>
                </div>
            </header>

            <p className={error ? 'status status-error' : 'status'}>{error || status}</p>

            {pending.length ? (
                <CategorisePanel busy={busy} apps={pending} onCategorise={handleCategorise} />
            ) : null}

            {change && plan ? (
                <DiffReview busy={busy} change={change} onApply={handleApply} onCancel={handleCancel} />
            ) : null}

            {shown ? <HomeScreen state={shown} icons={icons} /> : <p className='empty'>Nothing read yet.</p>}

            <footer>
                core {version || '—'}
                {update ? (
                    <a href={update.url} target='_blank' rel='noreferrer'>
                        {' '}
                        · version {update.version} is available
                    </a>
                ) : null}
            </footer>
        </main>
    )
}
