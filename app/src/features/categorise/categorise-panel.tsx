import { useCallback, useState } from 'react'

import { readApiKey, saveApiKey } from '../../lib/categorise'

import type { CategorisePanelProps } from './categorise-panel.types'

export default function CategorisePanel({ busy, apps, onCategorise }: CategorisePanelProps) {
    const [apiKey, setApiKey] = useState(readApiKey)
    const [editing, setEditing] = useState(!readApiKey())

    const handleSave = useCallback(() => {
        saveApiKey(apiKey.trim())
        setEditing(false)
    }, [apiKey])

    const handleRun = useCallback(() => onCategorise(apiKey.trim()), [apiKey, onCategorise])

    return (
        <section className='review'>
            <header className='review-head'>
                <h2>
                    {apps.length} apps have no rule yet
                    <span className='muted'> — they are sitting in Unsorted</span>
                </h2>
                {editing ? null : (
                    <div className='actions'>
                        <button onClick={() => setEditing(true)} disabled={busy}>
                            Change key
                        </button>
                        <button className='primary' onClick={handleRun} disabled={busy}>
                            Sort them with Claude
                        </button>
                    </div>
                )}
            </header>

            {editing ? (
                <div className='key-row'>
                    <input
                        type='password'
                        value={apiKey}
                        placeholder='Anthropic API key'
                        onChange={event => setApiKey(event.target.value)}
                    />
                    <button onClick={handleSave} disabled={!apiKey.trim()}>
                        Save
                    </button>
                </div>
            ) : null}

            <ul className='moves'>
                {apps.map(app => (
                    <li key={app.key} className='move'>
                        <strong>{app.displayName}</strong>
                        <span>{app.key}</span>
                    </li>
                ))}
            </ul>
        </section>
    )
}
