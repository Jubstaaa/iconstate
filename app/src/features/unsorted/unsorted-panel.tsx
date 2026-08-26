import type { UnsortedPanelProps } from './unsorted-panel.types'

export default function UnsortedPanel({ busy, apps, onLookUp }: UnsortedPanelProps) {
    return (
        <section className='review'>
            <header className='review-head'>
                <h2>
                    {apps.length} apps have no rule
                    <span className='muted'> — they are sitting in Unsorted</span>
                </h2>
                <button onClick={onLookUp} disabled={busy}>
                    Look them up in the App Store
                </button>
            </header>
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
