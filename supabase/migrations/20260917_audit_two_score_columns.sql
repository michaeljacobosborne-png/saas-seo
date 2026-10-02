-- Phase B: promoted columns for the two-score model.
--
-- The full report still lives in audit_results.result (JSONB). These columns
-- duplicate two values out of it so they can be indexed and aggregated.
--
-- Added NOW rather than retrofitted because the peer-benchmark feature ("median
-- of the last 10,000 URLs we scanned") needs to aggregate across rows, and
-- computing a median over a JSONB path across a growing table gets expensive
-- fast. One column each costs nothing today and is painful to backfill later.
--
-- Nullable by design: rows written before this migration have no values, and a
-- withheld score legitimately has no retrievability number.

alter table public.audit_results
  add column if not exists retrievability_score integer,
  add column if not exists citability_band text;

-- Bands are a closed set. A CHECK keeps a typo from silently becoming a new band.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'audit_results_citability_band_check'
  ) then
    alter table public.audit_results
      add constraint audit_results_citability_band_check
      check (citability_band is null or citability_band in ('strong','adequate','weak','absent','unverified'));
  end if;
end $$;

-- Range guard: the score is a normalised 0-100 integer or nothing at all.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'audit_results_retrievability_score_check'
  ) then
    alter table public.audit_results
      add constraint audit_results_retrievability_score_check
      check (retrievability_score is null or (retrievability_score between 0 and 100));
  end if;
end $$;

-- Supports the peer benchmark and the monthly re-run delta, both of which read
-- recent rows for one tool.
create index if not exists audit_results_retrievability_idx
  on public.audit_results (tool, created_at desc)
  where retrievability_score is not null;

comment on column public.audit_results.retrievability_score is
  'Promoted from result->retrievability->score. Deterministic 0-100. NULL when withheld.';
comment on column public.audit_results.citability_band is
  'Promoted from result->citability->band. strong|adequate|weak|absent|unverified.';
