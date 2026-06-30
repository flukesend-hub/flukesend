-- Reply-to email for an operator's outgoing guest emails. Set at onboarding to
-- the email the operator signed up with, so a guest who replies to the white
-- labeled From address reaches the operator's own inbox rather than our send
-- only flukesend.com address. Nullable: when empty, no reply-to header is set.
alter table branding add column reply_to_email text;
