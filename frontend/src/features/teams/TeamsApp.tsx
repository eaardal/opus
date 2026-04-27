import { useState, useCallback, useEffect, forwardRef, useImperativeHandle, useRef } from "react";
import "./TeamsApp.css";
import type { Person, Team } from "../../domain/teams/types";
import type { TeamMgtHandle } from "./types";
import { PeoplePanel } from "./PeoplePanel/PeoplePanel";
import { TeamsPanel } from "./TeamsPanel/TeamsPanel";
import { confirm } from "../../ui/ConfirmModal";
import { useWorkspaceRole } from "../workspace/WorkspaceRoleContext";

interface TeamMgtProps {
  initialPeople?: Person[];
  initialTeams?: Team[];
  onPeopleChange?: (people: Person[]) => void;
  onTeamsChange?: (teams: Team[]) => void;
}

export const TeamMgt = forwardRef<TeamMgtHandle, TeamMgtProps>(function TeamMgt(
  { initialPeople = [], initialTeams = [], onPeopleChange, onTeamsChange },
  ref,
) {
  const { canEdit } = useWorkspaceRole();
  const [people, setPeople] = useState<Person[]>(initialPeople);
  const [teams, setTeams] = useState<Team[]>(initialTeams);

  const onPeopleChangeRef = useRef(onPeopleChange);
  onPeopleChangeRef.current = onPeopleChange;
  const onTeamsChangeRef = useRef(onTeamsChange);
  onTeamsChangeRef.current = onTeamsChange;

  useEffect(() => {
    onPeopleChangeRef.current?.(people);
  }, [people]);
  useEffect(() => {
    onTeamsChangeRef.current?.(teams);
  }, [teams]);

  useImperativeHandle(
    ref,
    () => ({
      getPeople: () => people,
      getTeams: () => teams,
    }),
    [people, teams],
  );

  const addPerson = useCallback((): string => {
    if (!canEdit) return "";
    const id = crypto.randomUUID();
    setPeople((prev) => [...prev, { id, name: "", picture: null }]);
    return id;
  }, [canEdit]);

  const updatePerson = useCallback(
    (id: string, updates: Partial<Person>) => {
      if (!canEdit) return;
      setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
    },
    [canEdit],
  );

  const deletePerson = useCallback(
    async (id: string) => {
      if (!canEdit) return;
      const person = people.find((p) => p.id === id);
      const confirmed = await confirm({
        title: "Delete Person",
        message: `Delete "${person?.name || "this person"}"?`,
        confirmLabel: "Delete",
      });
      if (!confirmed) return;
      setPeople((prev) => prev.filter((p) => p.id !== id));
      setTeams((prev) =>
        prev.map((t) => ({ ...t, memberIds: t.memberIds.filter((mid) => mid !== id) })),
      );
    },
    [canEdit, people],
  );

  const addTeam = useCallback(() => {
    if (!canEdit) return;
    setTeams((prev) => [...prev, { id: crypto.randomUUID(), name: "New Team", memberIds: [] }]);
  }, [canEdit]);

  const updateTeam = useCallback(
    (id: string, updates: Partial<Team>) => {
      if (!canEdit) return;
      setTeams((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    },
    [canEdit],
  );

  const deleteTeam = useCallback(
    async (id: string) => {
      if (!canEdit) return;
      const team = teams.find((t) => t.id === id);
      const confirmed = await confirm({
        title: "Delete Team",
        message: `Delete team "${team?.name || "this team"}"? People will not be deleted.`,
        confirmLabel: "Delete",
      });
      if (!confirmed) return;
      setTeams((prev) => prev.filter((t) => t.id !== id));
    },
    [canEdit, teams],
  );

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
