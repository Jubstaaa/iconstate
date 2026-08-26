import { useEffect, useState } from 'react'

const clock = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })

export default function StatusBar() {
    const [time, setTime] = useState(clock)

    useEffect(() => {
        const timer = window.setInterval(() => setTime(clock()), 15_000)
        return () => window.clearInterval(timer)
    }, [])

    return (
        <div className='pointer-events-none flex items-center justify-between px-[9%] pt-[3%] text-[11px] font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]'>
            <span className='tabular-nums'>{time}</span>
            <span className='flex items-center gap-[5px]'>
                <svg viewBox='0 0 18 12' className='h-[10px] w-[15px]' fill='currentColor'>
                    <rect x='0' y='8' width='3' height='4' rx='1' />
                    <rect x='5' y='5.5' width='3' height='6.5' rx='1' />
                    <rect x='10' y='3' width='3' height='9' rx='1' />
                    <rect x='15' y='0' width='3' height='12' rx='1' />
                </svg>
                <svg viewBox='0 0 16 12' className='h-[10px] w-[13px]' fill='currentColor'>
                    <path d='M8 11.2 5.6 8.6a3.4 3.4 0 0 1 4.8 0L8 11.2Z' />
                    <path
                        d='M3.1 6.1a7 7 0 0 1 9.8 0'
                        stroke='currentColor'
                        strokeWidth='1.6'
                        fill='none'
                        strokeLinecap='round'
                    />
                    <path
                        d='M0.7 3.4a10.5 10.5 0 0 1 14.6 0'
                        stroke='currentColor'
                        strokeWidth='1.6'
                        fill='none'
                        strokeLinecap='round'
                    />
                </svg>
                <span className='flex h-[11px] w-[22px] items-center rounded-[3px] border border-white/60 p-[1.5px]'>
                    <span className='h-full w-[70%] rounded-[1px] bg-white' />
                </span>
            </span>
        </div>
    )
}
