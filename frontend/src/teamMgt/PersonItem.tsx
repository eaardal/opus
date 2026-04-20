import { useRef, useState, useEffect } from "react";
import "./PersonItem.css";
import { Person } from "./types";

const AVATAR_COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#06b6d4"];

function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

async function resizeImage(dataUrl: string, maxPx = 200): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.src = dataUrl;
  });
}

interface PersonItemProps {
  person: Person;
  onUpdate: (updates: Partial<Person>) => void;
  onDelete: () => void;
}

export function PersonItem({ person, onUpdate, onDelete }: PersonItemProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [editName, setEditName] = useState(person.name);
  const initials = person.name.trim() ? person.name.trim()[0].toUpperCase() : "?";

  useEffect(() => {
    setEditName(person.name);
  }, [person.name]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = async () => {
      const resized = await resizeImage(reader.result as string);
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
        onKeyDown={(e) => { if (e.key === "Enter") { commitName(); inputRef.current?.blur(); } }}
      />
      {person.picture && (
        <button className="person-clear-pic-btn" onClick={() => onUpdate({ picture: null })} title="Remove photo">
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
