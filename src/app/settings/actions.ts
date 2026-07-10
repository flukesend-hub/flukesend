/*
  Operator settings actions: retention, review links, roster, team, tips.
  Look and voice (logo, colors, fonts, copy) live on the Branding tab now.
  Writes go through the RLS client because a member is allowed those by
  policy; the few trusted operations use the admin client and say why.
*/
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, escapeHtml } from "@/lib/email";
import { resolveFromAddress } from "@/lib/sender-domain";
import { isCrewRole } from "@/lib/roles";
import { SOCIAL_PLATFORMS, normalizeSocialUrl } from "@/lib/social";
import { normalizeSpecies } from "@/lib/species";
import { TRIP_TIME_SLOTS } from "@/lib/trip-times";
import { CANONICAL_ORIGIN } from "@/lib/base-url";
import { isTipProvider, normalizeTipHandle } from "@/lib/tips";

export type SettingsState =
  | { error?: string; ok?: string; upgrade?: boolean }
  | undefined;


// Resolve the signed in user and the operator they belong to. Bounces to login
// or onboarding if either is missing, so callers can assume both exist.
async function resolveOperator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const { data: membership } = await supabase
    .from("operator_members")
    .select("operator_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    redirect("/onboarding");
  }
  return { supabase, operatorId: membership.operator_id as string };
}

// Look and voice (logo, colors, fonts, copy) moved to the Branding tab; see
// app/branding/actions.ts. Retention stayed here because it is mechanics.
export async function updateRetention(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { supabase, operatorId } = await resolveOperator();

  const retentionRaw = Number(formData.get("retention_days"));
  const retentionDays = Number.isFinite(retentionRaw)
    ? Math.trunc(retentionRaw)
    : NaN;
  if (![3, 5, 7].includes(retentionDays)) {
    return { error: "Pick 3, 5, or 7 days of retention." };
  }

  const { error } = await supabase
    .from("branding")
    .update({ retention_days: retentionDays })
    .eq("operator_id", operatorId);
  if (error) {
    return { error: "Could not save that. Try again." };
  }

  revalidatePath("/settings");
  return { ok: "Retention saved." };
}

// Website and the social links. Each platform maps to one branding column. A
// blank field clears that link; a bare host gets https:// added for the
// operator. The whole save fails with one message if any link cannot be parsed.
export async function updateSocialLinks(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { supabase, operatorId } = await resolveOperator();

  const update: Record<string, string | null> = {};
  for (const platform of SOCIAL_PLATFORMS) {
    const result = normalizeSocialUrl(String(formData.get(platform.key) ?? ""));
    if ("error" in result) {
      return { error: `${platform.label}: ${result.error}` };
    }
    update[platform.column] = result.url;
  }

  const { error } = await supabase
    .from("branding")
    .update(update)
    .eq("operator_id", operatorId);
  if (error) {
    return { error: "Could not save your links. Try again." };
  }

  // The form lives on the Branding tab now; both paths stay fresh.
  revalidatePath("/branding");
  revalidatePath("/settings");
  return { ok: "Links saved." };
}

// The operator's species list, picked from the catalog or typed in. Saved to
// branding.species_options and shown as the pills on the send form.
export async function updateSpecies(species: string[]): Promise<SettingsState> {
  const { supabase, operatorId } = await resolveOperator();
  const clean = normalizeSpecies(species);
  const { error } = await supabase
    .from("branding")
    .update({ species_options: clean })
    .eq("operator_id", operatorId);
  if (error) {
    return { error: "Could not save your species list. Try again." };
  }
  revalidatePath("/settings");
  revalidatePath("/send");
  return { ok: "Species saved." };
}

// The operator's trip departure times, picked from the standard slots. Saved
// to branding.trip_times and shown on both the send form and the guest QR
// form so a guest can only pick a trip the operator actually runs.
export async function updateTripTimes(times: string[]): Promise<SettingsState> {
  const { supabase, operatorId } = await resolveOperator();
  // Keep only valid slots, deduped and in chronological order.
  const clean = TRIP_TIME_SLOTS.filter((slot) => times.includes(slot));
  const { error } = await supabase
    .from("branding")
    .update({ trip_times: clean })
    .eq("operator_id", operatorId);
  if (error) {
    return { error: "Could not save your trip times. Try again." };
  }
  revalidatePath("/settings");
  revalidatePath("/send");
  return { ok: "Trip times saved." };
}

