import { FolderOpen, Save } from "lucide-react";
import "./ActionBar.css";

interface ActionBarProps {
  currentFilePath: string | null;
  hasUnsavedChanges: boolean;
  onOpen: () => void;
  onSave: () => void;
}

export function ActionBar({
  currentFilePath,
  hasUnsavedChanges,
  onOpen,
  onSave,
}: ActionBarProps) {
  return (
    <div className="actionbar">
      <button className="action-icon-btn" onClick={onOpen} aria-label="Open file">
        <FolderOpen size={16} />
      </button>
      <button className="action-icon-btn" onClick={onSave} aria-label="Save file">
        <Save size={16} />
      </button>
      {currentFilePath && (
        <span className="file-info">
          <span className="file-name">
            {currentFilePath.split("/").pop()}
          </span>
          {hasUnsavedChanges && (
            <span className="unsaved-indicator">●</span>
          )}
        </span>
      )}
    </div>
  );
}
