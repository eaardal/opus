export const AVATAR_COLORS = [
  "#aaabf5",
  "#eda2c7",
  "#f0c781",
  "#84c3ae",
  "#85a7dd",
  "#b49aef",
  "#99c8d1",
];

export function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