export async function removeLogo(): Promise<void> {
  const { supabase, operatorId } = await resolveOperator();
  const admin = createAdminClient();
  const { data: existing } = await admin.storage
    .from("branding")
    .list(operatorId);
  if (existing && existing.length) {
    await admin.storage
      .from("branding")
      .remove(existing.map((f) => `${operatorId}/${f.name}`));
  }
  await supabase
    .from("branding")
    .update({ logo_url: null })
    .eq("operator_id", operatorId);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

export async function addReviewLink(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { supabase, operatorId } = await resolveOperator();

  const label = String(formData.get("label") ?? "").trim();
  let url = String(formData.get("url") ?? "").trim();

  if (!label) {
    return { error: "Enter a label for the link." };
  }
  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }
  try {
    new URL(url);
  } catch {
    return { error: "Enter a valid URL." };
  }

  // New links go to the end of the list.
  const { data: last } = await supabase
    .from("review_destinations")
    .select("sort_order")
    .eq("operator_id", operatorId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (last?.sort_order ?? -1) + 1;

  const { error } = await supabase
    .from("review_destinations")
    .insert({ operator_id: operatorId, label, url, sort_order: sortOrder });
  if (error) {
    return { error: "Could not add the link. Try again." };
  }

  revalidatePath("/settings");
  return { ok: "Link added." };
}

export async function deleteReviewLink(formData: FormData): Promise<void> {
  const { supabase, operatorId } = await resolveOperator();
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return;
  }
  // RLS already scopes this to the operator; the operator_id match is belt and
  // suspenders.
  await supabase
    .from("review_destinations")
    .delete()
    .eq("id", id)
    .eq("operator_id", operatorId);
  revalidatePath("/settings");
}

// Boats and crew roster. Both are simple named lists scoped to the operator.
// extra lets a caller seed columns beyond name/sort_order (crew uses it to give
// a new person a starting role).
async function addNamed(
  table: "boats" | "crew_members",
  formData: FormData,
  extra: Record<string, unknown> = {},
): Promise<SettingsState> {
  const { supabase, operatorId } = await resolveOperator();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Enter a name." };
  }
  const { data: last } = await supabase
    .from(table)
    .select("sort_order")
    .eq("operator_id", operatorId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (last?.sort_order ?? -1) + 1;
  const { error } = await supabase
    .from(table)
    .insert({ operator_id: operatorId, name, sort_order: sortOrder, ...extra });
  if (error) {
    return { error: "Could not add it. Try again." };
  }
  revalidatePath("/settings");
  revalidatePath("/send");
  return { ok: "Added." };
}

// Replace a crew member's role tags. Roles drive which send dropdown the person
// appears in. Unknown values are dropped so only the four known roles persist.
export async function setCrewRoles(id: string, roles: string[]): Promise<void> {
  const { supabase, operatorId } = await resolveOperator();
  if (!id) {
    return;
  }
  const clean = Array.from(new Set(roles.filter(isCrewRole)));
  await supabase
    .from("crew_members")
    .update({ roles: clean })
    .eq("id", id)
    .eq("operator_id", operatorId);
  revalidatePath("/settings");
  revalidatePath("/send");
}

async function deleteNamed(table: "boats" | "crew_members", formData: FormData) {
  const { supabase, operatorId } = await resolveOperator();
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return;
  }
  await supabase.from(table).delete().eq("id", id).eq("operator_id", operatorId);
  revalidatePath("/settings");
  revalidatePath("/send");
}

// Team invites. A teammate is invited by email and joins under this same
// operator (shared branding, one bill). Invites are owner only, and written with
// the admin client because operator_invites has no client write policy; reads
// use RLS. The join itself lands in the next step.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function resolveMember() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const { data: membership } = await supabase
    .from("operator_members")
    .select("operator_id, role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    redirect("/onboarding");
  }
  return {
    operatorId: membership.operator_id as string,
    userId: user.id,
    isOwner: (membership.role as string) === "owner",
  };
}

export async function createInvite(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { operatorId, userId, isOwner } = await resolveMember();
  if (!isOwner) {
    return { error: "Only the account owner can invite teammates." };
  }
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return { error: "Enter a valid email." };
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("operator_invites")
    .select("id")
    .eq("operator_id", operatorId)
    .ilike("email", email)
    .is("accepted_at", null)
    .maybeSingle();
  if (existing) {
    return { error: "That email is already invited." };
  }

  const { error } = await admin.from("operator_invites").insert({
    operator_id: operatorId,
    email,
    role: "crew",
    created_by: userId,
  });
  if (error) {
    return { error: "Could not create the invite. Try again." };
  }

  // Email the invite. Best effort: the invite already exists, so a mail hiccup
  // must not fail the action. The teammate joins by signing up with this email.
  try {
    const [{ data: op }, { data: brand }] = await Promise.all([
      admin.from("operators").select("name").eq("id", operatorId).maybeSingle(),
      admin.from("branding").select("reply_to_email").eq("operator_id", operatorId).maybeSingle(),
    ]);
    const opName = (op?.name as string) || "your team";
    // Canonical domain, never the inviter's browsing host. See base-url.ts.
    const baseUrl = CANONICAL_ORIGIN;
    // White label the invite like the operator's other emails: from their own
    // sending identity (their verified domain, or their name at flukesend.com),
    // replying to their own inbox.
    const from = await resolveFromAddress(operatorId, opName);
    await sendEmail(
      email,
      `You're invited to join ${opName}`,
      inviteEmailHtml(opName, email, baseUrl),
      from,
      (brand?.reply_to_email as string | null) ?? null,
    );
  } catch (mailErr) {
    console.error(`invite email failed for ${email}: ${String(mailErr)}`);
  }

  revalidatePath("/settings");
  return { ok: "Invited. They join by signing up with this email." };
}

