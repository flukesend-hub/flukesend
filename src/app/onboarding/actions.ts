/*
  Operator onboarding. Creating an operator is the one write the schema does not
  expose to the client: there is no insert policy on operators, on purpose, so a
  fresh user cannot mint tenants from the browser. So this runs server side with
  the service role (the admin client), which bypasses RLS.

  We still take the user identity from the signed in server session, never from
  the form, and we only ever write rows tied to that user.
*/
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadOperatorLogo } from "@/lib/logo-upload";

export type SetupState = { error: string } | undefined;

const HEX = /^#[0-9a-fA-F]{6}$/;

export async function createOperator(
  _prev: SetupState,
  formData: FormData,
): Promise<SetupState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const name = String(formData.get("name") ?? "").trim();
  const brandColor = (
    String(formData.get("brand_color") ?? "").trim() || "#0b5563"
  ).toLowerCase();
  const defaultMessage = String(formData.get("default_message") ?? "").trim();
  const retentionRaw = Number(formData.get("retention_days"));

  if (!name) {
    return { error: "Enter your operation's name." };
  }
  if (!HEX.test(brandColor)) {
    return { error: "Pick a valid brand color." };
  }
  const retentionDays = Number.isFinite(retentionRaw)
    ? Math.trunc(retentionRaw)
    : NaN;
  // The setup form offers 3, 5, or 7 days. The DB enforces a 3 to 10 floor/ceiling
  // on the base plan too; we check here for a friendly message.
  if (![3, 5, 7].includes(retentionDays)) {
    return { error: "Pick 3, 5, or 7 days of retention." };
  }

  const admin = createAdminClient();

  // Do not let a user who already belongs to an operator create a second one.
  const { data: existing } = await admin
    .from("operator_members")
    .select("operator_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) {
    redirect("/send");
  }

  // operator, then membership, then branding. These are three statements, not
  // one transaction, so if a later step fails we delete the operator to avoid an
  // orphan. operator_members and branding both cascade on operator delete, so
  // removing the operator cleans up whatever did land.
  const { data: operator, error: opError } = await admin
    .from("operators")
    .insert({ name })
    .select("id")
    .single();
  if (opError || !operator) {
    return { error: "Could not create your operator. Try again." };
  }

  const { error: memberError } = await admin
    .from("operator_members")
    .insert({ operator_id: operator.id, user_id: user.id, role: "owner" });
  if (memberError) {
    await admin.from("operators").delete().eq("id", operator.id);
    return { error: "Could not link your account. Try again." };
  }

  // Logo is optional here: operators can add it now or later in Settings.
  const upload = await uploadOperatorLogo(operator.id, formData.get("logo"));
  if (!upload.ok) {
    await admin.from("operators").delete().eq("id", operator.id);
    return { error: upload.error };
  }

  const { error: brandError } = await admin.from("branding").insert({
    operator_id: operator.id,
    brand_color: brandColor,
    default_message: defaultMessage,
    retention_days: retentionDays,
    logo_url: upload.logoUrl,
    // Guest replies route here: the email the operator signed up with.
    reply_to_email: user.email ?? null,
  });
  if (brandError) {
    await admin.from("operators").delete().eq("id", operator.id);
    return { error: "Could not save your branding. Try again." };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

// Accept a team invite: bind the signed in user to the inviting operator instead
// of creating their own. Guarded server side: the invite must be pending and its
// email must match the signed in user's own email, so only the person who
// controls that address (and proved it by authenticating) can join. A user who
// already belongs to an operator is not given a second membership.
export async function acceptInvite(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const inviteId = String(formData.get("inviteId") ?? "");
  if (!inviteId) {
    redirect("/onboarding");
  }

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("operator_invites")
    .select("id, operator_id, email, role, accepted_at")
    .eq("id", inviteId)
    .maybeSingle();
  const email = (user.email ?? "").trim().toLowerCase();
  if (
    !invite ||
    invite.accepted_at ||
    (invite.email as string).trim().toLowerCase() !== email
  ) {
    redirect("/onboarding");
  }

  // One login belongs to one operator. If they already have one, do not stack a
  // second membership; just send them into the app.
  const { data: existing } = await admin
    .from("operator_members")
    .select("operator_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) {
    redirect("/send");
  }

  const { error: memberError } = await admin.from("operator_members").insert({
    operator_id: invite.operator_id,
    user_id: user.id,
    role: (invite.role as string) || "member",
  });
  if (memberError) {
    redirect("/onboarding");
  }
  await admin
    .from("operator_invites")
    .update({ accepted_at: new Date().toISOString(), accepted_by: user.id })
    .eq("id", invite.id);

  revalidatePath("/", "layout");
  redirect("/send");
}
