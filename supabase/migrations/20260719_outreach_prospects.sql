-- Outreach agent — prospect state machine.
--
-- One row per target. The outreach engine advances `status` through:
--   new → preparing → ready_for_review → approved → sent
--         (→ failed on error, → stopped on opt-out/reply/convert)
--
-- Phase 1 stops at ready_for_review (agent picks the best audit, runs it, drafts
-- the email). A human approves each send (status → approved → sent) via
-- POST /api/outreach/[id]/approve. Follow-up sequencing (step > 0) is Phase 3 and
-- reuses next_action_at as the cron cursor.

create table if not exists outreach_prospects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  email text not null,
  domain text not null,
  contact_name text,

  status text not null default 'new',        -- see state machine above
  chosen_audit text,                          -- 'content' | 'geo' | 'ao'
  audit_reason text,                          -- why the picker chose it (for review)

  audit_result_id uuid references audit_results(id) on delete set null,
  share_token uuid,                           -- powers the /report/<token> link in the email

  draft_subject text,
  draft_html text,

  ghl_contact_id text,
  step int not null default 0,                -- emails sent so far (0 = none)
  next_action_at timestamptz,                 -- when the sequencer should next touch this row
  sent_at timestamptz,
  last_error text,

  unique (email)
);

create index if not exists outreach_prospects_status_idx on outreach_prospects (status);
create index if not exists outreach_prospects_next_action_idx on outreach_prospects (next_action_at);

-- No RLS policies: this table is owner-only and touched exclusively by the
-- service-role client from server routes (mirrors how audit_results is written).
alter table outreach_prospects enable row level security;
