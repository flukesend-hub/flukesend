-- Expiring-soon reminder bookkeeping: stamped when the one nudge email goes
-- out to a guest who has not downloaded, so nobody is ever reminded twice.
alter table recipients add column if not exists reminder_sent_at timestamptz;
