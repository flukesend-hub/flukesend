/*
  Shared circular avatar for crew faces: the crew row in the review email and
  the tip bubble on the gallery. Shows the person's photo when there is one,
  otherwise their initial on a deterministic colored circle, so a missing photo
  is never a broken image. Client-safe: pure strings, no server-only imports.
*/
import { escapeHtml } from "@/lib/html";

// A small palette of calm, legible circle colors, picked by a stable hash of
// the name so the same person always gets the same color.
const AVATAR_COLORS = [
  "#2f6f8f", "#3a7d5d", "#8a5a3c", "#5a4b8a",
  "#9a6a2f", "#7a3b4e", "#3d6b6b", "#5f6b2f",
];

export function avatarInitials(name: string): string {
  const n = (name ?? "").trim();
  return n ? n[0].toUpperCase() : "?";
}

export function avatarColor(name: string): string {
  const n = (name ?? "").trim().toLowerCase();
  let h = 0;
  for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// A circular avatar as an inline HTML string, for the emails. Photo when set,
// otherwise the initial on a colored circle. line-height centers the initial
// vertically, which is the one trick that survives every mail client.
export function crewAvatarHtml(name: string, photoUrl: string | null, size = 48): string {
  const s = Math.round(size);
  if (photoUrl) {
    return `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(name)}" width="${s}" height="${s}" style="width:${s}px;height:${s}px;border-radius:50%;object-fit:cover;display:inline-block;border:0" />`;
  }
  return `<div style="width:${s}px;height:${s}px;border-radius:50%;background:${avatarColor(name)};color:#ffffff;text-align:center;line-height:${s}px;font-size:${Math.round(s * 0.42)}px;font-weight:600;font-family:'Inter',system-ui,sans-serif;display:inline-block">${escapeHtml(avatarInitials(name))}</div>`;
}
