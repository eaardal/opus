import { useState, useCallback, useEffect, forwardRef, useImperativeHandle, useRef } from "react";
import "./TeamMgt.css";
import { Person, Team, TeamMgtHandle } from "./types";
import { PeoplePanel } from "./PeoplePanel";
import { TeamsPanel } from "./TeamsPanel";
import { confirm } from "../shared/ConfirmModal";

interface TeamMgtProps {
  initialPeople?: Person[];
  initialTeams?: Team[];
  onPeopleChange?: (people: Person[]) => void;
  onTeamsChange?: (teams: Team[]) => void;
}

export const TeamMgt = forwardRef<TeamMgtHandle, TeamMgtProps>(function TeamMgt(
  { initialPeople = [], initialTeams = [], onPeopleChange, onTeamsChange },
  ref
) {
  const [people, setPeople] = useState<Person[]>(initialPeople);
  const [teams, setTeams] = useState<Team[]>(initialTeams);

  const onPeopleChangeRef = useRef(onPeopleChange);
  onPeopleChangeRef.current = onPeopleChange;
  const onTeamsChangeRef = useRef(onTeamsChange);
  onTeamsChangeRef.current = onTeamsChange;

  useEffect(() => { onPeopleChangeRef.current?.(people); }, [people]);
  useEffect(() => { onTeamsChangeRef.current?.(teams); }, [teams]);

  useImperativeHandle(ref, () => ({
    getPeople: () => people,
    getTeams: () => teams,
  }), [people, teams]);

  const addPerson = useCallback((): string => {
    const id = crypto.randomUUID();
    setPeople(prev => [...prev, { id, name: "", picture: null }]);
    return id;
  }, []);

  const updatePerson = useCallback((id: string, updates: Partial<Person>) => {
    setPeople(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const deletePerson = useCallback(async (id: string) => {
    const person = people.find(p => p.id === id);
    const confirmed = await confirm({
      title: "Delete Person",
      message: `Delete "${person?.name || "this person"}"?`,
      confirmLabel: "Delete",
    });
    if (!confirmed) return;
    setPeople(prev => prev.filter(p => p.id !== id));
    setTeams(prev => prev.map(t => ({ ...t, memberIds: t.memberIds.filter(mid => mid !== id) })));
  }, [people]);

  const addTeam = useCallback(() => {
    setTeams(prev => [...prev, { id: crypto.randomUUID(), name: "New Team", memberIds: [] }]);
  }, []);

  const updateTeam = useCallback((id: string, updates: Partial<Team>) => {
    setTeams(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const deleteTeam = useCallback(async (id: string) => {
    const team = teams.find(t => t.id === id);
    const confirmed = await confirm({
      title: "Delete Team",
      message: `Delete team "${team?.name || "this team"}"? People will not be deleted.`,
      confirmLabel: "Delete",
    });
    if (!confirmed) return;
    setTeams(prev => prev.filter(t => t.id !== id));
  }, [teams]);

  return (
    <div id="TeamMgt">
      <PeoplePanel
        people={people}
        onAddPerson={addPerson}
        onUpdatePerson={updatePerson}
        onDeletePerson={deletePerson}
      />
      <TeamsPanel
        teams={teams}
        people={people}
        onAddTeam={addTeam}
        onUpdateTeam={updateTeam}
        onDeleteTeam={deleteTeam}
      />
    </div>
  );
});
