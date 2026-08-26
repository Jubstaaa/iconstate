import { useCallback, useEffect, useState } from 'react'

import HomeScreen from './features/home-screen/home-screen'
import { coreVersion, getErrorMessage, listDevices, onProgress, readIconState } from './lib/core'
import { checkForUpdate } from './lib/update'

import type { Device, IconState, ProgressEvent } from './lib/core.types'
import type { UpdateInfo } from './lib/update'

export default function App() {
    const [version, setVersion] = useState('')
    const [devices, setDevices] = useState<Device[]>([])
    const [state, setState] = useState<IconState | null>(null)
    const [status, setStatus] = useState('')
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const [update, setUpdate] = useState<UpdateInfo | null>(null)

    const describe = useCallback((event: ProgressEvent) => {
        if (event.event === 'connected') return `connected to ${event.name} · iOS ${event.ios}`
        if (event.event === 'icon-state-read') return `read ${event.pages} pages`
        if (event.event === 'error') return String(event.message)
        return event.event
    }, [])

    const handleRefresh = useCallback(async () => {
        setBusy(true)
        setError('')
        try {
            const found = await listDevices()
            setDevices(found)
            if (!found.length) setStatus('plug the iPhone in over USB and trust this Mac')
        } catch (cause) {
            setError(getErrorMessage(cause))
        } finally {
            setBusy(false)
        }
    }, [])

    const handleRead = useCallback(async () => {
        setBusy(true)
        setError('')
        try {
            setState(await readIconState(devices[0]?.serial))
        } catch (cause) {
            setError(getErrorMessage(cause))
        } finally {
            setBusy(false)
        }
    }, [devices])

    useEffect(() => {
        const unlisten = onProgress(event => setStatus(describe(event)))
        coreVersion().then(setVersion).catch(cause => setError(getErrorMessage(cause)))
        handleRefresh()
        checkForUpdate().then(setUpdate).catch(() => setUpdate(null))
        return () => {
            unlisten.then(stop => stop())
        }
    }, [describe, handleRefresh])

    return (
        <main>
            <header>
                <div>
                    <h1>IconState</h1>
                    <p>{devices.length ? devices.map(device => device.serial).join(', ') : 'no device'}</p>
                </div>
                <div className='actions'>
                    <button onClick={handleRefresh} disabled={busy}>
                        Refresh
                    </button>
                    <button onClick={handleRead} disabled={busy || !devices.length}>
                        Read home screen
                    </button>
                </div>
            </header>
            <p className={error ? 'status status-error' : 'status'}>{error || status}</p>
            {state ? <HomeScreen state={state} /> : <p className='empty'>Nothing read yet.</p>}
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
