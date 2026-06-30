/*
  The roles a person can be tagged with in Settings. On a send the operator just
  checks who was aboard; each person is then credited by their role. Shared by
  the settings roster, the send form, and the server actions so the set never
  drifts.
*/
export const CREW_ROLES = [
  { key: "captain", label: "Captain" },
  { key: "crew", label: "Crew" },
  { key: "naturalist", label: "Naturalist" },
  { key: "photographer", label: "Photographer" },
] as const;

export type CrewRole = (typeof CREW_ROLES)[number]["key"];

export const CREW_ROLE_KEYS: CrewRole[] = CREW_ROLES.map((r) => r.key);

export function isCrewRole(value: string): value is CrewRole {
  return (CREW_ROLE_KEYS as string[]).includes(value);
}

// Severity ranking, highest first. A person is credited on a send exactly once,
// by their highest ranked role, so someone tagged both captain and photographer
// is just "Captain" and is never mentioned twice. Captain beats naturalist
// beats photographer beats crew.
export const ROLE_PRIORITY: CrewRole[] = [
  "captain",
  "naturalist",
  "photographer",
  "crew",
];

// The single role a person is credited as, or null if they carry none.
export function topRole(roles: string[]): CrewRole | null {
  return ROLE_PRIORITY.find((r) => roles.includes(r)) ?? null;
}
