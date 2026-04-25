import React from 'react'
import {createRoot} from 'react-dom/client'
import './styles/theme.css'
import './style.css'
import App from './App'
import { ConfirmHost } from './shared/ConfirmModal'
import { AuthGate } from './auth/AuthGate'
import { SelectedWorkspaceProvider } from './workspace/SelectedWorkspaceProvider'
import { WorkspaceGate } from './workspace/WorkspaceGate'

const container = document.getElementById('root')

const root = createRoot(container!)

root.render(
    <React.StrictMode>
        <AuthGate>
            <SelectedWorkspaceProvider>
                <WorkspaceGate>
                    <App/>
                </WorkspaceGate>
            </SelectedWorkspaceProvider>
        </AuthGate>
        <ConfirmHost/>
    </React.StrictMode>
)
