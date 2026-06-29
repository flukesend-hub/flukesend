/*
  Transfers is now a drawer opened from the nav, not a standalone page, so the
  old /dashboard route just sends people to the New send home. Any old links or
  bookmarks still land somewhere sensible.
*/
import { redirect } from "next/navigation";

export default function DashboardPage() {
  redirect("/send");
}
