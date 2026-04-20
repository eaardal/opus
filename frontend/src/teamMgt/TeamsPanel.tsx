import "./TeamsPanel.css";
import { Person, Team } from "./types";
import { TeamCard } from "./TeamCard";

interface TeamsPanelProps {
  teams: Team[];
  people: Person[];
  onAddTeam: () => void;
  onUpdateTeam: (id: string, updates: Partial<Team>) => void;
  onDeleteTeam: (id: string) => void;
}

export function TeamsPanel({ teams, people, onAddTeam, onUpdateTeam, onDeleteTeam }: TeamsPanelProps) {
  return (
    <div className="teams-panel">
      <div className="teams-panel-header">
        <span className="teams-panel-title">Teams</span>
        <button className="add-team-btn" onClick={onAddTeam}>+ Add team</button>
      </div>
      <div className="teams-list">
        {teams.length === 0 && (
          <p className="teams-empty">No teams yet. Create one to group your people.</p>
        )}
        {teams.map(team => (
          <TeamCard
            key={team.id}
            team={team}
            people={people}
            onUpdate={(updates) => onUpdateTeam(team.id, updates)}
            onDelete={() => onDeleteTeam(team.id)}
          />
        ))}
      </div>
    </div>
  );
}
