import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './app'
import CrashBoundary from './features/crash/crash-boundary'

import './styles.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <CrashBoundary>
            <App />
        </CrashBoundary>
    </React.StrictMode>
)
