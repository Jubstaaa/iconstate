import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './app'
import CrashBoundary from './features/crash/crash-boundary'

import './styles.css'

// WKWebView shows its own context menu (Reload, Inspect) on top of ours unless
// the default is refused for the whole document.
document.addEventListener('contextmenu', event => event.preventDefault())

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <CrashBoundary>
            <App />
        </CrashBoundary>
    </React.StrictMode>
)
