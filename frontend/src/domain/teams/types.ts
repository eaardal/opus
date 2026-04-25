export interface Person {
  id: string;
  name: string;
  picture: string | null; // base64 data URL
}

export interface Team {
  id: string;
  name: string;
  memberIds: string[];
}

export interface TeamsFileData {
  people: Person[];
  teams: Team[];
}
