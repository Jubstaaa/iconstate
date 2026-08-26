import { getCurrentWindow } from '@tauri-apps/api/window'

import type { ChromeAction, SimulatorChromeProps } from './simulator-chrome.types'

const PATHS: Record<ChromeAction['icon'], string> = {
    sort: 'M3 4h6v6H3V4Zm8 0h6v6h-6V4ZM3 12h6v6H3v-6Zm8 0h6v6h-6v-6Z',
    review: 'M4 10.5 8 14.5 16 5.5',
    reload: 'M16 10a6 6 0 1 1-1.9-4.4M16 3v3.5h-3.5',
}

function Light({ tone, onClick }: { tone: string; onClick: () => void }) {
    return <button onClick={onClick} className={`size-[12px] rounded-full ${tone}`} />
}

export default function SimulatorChrome({ device, system, actions }: SimulatorChromeProps) {
    return (
        <div
            data-tauri-drag-region
            className='flex h-[46px] shrink-0 items-center justify-between rounded-[15px] bg-[#1d2026] px-3 shadow-[0_4px_12px_-6px_rgba(0,0,0,0.6)] ring-1 ring-white/8 select-none'
        >
            <div className='flex items-center gap-2'>
                <Light tone='bg-[#ff5f57]' onClick={() => getCurrentWindow().close()} />
                <Light tone='bg-[#febc2e]' onClick={() => getCurrentWindow().minimize()} />
                <Light tone='bg-[#28c840]' onClick={() => getCurrentWindow().toggleMaximize()} />
            </div>

            <div data-tauri-drag-region className='pointer-events-none text-center leading-tight'>
                <p className='text-[13px] font-semibold text-white'>{device || 'IconState'}</p>
                <p className='text-[11px] text-white/45'>{system}</p>
            </div>

            <div className='flex items-center gap-1'>
                {actions.map(action => (
                    <button
                        key={action.icon}
                        title={action.label}
                        disabled={action.disabled}
                        onClick={action.onPick}
                        className='grid size-8 place-items-center rounded-full bg-white/8 text-white/80 transition hover:bg-white/16 hover:text-white disabled:opacity-30 disabled:hover:bg-white/8'
                    >
                        <svg
                            viewBox='0 0 20 20'
                            className='size-[15px]'
                            fill={action.icon === 'sort' ? 'currentColor' : 'none'}
                            stroke={action.icon === 'sort' ? 'none' : 'currentColor'}
                            strokeWidth='1.8'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                        >
                            <path d={PATHS[action.icon]} />
                        </svg>
                    </button>
                ))}
            </div>
        </div>
    )
}
