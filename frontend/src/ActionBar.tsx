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
    <div className="top-section">
      <div className="actionbar">
        <button className="action-btn" onClick={onOpen}>
          Open
        </button>
        <button className="action-btn" onClick={onSave}>
          Save
        </button>
      </div>

      {currentFilePath && (
        <div className="file-info">
          <span className="file-name">
            {currentFilePath.split("/").pop()}
          </span>
          {hasUnsavedChanges && (
            <span className="unsaved-indicator">●</span>
          )}
        </div>
      )}
    </div>
  );
}
