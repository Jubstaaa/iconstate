import { Component } from 'react'

import type { ErrorInfo, ReactNode } from 'react'

interface CrashBoundaryProps {
    children: ReactNode
}

interface CrashBoundaryState {
    error: Error | null
    where: string
}

/** Without this a render error unmounts everything and the window just goes black. */
export default class CrashBoundary extends Component<CrashBoundaryProps, CrashBoundaryState> {
    state: CrashBoundaryState = { error: null, where: '' }

    static getDerivedStateFromError(error: Error): Partial<CrashBoundaryState> {
        return { error }
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        this.setState({ where: info.componentStack ?? '' })
        console.error('render failed', error, info.componentStack)
    }

    render() {
        const { error, where } = this.state
        if (!error) return this.props.children

        return (
            <div className='grid h-full place-items-center p-6'>
                <div className='max-w-full space-y-3 overflow-auto'>
                    <p className='text-[13px] font-semibold text-alarm'>Something in the editor crashed</p>
                    <pre className='text-[11px] whitespace-pre-wrap text-chalk'>
                        {String(error?.stack ?? error)}
                    </pre>
                    <pre className='text-[10px] whitespace-pre-wrap text-dim'>
                        {where.split('\n').slice(0, 12).join('\n')}
                    </pre>
                    <button
                        onClick={() => this.setState({ error: null, where: '' })}
                        className='rounded-lg bg-panel px-3 py-1.5 text-[12px] ring-1 ring-hairline'
                    >
                        Try again
                    </button>
                </div>
            </div>
        )
    }
}
