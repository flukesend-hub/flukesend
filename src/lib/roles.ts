/*
  The crew roles a person can be tagged with in Settings. Each role becomes a
  picker on the send form: captain, naturalist, and photographer are single
  choice; crew is multiple. Shared by the settings roster, the send form, and
  the server actions so the set never drifts.
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
