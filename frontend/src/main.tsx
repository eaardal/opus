import React from "react";
import { createRoot } from "react-dom/client";
import "./styles/theme.css";
import "./style.css";
import App from "./App";
import { ConfirmHost } from "./ui/ConfirmModal";
import { AuthGate } from "./features/auth/AuthGate";
import { SelectedWorkspaceProvider } from "./features/workspace/SelectedWorkspaceProvider";
import { WorkspaceGate } from "./features/workspace/WorkspaceGate";

const container = document.getElementById("root");
if (!container) throw new Error("Root element #root not found");

const root = createRoot(container);

root.render(
  <React.StrictMode>
    <AuthGate>
      <SelectedWorkspaceProvider>
        <WorkspaceGate>
          <App />
        </WorkspaceGate>
      </SelectedWorkspaceProvider>
    </AuthGate>
    <ConfirmHost />
  </React.StrictMode>,
);
