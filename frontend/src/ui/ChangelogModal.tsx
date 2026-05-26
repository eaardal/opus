import { useEffect } from "react";
import { CHANGELOG } from "../generated/changelog";
import "./ChangelogModal.css";

interface Props {
  lastSeenVersion: string | null;
  onClose: () => void;
}

export function ChangelogModal({ lastSeenVersion, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="changelog-overlay" onClick={onClose}>
      <div
        className="changelog-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="changelog-title"
      >
        <div className="changelog-header">
          <h2 id="changelog-title" className="changelog-title">
            What's New
          </h2>
          <button type="button" className="changelog-close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="changelog-body">
          {CHANGELOG.map((entry) => {
            const isNew = isEntryNew(entry.version, lastSeenVersion);
            return (
              <div key={entry.version} className="changelog-entry">
                <div className="changelog-entry-header">
                  <span className="changelog-version">v{entry.version}</span>
                  {isNew && <span className="changelog-new-badge">New</span>}
                  <span className="changelog-date">{entry.date}</span>
                </div>
                {entry.sections.map((s) => (
                  <div key={s.name} className="changelog-section">
                    <span className="changelog-section-name">{s.name}</span>
                    {s.subsections.map((sub) => (
                      <div key={sub.heading ?? ""} className="changelog-subsection">
                        {sub.heading !== null && (
                          <span className="changelog-subsection-heading">{sub.heading}</span>
                        )}
                        <ul className="changelog-items">
                          {sub.items.map((item) => (
                            <li key={item.text}>
                              {item.text}
                              {item.subitems.length > 0 && (
                                <ul className="changelog-subitems">
                                  {item.subitems.map((subitem) => (
                                    <li key={subitem}>{subitem}</li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function isEntryNew(entryVersion: string, lastSeen: string | null): boolean {
  if (lastSeen === null) return false;
  return compareVersions(entryVersion, lastSeen) > 0;
}

function compareVersions(a: string, b: string): number {
  const parse = (v: string) => v.split(".").map(Number);
  const [aMaj, aMin, aPatch] = parse(a);
  const [bMaj, bMin, bPatch] = parse(b);
  if (aMaj !== bMaj) return aMaj - bMaj;
  if (aMin !== bMin) return aMin - bMin;
  return aPatch - bPatch;
}
