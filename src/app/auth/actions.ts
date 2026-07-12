/*
  Auth server actions. These run on the server, so the Supabase session cookie
  is set server side and never touched by client code. Email plus password for
  the build phase; magic link can come later once Resend and the domain are
  live. See the build notes for that decision.
*/
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { postAuthDestination } from "@/lib/operator-session";

export type AuthState = { error?: string; ok?: string } | undefined;

function readCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  return { email, password };
}

export async function login(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  // Route by who they are: admin to the console, operator to send, a brand new
  // account to onboarding. Avoids the send -> onboarding -> admin bounce.
  redirect(await postAuthDestination(supabase));
}

export async function signup(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  if (!email || !password) {
    return { error: "Enter your email and password." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    return { error: error.message };
  }

  // With "Confirm email" off (the build phase setting) signUp returns a live
  // session and we can go straight in. If confirmation is on, there is no
  // session yet, so ask the operator to check their inbox first.
  if (!data.session) {
    return {
      error: "Check your email to confirm your account, then log in.",
    };
  }

  revalidatePath("/", "layout");
  redirect(await postAuthDestination(supabase));
}

export async function signout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

// Send a password reset link. The link returns to /auth/callback which exchanges
// the code and forwards to /reset-password. The response is always the same
// wording so it never reveals whether an email has an account.
export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Enter your email." };

  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "";
  const origin = `${proto}://${host}`;

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  return {
    ok: "If that email has an account, a reset link is on the way. Check your inbox.",
  };
}

// Set a new password. Called from /reset-password after the recovery link has
// established a session via the callback.
export async function updatePassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "The passwords do not match." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your reset link expired or was opened in another browser. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect(await postAuthDestination(supabase));
}
