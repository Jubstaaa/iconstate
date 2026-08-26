import type { DiffReviewProps } from './diff-review.types'

export default function DiffReview({ busy, change, onApply, onCancel }: DiffReviewProps) {
    return (
        <div className='fixed inset-0 z-30 grid place-items-center bg-black/70 p-8 backdrop-blur-sm'>
            <section className='flex max-h-full w-full max-w-2xl flex-col gap-3 rounded-2xl bg-panel p-5 ring-1 ring-hairline'>
                <header className='flex items-baseline justify-between gap-4'>
                    <h2 className='text-sm font-semibold'>
                        {change.empty
                            ? 'Nothing to write — the device already matches'
                            : `${change.touched} icons will move`}
                    </h2>
                    <span className='text-xs text-dim'>
                        {change.addedFolders.length} folders added · {change.removedFolders.length} removed
                    </span>
                </header>

                {change.empty ? null : (
                    <ul className='grid max-h-72 grid-cols-1 gap-x-6 overflow-y-auto text-xs sm:grid-cols-2'>
                        {change.addedFolders.map(name => (
                            <li key={`+${name}`} className='flex justify-between gap-3 py-0.5 text-glow'>
                                <span>new folder</span>
                                <strong className='font-medium'>{name}</strong>
                            </li>
                        ))}
                        {change.removedFolders.map(name => (
                            <li key={`-${name}`} className='flex justify-between gap-3 py-0.5 text-alarm'>
                                <span>folder gone</span>
                                <strong className='font-medium'>{name}</strong>
                            </li>
                        ))}
                        {change.moves.map(move => (
                            <li key={move.key} className='flex justify-between gap-3 py-0.5'>
                                <strong className='truncate font-medium'>{move.displayName}</strong>
                                <span className='shrink-0 text-dim'>
                                    {move.before} → {move.after}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}

                <p className='text-xs text-dim'>A backup is written before anything reaches the device.</p>

                <div className='flex justify-end gap-2'>
                    <button
                        onClick={onCancel}
                        disabled={busy}
                        className='rounded-lg bg-ink px-3 py-1.5 text-xs ring-1 ring-hairline disabled:opacity-40'
                    >
                        Keep editing
                    </button>
                    <button
                        onClick={onApply}
                        disabled={busy || change.empty}
                        className='rounded-lg bg-glow px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-40'
                    >
                        Write to iPhone
                    </button>
                </div>
            </section>
        </div>
    )
}
