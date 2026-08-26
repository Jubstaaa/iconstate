import type { EditorToolbarProps } from './editor-toolbar.types'

const chip =
    'rounded-lg px-2.5 py-1.5 text-[12px] text-chalk/85 transition hover:bg-white/8 hover:text-chalk disabled:pointer-events-none disabled:text-dim/45'

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
        <div className='flex items-center gap-1 rounded-xl border border-white/8 bg-white/4 p-1 backdrop-blur-xl'>
            <button className={chip} onClick={onGroup} disabled={busy || selectionCount < 2}>
                {selectionCount > 1 ? `Group ${selectionCount}` : 'Group'}
                <span className='ml-1.5 text-dim'>⌘G</span>
            </button>
            <span className='h-4 w-px bg-white/10' />
            <button className={chip} onClick={onUndo} disabled={busy || !canUndo} title='Undo (⌘Z)'>
                Undo
            </button>
            <button className={chip} onClick={onRedo} disabled={busy || !canRedo} title='Redo (⇧⌘Z)'>
                Redo
            </button>
            <button className={chip} onClick={onReset} disabled={busy || !dirty}>
                Discard
            </button>
            <span className='h-4 w-px bg-white/10' />
            <button
                className='rounded-lg bg-glow px-3 py-1.5 text-[12px] font-semibold text-ink transition hover:brightness-110 disabled:bg-white/10 disabled:text-dim/60'
                onClick={onReview}
                disabled={busy || !dirty}
            >
                {dirty ? 'Review changes' : 'No changes'}
            </button>
        </div>
    )
}
