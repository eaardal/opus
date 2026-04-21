import { useState, useRef, useEffect } from "react";
import "./TeamCard.css";
import { Person, Team } from "./types";

const AVATAR_COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#06b6d4"];

function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function MemberAvatar({ person, size = 32 }: { person: Person; size?: number }) {
  const initials = person.name.trim() ? person.name.trim()[0].toUpperCase() : "?";
  const style = { width: size, height: size, minWidth: size };
  return person.picture ? (
    <img className="member-avatar" src={person.picture} alt={person.name} title={person.name} style={style} />
  ) : (
    <span className="member-avatar member-avatar-initials" style={{ ...style, background: avatarColor(person.id), fontSize: size * 0.45 }} title={person.name}>
      {initials}
    </span>
  );
}

interface TeamCardProps {
  team: Team;
  people: Person[];
  onUpdate: (updates: Partial<Team>) => void;
  onDelete: () => void;
}

export function TeamCard({ team, people, onUpdate, onDelete }: TeamCardProps) {
  const [editName, setEditName] = useState(team.name);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerFilter, setPickerFilter] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);
  const pickerFilterRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setEditName(team.name); }, [team.name]);

  useEffect(() => {
    if (!showPicker) { setPickerFilter(""); return; }
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false);
    };
    document.addEventListener("mousedown", handleClick);
    setTimeout(() => pickerFilterRef.current?.focus(), 0);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPicker]);

const members = team.memberIds.map(id => people.find(p => p.id === id)).filter(Boolean) as Person[];
  const nonMembers = people.filter(p => !team.memberIds.includes(p.id));

  const commitName = () => { if (editName !== team.name) onUpdate({ name: editName }); };
  const addMember = (id: string) => onUpdate({ memberIds: [...team.memberIds, id] });
  const removeMember = (id: string) => onUpdate({ memberIds: team.memberIds.filter(mid => mid !== id) });

  return (
    <div className="team-card">
      <div className="team-card-header">
        <input
          className="team-name-input"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => { if (e.key === "Enter") { commitName(); (e.target as HTMLInputElement).blur(); } }}
        />
        <button className="team-delete-btn" onClick={onDelete} title="Delete team">×</button>
      </div>

      <div className="team-members">
        {members.map(person => (
          <div key={person.id} className="team-member-slot">
            <MemberAvatar person={person} />
            <button className="remove-member-btn" onClick={() => removeMember(person.id)} title={`Remove ${person.name}`}>×</button>
          </div>
        ))}

        <div className="add-member-wrapper" ref={pickerRef}>
          <button
            className="add-member-btn"
            onClick={() => setShowPicker(v => !v)}
            title="Add member"
            disabled={nonMembers.length === 0}
          >
            +
          </button>
          {showPicker && nonMembers.length > 0 && (
            <div className="member-picker">
              <div className="member-picker-search">
                <input
                  ref={pickerFilterRef}
                  className="member-picker-filter"
                  placeholder="Filter people..."
                  value={pickerFilter}
                  onChange={e => setPickerFilter(e.target.value)}
                  onKeyDown={e => { if (e.key === "Escape") setShowPicker(false); }}
                />
              </div>
              <div className="member-picker-list">
                {nonMembers
                  .filter(p => !pickerFilter || p.name.toLowerCase().includes(pickerFilter.toLowerCase()))
                  .map(person => (
                    <button
                      key={person.id}
                      className="member-picker-item"
                      onClick={() => { addMember(person.id); setShowPicker(false); }}
                    >
                      <MemberAvatar person={person} size={24} />
                      <span>{person.name || "(unnamed)"}</span>
                    </button>
                  ))}
                {nonMembers.filter(p => !pickerFilter || p.name.toLowerCase().includes(pickerFilter.toLowerCase())).length === 0 && (
                  <div className="member-picker-empty">No matches</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="team-member-count">
        {members.length} {members.length === 1 ? "person" : "people"}
      </div>
    </div>
  );
}
