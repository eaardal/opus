import { FilePlus, FolderOpen, Save } from "lucide-react";
import "./PeoplePanel.css";
import { Person } from "./types";
import { PersonItem } from "./PersonItem";

interface PeoplePanelProps {
  people: Person[];
  currentFilePath: string | null;
  hasUnsavedChanges: boolean;
  onAddPerson: () => string;
  onUpdatePerson: (id: string, updates: Partial<Person>) => void;
  onDeletePerson: (id: string) => void;
  onSave: () => void;
  onOpen: () => void;
  onNew: () => void;
}

export function PeoplePanel({
  people,
  currentFilePath,
  hasUnsavedChanges,
  onAddPerson,
  onUpdatePerson,
  onDeletePerson,
  onSave,
  onOpen,
  onNew,
}: PeoplePanelProps) {
  const fileName = currentFilePath ? currentFilePath.split(/[\\/]/).pop() : null;

  return (
    <div className="people-panel">
      <div className="people-panel-header">
        <div className="people-panel-actions">
          <button className="panel-action-btn" onClick={onNew} title="New">
            <FilePlus size={15} />
          </button>
          <button className="panel-action-btn" onClick={onOpen} title="Open">
            <FolderOpen size={15} />
          </button>
          <button className="panel-action-btn" onClick={onSave} title="Save">
            <Save size={15} />
          </button>
        </div>
        <div className="people-panel-file-info">
          {fileName && (
            <span className="panel-filename">
              {hasUnsavedChanges && <span className="panel-unsaved">●</span>}
              {fileName}
            </span>
          )}
        </div>
      </div>

      <div className="people-panel-title-row">
        <span className="people-panel-title">People</span>
        <button className="add-person-btn" onClick={onAddPerson}>+ Add person</button>
      </div>

      <div className="people-list">
        {people.length === 0 && (
          <p className="people-empty">No people yet. Add someone to get started.</p>
        )}
        {people.map(person => (
          <PersonItem
            key={person.id}
            person={person}
            onUpdate={(updates) => onUpdatePerson(person.id, updates)}
            onDelete={() => onDeletePerson(person.id)}
          />
        ))}
      </div>
    </div>
  );
}
