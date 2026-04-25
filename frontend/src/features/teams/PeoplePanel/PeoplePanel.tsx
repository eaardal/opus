import { useState } from "react";
import "./PeoplePanel.css";
import type { Person } from "../../../domain/teams/types";
import { PersonItem } from "./PersonItem";

interface PeoplePanelProps {
  people: Person[];
  onAddPerson: () => string;
  onUpdatePerson: (id: string, updates: Partial<Person>) => void;
  onDeletePerson: (id: string) => void;
}

export function PeoplePanel({
  people,
  onAddPerson,
  onUpdatePerson,
  onDeletePerson,
}: PeoplePanelProps) {
  const [focusPersonId, setFocusPersonId] = useState<string | null>(null);

  const addAndFocus = () => {
    const id = onAddPerson();
    setFocusPersonId(id);
  };

  return (
    <div className="people-panel">
      <div className="people-panel-title-row">
        <span className="people-panel-title">People</span>
        <button className="add-person-btn" onClick={addAndFocus}>
          + Add person
        </button>
      </div>
      <div className="people-list">
        {people.length === 0 && (
          <p className="people-empty">No people yet. Add someone to get started.</p>
        )}
        {people.map((person) => (
          <PersonItem
            key={person.id}
            person={person}
            focusOnMount={person.id === focusPersonId}
            onAddAfter={addAndFocus}
            onUpdate={(updates) => onUpdatePerson(person.id, updates)}
            onDelete={() => onDeletePerson(person.id)}
          />
        ))}
      </div>
    </div>
  );
}