function inviteEmailHtml(opName: string, email: string, baseUrl: string): string {
  const name = escapeHtml(opName);
  const url = escapeHtml(`${baseUrl}/login`);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body style="margin:0;padding:0;background:#ffffff;font-family:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1c2b2e">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:30px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e6e9e8;border-radius:18px;overflow:hidden">
        <tr><td style="padding:30px 28px 6px">
          <h1 style="font-size:23px;line-height:1.25;margin:0 0 14px;color:#16241f">Join the ${name} team</h1>
          <p style="font-size:15px;line-height:1.55;margin:0 0 8px;color:#33464a">You have been added as a team member for ${name}. Create your account with this email address, <strong>${escapeHtml(email)}</strong>, and you can join and start sending trip photos.</p>
        </td></tr>
        <tr><td style="padding:16px 28px 8px">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%"><tr>
            <td align="center" style="border-radius:12px;background:#0b5563">
              <a href="${url}" style="display:block;padding:15px 24px;font-weight:600;font-size:15px;color:#ffffff;text-decoration:none">Create your account</a>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:10px 28px 28px">
          <p style="font-size:12.5px;line-height:1.5;color:#8ba4ac;margin:0">Use the same email this was sent to, then follow the prompt to join ${name}. If you did not expect this, you can ignore it.</p>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;
}

export async function revokeInvite(formData: FormData): Promise<void> {
  const { operatorId, isOwner } = await resolveMember();
  if (!isOwner) {
    return;
  }
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return;
  }
  const admin = createAdminClient();
  await admin
    .from("operator_invites")
    .delete()
    .eq("id", id)
    .eq("operator_id", operatorId);
  revalidatePath("/settings");
}

export async function addBoat(_prev: SettingsState, formData: FormData) {
  // Boats are unlimited on every plan, so there is no gate here anymore.
  return addNamed("boats", formData);
}
export async function deleteBoat(formData: FormData) {
  return deleteNamed("boats", formData);
}
export async function addCrew(_prev: SettingsState, formData: FormData) {
  // A new person starts with no roles; the operator tags what they do.
  return addNamed("crew_members", formData, { roles: [] });
}
export async function deleteCrew(formData: FormData) {
  return deleteNamed("crew_members", formData);
}

// ---- Photographer tip jar ----

// The operator level switch: tipping allowed, yes or no. Owner only, since it is
// a policy decision. The existing operators update policy is any-member, so the
// owner check is enforced here and the write goes through the admin client.
export async function setTipsEnabled(enabled: boolean): Promise<SettingsState> {
  const { operatorId, isOwner } = await resolveMember();
  if (!isOwner) {
    return { error: "Only the account owner can change this." };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("operators")
    .update({ tips_enabled: enabled })
    .eq("id", operatorId);
  if (error) {
    return { error: "Could not save that. Try again." };
  }
  revalidatePath("/settings");
  return { ok: enabled ? "Tips are on." : "Tips are off." };
}

// Whether the gallery also asks for a review under the tip. Owner only, and only
// meaningful while tips are on. Off means the tip is the single ask.
export async function setTipsShowReview(enabled: boolean): Promise<SettingsState> {
  const { operatorId, isOwner } = await resolveMember();
  if (!isOwner) {
    return { error: "Only the account owner can change this." };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("operators")
    .update({ tips_show_review: enabled })
    .eq("id", operatorId);
  if (error) {
    return { error: "Could not save that. Try again." };
  }
  revalidatePath("/settings");
  return { ok: "Saved." };
}

// A photographer's own tip link and display name. Scoped to the caller's own
// membership row (user_id = auth.uid()); it only ever writes the tip columns, so
// there is no way to touch role or another person's link. Blank clears it.
export async function updateMyTipLink(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { operatorId, userId } = await resolveMember();

  const displayName = String(formData.get("display_name") ?? "").trim().slice(0, 60) || null;
  const providerRaw = String(formData.get("tip_provider") ?? "").trim();
  const handleRaw = String(formData.get("tip_handle") ?? "");
  const handle = normalizeTipHandle(handleRaw);

  // Clearing: no handle means no link, whatever the provider says.
  if (!handle) {
    const admin = createAdminClient();
    const { error } = await admin
      .from("operator_members")
      .update({ display_name: displayName, tip_provider: null, tip_handle: null })
      .eq("operator_id", operatorId)
      .eq("user_id", userId);
    if (error) return { error: "Could not save. Try again." };
    revalidatePath("/settings");
    return { ok: "Saved. Your tip link is cleared." };
  }

  if (!isTipProvider(providerRaw)) {
    return { error: "Pick where tips should go." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("operator_members")
    .update({ display_name: displayName, tip_provider: providerRaw, tip_handle: handle })
    .eq("operator_id", operatorId)
    .eq("user_id", userId);
  if (error) return { error: "Could not save. Try again." };
  revalidatePath("/settings");
  return { ok: "Saved. Your tip link is set." };
}
