/*
  escapeHtml, shared by the server side email builders and the client side
  branding previews. Pure string work with no dependencies, safe on both
  sides. lib/email re-exports it so existing imports keep working.
*/
export function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
