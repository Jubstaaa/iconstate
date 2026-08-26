import type { EditorToolbarProps } from './editor-toolbar.types'

const button =
    'rounded-lg bg-panel px-3 py-1.5 text-xs text-chalk ring-1 ring-hairline transition hover:ring-glow disabled:opacity-35 disabled:hover:ring-hairline'

export default function EditorToolbar({
    busy,
    dirty,
    selectionCount,
    canUndo,
    canRedo,
    onGroup,
    onUndo,
    onRedo,
    onReset,
    onReview,
}: EditorToolbarProps) {
    return (
        <div className='flex items-center gap-2'>
            <button className={button} onClick={onGroup} disabled={busy || selectionCount < 2}>
                {selectionCount > 1 ? `Group ${selectionCount} apps` : 'Group selection'}
                <span className='ml-1.5 text-dim'>⌘G</span>
            </button>
            <button className={button} onClick={onUndo} disabled={busy || !canUndo}>
                Undo <span className='ml-1 text-dim'>⌘Z</span>
            </button>
            <button className={button} onClick={onRedo} disabled={busy || !canRedo}>
                Redo
            </button>
            <button className={button} onClick={onReset} disabled={busy || !dirty}>
                Discard edits
            </button>
            <button
                className='rounded-lg bg-glow px-3 py-1.5 text-xs font-semibold text-ink transition hover:brightness-110 disabled:opacity-35'
                onClick={onReview}
                disabled={busy || !dirty}
            >
                Review changes
            </button>
        </div>
    )
}
