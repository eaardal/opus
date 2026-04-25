import type { ReactNode } from "react";
import { useSelectedWorkspace } from "./SelectedWorkspaceProvider";
import { WorkspacePicker } from "./WorkspacePicker";

interface Props {
  children: ReactNode;
}

export function WorkspaceGate({ children }: Props) {
  const { id } = useSelectedWorkspace();
  if (!id) return <WorkspacePicker />;
  return <>{children}</>;
}
