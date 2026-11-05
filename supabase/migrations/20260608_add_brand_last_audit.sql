-- Persist the latest content-audit result for cross-device access
alter table public.brand_profiles
  add column if not exists last_audit jsonb;
