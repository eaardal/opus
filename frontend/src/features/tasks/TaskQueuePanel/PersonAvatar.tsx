import type { Person } from "../../../domain/teams/types";
import { avatarColor } from "../../../lib/avatar";

interface PersonAvatarProps {
  person: Person;
  size: number;
}

export function PersonAvatar({ person, size }: PersonAvatarProps) {
  const initials = person.name.trim() ? person.name.trim()[0].toUpperCase() : "?";
  const baseStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
  };
  return person.picture ? (
    <img style={{ ...baseStyle, objectFit: "cover" }} src={person.picture} alt={person.name} />
  ) : (
    <span
      style={{
        ...baseStyle,
        background: avatarColor(person.id),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.45,
        fontWeight: 600,
        color: "#fff",
      }}
    >
      {initials}
    </span>
  );
}
