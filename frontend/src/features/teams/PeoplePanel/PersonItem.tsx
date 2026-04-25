import { useRef, useState, useEffect } from "react";
import "./PersonItem.css";
import type { Person } from "../../../domain/teams/types";
import { avatarColor } from "../../../lib/avatar";
import { resizeDataUrlImage } from "../../../lib/imageResize";

interface PersonItemProps {
  person: Person;
  onUpdate: (updates: Partial<Person>) => void;
  onDelete: () => void;
  focusOnMount?: boolean;
  onAddAfter?: () => void;
}

export function PersonItem({
  person,
  onUpdate,
  onDelete,
  focusOnMount,
  onAddAfter,
}: PersonItemProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [editName, setEditName] = useState(person.name);
  const initials = person.name.trim() ? person.name.trim()[0].toUpperCase() : "?";

  useEffect(() => {
    if (focusOnMount) inputRef.current?.focus();
  }, [focusOnMount]);

  useEffect(() => {
    setEditName(person.name);
  }, [person.name]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = async () => {
      const resized = await resizeDataUrlImage(reader.result as string);
      onUpdate({ picture: resized });
    };
    reader.readAsDataURL(file);
  };

  const commitName = () => {
    if (editName !== person.name) onUpdate({ name: editName });
  };

  return (
    <div className="person-item">
      <button
        className="person-avatar-btn"
        onClick={() => fileInputRef.current?.click()}
        title="Click to change photo"
      >
        {person.picture ? (
          <img className="person-avatar-img" src={person.picture} alt={person.name} />
        ) : (
          <span className="person-avatar-initials" style={{ background: avatarColor(person.id) }}>
            {initials}
          </span>
        )}
        <span className="person-avatar-overlay">✎</span>
      </button>
      <input
        ref={inputRef}
        className="person-name-input"
        value={editName}
        placeholder="Name..."
        onChange={(e) => setEditName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.shiftKey) {
            e.preventDefault();
            commitName();
            onAddAfter?.();
          } else if (e.key === "Enter") {
            commitName();
            inputRef.current?.blur();
          }
        }}
      />
      {person.picture && (
        <button
          className="person-clear-pic-btn"
          onClick={() => onUpdate({ picture: null })}
          title="Remove photo"
        >
          ✕
        </button>
      )}
      <button className="person-delete-btn" onClick={onDelete} title="Delete person">
        ×
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
    </div>
  );
}
