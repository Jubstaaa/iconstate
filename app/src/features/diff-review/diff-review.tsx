import type { DiffReviewProps } from './diff-review.types'

export default function DiffReview({ busy, change, onApply, onCancel }: DiffReviewProps) {
    if (change.empty) {
        return <p className='status'>The device already matches this plan.</p>
    }

    return (
        <section className='review'>
            <header className='review-head'>
                <h2>
                    {change.touched} icons will move
                    {change.addedFolders.length ? ` · ${change.addedFolders.length} new folders` : ''}
                </h2>
                <div className='actions'>
                    <button onClick={onCancel} disabled={busy}>
                        Cancel
                    </button>
                    <button className='primary' onClick={onApply} disabled={busy}>
                        Apply to iPhone
                    </button>
                </div>
            </header>
            <p className='status'>A backup is written before anything is sent to the device.</p>
            <ul className='moves'>
                {change.addedFolders.map(name => (
                    <li key={`+${name}`} className='move move-add'>
                        new folder <strong>{name}</strong>
                    </li>
                ))}
                {change.moves.map(move => (
                    <li key={move.key} className='move'>
                        <strong>{move.displayName}</strong>
                        <span>
                            {move.before} → {move.after}
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    )
}
