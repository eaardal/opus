import "./SettingsDialog.css";

export interface AppSettings {
  showBlockedBySection: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  showBlockedBySection: true,
};

const STORAGE_KEY = "app-settings";

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

interface ToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <label className="settings-toggle-row">
      <div className="settings-toggle-text">
        <span className="settings-toggle-label">{label}</span>
        {description && (
          <span className="settings-toggle-desc">{description}</span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`settings-toggle-btn${checked ? " settings-toggle-btn--on" : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span className="settings-toggle-thumb" />
      </button>
    </label>
  );
}

interface SettingsDialogProps {
  settings: AppSettings;
  theme: "dark" | "light";
  onChange: (settings: AppSettings) => void;
  onToggleTheme: () => void;
  onClose: () => void;
}

export function SettingsDialog({
  settings,
  theme,
  onChange,
  onToggleTheme,
  onClose,
}: SettingsDialogProps) {
  const set = (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch };
    onChange(next);
    saveSettings(next);
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2 className="settings-title">Settings</h2>
          <button
            className="settings-close"
            onClick={onClose}
            aria-label="Close settings"
          >
            ×
          </button>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">Appearance</div>
          <ToggleRow
            label="Dark mode"
            checked={theme === "dark"}
            onChange={onToggleTheme}
          />
        </div>

        <div className="settings-section">
          <div className="settings-section-title">Task Queue</div>
          <ToggleRow
            label="Show Blocked By section"
            description="Displays tasks blocking a person's work in their swimlane"
            checked={settings.showBlockedBySection}
            onChange={(v) => set({ showBlockedBySection: v })}
          />
        </div>
      </div>
    </div>
  );
}
