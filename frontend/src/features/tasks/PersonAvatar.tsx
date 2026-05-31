import type { Person } from "../../domain/teams/types";
import { avatarColor } from "../../lib/avatar";

interface PersonAvatarProps {
  person: Person;
  size: number;
}

/**
 * A round avatar for a person: their picture when available, otherwise a
 * coloured circle with the first letter of their name.
 */
export function PersonAvatar({ person, size }: PersonAvatarProps) {
  const initials = person.name.trim() ? person.name.trim()[0].toUpperCase() : "?";
  const style: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    objectFit: "cover" as const,
  };
  return person.picture ? (
    <img style={style} src={person.picture} alt={person.name} />
  ) : (
    <span
      style={{
        ...style,
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
