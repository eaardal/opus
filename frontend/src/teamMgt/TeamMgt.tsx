import { useState, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
import "./TeamMgt.css";
import { Person, Team, TeamsFileData, TeamMgtHandle } from "./types";
import { PeoplePanel } from "./PeoplePanel";
import { TeamsPanel } from "./TeamsPanel";
import { ConfirmDialog, OpenFile, SaveFile, SaveFileAs } from "../../wailsjs/go/main/App";

export const TeamMgt = forwardRef<TeamMgtHandle>(function TeamMgt(_props, ref) {
  const [people, setPeople] = useState<Person[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useImperativeHandle(ref, () => ({
    getPeople: () => people,
    getTeams: () => teams,
  }), [people, teams]);

  const markDirty = useCallback(() => setHasUnsavedChanges(true), []);

  const handleSave = useCallback(async () => {
    const data = JSON.stringify({ people, teams } satisfies TeamsFileData, null, 2);
    try {
      if (currentFilePath) {
        await SaveFile(currentFilePath, data);
        setHasUnsavedChanges(false);
      } else {
        const filePath = await SaveFileAs(data);
        if (filePath) {
          setCurrentFilePath(filePath);
          setHasUnsavedChanges(false);
        }
      }
    } catch (err) {
      console.error("Save failed:", err);
    }
  }, [people, teams, currentFilePath]);

  const handleOpen = useCallback(async () => {
    try {
      const result = await OpenFile();
      if (result) {
        const parsed: TeamsFileData = JSON.parse(result.content);
        setPeople(parsed.people ?? []);
        setTeams(parsed.teams ?? []);
        setCurrentFilePath(result.filePath);
        setHasUnsavedChanges(false);
      }
    } catch (err) {
      console.error("Open failed:", err);
    }
  }, []);

  const handleNew = useCallback(async () => {
    if (hasUnsavedChanges) {
      const confirmed = await ConfirmDialog("New", "Discard unsaved changes and start fresh?");
      if (!confirmed) return;
    }
    setPeople([]);
    setTeams([]);
    setCurrentFilePath(null);
    setHasUnsavedChanges(false);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave]);

  const addPerson = useCallback((): string => {
    const id = crypto.randomUUID();
    setPeople(prev => [...prev, { id, name: "", picture: null }]);
    markDirty();
    return id;
  }, [markDirty]);

  const updatePerson = useCallback((id: string, updates: Partial<Person>) => {
    setPeople(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    markDirty();
  }, [markDirty]);

  const deletePerson = useCallback(async (id: string) => {
    const person = people.find(p => p.id === id);
    const confirmed = await ConfirmDialog("Delete Person", `Delete "${person?.name || "this person"}"?`);
    if (!confirmed) return;
    setPeople(prev => prev.filter(p => p.id !== id));
    setTeams(prev => prev.map(t => ({ ...t, memberIds: t.memberIds.filter(mid => mid !== id) })));
    markDirty();
  }, [people, markDirty]);

  const addTeam = useCallback(() => {
    setPeople(prev => prev); // flush
    setTeams(prev => [...prev, { id: crypto.randomUUID(), name: "New Team", memberIds: [] }]);
    markDirty();
  }, [markDirty]);

  const updateTeam = useCallback((id: string, updates: Partial<Team>) => {
    setTeams(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    markDirty();
  }, [markDirty]);

  const deleteTeam = useCallback(async (id: string) => {
    const team = teams.find(t => t.id === id);
    const confirmed = await ConfirmDialog("Delete Team", `Delete team "${team?.name || "this team"}"? People will not be deleted.`);
    if (!confirmed) return;
    setTeams(prev => prev.filter(t => t.id !== id));
    markDirty();
  }, [teams, markDirty]);

  return (
    <div id="TeamMgt">
      <PeoplePanel
        people={people}
        currentFilePath={currentFilePath}
        hasUnsavedChanges={hasUnsavedChanges}
        onAddPerson={addPerson}
        onUpdatePerson={updatePerson}
        onDeletePerson={deletePerson}
        onSave={handleSave}
        onOpen={handleOpen}
        onNew={handleNew}
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
