import React from 'react'
import {createRoot} from 'react-dom/client'
import './style.css'
import App from './App'
import { ConfirmHost } from './shared/ConfirmModal'
import { AuthGate } from './auth/AuthGate'

const container = document.getElementById('root')

const root = createRoot(container!)

root.render(
    <React.StrictMode>
        <AuthGate>
            <App/>
        </AuthGate>
        <ConfirmHost/>
    </React.StrictMode>
)
