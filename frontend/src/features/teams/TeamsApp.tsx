import { useState, useCallback } from "react";
import "./TeamsApp.css";
import type { Person, Team } from "../../domain/teams/types";
import { PeoplePanel } from "./PeoplePanel/PeoplePanel";
import { TeamsPanel } from "./TeamsPanel/TeamsPanel";
import { confirm } from "../../ui/ConfirmModal";
import { useWorkspaceRole } from "../workspace/WorkspaceRoleContext";
import { workspaceService } from "../../services/container";

interface TeamMgtProps {
  workspaceId: string;
  initialPeople?: Person[];
  initialTeams?: Team[];
}

export function TeamMgt({ workspaceId, initialPeople = [], initialTeams = [] }: TeamMgtProps) {
  const { canEdit } = useWorkspaceRole();
  const [people, setPeople] = useState<Person[]>(initialPeople);
  const [teams, setTeams] = useState<Team[]>(initialTeams);

  const addPerson = useCallback((): string => {
    if (!canEdit) return "";
    const id = crypto.randomUUID();
    const newPerson: Person = { id, name: "", picture: null };
    setPeople((prev) => [...prev, newPerson]);
    workspaceService.addPerson(workspaceId, newPerson).catch(console.error);
    return id;
  }, [canEdit, workspaceId]);

  const updatePerson = useCallback(
    (id: string, updates: Partial<Person>) => {
      if (!canEdit) return;
      setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
      workspaceService.updatePerson(workspaceId, id, updates).catch(console.error);
    },
    [canEdit, workspaceId],
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

      const affectedTeams = teams.filter((t) => t.memberIds.includes(id));
      setPeople((prev) => prev.filter((p) => p.id !== id));
      setTeams((prev) =>
        prev.map((t) => ({ ...t, memberIds: t.memberIds.filter((mid) => mid !== id) })),
      );

      workspaceService.deletePerson(workspaceId, id).catch(console.error);
      for (const team of affectedTeams) {
        workspaceService
          .updateTeam(workspaceId, team.id, {
            memberIds: team.memberIds.filter((mid) => mid !== id),
          })
          .catch(console.error);
      }
    },
    [canEdit, people, teams, workspaceId],
  );

  const addTeam = useCallback(() => {
    if (!canEdit) return;
    const newTeam: Team = { id: crypto.randomUUID(), name: "New Team", memberIds: [] };
    setTeams((prev) => [...prev, newTeam]);
    workspaceService.addTeam(workspaceId, newTeam).catch(console.error);
  }, [canEdit, workspaceId]);

  const updateTeam = useCallback(
    (id: string, updates: Partial<Team>) => {
      if (!canEdit) return;
      setTeams((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
      workspaceService.updateTeam(workspaceId, id, updates).catch(console.error);
    },
    [canEdit, workspaceId],
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
      workspaceService.deleteTeam(workspaceId, id).catch(console.error);
    },
    [canEdit, teams, workspaceId],
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
}
