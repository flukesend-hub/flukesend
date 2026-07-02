-- Delivery visibility. resend_email_id is the id of the most recent email
-- sent to this recipient (gallery delivery, resend, or review ask); the
-- Resend webhook matches events back by it. email_status is what happened
-- to that email: delivered, bounced, or complained. Bounce and complaint
-- are sticky over delivered so a bad address stays visible.
alter table recipients add column if not exists resend_email_id text;
alter table recipients add column if not exists email_status text;
alter table recipients add column if not exists email_status_at timestamptz;
create index if not exists recipients_resend_email_id_idx
  on recipients (resend_email_id) where resend_email_id is not null;
