ALTER TABLE public.audit_results
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS share_token uuid DEFAULT gen_random_uuid() NOT NULL,
  ADD COLUMN IF NOT EXISTS url text,
  ADD COLUMN IF NOT EXISTS tool text DEFAULT 'audit';

CREATE UNIQUE INDEX IF NOT EXISTS audit_results_share_token_idx ON public.audit_results (share_token);
CREATE INDEX IF NOT EXISTS audit_results_user_id_idx ON public.audit_results (user_id);
