import "./PeoplePanel.css";
import { Person } from "./types";
import { PersonItem } from "./PersonItem";

interface PeoplePanelProps {
  people: Person[];
  onAddPerson: () => string;
  onUpdatePerson: (id: string, updates: Partial<Person>) => void;
  onDeletePerson: (id: string) => void;
}

export function PeoplePanel({ people, onAddPerson, onUpdatePerson, onDeletePerson }: PeoplePanelProps) {
  return (
    <div className="people-panel">
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
